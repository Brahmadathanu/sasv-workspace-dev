-- A0: run119 provenance, current successful runs, behaviour split + rate policy states (SELECT-only)
select (select row_to_json(r) from costing.costing_refresh_run r where id=119) run119,
       (select json_agg(row_to_json(c)) from costing.v_current_successful_costing_refresh_run c) current_runs,
       (select json_agg(json_build_object('id',id,'comp',source_component_code,'beh',cost_behaviour,'amt',source_reference_amount,'status',status)) from costing.manufacturing_cost_behaviour_split) behaviour_split,
       (select json_agg(json_build_object('code',policy_code,'wu',normal_workload_units,'budget',normal_budget_amount,'status',status)) from costing.manufacturing_standard_rate_policy) rate_policy,
       (select row_to_json(p) from costing.cost_periods p where period_start='2026-09-01') period;
-- Migrations applied live since 2026-10-13:
-- select version, name from supabase_migrations.schema_migrations where version >= '20261013' order by version;
-- PR #66 functions present live? (expected none):
-- select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='costing' and proname ~ '^fn_preview_mc0[68]';
