#!/usr/bin/env bash
# Server-side checks for the PREPARED scoped RPC against a DISPOSABLE LOCAL PostgreSQL (synthetic fixture).
# Usage: PSQL_ARGS="-h /tmp/pgs -U postgres" ./run.sh      Refuses non-local hosts. Never use against Supabase.
set -euo pipefail
cd "$(dirname "$0")"; ROOT="$(cd ../.. && pwd)"
ARGS="${PSQL_ARGS:-}"
case "$ARGS" in *"-h /"*|*"-h localhost"*|*"-h 127.0.0.1"*) ;; *) echo "refusing: local socket/loopback only"; exit 2;; esac
PREP="$ROOT/docs/master-data-costing/prepared/PREPARED_20261111_csr_scoped_comparison_rpc.sql"
ROLLBACK="$ROOT/docs/master-data-costing/prepared/PREPARED_20261111_csr_scoped_comparison_rpc_rollback.sql"
DB=csr_scoped_rpc_server
psql $ARGS -qAt -d postgres -c "DROP DATABASE IF EXISTS $DB"; psql $ARGS -qAt -d postgres -c "CREATE DATABASE $DB"
P="psql $ARGS -v ON_ERROR_STOP=1 -q -d $DB"
$P -f ../csr-local-pg-harness/fixture.sql >/dev/null
../csr-local-pg-harness/build_objects.sh views-only | $P
$P -f security_setup.sql
fingerprint() { $P -AtX -c "SELECT md5(pg_get_viewdef('costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass)||pg_get_viewdef('public.v_cost_sheet_snapshot_sku_monthly_comparison_governed'::regclass)||(SELECT string_agg(indexdef,'|' ORDER BY indexname) FROM pg_indexes WHERE schemaname='costing' AND tablename='cost_sheet_line_monthly_snapshot')||(SELECT count(*)::text FROM costing.cost_sheet_line_monthly_snapshot)||current_setting('statement_timeout'))"; }
expect_fail() { # name file-or-sql pattern
  local out; if out=$($P -f "$2" 2>&1); then echo "TEST FAIL $1: expected failure"; exit 1; fi
  echo "$out" | grep -q "$3" || { echo "TEST FAIL $1: wrong error: $out"; exit 1; }
  echo "PASS  $1"; }
FP0=$(fingerprint)
echo "== GUARDS (must fail closed and leave no function) =="
TMP=$(mktemp -d)
sed 's/63adf7946b8d7f99a01a05e5e54d00be/00000000000000000000000000000000/' "$PREP" > "$TMP/badhash.sql"
expect_fail "G1 view hash drift aborts" "$TMP/badhash.sql" "contract drift"
$P -c "CREATE FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date) RETURNS int LANGUAGE sql AS 'select 1'"
expect_fail "G2 any pre-existing overload aborts" "$PREP" "already exists"
$P -c "DROP FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped(date)"
sed '/FROM PUBLIC;/d' "$PREP" | sed 's/TO authenticated;/TO authenticated, PUBLIC;/' > "$TMP/publicgrant.sql"
expect_fail "G3 post-condition aborts on PUBLIC execute and rolls back atomically" "$TMP/publicgrant.sql" "can execute"
[ "$($P -AtX -c "select count(*) from pg_proc where proname='rpc_get_cost_sheet_sku_monthly_comparison_scoped'")" = 0 ] || { echo "TEST FAIL G3: function leaked after aborted txn"; exit 1; }
echo "PASS  G4 no function left behind after failed applies"
echo "== APPLY prepared SQL (local disposable DB only) =="
$P -f "$PREP"
expect_fail "G5 second apply refused (no overwrite)" "$PREP" "already exists"
$P -f security_tests.sql
$P -f bag_equivalence.sql
echo "== ROLLBACK + ROLL-FORWARD =="
FP1=$(fingerprint); [ "$FP0" = "$FP1" ] || { echo "TEST FAIL: forward apply changed view/index/data/timeout fingerprint"; exit 1; }
echo "PASS  R0 forward apply changed no view, index, data row count or statement_timeout"
$P -f "$ROLLBACK"
[ "$($P -AtX -c "select count(*) from pg_proc where proname='rpc_get_cost_sheet_sku_monthly_comparison_scoped'")" = 0 ] || { echo "TEST FAIL R1 function remains"; exit 1; }
echo "PASS  R1 rollback removes the function"
FP2=$(fingerprint); [ "$FP0" = "$FP2" ] || { echo "TEST FAIL R2 rollback state differs from pre-state"; exit 1; }
echo "PASS  R2 post-rollback state fingerprint equals pre-apply state"
expect_fail "R3 rollback refuses when function absent" "$ROLLBACK" "expected exactly one"
$P -f "$PREP"; echo "PASS  R4 roll-forward after rollback applies cleanly"
$P -f security_tests.sql >/dev/null; echo "PASS  R5 security tests re-pass after roll-forward"
rm -rf "$TMP"
echo "SERVER CHECKS COMPLETE"
