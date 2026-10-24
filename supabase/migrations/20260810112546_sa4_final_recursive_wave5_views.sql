-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_costing_manual_provision_pool_options set (security_invoker = true);
alter view public.v_mrp_pm_by_batch_issue_ready set (security_invoker = true);