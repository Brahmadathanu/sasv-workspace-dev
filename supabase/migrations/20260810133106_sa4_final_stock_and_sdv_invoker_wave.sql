-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_sdv_exc_zero_sellers_3m set (security_invoker = true);
alter view public.v_sdv_freshness set (security_invoker = true);
alter view public.v_sdv_rollup_month_category set (security_invoker = true);
alter view public.v_sdv_rollup_month_godown_group set (security_invoker = true);
alter view public.v_sdv_rollup_month_region set (security_invoker = true);
alter view public.v_sdv_rollup_month_sku set (security_invoker = true);
alter view public.v_stock_checker set (security_invoker = true);