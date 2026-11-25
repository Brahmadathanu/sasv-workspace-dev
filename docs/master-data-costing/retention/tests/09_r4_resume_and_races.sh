#!/usr/bin/env bash
set -uo pipefail
Q="psql -X -q -t -A -v ON_ERROR_STOP=1"
fail() { echo "FAIL: $*"; exit 1; }
# 1. resumable: three independent transactions with tiny batches leave the run PURGE_IN_PROGRESS and unavailable
for i in 1 2 3; do $Q -c "SELECT costing_retention.purge_run_step(148,2)" >/dev/null || fail "step $i"; done
[ "$($Q -c "SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=148")" = PURGE_IN_PROGRESS ] || fail "state after partial purge"
[ "$($Q -c "SELECT available FROM costing_retention.fn_run_detail_availability(148)")" = f ] || fail "partial purge must be unavailable"
[ "$($Q -c "SELECT count(*) FROM costing_retention.fn_purge_run_blockers(148)")" = 0 ] || fail "in-progress run must stay resumable"
echo "PASS resumable-partial-state"
# 2. serialisation with approval/lock/supersession: same advisory key as public.rpc_costing_approve_run
( $Q -c "BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('cost-period-governance:2026-10-01',0)); SELECT pg_sleep(2.5); COMMIT;" >/dev/null ) &
pa=$!; sleep 0.6
t0=$(date +%s%N); $Q -c "SELECT costing_retention.purge_run_step(148,2)" >/dev/null || fail "blocked step"; t1=$(date +%s%N)
wait $pa
ms=$(( (t1-t0)/1000000 )); [ "$ms" -ge 1500 ] || fail "purge did not wait for the period governance lock (${ms}ms)"
echo "PASS purge-waits-for-period-governance-lock (${ms}ms)"
# 3. two concurrent purge drivers on the same run: exactly one seal, exact accounting
drive() { for i in $(seq 1 60); do out="$($Q -c "SELECT costing_retention.purge_run_step(148,1)" 2>&1)" || { echo "$out" >>/tmp/drv_err_$1.log; return 1; }; echo "$out" | grep -q '"done": true' && return 0; done; return 1; }
rm -f /tmp/drv_err_*.log
drive A & p1=$!; drive B & p2=$!
wait $p1 || fail "driver A: $(cat /tmp/drv_err_A.log 2>/dev/null)"; wait $p2 || fail "driver B: $(cat /tmp/drv_err_B.log 2>/dev/null)"
[ "$($Q -c "SELECT detail_state FROM costing.costing_run_retention_ledger WHERE refresh_run_id=148")" = DETAILS_PURGED ] || fail "not sealed"
[ "$($Q -c "SELECT count(*) FROM costing_retention.purge_step_receipt WHERE refresh_run_id=148 AND kind='FINAL'")" = 1 ] || fail "FINAL receipts != 1"
[ "$($Q -c "SELECT sum(deleted_rows) FROM costing_retention.purge_step_receipt WHERE refresh_run_id=148 AND kind='STEP'")" = 20 ] || fail "step accounting != 20 rows (4 tables x 5)"
[ "$($Q -c "SELECT (SELECT sum((value)::int) FROM jsonb_each_text(removed_row_counts)) FROM costing.costing_run_retention_ledger WHERE refresh_run_id=148")" = 20 ] || fail "ledger removed counts"
echo "PASS concurrent-drivers-exact-accounting"
# 4. stale preview: a run that was eligible at preview time becomes designated before execution
$Q <<'SQL' >/dev/null || fail "setup run 170"
INSERT INTO costing.costing_refresh_run(id,period_start,valuation_date,overall_status,valuation_context_source,finished_at) VALUES(170,'2026-10-01','2026-10-24','RUNNING','CAPTURED_AT_REQUEST',NULL);
INSERT INTO costing.marketing_signed_billed_sales_evidence_snapshot(refresh_run_id,marker) SELECT 170,'x'||g FROM generate_series(1,5) g;
UPDATE costing.costing_refresh_run SET overall_status='SUCCESS',finished_at='2026-10-24 10:00+05:30' WHERE id=170;
SQL
[ "$($Q -c "SELECT count(*) FROM costing_retention.fn_purge_run_blockers(170)")" = 0 ] || fail "170 should look eligible"
$Q -c "SELECT count(*) FROM costing_retention.fn_purge_run_preview(170)" >/dev/null
$Q -c "INSERT INTO costing.costing_run_designation(refresh_run_id,period_start,designation,designated_by,reason) VALUES(170,'2026-10-01','REFERENCE','owner','designated after the stale preview was taken')" >/dev/null
out="$($Q -c "SELECT costing_retention.purge_run_step(170)" 2>&1)"; echo "$out" | grep -q "DESIGNATION_HISTORY" || fail "stale preview executed: $out"
[ "$($Q -c "SELECT count(*) FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE refresh_run_id=170")" = 5 ] || fail "designated run lost rows"
echo "PASS stale-preview-recomputed-at-execution"
