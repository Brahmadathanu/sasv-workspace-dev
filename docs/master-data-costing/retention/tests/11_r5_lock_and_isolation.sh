#!/usr/bin/env bash
set -uo pipefail
Q="psql -X -q -t -A -v ON_ERROR_STOP=1"
fail() { echo "FAIL: $*"; exit 1; }
# overlapping scheduler ticks: the second one must not run, must log LOCKED and delete nothing
( $Q -c "BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('costing-retention-tick',0)); SELECT pg_sleep(2); COMMIT;" >/dev/null ) &
pa=$!; sleep 0.5
n0="$($Q -c "SELECT count(*) FROM costing.sku_scheme_viability_snapshot")"
out="$($Q -c "SELECT costing_retention.retention_tick('EXECUTE')")"
wait $pa
echo "$out" | grep -q '"outcome": "LOCKED"' || fail "overlapping tick was not refused: $out"
[ "$($Q -c "SELECT count(*) FROM costing.sku_scheme_viability_snapshot")" = "$n0" ] || fail "locked tick deleted rows"
[ "$($Q -c "SELECT count(*) FROM costing_retention.retention_job_log WHERE outcome='LOCKED'")" -ge 1 ] || fail "LOCKED not logged"
echo "PASS overlapping-tick-refused"
# the dedicated job login: may run governed entry points, nothing else
EX() { PGPASSWORD=fixture_only psql -X -q -t -A -U sasv_retention_executor -c "$1" 2>&1; }
EX "SELECT 1" | grep -qx 1 || fail "executor login unavailable"
EX "SELECT costing_retention.retention_tick('DRY_RUN')" | grep -q PLANNED || fail "executor cannot run dry-run tick"
EX "SELECT count(*) FROM costing_retention.fn_plan_retention()" | grep -qE '^[0-9]+$' || fail "executor cannot read the read-only plan"
EX "SELECT count(*) FROM costing_retention.fn_purge_run_blockers(122)" | grep -qE '^[0-9]+$' || fail "executor cannot read blockers"
for sql in "SELECT * FROM costing.costing_run_retention_ledger" "SELECT * FROM costing.governance_evidence_event" "SELECT * FROM costing_retention.purge_allowlist" \
           "UPDATE costing_retention.retention_policy SET purge_enabled=true" "INSERT INTO costing_retention.purge_context VALUES(1,pg_current_xact_id(),1,'x')" \
           "DELETE FROM costing.sku_scheme_viability_snapshot" "DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=153" ; do
  out="$(EX "$sql")"; echo "$out" | grep -qiE "permission denied|must be owner|prohibited for terminal|AU2_DESIGNATED" || fail "executor allowed: $sql => $out"
done
out="$(EX "SELECT costing_retention.purge_run_step(153)")"; echo "$out" | grep -q "PURGE_BLOCKED" || fail "executor purge of approved run not blocked: $out"
echo "PASS executor-login-least-privilege"
