#!/usr/bin/env bash
# WP05-W506-SEC-FIX-01 -- isolated LOCAL verification. SYNTHETIC FIXTURES ONLY. Never run against production,
# Supabase, or any operator/shared database.
#
# Safety interlocks (the script refuses to run otherwise):
#  * PGHOST must be an absolute unix-socket directory (no TCP, no localhost).
#  * The server must be a DISPOSABLE cluster whose data_directory basename starts with "w506-disposable-"
#    (create one with: initdb -D <parent>/w506-disposable-$$ ... ; the operator names it, nothing else qualifies).
#  * The connecting role must be a superuser of that cluster.
#  * A UNIQUE scratch database is created (creation fails if the name exists); only that database is ever dropped, and
#    only if this invocation created it. No "DROP DATABASE IF EXISTS" on any fixed name.
#  * All temp files live in one mktemp -d directory removed on exit.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261109040000_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql"
RB="$ROOT/docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql"
ACK='I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL'
case "${PGHOST:-}" in /*) ;; *) echo "refusing: PGHOST must be an absolute unix-socket directory"; exit 2;; esac
P="psql -X -q -v ON_ERROR_STOP=1 -At"
DD=$($P -d postgres -c "show data_directory" 2>/dev/null) || { echo "cannot connect"; exit 2; }
case "$(basename "$DD")" in w506-disposable-*) ;; *) echo "refusing: data_directory '$DD' is not a w506-disposable-* cluster"; exit 2;; esac
[ "$($P -d postgres -c "select rolsuper from pg_roles where rolname=current_user")" = "t" ] || { echo "refusing: need superuser on the disposable cluster"; exit 2; }
TMP="$(mktemp -d "${TMPDIR:-/tmp}/w506.XXXXXX")" || exit 2
DB="w506_scratch_$(date +%s)_$$"; CREATED=0; FAIL=0; NPASS=0; NFAIL=0
cleanup() {
  if [ "$CREATED" = 1 ] && [ -n "$DB" ]; then $P -d postgres -c "drop database \"$DB\"" >/dev/null 2>&1; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
$P -d postgres -c "create database \"$DB\"" || { echo "could not create unique scratch database (collision?) -- refusing"; exit 2; }
CREATED=1
q() { $P -d "$DB" "$@"; }
ok()  { echo "PASS  $1"; NPASS=$((NPASS+1)); }
bad() { echo "FAIL  $1  $2"; FAIL=1; NFAIL=$((NFAIL+1)); }
INT="'costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure"
WRP="'public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure"
INT_FP() { q -c "select md5(pg_get_functiondef($INT))"; }
WRP_FP() { q -c "select md5(pg_get_functiondef($WRP))"; }
CATALOG() { q -c "select p.oid, p.proowner, p.proacl, p.proconfig, p.provolatile, p.prosecdef, p.prorettype from pg_proc p where p.oid in ($INT,$WRP) order by 1"; }
reset() { q -f "$HERE/fixture.sql" >/dev/null || { echo "fixture failed"; exit 2; }; }
# test-only: replace the two recorded LIVE fingerprints by the current synthetic definitions' fingerprints (scratch copies)
mkmig() {
  local i w len pos; i=$(INT_FP); w=$(WRP_FP)
  len=$(q -c "select length(prosrc) from pg_proc where oid=$INT")
  pos=$(q -c "select regexp_instr(prosrc,'(^|[^[:alnum:]_])(begin)([[:space:]])',1,1,0,'i') from pg_proc where oid=$INT")
  for f in "$MIG:mig" "$RB:rb"; do
    sed -e "s/553d103a5afedda3191c1aa62c33be7c/$i/g" -e "s/6ba709477ecc7755fb6005b6e2203a2b/$w/g" \
        -e "s/constant int  := 4288;/constant int  := $len;/" -e "s/constant int  := 508; /constant int  := $pos; /" "${f%%:*}" > "$TMP/${f##*:}.sql"
  done
  LIVE_LEN=$len; LIVE_POS=$pos
  grep -q "$i" "$TMP/mig.sql" && grep -q "$w" "$TMP/mig.sql" && grep -q ":= $len;" "$TMP/mig.sql" && grep -q ":= $pos; " "$TMP/mig.sql" || { echo "substitution failed"; exit 2; }
}
rbrun() { { echo "set w506.rollback_owner_emergency_approval = '$1';"; cat "$TMP/rb.sql"; } > "$TMP/rbx.sql"; q -f "$TMP/rbx.sql" 2>&1; }
# expect_abort <name> <sqlfile> <message pattern>: nonzero exit, expected message, internal+wrapper definitions unchanged
expect_abort() {
  local a b c d out rc
  a=$(INT_FP); c=$(WRP_FP); out=$(q -f "$2" 2>&1); rc=$?; b=$(INT_FP); d=$(WRP_FP)
  if [ $rc -ne 0 ] && echo "$out" | grep -qE "$3" && [ "$a" = "$b" ] && [ "$c" = "$d" ]; then ok "$1"; else bad "$1" "rc=$rc :: $(echo "$out" | head -3)"; fi
}
# mutate the internal function via its own definition text (synthetic variants)
mutate_internal() { q -c "do \$m\$ declare d text := pg_get_functiondef($INT); begin execute $1; end \$m\$" >/dev/null 2>"$TMP/mut.err" || bad "mutation itself failed (test bug): $1" "$(head -2 "$TMP/mut.err")"; }

# ---------------------------------------------------------------- S0 baseline / S1 unmodified migration
reset
OUT=$(q <<'SQL' 2>&1
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
select public.rpc_set_staff_costing_classification(901,'OPERATIONS','POOL',date '2026-11-01',1,'baseline'); rollback;
SQL
)
echo "$OUT" | grep -q '"ok": true' && ok "S0 unguarded fixture: ID-N writes through the wrapper (reproduces the finding on the fixture)" || bad "S0 baseline" "$OUT"
cp "$MIG" "$TMP/real.sql"; expect_abort "S1 unmodified migration (real live fingerprints) aborts closed on the synthetic wrapper/body" "$TMP/real.sql" "aborted"

# ---------------------------------------------------------------- S2 apply, matrix, preservation, true idempotency
reset; mkmig
ORIG_DEF=$(INT_FP); CAT0=$(CATALOG); W0=$(WRP_FP)
OUT=$(q -f "$TMP/mig.sql" 2>&1) && ok "S2 migration applies to a fingerprint-matched fixture" || bad "S2 apply" "$OUT"
GUARDED_DEF=$(INT_FP)
[ "$(CATALOG)" = "$CAT0" ] && [ "$(WRP_FP)" = "$W0" ] && ok "S2b OID/owner/ACL/config/volatility/security-definer/return type and full wrapper definition unchanged" || bad "S2b preservation" ""
[ "$(q -c "select md5(replace(pg_get_functiondef($INT), E'\n  perform public.require_permission(''module:cost-build-manager'', true);\n',''))")" = "$ORIG_DEF" ] && ok "S2c definition minus guard hashes to the original full-definition fingerprint" || bad "S2c" ""
q -f "$HERE/matrix.sql" > "$TMP/matrix.out" 2>&1; cat "$TMP/matrix.out"
grep -q "FAILURES=0 OF 18" "$TMP/matrix.out" && ok "S3 identity matrix: 18/18 SQL rows PASS" || bad "S3 identity matrix" "see rows above"
OUT=$(q -f "$TMP/mig.sql" 2>&1); [ "$(INT_FP)" = "$GUARDED_DEF" ] && echo "$OUT" | grep -q "verified as already guarded" && ok "S4 re-apply: verified idempotent no-op (definition unchanged)" || bad "S4 idempotency" "$OUT"

# ---------------------------------------------------------------- S5 adversarial already-guarded drift (must abort, nothing changes)
G="E'\n  perform public.require_permission(''module:cost-build-manager'', true);\n'"
mutate_internal "replace(d, 'return jsonb_build_object', 'perform 1; return jsonb_build_object')"
expect_abort "S5a guarded body with an extra altered statement -> abort" "$TMP/mig.sql" "removing the guard does not restore|neither the verified"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
mutate_internal "replace(replace(d, $G, ''), E'\n  get diagnostics', $G || E'\n  get diagnostics')"
expect_abort "S5b guard moved after the validation statements (restores original but not first statement) -> abort" "$TMP/mig.sql" "not the expected first-statement insertion"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
mutate_internal "replace(replace(d, $G, E'\n  -- perform public.require_permission(''module:cost-build-manager'', true);\n'), 'declare', 'declare')"
expect_abort "S5c guard only inside a comment (body otherwise unguarded) -> abort" "$TMP/mig.sql" "neither the verified|removing the guard does not restore"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
mutate_internal "replace(d, $G, E'/*' || $G || E'*/')"
expect_abort "S5d guard inside a block comment -> abort" "$TMP/mig.sql" "removing the guard does not restore|neither the verified"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
mutate_internal "replace(d, $G, E'\n  if false then' || $G || E'  end if;\n')"
expect_abort "S5e guard inside a dead branch -> abort" "$TMP/mig.sql" "removing the guard does not restore|neither the verified"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
q -c "do \$m\$ declare d text := pg_get_functiondef($WRP); begin execute replace(d, 'costing.rpc_set_staff_costing_classification(\$1, \$2, \$3, \$4, \$5, \$6)', 'costing.rpc_set_staff_costing_classification(\$1, \$2, \$3, \$4, \$5, \$6) /* altered */'); end \$m\$" >/dev/null
expect_abort "S5f altered wrapper (delegate string still present) after guarding -> abort" "$TMP/mig.sql" "wrapper full-definition md5"

