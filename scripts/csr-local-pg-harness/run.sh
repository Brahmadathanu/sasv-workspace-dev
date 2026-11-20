#!/usr/bin/env bash
# Disposable LOCAL PostgreSQL harness for the Cost Comparison (#273) investigation.
# Usage: PSQL_ARGS="-h /tmp/pgs -U postgres" ./run.sh   (a throw-away local server you started yourself)
# Refuses anything that is not a local unix socket / loopback. Never point this at Supabase.
set -euo pipefail
cd "$(dirname "$0")"
ARGS="${PSQL_ARGS:-}"
case "$ARGS" in
  *"-h /"*|*"-h localhost"*|*"-h 127.0.0.1"*) ;;
  *) echo "refusing: PSQL_ARGS must name a local socket dir or loopback host (-h /path | -h localhost)"; exit 2;;
esac
DB=csr_local_fixture
psql $ARGS -qAt -d postgres -c "DROP DATABASE IF EXISTS $DB"
psql $ARGS -qAt -d postgres -c "CREATE DATABASE $DB"
P="psql $ARGS -v ON_ERROR_STOP=1 -q -d $DB"
$P -f fixture.sql
./build_objects.sh | $P
$P -f parity_and_plan.sql
$P -f timing.sql
$P -f projection.sql
echo "HARNESS COMPLETE (synthetic data; relative numbers only, not production latency)"
