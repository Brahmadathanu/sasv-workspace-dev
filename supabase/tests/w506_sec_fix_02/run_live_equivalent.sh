#!/usr/bin/env bash
# WP05-W506-SEC-FIX-02 -- LIVE-EQUIVALENT isolated verification. SYNTHETIC DEPENDENCIES ONLY. Never run against
# production, Supabase, or any shared/operator database.
#
# Installs the EXACT live function definitions committed in live_close_definition_snapshot_20261109.sql (UNMODIFIED; the
# snapshot's own psql interlock is satisfied with -v W506_CLOSE_LOCAL_ONLY=1) over synthetic scaffolding, asserts the recorded
# live fingerprints WITHOUT substitution, then applies the UNCHANGED migration and rollback files (no sed, no constant
# substitution anywhere in this script).
#
# Safety interlocks (identical to run_local.sh): PGHOST must be an absolute unix-socket directory; the cluster's
# data_directory basename must start with "w506-disposable-"; superuser required; a UNIQUE scratch database is created
# (refuses on collision) and only that database is dropped, only if this invocation created it; mktemp -d + trap.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261109050000_wp05_w506_sec_fix_02_staff_classification_close_writer_guard.sql"
RB="$ROOT/docs/master-data-costing/prepared/WP05_W506_SEC_FIX_02_ROLLBACK.sql"
SNAP="$HERE/live_close_definition_snapshot_20261109.sql"
ACK='I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL'
EXP_INT=1c9884c0ca0321eda6055feaa6bd64de; EXP_WRP=a8254681b64a6e78b59f1d2b00d9a7df
EXP_PREFIX=255b487148e29e51fa841048e8d248c9
case "${PGHOST:-}" in /*) ;; *) echo "refusing: PGHOST must be an absolute unix-socket directory"; exit 2;; esac
P="psql -X -q -v ON_ERROR_STOP=1 -At"
DD=$($P -d postgres -c "show data_directory" 2>/dev/null) || { echo "cannot connect"; exit 2; }
case "$(basename "$DD")" in w506-disposable-*) ;; *) echo "refusing: data_directory '$DD' is not a w506-disposable-* cluster"; exit 2;; esac
[ "$($P -d postgres -c "select rolsuper from pg_roles where rolname=current_user")" = "t" ] || { echo "refusing: need superuser on the disposable cluster"; exit 2; }
TMP="$(mktemp -d "${TMPDIR:-/tmp}/w506.XXXXXX")" || exit 2
DB="w506_close_live_$(date +%s)_$$"; CREATED=0; FAIL=0; NPASS=0; NFAIL=0
cleanup() { if [ "$CREATED" = 1 ] && [ -n "$DB" ]; then $P -d postgres -c "drop database \"$DB\"" >/dev/null 2>&1; fi; rm -rf "$TMP"; }
trap cleanup EXIT
$P -d postgres -c "create database \"$DB\"" || { echo "could not create unique scratch database -- refusing"; exit 2; }
CREATED=1
q() { $P -d "$DB" "$@"; }
ok()  { echo "PASS  $1"; NPASS=$((NPASS+1)); }
bad() { echo "FAIL  $1  $2"; FAIL=1; NFAIL=$((NFAIL+1)); }
INT="'costing.rpc_close_staff_costing_classification(bigint,date,text)'::regprocedure"
WRP="'public.rpc_close_staff_costing_classification(bigint,date,text)'::regprocedure"
IFP() { q -c "select md5(pg_get_functiondef($INT))"; }
WFP() { q -c "select md5(pg_get_functiondef($WRP))"; }
CAT() { q -c "select p.oid, pg_get_userbyid(p.proowner), p.proacl, p.proconfig, p.provolatile, p.prosecdef, p.prokind, p.proretset, pg_get_function_result(p.oid), pg_get_function_arguments(p.oid), pg_get_function_identity_arguments(p.oid) from pg_proc p where p.oid in ($INT,$WRP) order by 1"; }
# (re)install the unmodified snapshot over fresh scaffolding, then set the live ACLs (ACLs do not enter pg_get_functiondef)
fresh() {
  q -c "drop schema if exists costing cascade; drop schema if exists hr cascade; drop schema if exists t cascade; drop view if exists public.v_costing_staff_classification_register; drop table if exists public.user_permissions_canonical; drop function if exists public.rpc_close_staff_costing_classification(bigint,date,text); drop function if exists public.require_permission(text,boolean)" >/dev/null 2>&1
  q -f "$HERE/live_scaffold.sql" >/dev/null || { echo "scaffold failed"; exit 2; }
  q -v W506_CLOSE_LOCAL_ONLY=1 -f "$SNAP" >/dev/null || { echo "snapshot install failed (STOP)"; exit 2; }
  q -c "revoke all on function costing.rpc_close_staff_costing_classification(bigint,date,text) from public, anon, authenticated; revoke all on function public.rpc_close_staff_costing_classification(bigint,date,text) from public, anon; grant execute on function public.rpc_close_staff_costing_classification(bigint,date,text) to authenticated, service_role" >/dev/null
}
rbrun() { { echo "set w506.close_rollback_owner_emergency_approval = '$1';"; cat "$RB"; } > "$TMP/rbx.sql"; q -f "$TMP/rbx.sql" 2>&1; }
expect_abort() { local a b c d out rc; a=$(IFP); c=$(WFP); out=$(q -f "$2" 2>&1); rc=$?; b=$(IFP); d=$(WFP)
  if [ $rc -ne 0 ] && echo "$out" | grep -qE "$3" && [ "$a" = "$b" ] && [ "$c" = "$d" ]; then ok "$1"; else bad "$1" "rc=$rc :: $(echo "$out" | head -2)"; fi; }
mutate() { q -c "do \$m\$ declare d text := pg_get_functiondef($1); begin execute $2; end \$m\$" >/dev/null 2>"$TMP/mut.err" || bad "mutation itself failed (test bug): $2" "$(head -2 "$TMP/mut.err")"; }

echo "SERVER: $(q -c "select version()")   (server_version=$(q -c "show server_version"))"
echo "FILES : migration sha256=$(sha256sum "$MIG" | cut -c1-16)...  rollback sha256=$(sha256sum "$RB" | cut -c1-16)...  snapshot sha256=$(sha256sum "$SNAP" | cut -c1-16)..."
fresh

# ---------------------------------------------------------------- L0 exact live definitions installed, NO substitution
[ "$(IFP)" = "$EXP_INT" ] && ok "L0a internal full-definition md5 = $EXP_INT (unsubstituted)" || { bad "L0a internal md5" "$(IFP)"; echo "STOP: live definition drift"; exit 1; }
[ "$(WFP)" = "$EXP_WRP" ] && ok "L0b wrapper full-definition md5 = $EXP_WRP (unsubstituted)" || { bad "L0b wrapper md5" "$(WFP)"; echo "STOP: live definition drift"; exit 1; }
R=$(q -c "select length(pg_get_functiondef($INT))||':'||length(prosrc)||':'||md5(substr(prosrc,1,174))||':'||regexp_instr(prosrc,'(^|[^[:alnum:]_])(begin)([[:space:]])',1,1,0,'i')||':'||md5(prosrc) from pg_proc where oid=$INT")
[ "$R" = "2156:1589:$EXP_PREFIX:175:82f1b8b699f078505f1fd7211d9d2741" ] && ok "L0c definition 2156 chars, prosrc 1589, prefix(174) md5 $EXP_PREFIX, first BEGIN at 175, prosrc md5 82f1b8b6..." || { bad "L0c shape" "$R"; echo "STOP"; exit 1; }
R=$(q -c "select count(*) filter (where position(E'\r\n' in prosrc)>0) from pg_proc where oid=$INT")
[ "$R" = "1" ] && [ "$(q -c "select (length(prosrc)-length(replace(prosrc,E'\n','')))=(length(prosrc)-length(replace(prosrc,E'\r','')))  from pg_proc where oid=$INT")" = "t" ] && ok "L0d internal body is CRLF throughout (every LF paired with a CR)" || bad "L0d CRLF" ""
R=$(q -c "select (select proacl::text from pg_proc where oid=$INT)||' | '||(select proacl::text from pg_proc where oid=$WRP)||' | '||(select proconfig::text from pg_proc where oid=$INT)||' | '||(select proconfig::text from pg_proc where oid=$WRP)")
echo "      catalogue (synthetic ACL reproduces the live ACL text; owner = local superuser): $R"
[ "$R" = '{postgres=X/postgres} | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres} | {"search_path=costing, public, hr"} | {"search_path=public, costing, hr"}' ] && ok "L0e ACLs and search_path config equal the live values" || bad "L0e ACL/config" "$R"

# ---------------------------------------------------------------- L1 baseline: the unguarded exact function is writable by ID-N
OUT=$(q <<'SQL' 2>&1
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);
select count(*) from public.rpc_close_staff_costing_classification(1,date '2026-12-31','baseline'); rollback;
SQL
)
OUT=$(echo "$OUT" | tail -n 1)
[ "$OUT" = "1" ] && ok "L1 baseline (exact unguarded definitions): ID-N writes through the wrapper -> reproduces the finding" || bad "L1 baseline" "$OUT"

# ---------------------------------------------------------------- L2 apply the UNCHANGED migration
CAT0=$(CAT); W0=$(WFP); ORIG=$(IFP)
OUT=$(q -f "$MIG" 2>&1) && ok "L2 UNCHANGED migration applies to the exact live definitions (compiles; no fingerprint or constant substitution)" || { bad "L2 apply" "$OUT"; }
GUARDED=$(IFP)
[ "$(CAT)" = "$CAT0" ] && ok "L2b OID, owner, ACL, config, volatility, SECURITY DEFINER, kind, RETURNS TABLE, argument list/defaults and identity args unchanged" || bad "L2b preservation" "$(CAT)"
[ "$(WFP)" = "$W0" ] && [ "$(WFP)" = "$EXP_WRP" ] && ok "L2c wrapper full definition unchanged (still $EXP_WRP)" || bad "L2c wrapper" ""
[ "$(q -c "select md5(replace(pg_get_functiondef($INT), E'\n  perform public.require_permission(''module:cost-build-manager'', true);\n',''))")" = "$EXP_INT" ] && ok "L2d guarded definition minus the guard restores the verified original md5 $EXP_INT" || bad "L2d" ""
[ "$(q -c "select starts_with(prosrc, E'\r\ndeclare\r\n  v_effective_to date := coalesce(p_effective_to, current_date);') and md5(substr(prosrc,1,174))='$EXP_PREFIX' from pg_proc where oid=$INT")" = "t" ] && ok "L2e installed body keeps the byte-exact 174-byte CRLF declaration prefix" || bad "L2e" ""
q -f "$HERE/live_matrix.sql" > "$TMP/matrix.out" 2>&1; cat "$TMP/matrix.out"
NROWS=$(grep -c "|PASS|\||FAIL|" "$TMP/matrix.out"); grep -q "FAILURES=0 OF" "$TMP/matrix.out" && ok "L3 role/behaviour matrix: $(grep -o 'FAILURES=0 OF [0-9]*' "$TMP/matrix.out") SQL rows PASS" || bad "L3 matrix" "see rows above"

# ---------------------------------------------------------------- L4 idempotency
OUT=$(q -f "$MIG" 2>&1); [ "$(IFP)" = "$GUARDED" ] && echo "$OUT" | grep -q "verified as already guarded" && ok "L4 second application of the unchanged migration: verified idempotent no-op" || bad "L4" "$OUT"

# ---------------------------------------------------------------- L5 drift on the exact definitions (all must abort, nothing changes)
mutate "$INT" "replace(d, 'v_effective_to date := coalesce', 'v_effective_to date := coalesce')"   # no-op sanity (must still be guarded-verified)
OUT=$(q -f "$MIG" 2>&1); [ "$(IFP)" = "$GUARDED" ] && ok "L5a no-op rewrite of the guarded function is still recognised (definition unchanged)" || bad "L5a" "$OUT"
mutate "$INT" "replace(d, 'raise exception ''Classification id is required.'';', 'raise exception ''Classification id is required.''; perform 1;')"
expect_abort "L5b guarded exact function with an extra statement -> abort" "$MIG" "removing the guard does not restore|neither the verified"
fresh; q -f "$MIG" >/dev/null
mutate "$WRP" "replace(d, 'select *', 'select * /* altered */')"
expect_abort "L5c altered public wrapper (delegate still present) with guarded internal -> abort" "$MIG" "wrapper full-definition md5"
fresh; mutate "$INT" "replace(d, 'coalesce(p_effective_to, current_date)', 'coalesce(p_effective_to, current_date + 0)')"
expect_abort "L5d one-byte change inside the verified declaration prefix on the original -> abort (fingerprint)" "$MIG" "neither the verified original"
fresh; mutate "$INT" "replace(d, 'raise exception ''Classification id is required.'';', 'raise exception ''Classification id is required!'';')"
expect_abort "L5e one-byte change later in the original body -> abort (full-definition md5)" "$MIG" "neither the verified original"
fresh; q -f "$MIG" >/dev/null
mutate "$INT" "replace(replace(d, E'\n  perform public.require_permission(''module:cost-build-manager'', true);\n', ''), E'\r\n  if p_classification_id is null then', E'\n  perform public.require_permission(''module:cost-build-manager'', true);\n' || E'\r\n  if p_classification_id is null then')"
OUT=$(q -f "$MIG" 2>&1); echo "$OUT" | grep -q "verified as already guarded" && ok "L5f guard re-placed at the identical first-statement position is the same deterministic form (accepted)" || bad "L5f" "$OUT"