# ---------------------------------------------------------------- S6 preimage drift
reset; mkmig
q -c "do \$m\$ declare d text := pg_get_functiondef($WRP); begin execute replace(d, 'costing.rpc_set_staff_costing_classification(\$1, \$2, \$3, \$4, \$5, \$6)', 'costing.rpc_set_staff_costing_classification(\$1, \$2, \$3, \$4, \$5, \$6) /* altered */'); end \$m\$" >/dev/null
expect_abort "S6a altered wrapper with delegate string present, internal at preimage -> abort (no warning-and-continue)" "$TMP/mig.sql" "wrapper full-definition md5"
reset; mkmig; mutate_internal "replace(d, 'return jsonb_build_object', '/* drift */ return jsonb_build_object')"
expect_abort "S6b internal body drift (fingerprint mismatch) -> abort" "$TMP/mig.sql" "neither the verified original"
reset; mkmig; q -c "create function costing.rpc_set_staff_costing_classification(bigint) returns void language sql as 'select 1'" >/dev/null
expect_abort "S6c second overload of the internal name -> abort" "$TMP/mig.sql" "exactly one"
q -c "drop function costing.rpc_set_staff_costing_classification(bigint)" >/dev/null

# ---------------------------------------------------------------- S7 body shapes (each variant gets its own recorded fingerprint)
shape_accept() { # name, sql expression over d
  reset; mutate_internal "$2"; mkmig
  OUT=$(q -f "$TMP/mig.sql" 2>&1) && q -c "select prosrc ~* '\\mbegin\\M\\s+perform public\\.require_permission\\(''module:cost-build-manager'', true\\);' and (length(prosrc)-length(replace(prosrc,'require_permission','')))=length('require_permission') from pg_proc where oid=$INT" | grep -q t && ok "$1" || bad "$1" "$OUT"; }
