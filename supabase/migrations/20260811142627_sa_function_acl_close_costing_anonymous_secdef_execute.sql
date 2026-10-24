-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke execute on function costing.fn_preview_direct_labour_component_split(bigint, date, date, bigint, bigint) from public, anon;
grant execute on function costing.fn_preview_direct_labour_component_split(bigint, date, date, bigint, bigint) to authenticated, service_role;

revoke execute on function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date, date, bigint) from public, anon;
grant execute on function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date, date, bigint) to authenticated, service_role;

revoke execute on function costing.rpc_refresh_sku_direct_labour_legacy_snapshot(date, date, bigint) from public, anon;
grant execute on function costing.rpc_refresh_sku_direct_labour_legacy_snapshot(date, date, bigint) to authenticated, service_role;