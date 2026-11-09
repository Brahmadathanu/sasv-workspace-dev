#!/usr/bin/env bash
# WP05-W506 combined Save+Close sequencing and failure-injection checks. DISPOSABLE CLUSTER ONLY, SYNTHETIC dependencies.
# Usage: SAVE_DIR=<checkout of PR #254 branch> CLOSE_DIR=<checkout of PR #255 branch> PGHOST=<socket dir> run_combined_sequence.sh
# Interlocks: absolute unix-socket PGHOST; data_directory basename w506-disposable-*; superuser; unique scratch DB dropped on exit.
# Runners are SIMULATED with psql (BEGIN; file; history insert; COMMIT). The real Supabase runner is NOT available/established.
set -u
: "${SAVE_DIR:?}" "${CLOSE_DIR:?}"
case "${PGHOST:-}" in /*) ;; *) echo "refusing: PGHOST must be an absolute unix-socket directory"; exit 2;; esac
P="psql -X -q -v ON_ERROR_STOP=1 -At"
DD=$($P -d postgres -c "show data_directory" 2>/dev/null) || { echo "cannot connect"; exit 2; }
case "$(basename "$DD")" in w506-disposable-*) ;; *) echo "refusing: not a w506-disposable-* cluster"; exit 2;; esac
[ "$($P -d postgres -c "select rolsuper from pg_roles where rolname=current_user")" = "t" ] || { echo "refusing: need superuser"; exit 2; }
SM=$SAVE_DIR/supabase/migrations/20261109105557_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql
CM=$CLOSE_DIR/supabase/migrations/20261109105717_wp05_w506_sec_fix_02_staff_classification_close_writer_guard.sql
SR=$SAVE_DIR/docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql
CR=$CLOSE_DIR/docs/master-data-costing/prepared/WP05_W506_SEC_FIX_02_ROLLBACK.sql
SC=$SAVE_DIR/supabase/tests/w506_sec_fix_01/live_scaffold.sql
SS=$SAVE_DIR/supabase/tests/w506_sec_fix_01/live_definition_snapshot_20261109.sql
CS=$CLOSE_DIR/supabase/tests/w506_sec_fix_02/live_close_definition_snapshot_20261109.sql
for f in "$SM" "$CM" "$SR" "$CR" "$SC" "$SS" "$CS"; do [ -f "$f" ] || { echo "missing $f"; exit 2; }; done
echo "FILES sha256: save-mig=$(sha256sum "$SM"|cut -c1-12) close-mig=$(sha256sum "$CM"|cut -c1-12) save-rb=$(sha256sum "$SR"|cut -c1-12) close-rb=$(sha256sum "$CR"|cut -c1-12)"
TMP=$(mktemp -d "${TMPDIR:-/tmp}/w506c.XXXXXX") || exit 2; DB="w506_comb_$(date +%s)_$$"; CREATED=0
cleanup(){ [ "$CREATED" = 1 ] && $P -d postgres -c "drop database \"$DB\"" >/dev/null 2>&1; rm -rf "$TMP"; }; trap cleanup EXIT
$P -d postgres -c "create database \"$DB\"" || exit 2; CREATED=1
q(){ $P -d "$DB" "$@"; }; N=0; X=0
ok(){ echo "PASS $1"; N=$((N+1)); }; bad(){ echo "FAIL $1 :: $2"; X=$((X+1)); }; expect(){ [ "$1" = "$2" ] && ok "$3" || bad "$3" "got [$1] want [$2]"; }
SI="'costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure"
SW="'public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)'::regprocedure"
CI="'costing.rpc_close_staff_costing_classification(bigint,date,text)'::regprocedure"
CW="'public.rpc_close_staff_costing_classification(bigint,date,text)'::regprocedure"
fp(){ q -c "select md5(pg_get_functiondef($1))"; }
meta(){ q -c "select string_agg(p.oid||'|'||pg_get_userbyid(p.proowner)||'|'||coalesce(p.proacl::text,'')||'|'||coalesce(p.proconfig::text,'')||'|'||p.prosecdef::text||'|'||p.provolatile::text||'|'||pg_get_function_arguments(p.oid)||'|'||pg_get_function_result(p.oid),E'\n' order by p.oid) from pg_proc p where p.oid in ($SI,$SW,$CI,$CW)"; }
S0=553d103a5afedda3191c1aa62c33be7c; SW0=6ba709477ecc7755fb6005b6e2203a2b; C0=1c9884c0ca0321eda6055feaa6bd64de; CW0=a8254681b64a6e78b59f1d2b00d9a7df
fresh(){ q -c "drop schema if exists costing cascade; drop schema if exists hr cascade; drop view if exists public.v_costing_staff_costing_class_options, public.v_costing_staff_classification_register; drop table if exists public.user_permissions_canonical, public.mig_history_sim; drop function if exists public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text), public.rpc_close_staff_costing_classification(bigint,date,text), public.require_permission(text,boolean)" >/dev/null 2>&1
 q -f "$SC" >/dev/null && q -c "insert into costing.staff_costing_classification(id,staff_id,costing_class,allocation_pool,effective_from) values (101,2,'PACKING','PACKING_LABOUR',date '2026-01-01'); create table public.mig_history_sim(v text)" >/dev/null && q -v W506_LOCAL_ONLY=1 -f "$SS" >/dev/null && q -v W506_CLOSE_LOCAL_ONLY=1 -f "$CS" >/dev/null || { echo "install failed"; exit 2; }
 q -c "revoke all on function costing.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text), costing.rpc_close_staff_costing_classification(bigint,date,text) from public, anon, authenticated; revoke all on function public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text), public.rpc_close_staff_costing_classification(bigint,date,text) from public, anon; grant execute on function public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text), public.rpc_close_staff_costing_classification(bigint,date,text) to authenticated, service_role" >/dev/null; }
# simulated runner: ONE transaction on ONE connection per migration, history row recorded inside it
runmig(){ { echo "begin;"; cat "$1"; echo "insert into public.mig_history_sim values ('$2');"; echo "commit;"; } > "$TMP/run.sql"; q -f "$TMP/run.sql" 2>&1; }
HIST(){ q -c "select coalesce(string_agg(v,',' order by v),'') from public.mig_history_sim"; }
probe(){ local call; if [ "$2" = save ]; then call="select count(*) from public.rpc_set_staff_costing_classification(1,'MANUFACTURING',null,date '2026-11-01',1,'p')"; else call="select count(*) from public.rpc_close_staff_costing_classification(101,date '2026-12-31','p')"; fi
 q <<SQL 2>&1 | grep -E '^[0-9]+$|permission denied|not authenticated' | head -1 | sed -E 's/^[0-9]+$/OK/; s/.*(permission denied|not authenticated).*/DENIED/'
