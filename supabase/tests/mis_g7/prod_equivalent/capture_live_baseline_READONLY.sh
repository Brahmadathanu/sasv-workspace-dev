#!/usr/bin/env bash
# MIS G7: capture a LOCAL, PROTECTED production schema baseline for the isolated production-equivalent acceptance run. READ ONLY.
#   MIS_G7_PROD_RO_URL='postgresql://<read-only role>@<host>:5432/postgres' ./capture_live_baseline_READONLY.sh
# - Structure only (pg_dump --schema-only + catalog JSON): NO business rows, NO user identities, NO credentials are exported.
# - The server rejects writes (default_transaction_read_only=on). pg_dump's major version must be >= the server's (production is 17.x).
# - Output goes to .local/mis-g7-prod-baseline (git-ignored, mode 0700). The GitHub repository is PUBLIC: never commit the packet.
set -euo pipefail
: "${MIS_G7_PROD_RO_URL:?set MIS_G7_PROD_RO_URL to a READ-ONLY connection string (never commit it)}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${OUT_DIR:-.local/mis-g7-prod-baseline}"
PSQL="${PSQL:-psql}"; PGDUMP="${PG_DUMP:-pg_dump}"
umask 077; mkdir -p "$OUT"; chmod 700 "$OUT"
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000'
echo "pg_dump: $($PGDUMP --version)  psql: $($PSQL --version)" >&2
"$PSQL" "$MIS_G7_PROD_RO_URL" -X -A -t -q -f "$HERE/capture_queries.sql" | sed -n '/^{/,$p' > "$OUT/catalog.json"
"$PGDUMP" "$MIS_G7_PROD_RO_URL" --schema-only --no-comments --no-security-labels --no-publications --no-subscriptions \
  -n public -n costing -n app_private -f "$OUT/10_schema.sql"
# auth.uid / auth.jwt / auth.role come from the catalog JSON (they are not part of the dumped schemas)
sha256sum "$OUT/catalog.json" "$OUT/10_schema.sql" > "$OUT/PACKET.sha256"
echo "baseline packet written to $OUT (LOCAL ONLY; contains schema definitions, no row data)" >&2
