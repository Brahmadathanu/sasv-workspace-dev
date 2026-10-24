-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  for r in select * from (values
    ('hr','staff_category'),('hr','staff_status'),('hr','unit'),
    ('lab','analysis_register_counter'),('lab','coa_counter'),('lab','coa_issue'),('lab','coa_issue_line'),
    ('lab','control_register'),('lab','control_sample'),('lab','product_shelf_life'),
    ('lab','protocol_category_test'),('lab','protocol_subject_map'),('lab','rm_lot_counter'),
    ('lab','spec_line'),('lab','spec_override'),('lab','spec_profile'),('lab','system_config'),
    ('lab','test_master'),('lab','test_method')
  ) as t(schema_name,table_name)
  loop
    execute format('alter table %I.%I enable row level security',r.schema_name,r.table_name);
    execute format('revoke all on table %I.%I from anon',r.schema_name,r.table_name);
    execute format('drop policy if exists %I on %I.%I',r.table_name||'_authenticated_select',r.schema_name,r.table_name);
    execute format('drop policy if exists %I on %I.%I',r.table_name||'_authenticated_insert',r.schema_name,r.table_name);
    execute format('drop policy if exists %I on %I.%I',r.table_name||'_authenticated_update',r.schema_name,r.table_name);
    execute format('drop policy if exists %I on %I.%I',r.table_name||'_authenticated_delete',r.schema_name,r.table_name);
    execute format('create policy %I on %I.%I for select to authenticated using ((select auth.uid()) is not null)',r.table_name||'_authenticated_select',r.schema_name,r.table_name);
    execute format('create policy %I on %I.%I for insert to authenticated with check ((select auth.uid()) is not null)',r.table_name||'_authenticated_insert',r.schema_name,r.table_name);
    execute format('create policy %I on %I.%I for update to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',r.table_name||'_authenticated_update',r.schema_name,r.table_name);
    execute format('create policy %I on %I.%I for delete to authenticated using ((select auth.uid()) is not null)',r.table_name||'_authenticated_delete',r.schema_name,r.table_name);
  end loop;

  for r in select * from (values
    ('lab','protocol_category_inv_group_map'),('lab','protocol_category_product_group_map'),('lab','spec_profile_inv_group_map')
  ) as t(schema_name,table_name)
  loop
    execute format('alter table %I.%I enable row level security',r.schema_name,r.table_name);
    execute format('revoke all on table %I.%I from anon',r.schema_name,r.table_name);
    execute format('drop policy if exists %I on %I.%I',r.table_name||'_authenticated_select',r.schema_name,r.table_name);
    execute format('create policy %I on %I.%I for select to authenticated using ((select auth.uid()) is not null)',r.table_name||'_authenticated_select',r.schema_name,r.table_name);
  end loop;

  alter table lab.spec_override_audit enable row level security;
  revoke all on table lab.spec_override_audit from anon;
  drop policy if exists spec_override_audit_authenticated_select on lab.spec_override_audit;
  drop policy if exists spec_override_audit_authenticated_insert on lab.spec_override_audit;
  create policy spec_override_audit_authenticated_select on lab.spec_override_audit for select to authenticated using ((select auth.uid()) is not null);
  create policy spec_override_audit_authenticated_insert on lab.spec_override_audit for insert to authenticated with check ((select auth.uid()) is not null);
end $$;