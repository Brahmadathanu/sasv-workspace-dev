#!/usr/bin/env bash
# Full retention acceptance on an ISOLATED PostgreSQL (CI: postgres:17 service). Synthetic data only; never point at production.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
: "${PGHOST:?}"; : "${PGUSER:?}"
{ echo "server_version=$(psql -X -qAt -d postgres -c 'show server_version')"
"$here/run_pg_tests.sh" 01_seed.sql 02_apply_r1_r2a_r2b.sql 03_r2_adversarial.sql 04_r2_commit_and_concurrency.sh 05_r1_ledger.sql \
  06_r2c_cutover_and_purged_source.sql 07_r3_availability.sql 13_r3b_read_guards_verification.sql 08_r4_purge.sql 09_r4_resume_and_races.sh 10_r5_turnover.sql 11_r5_lock_and_isolation.sh 14_install_order.sh 15_r7_server_candidate.sh \
  12_preflight_scripts_parse.sql 2>&1; } | tee "${RETENTION_RECEIPT:-/tmp/retention-pg-receipt.txt}"
grep -q '^RETENTION_PG_TESTS_DONE$' "${RETENTION_RECEIPT:-/tmp/retention-pg-receipt.txt}"
if grep -E '^(FAIL|psql:.*ERROR)' "${RETENTION_RECEIPT:-/tmp/retention-pg-receipt.txt}"; then exit 1; fi
n=$(grep -cE '^PASS ' "${RETENTION_RECEIPT:-/tmp/retention-pg-receipt.txt}"); echo "RETENTION_PG_ALL_PASS count=$n"
