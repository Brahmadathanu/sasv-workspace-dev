-- PREPARED (not applied). CI-001: Tally source snapshot tables writable by any logged-in user.
-- Change: the 14 "<table>_authenticated_crud" (ALL) policies become
--   <table>_authenticated_read  FOR SELECT  TO authenticated USING (auth.uid() IS NOT NULL)        -- reads unchanged
--   <table>_etl_admin_write     FOR ALL     TO authenticated USING/CHECK (is_etl_admin(auth.uid())) -- ETL admins (hub etl_control_admin/hub_admin) keep write
-- service_role (bypasses RLS) is unchanged: the Tally agent / loader path keeps working (AU3 already loads expenses this way).
-- Grant hygiene on all public tally_* tables and etl_jobs: anon loses every privilege; authenticated loses TRUNCATE/REFERENCES/TRIGGER/MAINTAIN
-- (TRUNCATE is not governed by RLS). tally_expenses_snapshot (AU3) is already read-only and is only re-asserted.
-- Guards: stops if any policy/ACL differs from the 19 Oct 2026 live baseline.
do $g$
declare t text; n int; v_bad text := '';
  crud text[] := array['tally_consumables_monthly_snapshot','tally_consumables_stock_snapshot','tally_fg_transfer_voucher_lines','tally_fuel_stock_snapshot',
    'tally_group_outstanding_snapshot','tally_monthly_group_summary','tally_plm_stock_snapshot','tally_purchase_orders_snapshot','tally_purchases_vreg_snapshot',
    'tally_rm_inward_qty_snapshot','tally_rm_pm_issues_snapshot','tally_rm_stock_snapshot','tally_sales_vreg_snapshot','tally_stock_by_name'];
begin
  if to_regprocedure('public.is_etl_admin(uuid)') is null then raise exception 'TB1_GUARD: public.is_etl_admin(uuid) missing'; end if;
  foreach t in array crud loop
    select count(*) into n from pg_policies p where p.schemaname='public' and p.tablename=t;
    if n <> 1 or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.policyname=t||'_authenticated_crud'
         and p.cmd='ALL' and p.roles='{authenticated}' and p.qual='(( SELECT auth.uid() AS uid) IS NOT NULL)' and p.with_check='(( SELECT auth.uid() AS uid) IS NOT NULL)') then
      v_bad := v_bad || ' policy:' || t; end if;
    if (select relacl::text from pg_class where oid=('public.'||t)::regclass) <> '{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwd/postgres}' then
      v_bad := v_bad || ' acl:' || t; end if;
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then v_bad := v_bad || ' rls_off:' || t; end if;
  end loop;
  if (select relacl::text from pg_class where oid='public.tally_fg_transfer_snapshot'::regclass) <> '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then v_bad := v_bad||' acl:fg_transfer_snapshot'; end if;
  if (select relacl::text from pg_class where oid='public.tally_rm_rms_stock_snapshot'::regclass) <> '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then v_bad := v_bad||' acl:rm_rms_stock_snapshot'; end if;
  if (select relacl::text from pg_class where oid='public.etl_jobs'::regclass) <> '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then v_bad := v_bad||' acl:etl_jobs'; end if;
  if v_bad <> '' then raise exception 'TB1_GUARD: live differs from the 19 Oct baseline:%', v_bad; end if;
end $g$;

do $c$
declare t text;
  crud text[] := array['tally_consumables_monthly_snapshot','tally_consumables_stock_snapshot','tally_fg_transfer_voucher_lines','tally_fuel_stock_snapshot',
    'tally_group_outstanding_snapshot','tally_monthly_group_summary','tally_plm_stock_snapshot','tally_purchase_orders_snapshot','tally_purchases_vreg_snapshot',
    'tally_rm_inward_qty_snapshot','tally_rm_pm_issues_snapshot','tally_rm_stock_snapshot','tally_sales_vreg_snapshot','tally_stock_by_name'];
begin
  foreach t in array crud loop
    execute format('drop policy %I on public.%I', t||'_authenticated_crud', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)', t||'_authenticated_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_etl_admin((select auth.uid()))) with check (public.is_etl_admin((select auth.uid())))', t||'_etl_admin_write', t);
    execute format('comment on policy %I on public.%I is %L', t||'_etl_admin_write', t, 'CI-001 (closure 2026-10): Tally snapshot writes only by service_role or ETL admins');
  end loop;
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (c.relname like 'tally%' or c.relname='etl_jobs') loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, references, trigger, maintain on public.%I from authenticated', t);
  end loop;
end $c$;

-- postchecks
do $p$
declare n int;
begin
  select count(*) into n from pg_policies where schemaname='public' and tablename like 'tally%' and policyname like '%_authenticated_crud';
  if n <> 0 then raise exception 'TB1_POST: % crud policies remain', n; end if;
  select count(*) into n from pg_policies where schemaname='public' and tablename like 'tally%' and policyname like '%_etl_admin_write';
  if n <> 14 then raise exception 'TB1_POST: expected 14 etl-admin write policies, found %', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace
   where s.nspname='public' and c.relkind in ('r','p') and (c.relname like 'tally%' or c.relname='etl_jobs')
     and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('authenticated',c.oid,'TRUNCATE'));
  if n <> 0 then raise exception 'TB1_POST: % tables still grant anon access or authenticated TRUNCATE', n; end if;
end $p$;
