#!/usr/bin/env bash
# Isolated retention test runner. Uses PG* env; creates/drops database retention_fixture. Synthetic data only.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../../../.." && pwd)"
mig="$repo/supabase/migrations"; cand="$here/../candidates"
cd "$here"
export PGDATABASE=postgres
psql -X -qAt -c "DROP DATABASE IF EXISTS retention_fixture" -c "CREATE DATABASE retention_fixture"
export PGDATABASE=retention_fixture
P="psql -X -q -t -A -v ON_ERROR_STOP=1"
views="$(mktemp)"; python3 "$here/extract_real_ddl.py" "$repo" > "$views"
$P -v views_file="$views" -f "$here/00_contract_fixture.sql" >/dev/null
for f in 20260915041807_add_sales_allocation_quantity_driver_acceptance 20260915041934_fix_sales_allocation_acceptance_permission_target \
         20260915041955_qualify_sales_allocation_acceptance_snapshot_lookup 20260915042017_set_sales_allocation_acceptance_variable_conflict_mode \
         20260915060034_regional_marketing_evidence_acceptance_architecture 20261021045619_costing_regional_evidence_continuity_20261021; do
  $P -f "$mig/$f.sql" >/dev/null
done
echo "FIXTURE_LOADED real_migrations=6 extracted_views=3"
run_sql() { echo "--- $1"; case "$1" in *.sh) bash "$here/$1";; *) $P -f "$here/$1" | grep -v "^$" || test "${PIPESTATUS[0]}" = 0;; esac; }
for t in "$@"; do run_sql "$t"; done
echo RETENTION_PG_TESTS_DONE
