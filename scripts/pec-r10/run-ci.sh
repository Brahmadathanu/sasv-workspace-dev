#!/usr/bin/env bash
# Runs the guarded source (all must PASS) and the two negative controls (the
# mutation-sensitive tests MUST FAIL on unguarded sources). Exit 0 only if both hold.
set -u
H=$(dirname "$0")/concurrency-harness.sh; rc=0
g=$($H guarded); echo "$g"; echo "$g" | grep -q 'SOURCE=guarded FAILS=0' || { echo "GUARDED SOURCE HAS FAILURES"; rc=1; }
need() { # need <source> <ids...>: each id must report FAIL on the unguarded source
  local s=$1; shift; local o; o=$($H $s); echo "$o"
  for id in "$@"; do echo "$o" | grep -q "^RESULT $id FAIL" || { echo "NEGATIVE CONTROL $s DID NOT FAIL $id (test not mutation-sensitive)"; rc=1; }; done; }
need legacy S1 S2 S3a T1 T2 T4 T5 SR2 SR3 SR4
need r9proto T1 T2 T4 T5 SR2 SR3 SR4
[ $rc = 0 ] && echo PEC_R10_CONCURRENCY_HARNESS_PASS
exit $rc
