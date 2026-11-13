#!/usr/bin/env bash
# PEC R10 SAFE-resync concurrency + collision harness (disposable Postgres only).
# Usage: concurrency-harness.sh <guarded|legacy|r9proto>
#   guarded  = new R10 migration (collision guard + lock order)
#   legacy   = 20261112143000 as-is (negative control)
#   r9proto  = #385 prototype: collision guard, NO locks (negative control)
# Env: PGHOST PGPORT PGUSER [PGPASSWORD]. Creates/drops database pec_r10_<source>.
# Ordering uses an advisory-lock barrier (id 777) plus polling pg_stat_activity wait
# events; no sleep is relied upon for ordering. Prints "RESULT <id> PASS|FAIL ...".
set -u
SRC=${1:?source}; ROOT=$(cd "$(dirname "$0")/../.." && pwd)
MIG=$ROOT/supabase/migrations
DB=pec_r10_$SRC
export PGOPTIONS='-c client_min_messages=warning'
P() { psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
PA() { local app=$1; shift; PGAPPNAME=$app psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB" || exit 2
lf() { tr -d '\r' < "$1"; }
P -f "$ROOT/scripts/pec-r10/fixture-schema.sql" >/dev/null
# real function sources
awk '/CREATE OR REPLACE FUNCTION public.proc_indent_add_line_pec_internal/{f=1} f{print} f&&/^\$function\$;/{exit}' <(lf $MIG/20261112122500_pec_revision_and_manual_indent_internal_guard.sql) > /tmp/r10_addline_internal.$$.sql
P -f /tmp/r10_addline_internal.$$.sql >/dev/null || { echo "failed to load internal add_line"; exit 2; }
lf $MIG/20261112133000_pec_manual_pr_internal_item_guards.sql | P >/dev/null   # original PR writers
lf $MIG/20261112143000_pec_safe_resync_preserve_manual_lines.sql | P >/dev/null  # original resync
case $SRC in
  legacy) ;;
  r9proto) lf "$ROOT/scripts/pec-g0-safe-collision-proposed-function.sql" | P >/dev/null ;;
  guarded) lf $(ls $MIG/*_pec_safe_resync_collision_guard_lock_order.sql | head -1) | P >/dev/null ;;
  *) echo bad source; exit 2;;
esac
lf "$ROOT/scripts/pec-r10/addline-wrapper-374-e252277.sql" | P >/dev/null   # guarded Add Line wrapper (#374)

FAILS=0
res() { echo "RESULT $1 $2 $3"; [ "$2" = PASS ] || FAILS=$((FAILS+1)); }
seed() { P -c "select public.fx_seed()" >/dev/null; }
q() { P -c "$1"; }
expect_err() { # expect_err <sqlstate> <sql> -> prints OK or BAD
  P -c "DO \$\$ BEGIN BEGIN $2; RAISE EXCEPTION 'NOERR' USING ERRCODE='ZX001'; EXCEPTION WHEN OTHERS THEN IF SQLSTATE='$1' THEN RETURN; END IF; RAISE EXCEPTION 'got % %',SQLSTATE,SQLERRM; END; END \$\$" >/dev/null 2>&1 && echo OK || echo BAD
}
# ---- barrier helpers
ctl_hold() { PGAPPNAME=ctl psql -X -q -At -d "$DB" -c "select pg_advisory_lock(777); select pg_sleep(3600)" >/dev/null 2>&1 & CTL=$!
  for _ in $(seq 200); do [ "$(q "select count(*) from pg_locks where locktype='advisory' and granted and objid=777")" = 1 ] && return 0; sleep 0.05; done; return 1; }
ctl_release() { q "select pg_terminate_backend(pid) from pg_stat_activity where application_name='ctl'" >/dev/null; wait $CTL 2>/dev/null; }
wait_wait() { # wait_wait <app> <sqlcond on wait_event> -> 0 when blocked
  for _ in $(seq 120); do [ "$(q "select count(*) from pg_stat_activity where application_name='$1' and wait_event_type='Lock' and $2")" -ge 1 ] && return 0; sleep 0.05; done; return 1; }
A_ADV="wait_event='advisory'"; B_ROW="wait_event in ('transactionid','tuple')"
OUT=$(mktemp -d)
bg() { local app=$1 sql=$2 tag=$3; PGAPPNAME=$app psql -X -q -At -d "$DB" -c "$sql" >"$OUT/$tag.out" 2>"$OUT/$tag.err" & echo $! >"$OUT/$tag.pid"; }
finish() { wait "$(cat $OUT/$1.pid)"; echo $? >"$OUT/$1.rc"; }

# ============ single-session semantics ============
seed
before=$(q "select public.fx_state_md5(1)")
r=$(expect_err 23514 "PERFORM public.proc_indent_resync_from_pr_pec_internal(1,'safe')")
[ "$r" = OK ] && [ "$(q "select public.fx_state_md5(1)")" = "$before" ] && res S1 PASS "qty collision 23514, state identical" || res S1 FAIL "qty collision not rejected or state mutated"
q "update proc_indent_line set requested_qty=4 where indent_line_id=104" >/dev/null; before=$(q "select public.fx_state_md5(1)")
r=$(expect_err 23514 "PERFORM public.proc_indent_resync_from_pr_pec_internal(1,'safe')")
[ "$r" = OK ] && [ "$(q "select public.fx_state_md5(1)")" = "$before" ] && res S2 PASS "same qty, different reason rejected, state identical" || res S2 FAIL "reason-only collision not rejected"
seed; before=$(q "select public.fx_state_md5(6)")
r=$(expect_err 23514 "PERFORM public.proc_indent_resync_from_pr_pec_internal(6,'safe')")
[ "$r" = OK ] && [ "$(q "select public.fx_state_md5(6)")" = "$before" ] && res S3a PASS "NULL reason is not a bypass" || res S3a FAIL "NULL reason bypassed collision"
# normalization: whitespace/empty reasons equal NULL on both sides => no collision
seed; q "update proc_pr_line set manual_reason='   ' where pr_line_id=1003; update proc_indent_line set requested_qty=4, manual_reason='' where indent_line_id=104" >/dev/null
r=$(expect_err 00000 "PERFORM public.proc_indent_resync_from_pr_pec_internal(1,'safe')")
q "select 1" >/dev/null
ok=$(P -c "begin; select public.proc_indent_resync_from_pr_pec_internal(1,'safe'); select (select count(*) from proc_pr_indent_line_map where indent_line_id=104)=1; rollback;" 2>/dev/null | tail -1)
[ "$ok" = t ] && res S3b PASS "''/whitespace normalize to NULL, equal => adopted" || res S3b FAIL "normalized-equal reasons rejected: $ok"
seed; q "update proc_indent_line set requested_qty=4, manual_reason='' where indent_line_id=104" >/dev/null
r=$(expect_err 23514 "PERFORM public.proc_indent_resync_from_pr_pec_internal(1,'safe')")
[ "$r" = OK ] && res S3c PASS "empty reason vs PR reason differs => rejected" || res S3c FAIL "empty vs non-empty not rejected"
# adopt + independent + idempotence
seed; q "update proc_indent_line set requested_qty=4, manual_reason='PR 13' where indent_line_id=104" >/dev/null
q "select public.proc_indent_resync_from_pr_pec_internal(1,'safe')" >/dev/null
h1=$(q "select public.fx_state_md5(1)"); q "select public.proc_indent_resync_from_pr_pec_internal(1,'safe')" >/dev/null
v=$(q "select (select requested_qty from proc_indent_line where indent_id=1 and stock_item_id=80)=7 and (select count(*) from proc_pr_indent_line_map where indent_id=1)=3 and not exists(select 1 from proc_indent_line where indent_id=1 and stock_item_id in (12,91,99)) and exists(select 1 from proc_indent_line where indent_id=1 and stock_item_id=14 and requested_qty=2) and not exists(select 1 from proc_pr_indent_line_map m join proc_indent_line l using(indent_line_id) where m.indent_id=1 and l.stock_item_id=80)")
[ "$v" = t ] && res S4 PASS "matching line adopted, independent manual retained, no map for it" || res S4 FAIL "SAFE success semantics wrong"
q "select public.proc_indent_resync_from_pr_pec_internal(1,'safe')" >/dev/null
q "select (select count(*) from proc_indent_line where indent_id=1)=4 and (select count(*) from proc_pr_indent_line_map where indent_id=1)=3 and (select count(*) from proc_pr_to_indent_map where indent_id=1 and is_active)=1" | grep -q t && res S5 PASS "repeat SAFE idempotent (links/maps/lines stable)" || res S5 FAIL "repeat SAFE not idempotent"
# mapped stale line is PR-derived => overwritten
seed; q "select public.proc_indent_resync_from_pr_pec_internal(7,'safe')" >/dev/null
q "select 1" >/dev/null
seed; q "update proc_indent_line set requested_qty=4, manual_reason='PR 13' where indent_line_id=104" >/dev/null; q "select public.proc_indent_resync_from_pr_pec_internal(1,'safe')" >/dev/null
q "select (select requested_qty from proc_indent_line where indent_line_id=101)=5 and (select manual_reason from proc_indent_line where indent_line_id=101)='PR 11'" | grep -q t && res S6 PASS "mapped (PR-derived) stale line refreshed from PR" || res S6 FAIL "mapped line not refreshed"
# RESET unchanged: destructive even with a collision
seed; q "select public.proc_indent_resync_from_pr_pec_internal(2,'reset')" >/dev/null
q "select (select count(*) from proc_indent_line where indent_id=2)=3 and not exists(select 1 from proc_indent_line where indent_id=2 and stock_item_id in (80,91,99,12))" | grep -q t && res S7 PASS "RESET still destructive (collision not blocking)" || res S7 FAIL "RESET behaviour changed"
# denied operations never mutate
seed; ok=1
for t in "3,'safe'" "4,'safe'" "5,'safe'" "1,'bogus'"; do
  i=${t%%,*}; b=$(q "select public.fx_state_md5($i)"); expect_err 00000 "PERFORM public.proc_indent_resync_from_pr_pec_internal($t)" >/dev/null
  [ "$(q "select public.fx_state_md5($i)")" = "$b" ] || ok=0
done
q "select count(*) from proc_indent_line where indent_id=3" | grep -q 2 || ok=0
[ $ok = 1 ] && res S8 PASS "approved/no-PR/PR-not-active/invalid-mode denials mutate nothing" || res S8 FAIL "denied resync mutated state"
b=$(q "select public.fx_state_md5(1)"); r=$(expect_err 23514 "PERFORM public.proc_indent_add_line(1,1,55,1,3,'x')"); [ "$r" = OK ] && [ "$(q "select public.fx_state_md5(1)")" = "$b" ] && res S9 PASS "Add Line wrapper new-row denial on PR-linked indent: 23514, no mutation" || res S9 FAIL "wrapper guard regression"

# ============ concurrency ============
# T1: manual edit vs in-flight SAFE resync must serialize; no lost manual edit.
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV" || res T1 FAIL "resync never reached barrier"
bg sess_B "select public.proc_indent_add_line(9,1,13,1,9,'manual 9')" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
v=$(q "select (select requested_qty from proc_indent_line where indent_line_id=902)=9 and (select manual_reason from proc_indent_line where indent_line_id=902)='manual 9'")
if [ $blocked = 1 ] && [ "$v" = t ] && [ "$(cat $OUT/A.rc)" = 0 ] && [ "$(cat $OUT/B.rc)" = 0 ]; then res T1 PASS "edit blocked behind resync, applied after; no lost update"
else res T1 FAIL "blocked=$blocked final_edit_kept=$v rcA=$(cat $OUT/A.rc) rcB=$(cat $OUT/B.rc) (unserialized => manual edit lost or overwritten)"; fi
# T2: PR status flip must wait for in-flight resync's PR-header share lock.
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV"
bg sess_B "update proc_pr_header set status='superseded' where pr_id=100" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(q "select status from proc_pr_header where pr_id=100")" = superseded ] && [ "$(q "select count(*) from proc_pr_indent_line_map where indent_id=9")" = 3 ] && res T2 PASS "PR status change waits for resync" || res T2 FAIL "PR header not locked during resync (blocked=$blocked)"
# T3: PR line editor holding PR header; resync of an indent of that PR must wait, then see committed PR-final.
seed; ctl_hold
bg sess_A "select public.fx_pr_edit_pause_activate(2001,4)" A
for _ in $(seq 400); do [ "$(q "select count(*) from pg_stat_activity where application_name='sess_A' and wait_event='advisory'")" -ge 1 ] && break; sleep 0.05; done
bg sess_B "select public.proc_indent_resync_from_pr_pec_internal(5,'safe')" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(cat $OUT/B.rc)" = 0 ] && [ "$(q "select requested_qty from proc_indent_line where indent_id=5 and stock_item_id=11")" = 7.000000 -o "$(q "select requested_qty from proc_indent_line where indent_id=5 and stock_item_id=11")" = 7 ] && res T3 PASS "resync waited for PR edit+activation, then used committed final qty 7" || res T3 FAIL "resync not serialized with PR-final update (blocked=$blocked rcB=$(cat $OUT/B.rc))"
# T4: indent status transition cannot slip under an in-flight resync.
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV"
bg sess_B "update proc_indent_header set status='approved' where indent_id=9" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(q "select status from proc_indent_header where indent_id=9")" = approved ] && res T4 PASS "approval waits; resync completes on a draft first" || res T4 FAIL "approval raced resync (blocked=$blocked)"
# T5: two resyncs of the SAME indent serialize and remain idempotent.
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV"
bg sess_B "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" B
if wait_wait sess_B "$B_ROW"; then blocked=1; else blocked=0; fi
ctl_release; finish A; finish B
[ $blocked = 1 ] && [ "$(cat $OUT/B.rc)" = 0 ] && [ "$(q "select count(*) from proc_pr_indent_line_map where indent_id=9")" = 3 ] && [ "$(q "select count(*) from proc_pr_to_indent_map where indent_id=9 and is_active")" = 1 ] && res T5 PASS "same-indent resyncs serialize; 3 maps, 1 active link, no duplicates" || res T5 FAIL "same-indent resyncs overlapped (blocked=$blocked)"
# T6: NO unnecessary serialization: other indent / other writers proceed while resync(9) is paused.
seed; ctl_hold
bg sess_A "select public.proc_indent_resync_from_pr_pec_internal(9,'safe')" A
wait_wait sess_A "$A_ADV"
if timeout 20 env PGAPPNAME=sess_B psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "select public.proc_indent_resync_from_pr_pec_internal(7,'safe'); select public.proc_indent_add_line(4,1,80,1,5,'ok'); select public.proc_pr_add_line_pec_internal(300,1,11,1,2,'x')" >/dev/null 2>&1; then nb=1; else nb=0; fi
ctl_release; finish A
[ $nb = 1 ] && [ "$(cat $OUT/A.rc)" = 0 ] && res T6 PASS "unrelated indent/PR work not blocked (row-level locks only)" || res T6 FAIL "unrelated writers blocked or failed (nb=$nb)"
# T7: opposite lock order never deadlocks (resync vs PR line writer on same PR, 20 interleaved rounds, bounded)
dl=0; seed
for i in $(seq 20); do
  PGAPPNAME=x1 psql -X -q -At -d "$DB" -c "select public.proc_indent_resync_from_pr_pec_internal(7,'safe')" >/dev/null 2>"$OUT/d1.err" &
  p1=$!
  PGAPPNAME=x2 psql -X -q -At -d "$DB" -c "select public.proc_pr_add_line_pec_internal(200,1,12,1,$i,'r')" >/dev/null 2>"$OUT/d2.err" &
  p2=$!
  PGAPPNAME=x3 psql -X -q -At -d "$DB" -c "select public.proc_indent_add_line(7,1,11,1,$((i+1)),'m'); update proc_indent_header set status='draft' where indent_id=7" >/dev/null 2>"$OUT/d3.err" &
  p3=$!
  wait $p1 $p2 $p3
  grep -qi deadlock "$OUT"/d?.err && dl=1
done
[ $dl = 0 ] && res T7 PASS "20 interleaved rounds, no deadlock" || res T7 FAIL "deadlock detected"
dropdb --if-exists "$DB" >/dev/null 2>&1
echo "SOURCE=$SRC FAILS=$FAILS"
