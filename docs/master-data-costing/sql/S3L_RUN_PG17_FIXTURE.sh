#!/usr/bin/env bash
# S3L: isolated PostgreSQL 17 acceptance. Synthetic data, no production secrets.
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=s3l_fixture
export PGUSER=postgres PGPASSWORD=fixture_only
sql_dir="docs/master-data-costing/sql"
admin() { PGUSER=postgres PGPASSWORD=fixture_only psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
login() { PGUSER=sasv_retention_executor PGPASSWORD=fixture_only psql -X -qAt -v ON_ERROR_STOP=1 -c "$1"; }
reject() {
  local name="$1" command="$2" role="${3:-postgres}"
  if PGUSER="$role" PGPASSWORD=fixture_only psql -X -qAt -v ON_ERROR_STOP=1 -c "$command" >"/tmp/s3l-${name}.log" 2>&1; then
    echo "S3L FAIL: $name unexpectedly permitted"; exit 1
  fi
  echo "S3L PASS rejected: $name"
}
assert_count() {
  local table="$1" run="$2" expected="$3" n
  n="$(admin "SELECT count(*) FROM costing.${table} WHERE refresh_run_id=${run}")"
  test "$n" = "$expected" || { echo "S3L COUNT FAIL ${table}/${run}: ${n} != ${expected}"; exit 1; }
}
psql -X -v ON_ERROR_STOP=1 -f "$sql_dir/S3L_SYNTHETIC_PG17_FIXTURE.sql" | tee /tmp/s3l-setup.txt
# Actual catalog-driven inventory acceptance on isolated synthetic schema.
# Production may have 64 direct run FKs; fixture deliberately has fewer.
psql -X -v ON_ERROR_STOP=1 -f "$sql_dir/S3M_FULL_RUN_DEPENDENCY_INVENTORY_READ_ONLY.sql" > /tmp/s3m-inventory.txt
test "$(admin "SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='costing.costing_refresh_run'::regclass")" -ge 2
grep -q 'marketing_signed_billed_sales_evidence_snapshot' /tmp/s3m-inventory.txt
grep -q 'marketing_regional_sales_evidence_snapshot' /tmp/s3m-inventory.txt
grep -q 'HOLD_GOVERNANCE_OR_STATE' /tmp/s3m-inventory.txt
echo "S3M_PG17_CATALOG_INVENTORY_PASS"
# Expected exact live function definitions. If fixture format differs, stop and
# inspect instead of silently weakening the existing guard signature check.
test "$(admin "SELECT md5(pg_get_functiondef('costing.fn_enforce_mutable_refresh_run_snapshot()'::regprocedure))")" = "2fc573625296de9ccde5d722fdd4a3de"
test "$(admin "SELECT md5(pg_get_functiondef('costing.fn_guard_designated_run_rows()'::regprocedure))")" = "5629ce76254a5ed45cde5529ce91caee"
echo "S3L PASS guard definition parity"
reject "preinstall-run87-snapshot-protection" "DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=1"
reject "preinstall-approved-snapshot-protection" "DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=3001"

# Positive suite relies only on review-scoped fixed fixture and isolated host.
psql -X -v ON_ERROR_STOP=1 -f "$sql_dir/S3K_STAGE_ONLY_RETENTION_EXECUTOR_REVIEW.sql" | tee /tmp/s3l-install.txt
test "$(admin "SELECT count(*) FROM costing_retention.sealed_batch_approval")" = "0"
reject "ordinary-superuser-session-not-maintenance-login" "SELECT costing_retention.execute_leaf_batch(1)"
reject "unsealed-dedicated-login" "SELECT costing_retention.execute_leaf_batch(1)" sasv_retention_executor
reject "direct-ordinary-user-update" "UPDATE costing.marketing_signed_billed_sales_evidence_snapshot SET marker='bad' WHERE id=1"
reject "direct-dedicated-login-delete" "DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=1" sasv_retention_executor
reject "direct-approved-delete" "DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=3001"
reject "spoofed-session-flag" "SET sasv.retention_staging_rehearsal='EXPLICIT_STAGE_RUN87'; DELETE FROM costing.marketing_signed_billed_sales_evidence_snapshot WHERE id=1"
assert_count "marketing_signed_billed_sales_evidence_snapshot" 87 1100
assert_count "marketing_regional_sales_evidence_snapshot" 87 1100

# This approval is wholly SYNTHETIC and not a real archival authorization.
admin "INSERT INTO costing_retention.sealed_batch_approval
(refresh_run_id,table_name,approved_total_rows,archive_sha256,restore_receipt_sha256,
 restore_verified,approver,expires_at)
VALUES (87,'marketing_signed_billed_sales_evidence_snapshot',1100,
 repeat('a',64),repeat('b',64),true,'fixture_only',clock_timestamp()+interval '1 day')"
reject "login-cannot-forge-sealed-approval" "INSERT INTO costing_retention.sealed_batch_approval (refresh_run_id) VALUES (143)" sasv_retention_executor
reject "login-cannot-see-private-manifest" "SELECT * FROM costing_retention.sealed_batch_approval" sasv_retention_executor

# Rollback test: batch deletion and receipt must disappear together.
test "$(login "BEGIN; SELECT costing_retention.execute_leaf_batch(1); ROLLBACK;")" != "" || exit 1
assert_count "marketing_signed_billed_sales_evidence_snapshot" 87 1100
test "$(admin "SELECT count(*) FROM costing_retention.batch_receipt")" = 0
echo "S3L PASS transaction rollback"

test "$(login "SELECT costing_retention.execute_leaf_batch(1)")" = 500
assert_count "marketing_signed_billed_sales_evidence_snapshot" 87 600
test "$(login "SELECT costing_retention.execute_leaf_batch(1)")" = 500
assert_count "marketing_signed_billed_sales_evidence_snapshot" 87 100
test "$(login "SELECT costing_retention.execute_leaf_batch(1)")" = 100
assert_count "marketing_signed_billed_sales_evidence_snapshot" 87 0
test "$(admin "SELECT state FROM costing_retention.sealed_batch_approval WHERE id=1")" = COMPLETE
test "$(admin "SELECT count(*) FROM costing_retention.batch_receipt WHERE approval_id=1")" = 3
reject "completed-approval-reuse" "SELECT costing_retention.execute_leaf_batch(1)" sasv_retention_executor

# Negative protected 143 (even with forged synthetic approval).
admin "INSERT INTO costing_retention.sealed_batch_approval
(refresh_run_id,table_name,approved_total_rows,archive_sha256,restore_receipt_sha256,
 restore_verified,approver,expires_at)
VALUES (143,'marketing_signed_billed_sales_evidence_snapshot',1,
 repeat('a',64),repeat('b',64),true,'fixture_only',clock_timestamp()+interval '1 day')"
reject "approved-run-143-positive-bypass" "SELECT costing_retention.execute_leaf_batch(2)" sasv_retention_executor

# Independent second leaf-table acceptance, including 500/500/100 receipts.
admin "INSERT INTO costing_retention.sealed_batch_approval
(refresh_run_id,table_name,approved_total_rows,archive_sha256,restore_receipt_sha256,
 restore_verified,approver,expires_at)
VALUES (87,'marketing_regional_sales_evidence_snapshot',1100,
 repeat('c',64),repeat('d',64),true,'fixture_only',clock_timestamp()+interval '1 day')"
test "$(login "SELECT costing_retention.execute_leaf_batch(3)")" = 500
assert_count "marketing_regional_sales_evidence_snapshot" 87 600
test "$(login "SELECT costing_retention.execute_leaf_batch(3)")" = 500
assert_count "marketing_regional_sales_evidence_snapshot" 87 100
test "$(login "SELECT costing_retention.execute_leaf_batch(3)")" = 100
assert_count "marketing_regional_sales_evidence_snapshot" 87 0
test "$(admin "SELECT state FROM costing_retention.sealed_batch_approval WHERE id=3")" = COMPLETE
test "$(admin "SELECT count(*) FROM costing_retention.batch_receipt WHERE approval_id=3")" = 3
reject "regional-completed-approval-reuse" "SELECT costing_retention.execute_leaf_batch(3)" sasv_retention_executor
assert_count "marketing_signed_billed_sales_evidence_snapshot" 122 1
assert_count "marketing_signed_billed_sales_evidence_snapshot" 153 1
assert_count "marketing_regional_sales_evidence_snapshot" 122 1
assert_count "marketing_regional_sales_evidence_snapshot" 153 1
echo S3L_PG17_FIXTURE_PASS
