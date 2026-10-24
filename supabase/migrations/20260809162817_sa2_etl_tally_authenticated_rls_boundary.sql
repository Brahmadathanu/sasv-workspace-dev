-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  for r in select unnest(array[
    'etl_config','etl_health_log','tally_consumables_monthly_snapshot','tally_consumables_stock_snapshot','tally_expenses_snapshot','tally_fg_transfer_voucher_lines','tally_fuel_stock_snapshot','tally_group_outstanding_snapshot','tally_monthly_group_summary','tally_plm_stock_snapshot','tally_purchase_orders_snapshot','tally_purchases_vreg_snapshot','tally_rm_inward_qty_snapshot','tally_rm_pm_issues_snapshot','tally_rm_stock_snapshot','tally_sales_vreg_snapshot','tally_stock_by_name','vreg_sales_baseline'
  ]::text[]) as table_name loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', r.table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name || '_authenticated_crud', r.table_name);
    execute format('create policy %I on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)', r.table_name || '_authenticated_crud', r.table_name);
  end loop;
end $$;