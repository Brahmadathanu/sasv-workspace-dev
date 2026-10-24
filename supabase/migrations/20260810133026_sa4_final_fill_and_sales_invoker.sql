-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_fill_inputs set (security_invoker = true);
alter view public.v_sdv_sales_enriched set (security_invoker = true);