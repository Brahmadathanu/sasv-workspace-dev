-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_forecast_exceptions set (security_invoker = true);
alter view public.v_rm_reservation_priority_current_month set (security_invoker = true);
alter view public.v_sales_monthly_clean set (security_invoker = true);
alter view public.v_sdv_dim_month set (security_invoker = true);
alter view public.v_sku_recent_stats set (security_invoker = true);
alter view public.v_supply_recon set (security_invoker = true);