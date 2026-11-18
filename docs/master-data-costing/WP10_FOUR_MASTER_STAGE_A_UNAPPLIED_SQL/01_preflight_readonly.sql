-- WP10 four-master STAGE A — 01 PREFLIGHT (read-only). NOT APPLIED / NOT A MIGRATION.
-- Run as postgres (SQL editor or psql) against the TARGET database BEFORE 02_stage_a_apply.sql.
-- Read-only transaction: no DDL, no DML, no grant change. Output: one row per check; PASS/FAIL/WARN/INFO.
-- Stop condition: any FAIL row (including the final RESULT row). INFO/WARN rows are for the reviewer. No user identities are returned (counts only).
-- Also re-run after 99_rollback_stage_a.sql: it must PASS again (it asserts the ORIGINAL identity-only state).
begin transaction read only;

with cfg(tbl, target, old_policy) as (values
  ('categories',     'module:manage-categories',     'categories_authenticated_crud'),
  ('sub_categories', 'module:manage-subcategories',  'sub_categories_authenticated_crud'),
  ('product_groups', 'module:manage-product-groups', 'product_groups_authenticated_crud'),
  ('sub_groups',     'module:manage-subgroups',      'sub_groups_authenticated_crud')),
rel as (select c.*, to_regclass('public.' || c.tbl) as oid_ from cfg c),
rpcs(rpc, tbl, target) as (values
  ('rpc_wp10_create_category','categories','module:manage-categories'),
  ('rpc_wp10_rename_category','categories','module:manage-categories'),
  ('rpc_wp10_delete_category','categories','module:manage-categories'),
  ('rpc_wp10_create_subcategory','sub_categories','module:manage-subcategories'),
  ('rpc_wp10_rename_subcategory','sub_categories','module:manage-subcategories'),
  ('rpc_wp10_delete_subcategory','sub_categories','module:manage-subcategories'),
  ('rpc_wp10_create_product_group','product_groups','module:manage-product-groups'),
  ('rpc_wp10_rename_product_group','product_groups','module:manage-product-groups'),
  ('rpc_wp10_delete_product_group','product_groups','module:manage-product-groups'),
  ('rpc_wp10_create_subgroup','sub_groups','module:manage-subgroups'),
  ('rpc_wp10_rename_subgroup','sub_groups','module:manage-subgroups'),
  ('rpc_wp10_delete_subgroup','sub_groups','module:manage-subgroups')),
