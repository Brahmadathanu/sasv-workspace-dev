-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  t text;
begin
  foreach t in array array[
    'forecast_run','sku_forecast_monthly_llt','sku_forecast_monthly_seasonal',
    'season_profile','season_profile_month','season_profile_weight',
    'plan_publish_headers','plan_publish_lines',
    'sop_master','sop_revisions','sop_sections','sop_attachments'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_crud', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)',
      t || '_authenticated_crud', t
    );
  end loop;

  foreach t in array array['sop_series','sop_approvals','sop_review_policies','profiles']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)',
      t || '_authenticated_read', t
    );
  end loop;
end $$;