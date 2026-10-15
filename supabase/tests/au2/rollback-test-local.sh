#!/usr/bin/env bash
# Proves on the local parity DB: apply AU-2 -> rollback == original (views, triggers, grants), with live-like grants seeded.
set -euo pipefail
PG="env PGOPTIONS=-cclient_min_messages=warning psql -h ${PGHOST:-/tmp} -p ${PGPORT:-54329} -U postgres"
DDL=${LOCAL_DB_DIR:?set LOCAL_DB_DIR}; D=$(dirname "$0")
$PG -qc "drop database if exists costing_local" -c "create database costing_local" -c "alter database costing_local set timezone='UTC'"
(cd "$DDL" && python3 load.py >/dev/null)
# seed live grants observed 2026-10-15 on the current-run view and sample dependents
$PG -d costing_local -qc "grant select on costing.v_current_successful_costing_refresh_run to authenticated; grant select on costing.v_sku_detailed_cost_sheet_current to authenticated; grant all on public.v_costing_pricing_dashboard_summary to service_role; grant select on public.v_costing_pricing_dashboard_summary to authenticated; grant select on public.v_costing_pricing_sku_control_status_snapshot to authenticated, service_role;"
snap() { $PG -d costing_local -XAt -c "
 select 'V '||n.nspname||'.'||c.relname||' '||md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind='v' and c.relname<>'v_costing_run_effective_designation'
 union all select 'T '||tgrelid::regclass||' '||tgname from pg_trigger where not tgisinternal
 union all select 'G '||grantee||' '||table_schema||'.'||table_name||' '||privilege_type from information_schema.role_table_grants where table_schema in ('costing','public') and table_name not in ('costing_period_refresh_authorization','costing_run_designation','costing_run_fingerprint','v_costing_run_effective_designation')
 union all select 'O '||n.nspname||'.'||c.relname||' '||pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind='v' and c.relname<>'v_costing_run_effective_designation'
 order by 1"; }
snap > /tmp/au2_before.txt
$PG -d costing_local -X -v ON_ERROR_STOP=1 -q -f "$D/../../migrations/20261015165757_au2_run_governance.sql" >/dev/null
snap > /tmp/au2_applied.txt
$PG -d costing_local -X -v ON_ERROR_STOP=1 -q -f "$D/au2_rollback.sql"
snap > /tmp/au2_after.txt
echo "objects compared: $(wc -l < /tmp/au2_before.txt); changed by apply: $(diff /tmp/au2_before.txt /tmp/au2_applied.txt | grep -c '^[<>]')"
if diff -q /tmp/au2_before.txt /tmp/au2_after.txt >/dev/null; then echo "ROLLBACK_PARITY: IDENTICAL"; else echo "ROLLBACK_PARITY: DIFFERENT"; diff /tmp/au2_before.txt /tmp/au2_after.txt | head; exit 1; fi
