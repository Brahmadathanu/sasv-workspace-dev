-- backfilled from live schema_migrations on 2026-10-24, CI-016
revoke select on table public.v_fg_stock_latest_product_region_base from authenticated;
revoke select on table public.v_sku_to_base_multiplier from authenticated;