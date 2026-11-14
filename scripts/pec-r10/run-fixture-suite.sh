#!/usr/bin/env bash
# F1-F4 orchestrator (disposable PostgreSQL only; PEC_FIXTURE_ONLY=1 and a local PGHOST are required).
# Exit 0 only if: guard mutation test passes, every guarded suite is all-PASS, and every negative
# control FAILS exactly where it must (so the tests are mutation-sensitive).
set -u
D=$(cd "$(dirname "$0")" && pwd); rc=0
need_pass() { # <label> <cmd...>: output must contain FAILS=0 and no RESULT ... FAIL
  local label=$1; shift; local o; o=$("$@" 2>&1); echo "$o"
  echo "$o" | grep -q "FAILS=0" || { echo "SUITE $label HAS FAILURES"; rc=1; }
  echo "$o" | grep -q "^RESULT [A-Za-z0-9]* FAIL" && { echo "SUITE $label HAS FAILED CHECKS"; rc=1; }
}
need_fail() { # <label> <ids,comma> <cmd...>: each listed id must report FAIL on this negative control
  local label=$1 ids=$2; shift 2; local o; o=$("$@" 2>&1); echo "$o"
  for id in ${ids//,/ }; do echo "$o" | grep -q "^RESULT $id FAIL" || { echo "NEGATIVE CONTROL $label DID NOT FAIL $id (test not mutation-sensitive)"; rc=1; }; done
}
echo "=== F1 guard + mutation test (no database needed) ==="
o=$(bash "$D/guard-mutation-test.sh" 2>&1); echo "$o" | grep -E "FAIL|MUTANT|SUMMARY|PEC_GUARD|BASELINE"
echo "$o" | grep -q PEC_GUARD_MUTATION_PASS || { echo "GUARD MUTATION TEST FAILED"; rc=1; }
echo "=== F2 writer / collision matrix ==="
need_pass matrix-guarded bash "$D/writer-matrix.sh" guarded
need_fail matrix-legacy C2,C4,C6 bash "$D/writer-matrix.sh" legacy
need_fail matrix-nowrap A3,A4 bash "$D/writer-matrix.sh" nowrap
echo "=== F1 real roles and grants ==="
need_pass roles-guarded bash "$D/roles-acl.sh" guarded
need_fail roles-open G5,G6 bash "$D/roles-acl.sh" open
need_fail roles-noperm G2,G3 bash "$D/roles-acl.sh" noperm
if [ -f "$D/risk-characterization.sh" ]; then
  echo "=== F4 residual-risk characterisation ==="
  need_pass risk bash "$D/risk-characterization.sh" guarded
fi
[ $rc = 0 ] && echo PEC_FIXTURE_SUITE_PASS
exit $rc
