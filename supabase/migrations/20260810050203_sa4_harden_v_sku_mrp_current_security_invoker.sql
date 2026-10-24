-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_sku_mrp_current set (security_invoker = true);