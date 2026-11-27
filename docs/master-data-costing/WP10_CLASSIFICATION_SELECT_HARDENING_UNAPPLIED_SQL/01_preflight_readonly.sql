-- WP10 classification SELECT hardening - 01 PREFLIGHT (READ-ONLY). PROPOSED / UNAPPLIED.
-- Expected current production state ("Stage A"): four tables, RLS on (not forced), four policies each (_read/_insert/_update/_delete),
-- the _read policy is identity-only (auth.uid() IS NOT NULL), and the helper function does not exist yet.
-- Output rows: id | status | detail. RESULT PASS only when there is no FAIL. Runs in a read-only transaction.
begin read only;
with t(tbl) as (values ('categories'),('sub_categories'),('product_groups'),('sub_groups')),
pol as (
  select t.tbl, p.polname, p.polcmd, pg_get_expr(p.polqual, p.polrelid) as qual
  from t join pg_class c on c.relname = t.tbl and c.relnamespace = 'public'::regnamespace
  join pg_policy p on p.polrelid = c.oid
),
checks as (
  select 'P1_rls_enabled_not_forced:' || t.tbl as id,
         case when c.relrowsecurity and not c.relforcerowsecurity then 'PASS' else 'FAIL' end as status,
         format('enabled=%s forced=%s', c.relrowsecurity, c.relforcerowsecurity) as detail
  from t join pg_class c on c.relname = t.tbl and c.relnamespace = 'public'::regnamespace
  union all
  select 'P2_four_policies:' || t.tbl,
         case when (select count(*) from pol where pol.tbl = t.tbl) = 4
               and (select count(*) from pol where pol.tbl = t.tbl and pol.polname in (t.tbl || '_authenticated_read', t.tbl || '_authenticated_insert', t.tbl || '_authenticated_update', t.tbl || '_authenticated_delete')) = 4
              then 'PASS' else 'FAIL' end,
         (select string_agg(polname, ',' order by polname) from pol where pol.tbl = t.tbl)
  from t
  union all
  select 'P3_read_policy_identity_only:' || t.tbl,
         case when exists (select 1 from pol where pol.tbl = t.tbl and pol.polname = t.tbl || '_authenticated_read' and pol.polcmd = 'r'
                           and pol.qual ilike '%auth.uid()%' and pol.qual ilike '%is not null%' and pol.qual not ilike '%app_has_permission%' and pol.qual not ilike '%app_is_provisioned_user%')
              then 'PASS' else 'FAIL' end,
         coalesce((select qual from pol where pol.tbl = t.tbl and pol.polname = t.tbl || '_authenticated_read'), 'missing')
  from t
  union all
  select 'P4_authenticated_select_grant:' || t.tbl,
         case when has_table_privilege('authenticated', 'public.' || t.tbl, 'SELECT') then 'PASS' else 'FAIL' end, ''
  from t
  union all
  select 'P5_anon_has_no_select:' || t.tbl,
         case when not has_table_privilege('anon', 'public.' || t.tbl, 'SELECT') then 'PASS' else 'FAIL' end, ''
  from t
  union all
  select 'P6_helper_absent', case when to_regprocedure('public.app_is_provisioned_user()') is null then 'PASS' else 'INFO' end, 'INFO means the helper already exists (re-run is idempotent)'
  union all
  select 'P7_canonical_permission_source_columns',
         case when (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'user_permissions_canonical' and column_name in ('user_id','target','can_view','can_edit')) = 4 then 'PASS' else 'FAIL' end,
         'public.user_permissions_canonical(user_id,target,can_view,can_edit)'
  union all
  select 'P8_app_has_permission_present', case when to_regprocedure('public.app_has_permission(text,text)') is not null then 'PASS' else 'FAIL' end, ''
)
select id, status, detail from checks
union all
select 'RESULT', case when exists (select 1 from checks where status = 'FAIL') then 'FAIL' else 'PASS' end, ''
order by 1;
rollback;