begin; set local role authenticated; select set_config('request.jwt.claim.sub','$1',true); $call; rollback;
SQL
}
NP=00000000-0000-0000-0000-0000000000a1; ED=00000000-0000-0000-0000-0000000000c1
drift_cw(){ q -c "do \$m\$ declare d text := pg_get_functiondef($CW); begin execute replace(d,'select *','select * /* drift */'); end \$m\$" >/dev/null; }
fix_cw(){ q -c "do \$m\$ declare d text := pg_get_functiondef($CW); begin execute replace(d,'select * /* drift */','select *'); end \$m\$" >/dev/null; }
echo "SERVER $(q -c 'select version()')"
fresh; expect "$(fp "$SI")/$(fp "$SW")/$(fp "$CI")/$(fp "$CW")" "$S0/$SW0/$C0/$CW0" "C0 four original fingerprints reproduced"
M0=$(meta); expect "$(probe $NP save)/$(probe $NP close)" "OK/OK" "C0 both writers open to a no-grant user (finding reproduced)"
runmig "$SM" save >/dev/null; expect "$(probe $NP save)/$(probe $NP close)/$(HIST)" "DENIED/OK/save" "C1 after Save only: Save denied, Close still open, history=save"
runmig "$CM" close >/dev/null; expect "$(probe $NP save)/$(probe $NP close)/$(probe $ED save)/$(probe $ED close)/$(HIST)" "DENIED/DENIED/OK/OK/close,save" "C2 final: both denied for no-grant, both allowed for CBM editor, history=save+close"
expect "$(fp "$SW")/$(fp "$CW")" "$SW0/$CW0" "C3 both wrappers unchanged"; expect "$(meta)" "$M0" "C4 owner/ACL/config/signature/OID of all four unchanged"
G=$(fp "$SI")/$(fp "$CI"); runmig "$SM" save2 >/dev/null; runmig "$CM" close2 >/dev/null; expect "$(fp "$SI")/$(fp "$CI")" "$G" "C5 re-applying both is a no-op"
fresh; runmig "$CM" close >/dev/null; runmig "$SM" save >/dev/null; expect "$(fp "$SI")/$(fp "$CI")" "$G" "C6 Close-then-Save gives byte-identical guarded definitions"
fresh; drift_cw; runmig "$SM" save >/dev/null; OUT=$(runmig "$CM" close); RC=$?
{ echo "$OUT" | grep -q "wrapper full-definition md5"; } && ok "C7 Close aborts fail-closed on wrapper drift" || bad C7 "$OUT"
expect "$([ "$(fp "$SI")" != $S0 ] && echo guarded)/$(fp "$CI")/$(HIST)" "guarded/$C0/save" "C8 Save committed with history; Close internal untouched; Close history row absent"
expect "$(probe $NP save)/$(probe $NP close)" "DENIED/OK" "C9 residual exposure confirmed (Close open)"
fix_cw; runmig "$CM" close >/dev/null; expect "$(fp "$SI")/$(fp "$CI")/$(HIST)" "$G/close,save" "C10 forward correction: re-run ONLY Close; end state and history as in the clean sequence"
fresh; runmig "$SM" save >/dev/null; { echo "begin;"; cat "$CM"; echo "select 1/0;"; echo "insert into public.mig_history_sim values ('close');"; echo "commit;"; } > "$TMP/f.sql"; q -f "$TMP/f.sql" >/dev/null 2>&1
expect "$(fp "$CI")/$(HIST)" "$C0/save" "C11 error AFTER the Close function replacement inside the runner transaction: Close restored to original, NO Close history row, Save untouched"
fresh; { echo "begin;"; cat "$SM"; cat "$CM"; echo "insert into public.mig_history_sim values ('both');"; echo "commit;"; } > "$TMP/both.sql"; q -f "$TMP/both.sql" >/dev/null 2>&1
expect "$(fp "$SI")/$(fp "$CI")/$(HIST)" "$G/both" "C12 optional: both UNMODIFIED files in ONE runner transaction work (helpers have distinct names) and give identical definitions"
fresh; drift_cw; q -f "$TMP/both.sql" >/dev/null 2>&1
expect "$(fp "$SI")/$(fp "$CI")/$(HIST)" "$S0/$C0/" "C13 optional single-transaction variant with Close drift: Save ALSO unguarded (all-or-nothing)"
ACK=I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL
fresh; runmig "$SM" save >/dev/null; runmig "$CM" close >/dev/null
OUT=$({ echo "set w506.rollback_owner_emergency_approval='$ACK';"; cat "$CR"; } | q 2>&1); { echo "$OUT" | grep -q interlock && [ "$(fp "$CI")" != $C0 ]; } && ok "C14 Save interlock does NOT authorise the Close rollback" || bad C14 "$OUT"
OUT=$({ echo "set w506.close_rollback_owner_emergency_approval='$ACK';"; cat "$SR"; } | q 2>&1); { echo "$OUT" | grep -q interlock && [ "$(fp "$SI")" != $S0 ]; } && ok "C15 Close interlock does NOT authorise the Save rollback" || bad C15 "$OUT"
{ echo "set w506.rollback_owner_emergency_approval='$ACK';"; cat "$SR"; } | q >/dev/null 2>&1
expect "$(probe $NP save)/$(probe $NP close)" "OK/DENIED" "C16 Save-only rollback reopens only Save; Close stays guarded"
runmig "$SM" save3 >/dev/null; expect "$(fp "$SI")/$(fp "$CI")" "$G" "C17 forward re-apply of Save restores the combined state"
echo "SUMMARY $N passed, $X failed"; [ $X -eq 0 ]
