#!/usr/bin/env bash
# Rebuilds the local parity DB (scripts/audit/local-db on the audit branch), applies AU-3, runs the tests on synthetic data.
set -euo pipefail
PG="env PGOPTIONS=-cclient_min_messages=warning psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54329} -U postgres"
DDL=${LOCAL_DB_DIR:?set LOCAL_DB_DIR to the folder with load.py, bootstrap.sql, live_ddl.json}
$PG -qc "drop database if exists costing_local" -c "create database costing_local" -c "alter database costing_local set timezone='UTC'"
(cd "$DDL" && python3 load.py >/dev/null)
$PG -d costing_local -X -v ON_ERROR_STOP=1 -q -f "$(dirname "$0")/../../migrations/20261015210000_au3_tally_period_interpretation.sql"
$PG -d costing_local -X -q -P pager=off -f "$(dirname "$0")/au3_tally_tests.sql"
