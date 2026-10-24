-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop function costing.rpc_refresh_sku_material_cost_snapshot();
drop function costing.rpc_refresh_sku_pricing_bridge_snapshot(date);