# ---------------------------------------------------------------- L6 rollback (unchanged script, explicit synthetic emergency interlock)
fresh; CAT0=$(CAT); q -f "$MIG" >/dev/null; GUARDED=$(IFP); CATG=$(CAT)
OUT=$(rbrun "wrong"); [ "$(IFP)" = "$GUARDED" ] && echo "$OUT" | grep -q "interlock" && ok "L6a rollback without the interlock aborts" || bad "L6a" "$OUT"
OUT=$(rbrun "$ACK") && [ "$(IFP)" = "$EXP_INT" ] && ok "L6b rollback (with interlock) restores the original md5 $EXP_INT" || bad "L6b" "$OUT"
[ "$(WFP)" = "$EXP_WRP" ] && [ "$(CAT)" = "$CAT0" ] && ok "L6c after rollback: OID/owner/ACL/config/result/args and wrapper definition equal the original" || bad "L6c" ""
OUT=$(rbrun "$ACK") && echo "$OUT" | grep -q "already the verified unguarded" && ok "L6d second rollback is a verified no-op" || bad "L6d" "$OUT"
q -f "$MIG" >/dev/null 2>&1; [ "$(IFP)" = "$GUARDED" ] && [ "$(CAT)" = "$CATG" ] && ok "L6e re-apply after rollback reproduces the identical guarded definition and catalogue" || bad "L6e" ""
mutate "$INT" "replace(d, 'raise exception ''Classification id is required.'';', 'raise exception ''Classification id is required.''; perform 1;')"; DR=$(IFP)
OUT=$(rbrun "$ACK"); [ "$(IFP)" = "$DR" ] && echo "$OUT" | grep -qE "drift|guard text" && ok "L6f rollback aborts on a drifted guarded definition" || bad "L6f" "$OUT"
fresh; q -f "$MIG" >/dev/null; mutate "$WRP" "replace(d, 'select *', 'select * /* altered */')"; G2=$(IFP)
OUT=$(rbrun "$ACK"); [ "$(IFP)" = "$G2" ] && echo "$OUT" | grep -q "wrapper" && ok "L6g rollback aborts on an altered wrapper" || bad "L6g" "$OUT"

echo "SUMMARY: $NPASS passed, $NFAIL failed (live-equivalent runner checks; the role/behaviour matrix is reported separately as SQL rows)"
[ $FAIL -eq 0 ] && echo "ALL LIVE-EQUIVALENT CHECKS PASSED" || echo "SOME CHECKS FAILED"; exit $FAIL
