-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_batch_supply_candidates set (security_invoker = true);
alter view public.v_stock_coverage_sim_sku_region_current_month set (security_invoker = true);