#!/usr/bin/env bash
# WP05-W506-CONF-01 -- isolated verification of the personnel-confidentiality view gate. SYNTHETIC dependencies only.
# Never run against production, Supabase, or any shared database. The three views are created from the repository's TB2 migration
# text (supabase/migrations/20261019134900_*); the migration under test carries 4 pinned live fingerprints which this runner replaces with
# the md5s of the scaffold's own definitions in a SCRATCH COPY (the only substitution; the committed files are never modified).
# This proves the mechanics on the repo-recorded definitions; it does NOT prove the live definitions match -- that needs the owner readback.
# Interlocks: absolute unix-socket PGHOST; data_directory basename w506-disposable-*; superuser; unique scratch DB dropped on exit.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../../.." && pwd)"
MIG="$ROOT/supabase/migrations/20261110071308_wp05_w506_conf_01_personnel_view_gate.sql"
RB="$ROOT/docs/master-data-costing/prepared/WP05_W506_CONF_01_ROLLBACK.sql"
TB2="$ROOT/supabase/migrations/20261019134900_tb2_costing_view_permission_gate.sql"
ACK='I-HAVE-OWNER-EMERGENCY-APPROVAL-AND-AN-ALTERNATIVE-CONTROL'
case "${PGHOST:-}" in /*) ;; *) echo "refusing: PGHOST must be an absolute unix-socket directory"; exit 2;; esac
P="psql -X -q -v ON_ERROR_STOP=1 -At"
DD=$($P -d postgres -c "show data_directory" 2>/dev/null) || { echo "cannot connect"; exit 2; }
case "$(basename "$DD")" in w506-disposable-*) ;; *) echo "refusing: data_directory '$DD' is not a w506-disposable-* cluster"; exit 2;; esac
[ "$($P -d postgres -c "select rolsuper from pg_roles where rolname=current_user")" = "t" ] || { echo "refusing: need superuser"; exit 2; }
TMP="$(mktemp -d "${TMPDIR:-/tmp}/w506conf.XXXXXX")" || exit 2; DB="w506_conf_$(date +%s)_$$"; CREATED=0; N=0; X=0
cleanup() { if [ "$CREATED" = 1 ]; then $P -d postgres -c "drop database \"$DB\"" >/dev/null 2>&1; fi; rm -rf "$TMP"; }
trap cleanup EXIT
$P -d postgres -c "create database \"$DB\"" || { echo "could not create unique scratch database"; exit 2; }; CREATED=1
q() { $P -d "$DB" "$@"; }
ok() { echo "PASS  $1"; N=$((N+1)); }; bad() { echo "FAIL  $1  $2"; X=$((X+1)); }
V1=v_costing_staff_classification_register; V2=v_costing_unclassified_staff_for_costing; V3=v_costing_staff_cost_pool_summary
VD() { q -c "select md5(pg_get_viewdef('public.$1'::regclass))"; }
ALLV() { echo "$(VD $V1)/$(VD $V2)/$(VD $V3)"; }
META() { q -c "select string_agg(c.oid||'|'||c.relowner::regrole||'|'||coalesce(c.relacl::text,'')||'|'||coalesce(c.reloptions::text,'')||'|'||(select string_agg(a.attname||':'||format_type(a.atttypid,a.atttypmod),',' order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped), E'\n' order by c.oid) from pg_class c where c.oid in ('public.$V1'::regclass,'public.$V2'::regclass,'public.$V3'::regclass)"; }
build() {
  q -c "drop schema if exists costing cascade; drop schema if exists hr cascade; drop schema if exists t cascade; drop view if exists public.$V2, public.$V1, public.$V3, public.v_costing_staff_costing_class_options; drop table if exists public.user_permissions_canonical, public.mig_history_sim; drop function if exists public.fn_costing_personnel_view_allowed(), public.fn_costing_view_allowed(), public.app_has_permission(text,text), public.t_definer_probe()" >/dev/null 2>&1
  q -f "$HERE/scaffold.sql" >/dev/null || { echo "scaffold failed"; exit 2; }
  if [ "${FIXTURE_MODE:-0}" = 1 ]; then
    q -f "$HERE/live_view_definitions_pg17_20261109.sql" >/dev/null || { echo "PG17 fixture view creation failed"; exit 2; }
  else
    awk '/^create or replace view public\.(v_costing_staff_classification_register|v_costing_staff_cost_pool_summary|v_costing_unclassified_staff_for_costing) as/{f=1} f{print} /^where \(select public\.fn_costing_view_allowed\(\)\);/{f=0}' "$TB2" > "$TMP/views.sql"
    q -f "$TMP/views.sql" >/dev/null || { echo "TB2 view extraction/creation failed"; exit 2; }
  fi
  q -c "grant select on public.$V1, public.$V2, public.$V3 to authenticated, service_role; create table public.mig_history_sim(v text)" >/dev/null
  GATEFP=$(q -c "select md5(pg_get_functiondef('public.fn_costing_view_allowed()'::regprocedure))")
  FP1=$(VD $V1); FP2=$(VD $V2); FP3=$(VD $V3)
  if [ "${FIXTURE_MODE:-0}" = 1 ]; then  # use the RECORDED live PG17.4 fingerprints (not the locally computed ones)
    FP1=$(grep -E "^-- $V1: " "$HERE/live_view_definitions_pg17_20261109.sql" | sed -E 's/.*: //'); FP2=$(grep -E "^-- $V2: " "$HERE/live_view_definitions_pg17_20261109.sql" | sed -E 's/.*: //'); FP3=$(grep -E "^-- $V3: " "$HERE/live_view_definitions_pg17_20261109.sql" | sed -E 's/.*: //')
  fi
  for f in "$MIG:$TMP/mig.sql" "$RB:$TMP/rb.sql"; do
    sed -e "s/2447f6b30fdc11e5e5dac487619b9142/$FP1/; s/659a7d0e992a7bae23b4b0409d33a161/$FP2/; s/80d1a1a4f2e3add5eae58acac99e14fd/$FP3/; s/a5c51f50421d35a7207878c237fff273/$GATEFP/" "${f%%:*}" > "${f##*:}"
  done
}
rbrun() { { echo "set w506.personnel_gate_rollback_owner_emergency_approval = '$1';"; cat "$TMP/rb.sql"; } > "$TMP/rbx.sql"; q -f "$TMP/rbx.sql" 2>&1; }
mutate() { q -c "$1" >/dev/null 2>"$TMP/mut.err" || bad "mutation failed (test bug): $1" "$(head -2 "$TMP/mut.err")"; }
expect_abort() { local a b out rc; a=$(ALLV); out=$(q -f "$2" 2>&1); rc=$?; b=$(ALLV); if [ $rc -ne 0 ] && echo "$out" | grep -qE "$3" && [ "$a" = "$b" ]; then ok "$1"; else bad "$1" "rc=$rc :: $(echo "$out" | head -2)"; fi; }
echo "SERVER: $(q -c "select version()")"
echo "FILES : migration sha256=$(sha256sum "$MIG" | cut -c1-16)  rollback sha256=$(sha256sum "$RB" | cut -c1-16)  tb2 sha256=$(sha256sum "$TB2" | cut -c1-16)"
build
ORIG=$(ALLV); M0=$(META)
# ---- P0 negative test: deliberately corrupt the pinned register fingerprint in a SCRATCH COPY.
# This must fail before any persistent helper/view change; do not execute the pinned file on synthetic TB2 where it could succeed.
sed 's/2447f6b30fdc11e5e5dac487619b9142/00000000000000000000000000000000/' "$MIG" > "$TMP/mig_wrong_pin.sql"
OUT=$(q -f "$TMP/mig_wrong_pin.sql" 2>&1)
if [ $? -ne 0 ] && [ "$(ALLV)" = "$ORIG" ] && [ "$(q -c "select to_regprocedure('public.fn_costing_personnel_view_allowed()') is null")" = t ]; then
  ok "P0 wrong pinned register fingerprint aborts atomically before any persistent change"
else
  bad "P0 wrong pinned fingerprint interlock" "$OUT"
fi
# ---- P1 baseline exposure on the repo-recorded definitions
q -c "insert into public.user_permissions_canonical values ('00000000-0000-0000-0000-0000000000e1','module:cost-sheet-review',true,false) on conflict do nothing" >/dev/null
R=$(q <<'SQL' 2>&1 | tail -1
begin; set local role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',true);
select (select count(*) from public.v_costing_staff_classification_register where total_salary_cost is not null)||'/'||(select count(*) from public.v_costing_staff_cost_pool_summary where staff_details is not null); rollback;
SQL
)
[ "$R" = "2/1" ] && ok "P1 baseline (TB2 definitions): a Cost-Sheet-Review-only user reads individual salary rows and staff_details -> finding reproduced" || bad "P1 baseline" "$R"
q -c "delete from public.user_permissions_canonical" >/dev/null
# ---- P2 apply (scratch copy with the four pinned hashes substituted for synthetic scaffold fingerprints)
OUT=$(q -f "$TMP/mig.sql" 2>&1) && ok "P2 migration applies to the repo-recorded view definitions" || bad "P2 apply" "$OUT"
PATCHED=$(ALLV); [ "$PATCHED" != "$ORIG" ] && ok "P2b all three view definitions changed" || bad "P2b" ""
[ "$(META)" = "$M0" ] && ok "P2c columns (names/types/order), owner, ACL and reloptions of all three views unchanged" || bad "P2c" "$(META)"
q -f "$HERE/matrix.sql" > "$TMP/matrix.out" 2>&1; cat "$TMP/matrix.out"
grep -q "FAILURES=0 OF" "$TMP/matrix.out" && ok "P3 identity matrix: $(grep -o 'FAILURES=0 OF [0-9]*' "$TMP/matrix.out") rows PASS" || bad "P3 matrix" "see rows above"
# ---- P4 idempotency
OUT=$(q -f "$TMP/mig.sql" 2>&1); [ "$(ALLV)" = "$PATCHED" ] && [ "$(echo "$OUT" | grep -c 'already patched')" = 3 ] && ok "P4 second application: verified no-op for all three views" || bad "P4" "$OUT"
# ---- P5 drift (each must abort with nothing changed)
build; mutate "create or replace view public.$V1 as select q.* from ($(q -c "select pg_get_viewdef('public.$V1'::regclass)" | sed 's/;$//')) q"
expect_abort "P5a drifted register view (extra wrapper) -> abort" "$TMP/mig.sql" "neither the verified original|drift"
build; mutate "create or replace function public.fn_costing_view_allowed() returns boolean language sql stable security invoker set search_path = public, pg_temp as \$f\$ select true \$f\$"
expect_abort "P5b altered fn_costing_view_allowed() -> abort" "$TMP/mig.sql" "differs from the verified definition"
build; sed -e "s/$FP2/00000000000000000000000000000000/" "$TMP/mig.sql" > "$TMP/mig_badfp.sql"
expect_abort "P5c wrong fingerprint for one view -> abort, no view changed (atomic DO)" "$TMP/mig_badfp.sql" "neither the verified original|drift"
build; mutate "drop view public.$V2; create view public.$V2 as select * from public.$V1"; expect_abort "P5d replaced unclassified view -> abort" "$TMP/mig.sql" "neither the verified original|drift|exactly once|anchor"
# ---- P6 rollback
build; M0=$(META); q -f "$TMP/mig.sql" >/dev/null 2>&1; PATCHED=$(ALLV)
OUT=$(rbrun wrong); [ "$(ALLV)" = "$PATCHED" ] && echo "$OUT" | grep -q interlock && ok "P6a rollback without the interlock aborts" || bad "P6a" "$OUT"
OUT=$(rbrun "$ACK") && [ "$(ALLV)" = "$ORIG" ] && ok "P6b rollback (with interlock) restores all three original definitions" || bad "P6b" "$OUT"
[ "$(META)" = "$M0" ] && ok "P6c metadata equal after rollback" || bad "P6c" ""
OUT=$(rbrun "$ACK"); echo "$OUT" | grep -c "already the verified original" | grep -q 3 && ok "P6d second rollback is a verified no-op" || bad "P6d" "$OUT"
q -f "$TMP/mig.sql" >/dev/null 2>&1; [ "$(ALLV)" = "$PATCHED" ] && ok "P6e re-apply after rollback reproduces the identical patched definitions" || bad "P6e" ""
mutate "create or replace view public.$V1 as select q.* from ($(q -c "select pg_get_viewdef('public.$V1'::regclass)" | sed 's/;$//')) q"; DR=$(ALLV)
OUT=$(rbrun "$ACK"); [ "$(ALLV)" = "$DR" ] && echo "$OUT" | grep -q "drift" && ok "P6f rollback aborts on a drifted definition" || bad "P6f" "$OUT"
# ---- P7 runner compatibility (simulated runners; the real Supabase runner is not available here)
build; { echo "begin;"; cat "$TMP/mig.sql"; echo "select 1/0;"; echo "insert into public.mig_history_sim values ('v');"; echo "commit;"; } > "$TMP/r.sql"
q -f "$TMP/r.sql" >/dev/null 2>&1; [ "$(ALLV)" = "$ORIG" ] && [ "$(q -c 'select count(*) from public.mig_history_sim')" = 0 ] && ok "P7a error after the view replacement inside a runner transaction: views restored, no history row" || bad "P7a" ""
{ echo "begin;"; cat "$TMP/mig.sql"; echo "insert into public.mig_history_sim values ('v');"; echo "commit;"; } > "$TMP/r2.sql"
q -f "$TMP/r2.sql" >/dev/null 2>&1; [ "$(ALLV)" != "$ORIG" ] && [ "$(q -c 'select count(*) from public.mig_history_sim')" = 1 ] && ok "P7b runner transaction: views and history row commit together" || bad "P7b" ""
build; q -c "$(cat "$TMP/mig.sql"; echo "select 1/0;")" >/dev/null 2>&1; [ "$(ALLV)" = "$ORIG" ] && ok "P7c whole file as one multi-statement simple query with a later error: implicit transaction rolls everything back" || bad "P7c" ""
# ---- P8 failure injection inside the SAME atomic DO: helper and all view changes must roll back.
# Only scratch copies of the migration are altered; production/committed SQL untouched.
build; ORIG=$(ALLV); M0=$(META)
python3 - "$TMP/mig.sql" "$TMP/inject_helper.sql" "$TMP/inject_view1.sql" "$TMP/inject_view2.sql" <<'PY'
import pathlib, sys
src = pathlib.Path(sys.argv[1]).read_text()
helper_anchor = "  for v_i in 1 .. array_length(v_views, 1) loop"
view_anchor = "    execute format('create or replace view public.%I%s as %s', v_name, v_with, v_new);"
assert src.count(helper_anchor) == 1, "helper injection anchor must be unique"
assert src.count(view_anchor) == 1, "view CREATE anchor must be unique"
pathlib.Path(sys.argv[2]).write_text(src.replace(helper_anchor,
    "  raise exception 'W506_TEST_ABORT_AFTER_HELPER';\n" + helper_anchor, 1))
for path, view_i in [(sys.argv[3], 1), (sys.argv[4], 2)]:
    injection = ("\n    if v_i = " + str(view_i) +
                 " then raise exception 'W506_TEST_ABORT_AFTER_VIEW" + str(view_i) +
                 "'; end if;")
    pathlib.Path(path).write_text(src.replace(view_anchor, view_anchor + injection, 1))
PY
OUT=$(q -f "$TMP/inject_helper.sql" 2>&1)
if echo "$OUT" | grep -q W506_TEST_ABORT_AFTER_HELPER && [ "$(ALLV)" = "$ORIG" ] && [ "$(META)" = "$M0" ] && [ "$(q -c "select to_regprocedure('public.fn_costing_personnel_view_allowed()') is null")" = t ]; then
  ok "P8a forced exception after helper CREATE/ACL leaves no helper and no view/metadata change"
else
  bad "P8a helper atomicity" "$OUT"
fi
OUT=$(q -f "$TMP/inject_view1.sql" 2>&1)
if echo "$OUT" | grep -q W506_TEST_ABORT_AFTER_VIEW1 && [ "$(ALLV)" = "$ORIG" ] && [ "$(META)" = "$M0" ] && [ "$(q -c "select to_regprocedure('public.fn_costing_personnel_view_allowed()') is null")" = t ]; then
  ok "P8b forced exception immediately after first view replacement leaves no helper and no view/metadata change"
else
  bad "P8b first-view atomicity" "$OUT"
fi
OUT=$(q -f "$TMP/inject_view2.sql" 2>&1)
if echo "$OUT" | grep -q W506_TEST_ABORT_AFTER_VIEW2 && [ "$(ALLV)" = "$ORIG" ] && [ "$(META)" = "$M0" ] && [ "$(q -c "select to_regprocedure('public.fn_costing_personnel_view_allowed()') is null")" = t ]; then
  ok "P8c forced exception immediately after second view replacement leaves no helper and no view/metadata change"
else
  bad "P8c second-view atomicity" "$OUT"
fi
# Reapply ordinary migration after all three induced failures, proving failed attempts leave a clean baseline.
OUT=$(q -f "$TMP/mig.sql" 2>&1)
if [ $? -eq 0 ] && [ "$(ALLV)" != "$ORIG" ] && [ "$(q -c "select to_regprocedure('public.fn_costing_personnel_view_allowed()') is not null")" = t ]; then
  ok "P8d normal apply succeeds after all three atomicity failures"
else
  bad "P8c recovery" "$OUT"
fi
# ---- P9 captured live PostgreSQL 17.4 view-definition fixture (schema-only; see live_view_definitions_pg17_20261109.sql)
FIXTURE_MODE=1; build
LIVE1=$(grep -E "^-- $V1: " "$HERE/live_view_definitions_pg17_20261109.sql" | sed -E 's/.*: //'); LIVE2=$(grep -E "^-- $V2: " "$HERE/live_view_definitions_pg17_20261109.sql" | sed -E 's/.*: //'); LIVE3=$(grep -E "^-- $V3: " "$HERE/live_view_definitions_pg17_20261109.sql" | sed -E 's/.*: //')
[ "$(VD $V1)/$(VD $V2)/$(VD $V3)" = "$LIVE1/$LIVE2/$LIVE3" ] && ok "P9a live-17.4 fixture recreated on this server deparses to the three recorded live md5 fingerprints (no deparse mismatch)" || bad "P9a deparse parity" "$(VD $V1)/$(VD $V2)/$(VD $V3) vs $LIVE1/$LIVE2/$LIVE3"
M0=$(META); FORIG=$(ALLV)
OUT=$(q -f "$TMP/mig.sql" 2>&1) && [ "$(ALLV)" != "$FORIG" ] && ok "P9b unmodified migration (live view fingerprints filled) applies to the live-17.4 view definitions" || bad "P9b" "$OUT"
[ "$(META)" = "$M0" ] && ok "P9c columns/owner/ACL/reloptions unchanged on the fixture views" || bad "P9c" ""
FP9=$(ALLV); OUT=$(q -f "$TMP/mig.sql" 2>&1); [ "$(ALLV)" = "$FP9" ] && [ "$(echo "$OUT" | grep -c 'already patched')" = 3 ] && ok "P9d idempotent on the fixture views" || bad "P9d" "$OUT"
q -f "$HERE/matrix.sql" > "$TMP/matrix9.out" 2>&1; grep -q "FAILURES=0 OF" "$TMP/matrix9.out" && ok "P9e identity matrix on the live-17.4 definitions: $(grep -o 'FAILURES=0 OF [0-9]*' "$TMP/matrix9.out") rows PASS" || bad "P9e matrix" "$(grep -E '\|FAIL\|' "$TMP/matrix9.out" | head -3)"
OUT=$(rbrun "$ACK") && [ "$(ALLV)" = "$FORIG" ] && ok "P9f rollback restores the exact live-17.4 definitions (recorded fingerprints)" || bad "P9f" "$OUT"
FIXTURE_MODE=0
echo "SUMMARY: $N passed, $X failed (runner checks; identity matrix reported separately as SQL rows)"
[ $X -eq 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"; exit $X
