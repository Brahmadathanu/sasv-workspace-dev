-- WP10 classification SELECT hardening - 03 POSTFLIGHT (READ-ONLY). PROPOSED / UNAPPLIED. Output: id | status | detail; RESULT PASS only without FAIL.
begin read only;
with t(tbl) as (values ('categories'),('sub_categories'),('product_groups'),('sub_groups')),
pol as (
  select t.tbl, p.polname, p.polcmd, pg_get_expr(p.polqual, p.polrelid) as qual, pg_get_expr(p.polwithcheck, p.polrelid) as chk
  from t join pg_class c on c.relname = t.tbl and c.relnamespace = 'public'::regnamespace
  join pg_policy p on p.polrelid = c.oid
),
checks as (
  select 'Q1_read_policy_provisioned_gate:' || t.tbl as id,
         case when exists (select 1 from pol where pol.tbl = t.tbl and pol.polname = t.tbl || '_authenticated_read' and pol.polcmd = 'r' and pol.qual ilike '%app_is_provisioned_user%') then 'PASS' else 'FAIL' end as status, '' as detail
  from t
  union all
  select 'Q2_four_policies:' || t.tbl, case when (select count(*) from pol where pol.tbl = t.tbl) = 4 then 'PASS' else 'FAIL' end, ''
  from t
  union all
  select 'Q3_write_policies_unchanged:' || t.tbl,
         case when (select count(*) from pol where pol.tbl = t.tbl and pol.polcmd in ('a','w','d') and (coalesce(pol.qual, '') || coalesce(pol.chk, '')) ilike '%app_has_permission%') = 3 then 'PASS' else 'FAIL' end,
         'insert/update/delete still View AND Edit'
  from t
  union all
  select 'Q4_authenticated_grants_unchanged:' || t.tbl,
         case when has_table_privilege('authenticated', 'public.' || t.tbl, 'SELECT') and has_table_privilege('authenticated', 'public.' || t.tbl, 'INSERT')
               and has_table_privilege('authenticated', 'public.' || t.tbl, 'UPDATE') and has_table_privilege('authenticated', 'public.' || t.tbl, 'DELETE') then 'PASS' else 'FAIL' end, 'Stage B not applied'
  from t
  union all
  select 'Q5_helper_security_definer_and_acl',
         case when exists (select 1 from pg_proc where oid = to_regprocedure('public.app_is_provisioned_user()') and prosecdef and provolatile = 's')
               and has_function_privilege('authenticated', 'public.app_is_provisioned_user()', 'EXECUTE')
               and not has_function_privilege('anon', 'public.app_is_provisioned_user()', 'EXECUTE') then 'PASS' else 'FAIL' end, ''
)
select id, status, detail from checks
union all select 'RESULT', case when exists (select 1 from checks where status = 'FAIL') then 'FAIL' else 'PASS' end, ''
order by 1;
rollback;
