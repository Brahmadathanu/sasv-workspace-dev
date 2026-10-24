-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare r record;
begin
  -- Authenticated CRUD tables: preserve current signed-in client/invoker behavior, remove anonymous exposure.
  for r in select unnest(array[
    'bmr_details','product_references',
    'production_qty_overrides','production_batch_overrides','production_batch_overrides_staging','production_overrides_staging',
    'pm_blockers_snapshot_current_month','pm_issue_priority_snapshot_current_month','pm_leverage_snapshot_current_month','pm_reservation_snapshot_current_month','pm_status_snapshot_current_month','priority_queue_snapshot_current_month',
    'rm_blockers_snapshot_current_month','rm_issue_priority_snapshot_current_month','rm_leverage_snapshot_current_month','rm_reservation_snapshot_current_month','rm_status_snapshot_current_month','rm_unassigned_issues_snapshot_current_month'
  ]::text[]) as table_name loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', r.table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name || '_authenticated_crud', r.table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      r.table_name || '_authenticated_crud', r.table_name
    );
  end loop;

  -- Authenticated read-only tables: client reads only; governed writers are SECURITY DEFINER/service paths.
  for r in select unnest(array['products','product_skus','sku_stock_snapshot']::text[]) as table_name loop
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('revoke all privileges on table public.%I from anon, authenticated', r.table_name);
    execute format('grant select on table public.%I to authenticated', r.table_name);
    execute format('drop policy if exists %I on public.%I', r.table_name || '_authenticated_read', r.table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)',
      r.table_name || '_authenticated_read', r.table_name
    );
  end loop;
end $$;