authr as (select oid from pg_roles where rolname = 'authenticated'),
checks(ord, id, status, detail) as (
  -- tables, RLS
  select 100, 'P01 ' || tbl, case when coalesce((select relkind = 'r' from pg_class where oid = oid_), false) then 'PASS' else 'FAIL' end, 'ordinary table public.' || tbl || ' exists' from rel
  union all select 110, 'P02 ' || tbl, case when coalesce((select relrowsecurity from pg_class where oid = oid_), false) then 'PASS' else 'FAIL' end, 'RLS enabled' from rel
  union all select 120, 'P03 ' || tbl, case when coalesce((select not relforcerowsecurity from pg_class where oid = oid_), false) then 'PASS' else 'FAIL' end,
         'RLS NOT forced (table-owner-executed SECURITY DEFINER RPCs bypass RLS; FORCE would block all 12 governed RPCs)' from rel
  -- original policy set is exactly one identity-only FOR ALL policy for authenticated only
  union all select 130, 'P04 ' || tbl,
         case when (select count(*) from pg_policy where polrelid = oid_) = 1
               and exists (select 1 from pg_policy p where p.polrelid = oid_ and p.polname = r.old_policy) then 'PASS' else 'FAIL' end,
         'exactly one policy, named ' || old_policy || '; actual: ' || coalesce((select string_agg(polname, ',' order by polname) from pg_policy where polrelid = oid_), '(none)') from rel r
  union all select 131, 'P05 ' || tbl,
         case when exists (select 1 from pg_policy p, authr a where p.polrelid = oid_ and p.polname = r.old_policy and p.polcmd = '*' and p.polpermissive
                and p.polroles = array[a.oid]::oid[]
                and pg_get_expr(p.polqual, p.polrelid) ~ 'auth\.uid\(\).*IS NOT NULL'
                and pg_get_expr(p.polwithcheck, p.polrelid) ~ 'auth\.uid\(\).*IS NOT NULL') then 'PASS' else 'FAIL' end,
         'old policy is permissive FOR ALL TO authenticated only, USING/WITH CHECK identity-only (auth.uid() IS NOT NULL)' from rel r
  -- grants (Stage A must leave them untouched; Stage B is separate)
  union all select 140, 'P06 ' || tbl,
         case when has_table_privilege('authenticated', oid_, 'SELECT') and has_table_privilege('authenticated', oid_, 'INSERT')
               and has_table_privilege('authenticated', oid_, 'UPDATE') and has_table_privilege('authenticated', oid_, 'DELETE') then 'PASS' else 'FAIL' end,
         'authenticated currently holds SELECT/INSERT/UPDATE/DELETE (Stage A keeps them for legacy-Editor compatibility; this preflight asserts the pre-Stage-A grant state)' from rel
  union all select 141, 'P07 ' || tbl,
         case when not exists (select 1 from pg_roles where rolname = 'anon')
                or not (has_table_privilege('anon', oid_, 'SELECT') or has_table_privilege('anon', oid_, 'INSERT') or has_table_privilege('anon', oid_, 'UPDATE') or has_table_privilege('anon', oid_, 'DELETE')) then 'PASS' else 'FAIL' end,
         'anon has no table privilege' from rel
  union all select 142, 'P08 ' || tbl,
         case when exists (select 1 from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where c.oid = oid_ and a.grantee = 0) then 'FAIL' else 'PASS' end,
         'no PUBLIC pseudo-role grant' from rel
  -- helper functions
  union all select 200, 'P09 ' || f.sig, case when to_regprocedure(f.sig) is not null
              and has_function_privilege('authenticated', to_regprocedure(f.sig), 'EXECUTE')
              and not coalesce(has_function_privilege('anon', to_regprocedure(f.sig), 'EXECUTE') and exists (select 1 from pg_roles where rolname = 'anon'), false) then 'PASS' else 'FAIL' end,
         'exists; authenticated EXECUTE; anon no EXECUTE' from (values ('public.app_has_permission(text,text)'), ('public.app_has_permission_core(uuid,text,text)'), ('public.require_permission(text,boolean)')) f(sig)
  union all select 201, 'P10 helper security', 'INFO',
         (select string_agg(p.proname || ': ' || case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end || ', owner=' || pg_get_userbyid(p.proowner), '; ' order by p.proname)
            from pg_proc p where p.oid in (to_regprocedure('public.app_has_permission(text,text)'), to_regprocedure('public.app_has_permission_core(uuid,text,text)'), to_regprocedure('public.require_permission(text,boolean)')))
  -- twelve governed RPCs
  union all select 300, 'P11 ' || rpc, case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = rpc) = 1 then 'PASS' else 'FAIL' end,
         'exactly one public.' || rpc from rpcs
  union all select 301, 'P12 ' || rpc, case when coalesce((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = rpc), false) then 'PASS' else 'FAIL' end,
         'SECURITY DEFINER (executes as owner, so it is not subject to the new INSERT/UPDATE/DELETE policies)' from rpcs
  union all select 302, 'P13 ' || rpc, case when coalesce((select p.proowner = c.relowner or coalesce((select rolbypassrls or rolsuper from pg_roles where oid = p.proowner), false)
                from pg_proc p join pg_namespace n on n.oid = p.pronamespace, pg_class c where n.nspname = 'public' and p.proname = rpc and c.oid = to_regclass('public.' || rpcs.tbl)), false) then 'PASS' else 'FAIL' end,
         'RPC owner is the table owner or has BYPASSRLS/superuser (so RLS cannot block it)' from rpcs
  union all select 303, 'P14 ' || rpc, case when coalesce((select p.prosrc ~* ('require_permission\(\s*''' || rpcs.target || '''\s*,\s*true\s*\)') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = rpc), false) then 'PASS' else 'FAIL' end,
         'body calls require_permission(''' || target || ''', true) (module Edit) — the same target/mode Stage A policies use' from rpcs
  union all select 304, 'P15 ' || rpc, case when coalesce((select p.proconfig is not null and exists (select 1 from unnest(p.proconfig) s where s ~* '^search_path=') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = rpc), false) then 'PASS' else 'WARN' end,
         'fixed search_path configured' from rpcs
  union all select 305, 'P16 ' || rpc, case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = rpc and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
              and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where n.nspname = 'public' and p.proname = rpc and a.grantee = 0) then 'PASS' else 'FAIL' end,
         'authenticated EXECUTE; no PUBLIC EXECUTE' from rpcs
  -- indirect server-side writers
  union all select 400, 'P17 ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         case when not p.prosecdef then 'FAIL' when p.proname in (select rpc from rpcs) then 'PASS' else 'WARN' end,
         case when not p.prosecdef then 'SECURITY INVOKER function writes a four-master table: Stage A policies would apply to it — review before applying'
              when p.proname in (select rpc from rpcs) then 'expected governed RPC (SECURITY DEFINER)'
              else 'SECURITY DEFINER function writes a four-master table (runs as owner; unaffected by Stage A) — review' end
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema') and p.prokind in ('f', 'p')
     and p.prosrc ~* '(insert\s+into|update|delete\s+from|merge\s+into)\s+(only\s+)?("?public"?\.)?"?(categories|sub_categories|product_groups|sub_groups)"?\M'
  union all select 410, 'P18 ' || tbl, 'INFO', 'user triggers: ' || coalesce((select string_agg(tgname, ',') from pg_trigger where tgrelid = oid_ and not tgisinternal), '(none)') || '; table owner=' || coalesce((select pg_get_userbyid(relowner) from pg_class where oid = oid_), '?') from rel
  union all select 420, 'P19 ' || tbl, 'INFO',
         'users with canonical Edit on ' || target || ': ' || coalesce((select count(*)::text from public.user_permissions_canonical u where u.target = rel.target and u.can_edit is true), 'n/a (count only, no identities)') from rel
  union all select 900, 'P20 environment', 'INFO', 'server_version=' || current_setting('server_version') || '; current_user=' || current_user
)
select id, status, detail from (
select id, status, detail from checks
union all select 'RESULT', case when count(*) filter (where status = 'FAIL') = 0 then 'PASS' else 'FAIL' end,
  count(*) filter (where status = 'PASS') || ' pass / ' || count(*) filter (where status = 'FAIL') || ' fail / ' || count(*) filter (where status = 'WARN') || ' warn / ' || count(*) filter (where status = 'INFO') || ' info' from checks
) q order by (id = 'RESULT'), id;

rollback;
