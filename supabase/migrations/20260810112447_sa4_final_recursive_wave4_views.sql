-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter view public.v_costing_expense_allocation_pool_options set (security_invoker = true);
alter view public.v_costing_manual_provision_type_options set (security_invoker = true);
alter view public.v_costing_staff_costing_class_options set (security_invoker = true);
alter view public.v_fg_transfer_missing_log set (security_invoker = true);
alter view public.v_mis_batch_pipeline set (security_invoker = true);
alter view public.v_mrp_pm_by_batch set (security_invoker = true);
alter view public.v_stock_coverage_after_sim_activated_batches_current_month set (security_invoker = true);