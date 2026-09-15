-- CSA scoped fallback — static SQL contract proof (read migration source / optional post-apply checks).
-- Does NOT apply migrations. Does NOT touch Run 108 / refresh runs.
-- Run after IMPLEMENT on feature branch; behavioral DB proofs wait for live apply.

-- Expected present catalog sizes (tests only; expander is catalog-driven):
-- THIS_POLICY company/regional = 1
-- ALL_COMPANY = 2
-- SAME_REGION_LINKED = 3
-- ALL_REGIONAL = 6
-- ALL_LINKED = 8

-- Static privilege expectations after prospective apply (run only on disposable DB):
-- select has_function_privilege('anon', 'costing.fn_revise_sales_allocation_default_policy(uuid,text,numeric,date,text,text)', 'EXECUTE'); -- false
-- select has_function_privilege('authenticated', 'costing.fn_revise_sales_allocation_default_policy(uuid,text,numeric,date,text,text)', 'EXECUTE'); -- false
-- select has_function_privilege('authenticated', 'costing.fn_revise_regional_sales_allocation_default_policy(uuid,text,text,numeric,date,text,text)', 'EXECUTE'); -- false
-- select has_function_privilege('authenticated', 'public.rpc_set_sales_allocation_default_policies_scoped(text,text,text,text,numeric,date,text,text)', 'EXECUTE'); -- true
-- select to_regprocedure('public.rpc_get_sales_allocation_default_policies()') is not null;

select
  (to_regprocedure('costing.fn_expand_sales_allocation_default_policy_scope(text,text,text,text)') is not null)
    as expander_exists_after_apply,
  (to_regprocedure('public.rpc_preview_sales_allocation_default_policy_scope(text,text,text,text,numeric,date)') is not null)
    as preview_exists_after_apply,
  (to_regprocedure('public.rpc_set_sales_allocation_default_policies_scoped(text,text,text,text,numeric,date,text,text)') is not null)
    as scoped_set_exists_after_apply,
  (to_regprocedure('public.rpc_get_sales_allocation_default_policies()') is not null)
    as company_get_exists_after_apply;

-- After prospective apply, also verify:
-- select count(*) from costing.fn_expand_sales_allocation_default_policy_scope('REGIONAL','NO_ELIGIBLE_REGIONAL_HISTORY','IK','ALL_LINKED');
-- expect 8
-- select pg_get_functiondef('costing.fn_resolve_regional_sales_default_policy_as_of(text,text,date)'::regprocedure)
--   not ilike '%fn_resolve_sales_planning_fallback_units_as_of%';
-- select id, overall_status from costing.costing_refresh_run where id = 108;
-- select max(id) from costing.costing_refresh_run; -- unchanged by CSA tests
