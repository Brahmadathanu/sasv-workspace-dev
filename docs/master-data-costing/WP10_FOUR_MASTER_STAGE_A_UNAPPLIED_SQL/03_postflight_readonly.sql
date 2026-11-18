-- WP10 four-master STAGE A — 03 POSTFLIGHT (read-only). NOT APPLIED. Run as postgres immediately after 02_stage_a_apply.sql.
-- Catalog-level proof of the expected Stage A end state. It is NOT a behavioural test: negative/positive acceptance with genuine Editor / View-only /
-- No-access sessions (04_role_acceptance_checklist.md) is still required. Any FAIL = stop and consider 99_rollback_stage_a.sql under owner approval.
begin transaction read only;

with cfg(tbl, target) as (values
  ('categories','module:manage-categories'), ('sub_categories','module:manage-subcategories'),
  ('product_groups','module:manage-product-groups'), ('sub_groups','module:manage-subgroups')),
rel as (select c.*, to_regclass('public.' || c.tbl) as oid_ from cfg c),
cmds(cmd, suffix) as (values ('r','read'), ('a','insert'), ('w','update'), ('d','delete')),
authr as (select oid from pg_roles where rolname = 'authenticated'),
pol as (
  select r.tbl, r.target, r.oid_, m.cmd, m.suffix, p.polname, p.polpermissive, p.polroles,
         pg_get_expr(p.polqual, p.polrelid) q, pg_get_expr(p.polwithcheck, p.polrelid) w
    from rel r cross join cmds m left join pg_policy p on p.polrelid = r.oid_ and p.polname = r.tbl || '_authenticated_' || m.suffix and p.polcmd = m.cmd),
checks(id, status, detail) as (
  select 'Q01 ' || tbl, case when (select count(*) from pg_policy where polrelid = oid_) = 4 then 'PASS' else 'FAIL' end, 'exactly 4 policies (no residual FOR ALL / extra permissive policy)' from rel
  union all select 'Q02 ' || tbl, case when not exists (select 1 from pg_policy where polrelid = oid_ and (polcmd = '*' or polname = tbl || '_authenticated_crud')) then 'PASS' else 'FAIL' end, 'original identity-only FOR ALL policy is gone' from rel
  union all select 'Q03 ' || tbl || ' ' || suffix, case when polname is not null and polpermissive and polroles = (select array[oid]::oid[] from authr) then 'PASS' else 'FAIL' end, 'policy present, permissive, TO authenticated only' from pol
  union all select 'Q04 ' || tbl, case when exists (select 1 from pol where pol.tbl = rel.tbl and cmd = 'r' and q ~ 'auth\.uid\(\).*IS NOT NULL') then 'PASS' else 'FAIL' end, 'SELECT stays identity-only (hierarchy reads unchanged)' from rel
  union all select 'Q05 ' || tbl || ' ' || suffix, case when (cmd = 'a' and w ~ ('app_has_permission\(''' || target || '''(::text)?, ''edit''(::text)?\)') and q is null)
                                                    or (cmd = 'w' and q ~ ('app_has_permission\(''' || target || '''(::text)?, ''edit''(::text)?\)') and w ~ ('app_has_permission\(''' || target || '''(::text)?, ''edit''(::text)?\)'))
                                                    or (cmd = 'd' and q ~ ('app_has_permission\(''' || target || '''(::text)?, ''edit''(::text)?\)') and w is null) then 'PASS' else 'FAIL' end,
         'gated by app_has_permission(' || target || ', edit) with the correct module key' from pol where cmd <> 'r'
  union all select 'Q06 ' || tbl, case when exists (select 1 from pol where pol.tbl = rel.tbl and cmd <> 'r' and (coalesce(q,'') || coalesce(w,'')) ~ 'module:manage-' and (coalesce(q,'') || coalesce(w,'')) !~ ('module:manage-' || substring(target from 'manage-(.*)$') || '''')) then 'FAIL' else 'PASS' end, 'no policy references a different module key' from rel
  union all select 'Q07 ' || tbl, case when coalesce((select relrowsecurity and not relforcerowsecurity from pg_class where oid = oid_), false) then 'PASS' else 'FAIL' end, 'RLS enabled, not forced' from rel
  union all select 'Q08 ' || tbl, case when has_table_privilege('authenticated', oid_, 'SELECT') and has_table_privilege('authenticated', oid_, 'INSERT') and has_table_privilege('authenticated', oid_, 'UPDATE') and has_table_privilege('authenticated', oid_, 'DELETE') then 'PASS' else 'FAIL' end,
         'GRANTs unchanged by Stage A (authenticated still SELECT/INSERT/UPDATE/DELETE); Stage B REVOKE has NOT been applied' from rel
  union all select 'Q09 ' || tbl, case when not exists (select 1 from pg_roles where rolname = 'anon') or not (has_table_privilege('anon', oid_, 'SELECT') or has_table_privilege('anon', oid_, 'INSERT') or has_table_privilege('anon', oid_, 'UPDATE') or has_table_privilege('anon', oid_, 'DELETE')) then 'PASS' else 'FAIL' end, 'anon has no table privilege' from rel
  union all select 'Q10 governed RPCs', case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname ~ '^rpc_wp10_(create|rename|delete)_(category|subcategory|product_group|subgroup)$' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')) = 12 then 'PASS' else 'FAIL' end,
         'all 12 rpc_wp10_* writers still exist, SECURITY DEFINER, executable by authenticated'
  union all select 'Q11 RPC owner bypass', case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace, rel r where n.nspname = 'public' and p.proname ~ '^rpc_wp10_(create|rename|delete)_(category|subcategory|product_group|subgroup)$'
              and not (p.proowner = (select relowner from pg_class where oid = r.oid_) or coalesce((select rolbypassrls or rolsuper from pg_roles where oid = p.proowner), false))) then 'PASS' else 'FAIL' end,
         'each RPC owner is a table owner or BYPASSRLS role (RPC writes cannot be blocked by the new policies)'
)
select id, status, detail from (
select id, status, detail from checks
union all select 'RESULT', case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end,
  count(*) filter (where status = 'PASS') || ' pass / ' || count(*) filter (where status = 'FAIL') || ' fail' from checks
) q order by (id = 'RESULT'), id;

rollback;
