#!/usr/bin/env bash
# Reconciled deployment order, executed in two fresh databases (this suite's main database is untouched).
# Negative cases print expected SQL errors to stderr; those are captured and shown only if the PASS marker is missing.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
run() { # $1 db  $2 file  $3 marker
  local out err; err="$(mktemp)"
  out="$(RETENTION_DB="$1" "$here/run_pg_tests.sh" "$2" 2>"$err")" || { echo "FAIL: $2"; cat "$err"; echo "$out"; exit 1; }
  echo "$out" | grep -q "^PASS $3" || { echo "FAIL: $2 missing marker"; cat "$err"; echo "$out"; exit 1; }
  echo "PASS $3"
}
run retention_order 14a_deploy_order.sql 14a_deploy_order_and_seed
run retention_order_neg 14b_planner_requires_engine.sql 14b_planner_requires_engine
