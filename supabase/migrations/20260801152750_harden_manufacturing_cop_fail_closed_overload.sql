-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;
revoke all on function costing.rpc_refresh_sku_manufacturing_cop_snapshot(date) from public, anon, authenticated, service_role;
grant execute on function costing.rpc_refresh_sku_manufacturing_cop_snapshot(date) to postgres;
commit;