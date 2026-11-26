#!/usr/bin/env bash
# R7 stage-1 candidate in its own database; expected "R7 blocked" errors are captured, shown only on failure.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
err="$(mktemp)"
out="$(RETENTION_DB=retention_r7 "$here/run_pg_tests.sh" 15_r7_server_candidate.sql 2>"$err")" || { echo "FAIL: 15_r7"; cat "$err"; echo "$out"; exit 1; }
echo "$out" | grep -q "^PASS 15_r7_server_candidate" || { echo "FAIL: 15_r7 missing marker"; cat "$err"; echo "$out"; exit 1; }
echo "PASS 15_r7_server_candidate"
