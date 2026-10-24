-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  r record;
  policy_name text;
begin
  for r in
    select * from (values
      ('costing','material_manual_rates'),
      ('costing','costing_control_dashboard_snapshot'),
      ('costing','costing_control_integrity_audit_snapshot'),
      ('costing','material_costing_action_drilldown_snapshot'),
      ('costing','material_costing_action_queue_snapshot'),
      ('costing','costing_review_action_item_drilldown_snapshot'),
      ('costing','costing_review_top_action_item_snapshot'),
      ('costing','costing_review_workbench_summary_snapshot'),
      ('costing','sku_costing_control_status_snapshot'),
      ('costing','sku_direct_labour_allocation_snapshot'),
      ('costing','scheme_policy_rules'),
      ('costing','sku_scheme_policy'),
      ('costing','sku_scheme_viability_snapshot'),
      ('costing','product_mrp_derivation_policy'),
      ('costing','product_mrp_proposal'),
      ('costing','product_mrp_proposal_line')
    ) as x(schema_name,table_name)
  loop
    execute format('grant select on table %I.%I to authenticated', r.schema_name, r.table_name);
    execute format('revoke all on table %I.%I from anon', r.schema_name, r.table_name);
    policy_name := r.table_name || '_authenticated_read';
    execute format('drop policy if exists %I on %I.%I', policy_name, r.schema_name, r.table_name);
    execute format('create policy %I on %I.%I for select to authenticated using ((select auth.uid()) is not null)', policy_name, r.schema_name, r.table_name);
  end loop;
end $$;