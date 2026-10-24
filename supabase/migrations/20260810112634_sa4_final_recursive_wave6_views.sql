-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_batch_pm_readiness set (security_invoker = true);
alter view public.v_mrp_pm_by_batch_actionable set (security_invoker = true);
alter view public.v_mrp_pm_by_batch_overissued set (security_invoker = true);