shape_abort() { reset; mutate_internal "$2"; mkmig; expect_abort "$1" "$TMP/mig.sql" "$3"; }
shape_accept "S7a CRLF line endings: accepted, guard is first statement" "replace(d, E'\n', E'\r\n')"
shape_accept "S7b nested BEGIN..EXCEPTION block later in body: only the first BEGIN patched" "replace(d, E'  get diagnostics', E'  begin\n    perform 1;\n  exception when others then null;\n  end;\n  get diagnostics')"
shape_abort  "S7c comment inside the DECLARE section -> abort" "replace(d, 'v_updated int;', 'v_updated int; -- note')" "comment, quote or label|unexpected text"
shape_abort  "S7d label before the block -> abort" "replace(d, 'declare', E'<<blk>>\ndeclare')" "comment, quote or label|unexpected text"
shape_abort  "S7e quoted default in DECLARE -> abort (refuse to guess)" "replace(d, 'v_updated int;', E'v_updated int; v_s text := ''x'';')" "comment, quote or label|unexpected text"
shape_abort  "S7f comment before DECLARE -> abort" "replace(d, 'declare', E'-- c\ndeclare')" "unexpected text before the first BEGIN|comment, quote or label"

# ---------------------------------------------------------------- S7g.. live-declaration allowance (fingerprint + anchors + exact initialisers)
shape_abort  "S7g extra quoted initialiser beyond the three live ones -> abort" "replace(d, 'v_updated int;', E'v_updated int; v_x text := '''';')" "comment, quote or label"
shape_abort  "S7h one live initialiser altered (non-empty literal) -> abort" "replace(d, 'p_costing_class), '''')', 'p_costing_class), ''x'')')" "not found exactly once|comment, quote or label"
shape_abort  "S7i one live initialiser missing -> abort" "replace(d, E'  v_remarks text := nullif(trim(p_remarks), '''');\n', '')" "not found exactly once|comment, quote or label"
shape_abort  "S7j live initialiser renamed (variable renamed throughout) -> abort" "replace(d, 'v_remarks', 'v_notes')" "not found exactly once|comment, quote or label"
shape_abort  "S7k comment appended to a live initialiser line -> abort" "replace(d, 'p_remarks), '''');', 'p_remarks), ''''); -- c')" "comment, quote or label"
shape_abort  "S7l label with the live initialisers present -> abort" "replace(d, 'declare', E'<<blk>>\ndeclare')" "comment, quote or label|unexpected text"
shape_accept "S7m CRLF with the live quoted initialisers: accepted, guard first" "replace(d, E'\n', E'\r\n')"
# anchors: without matching body length / BEGIN position the quote allowance is NOT available
reset; mkmig; sed "s/constant int  := $LIVE_LEN;/constant int  := $((LIVE_LEN+1));/" "$TMP/mig.sql" > "$TMP/mig_badlen.sql"
expect_abort "S7n allowance unavailable when body length anchor differs -> abort" "$TMP/mig_badlen.sql" "comment, quote or label"
sed "s/constant int  := $LIVE_POS; /constant int  := $((LIVE_POS+1)); /" "$TMP/mig.sql" > "$TMP/mig_badpos.sql"
expect_abort "S7o allowance unavailable when BEGIN position anchor differs -> abort" "$TMP/mig_badpos.sql" "comment, quote or label"
# the allowance is only reachable after the full-definition md5 check: a fingerprint mismatch aborts before any shape logic
sed "s/$(INT_FP)/00000000000000000000000000000000/g" "$TMP/mig.sql" > "$TMP/mig_badfp.sql"
expect_abort "S7p fingerprint mismatch aborts before the shape allowance" "$TMP/mig_badfp.sql" "neither the verified original"
# guard precedes the live-style validation; initialisers retained
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
if q -c "select position('perform public.require_permission' in prosrc) between position('begin' in prosrc) and position('staff id required' in prosrc) and prosrc like '%v_costing_class text := upper(nullif(trim(p_costing_class), ''''));%' and prosrc like '%v_remarks text := nullif(trim(p_remarks), '''');%' from pg_proc where oid=$INT" | grep -q t; then ok "S7q guarded body keeps the live initialisers and the guard precedes validation and writes"; else bad "S7q" ""; fi

