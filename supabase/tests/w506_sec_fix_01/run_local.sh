#!/usr/bin/env bash
# WP05-W506-SEC-FIX-01 -- isolated LOCAL verification. Never point this at production or any shared database:
# it creates and drops a scratch database named w506_sec_fix_01_test on the server given by PGHOST/PGPORT/PGUSER
# (default: local socket, superuser). Requires psql + a throwaway local PostgreSQL 14+ (tested on 16.15).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261109040000_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql"
RB="$ROOT/docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql"
DB=w506_sec_fix_01_test; FAIL=0
P="psql -X -q -v ON_ERROR_STOP=1 -At"
case "${PGHOST:-}" in ""|/*|localhost|127.0.0.1) ;; *) echo "refusing non-local PGHOST=$PGHOST"; exit 2;; esac
$P -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 2
q() { $P -d $DB "$@"; }
ok()  { echo "PASS  $1"; }
bad() { echo "FAIL  $1  $2"; FAIL=1; }
SRC_FP="select md5(prosrc) from pg_proc where oid='costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure"

q -f "$HERE/fixture.sql" >/dev/null || { echo "fixture failed"; exit 2; }
ORIG_FP=$(q -c "$SRC_FP")

# T0 failing-before: on the unguarded synthetic function an identity with NO grants can write through the wrapper
OUT=$(q -c "set local role authenticated" -c "select 1" 2>&1 >/dev/null; q <<'SQL' 2>&1
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
select public.rpc_set_staff_costing_classification(901,'OPERATIONS','POOL',date '2026-11-01',1,'baseline'); rollback;
SQL
)
echo "$OUT" | grep -q '"ok": true' && ok "T0 baseline (unguarded fixture): ID-N write succeeds -> reproduces the finding on the fixture" || bad "T0 baseline" "$OUT"

# T1 drift precondition: the UNMODIFIED migration (real live fingerprint) must abort against the synthetic body and leave it unchanged
OUT=$(q -f "$MIG" 2>&1); RC=$?
if [ $RC -ne 0 ] && echo "$OUT" | grep -q "fingerprint" && [ "$(q -c "$SRC_FP")" = "$ORIG_FP" ]; then ok "T1 drift: migration aborts closed on fingerprint mismatch, body unchanged"; else bad "T1 drift" "$OUT"; fi

# Test-only substitution of the recorded live fingerprint by the synthetic body's fingerprint
sed "s/553d103a5afedda3191c1aa62c33be7c/$ORIG_FP/" "$MIG" > /tmp/w506_mig_local.sql
sed "s/553d103a5afedda3191c1aa62c33be7c/$ORIG_FP/" "$RB"  > /tmp/w506_rb_local.sql
grep -q "$ORIG_FP" /tmp/w506_mig_local.sql || { bad "substitution" "fingerprint literal not found"; exit 1; }

# T2 apply, T3 matrix
OUT=$(q -f /tmp/w506_mig_local.sql 2>&1) && ok "T2 migration applies to fingerprint-matched fixture" || bad "T2 apply" "$OUT"
q -v guarded=on -f "$HERE/matrix.sql" > /tmp/w506_matrix.out 2>&1; cat /tmp/w506_matrix.out
grep -q "FAILURES=0 OF" /tmp/w506_matrix.out && ok "T3 identity matrix (all rows PASS)" || bad "T3 identity matrix" "see rows above"

# T4 idempotent re-run
OUT=$(q -f /tmp/w506_mig_local.sql 2>&1); H1=$(q -c "$SRC_FP")
echo "$OUT" | grep -q "already guarded" && ok "T4 re-apply is a no-op notice" || bad "T4 idempotent" "$OUT"
GUARDED_FP=$H1

# T5 rollback restores the original body exactly, then re-apply gives the identical guarded body
OUT=$(q -f /tmp/w506_rb_local.sql 2>&1) && [ "$(q -c "$SRC_FP")" = "$ORIG_FP" ] && ok "T5 rollback restores original fingerprint" || bad "T5 rollback" "$OUT"
q -f /tmp/w506_mig_local.sql >/dev/null 2>&1; [ "$(q -c "$SRC_FP")" = "$GUARDED_FP" ] && ok "T6 re-apply after rollback reproduces identical guarded body" || bad "T6 reapply" ""

# T7 unexpected shape (no BEGIN / existing guard variants) must abort
q -c "create or replace function costing.rpc_set_staff_costing_classification(p_staff_id bigint,p_costing_class text,p_allocation_pool text,p_effective_from date,p_allocation_weight numeric,p_remarks text) returns jsonb language sql security definer set search_path = costing, public, pg_temp as \$\$ select '{}'::jsonb \$\$" >/dev/null
NEWFP=$(q -c "$SRC_FP"); sed "s/553d103a5afedda3191c1aa62c33be7c/$NEWFP/" "$MIG" > /tmp/w506_mig_shape.sql
OUT=$(q -f /tmp/w506_mig_shape.sql 2>&1); RC=$?
[ $RC -ne 0 ] && echo "$OUT" | grep -q "no BEGIN" && ok "T7 body without BEGIN: aborts closed" || bad "T7 shape" "$OUT"

q -d postgres -c "select 1" >/dev/null; $P -d postgres -c "drop database $DB" >/dev/null
[ $FAIL -eq 0 ] && echo "ALL LOCAL CHECKS PASSED" || echo "SOME CHECKS FAILED"; exit $FAIL
