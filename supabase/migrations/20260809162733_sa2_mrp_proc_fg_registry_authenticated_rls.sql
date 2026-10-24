-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  -- Preserve authenticated CRUD for server-invoker workflows / existing signed-in writers.
  for r in select unnest(array[
    'fg_bulk_internal_transfer','fg_bulk_stock_ledger','forecast_model_run','godowns','regions','marketing_export_settings',
    'mrp_plm_fill_plan_monthly','mrp_plm_issue_lines','mrp_rm_issue_lines','mrp_rm_overlay_season_detail','mrp_rm_overlay_season_runs','mrp_rm_plan_detail','mrp_rm_plan_month_runs','mrp_rm_plan_monthly',
    'plm_sku_plm_override','plm_tpl_line',
    'proc_item_criticality_policy','proc_item_lead_time_policy','proc_item_production_urgency','proc_pr_to_indent_map',
    'publication_details','text_chapters','sop_approval_roles','sop_series_counters','supply_rollup_refresh_queue','user_staff_map','sku_forecast_monthly_base'
  ]::text[]) as table_name loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', r.table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name || '_authenticated_crud', r.table_name);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', r.table_name || '_authenticated_crud', r.table_name);
  end loop;

  -- Preserve current authenticated read-only exposure for procurement/alias registries.
  for r in select unnest(array[
    'godown_aliases','sku_aliases','proc_indent_excess_acceptance','proc_indent_header','proc_indent_line','proc_indent_priority_override',
    'proc_pr_header','proc_pr_line','proc_snapshot_refresh_run','proc_snapshot_refresh_run_stage','proc_vendor_alias','proc_vendor_item_rate'
  ]::text[]) as table_name loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', r.table_name);
    execute format('grant select on table public.%I to authenticated', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name || '_authenticated_read', r.table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)', r.table_name || '_authenticated_read', r.table_name);
  end loop;
end $$;