# ---------------------------------------------------------------- S8 rollback validation
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null; GUARDED_DEF=$(INT_FP)
OUT=$(rbrun "wrong"); rc=$?; [ "$(INT_FP)" = "$GUARDED_DEF" ] && echo "$OUT" | grep -q "interlock" && ok "S8a rollback without the owner emergency interlock aborts" || bad "S8a" "$OUT"
mutate_internal "replace(d, 'return jsonb_build_object', 'perform 1; return jsonb_build_object')"; DRIFT=$(INT_FP)
OUT=$(rbrun "$ACK"); [ "$(INT_FP)" = "$DRIFT" ] && echo "$OUT" | grep -qE "drift|guard text" && ok "S8b rollback aborts on drifted guarded definition" || bad "S8b" "$OUT"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null
q -c "do \$m\$ declare d text := pg_get_functiondef($WRP); begin execute replace(d, 'costing.rpc_set_staff_costing_classification(\$1, \$2, \$3, \$4, \$5, \$6)', 'costing.rpc_set_staff_costing_classification(\$1, \$2, \$3, \$4, \$5, \$6) /* altered */'); end \$m\$" >/dev/null
OUT=$(rbrun "$ACK"); [ "$(INT_FP)" = "$GUARDED_DEF" ] && echo "$OUT" | grep -q "wrapper" && ok "S8c rollback aborts on altered wrapper" || bad "S8c" "$OUT"
reset; mkmig; q -f "$TMP/mig.sql" >/dev/null; GUARDED_DEF=$(INT_FP)
OUT=$(rbrun "$ACK") && [ "$(INT_FP)" = "$ORIG_DEF" ] && ok "S8d rollback (with interlock) restores the original full-definition fingerprint" || bad "S8d" "$OUT"
OUT=$(rbrun "$ACK") && echo "$OUT" | grep -q "already the verified unguarded" && ok "S8e second rollback is a verified no-op" || bad "S8e" "$OUT"
q -f "$TMP/mig.sql" >/dev/null 2>&1; [ "$(INT_FP)" = "$GUARDED_DEF" ] && ok "S8f re-apply after rollback reproduces the identical guarded definition" || bad "S8f" ""

echo "SUMMARY: $NPASS passed, $NFAIL failed (runner checks; identity matrix reported separately as 18 SQL rows)"
[ $FAIL -eq 0 ] && echo "ALL LOCAL CHECKS PASSED" || echo "SOME CHECKS FAILED"; exit $FAIL
