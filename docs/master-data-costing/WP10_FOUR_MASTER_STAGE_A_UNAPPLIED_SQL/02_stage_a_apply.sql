-- WP10 four-master STAGE A — 02 APPLY. NOT APPLIED / NOT A MIGRATION (deliberately outside supabase/migrations).
-- Replaces the identity-only FOR ALL policy on four classification masters with identity-only SELECT + per-module Edit-gated INSERT/UPDATE/DELETE,
-- using the canonical public.app_has_permission(target,'view') AND (target,'edit'): the live public.require_permission(target,true) used by the 12 governed RPCs requires BOTH
-- can_view and can_edit, so direct-DML policies must too (rev 2: an edit-without-view canonical row is denied here exactly as the RPC denies it).
-- Does NOT change any GRANT (Stage B REVOKE is a separate, separately-authorised step), data, function, trigger or other table.
-- Single transaction. Aborts (changing nothing) if live state differs from the reviewed ORIGINAL state or if the result differs from the expected end state.
-- Run 01_preflight_readonly.sql first (must show RESULT PASS). Rollback: 99_rollback_stage_a.sql. Verify: 03_postflight_readonly.sql.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

-- 0. drift guard: each table must have exactly the one original identity-only policy
do $$
declare t record; n int;
begin
  for t in select * from (values ('categories'), ('sub_categories'), ('product_groups'), ('sub_groups')) v(tbl) loop
    select count(*) into n from pg_policy where polrelid = ('public.' || t.tbl)::regclass;
    if n <> 1 or not exists (select 1 from pg_policy where polrelid = ('public.' || t.tbl)::regclass and polname = t.tbl || '_authenticated_crud' and polcmd = '*') then
      raise exception 'WP10 Stage A refused: public.% does not have exactly the original policy %_authenticated_crud (found % policies). Run 01_preflight_readonly.sql.', t.tbl, t.tbl, n;
    end if;
    if not (select relrowsecurity and not relforcerowsecurity from pg_class where oid = ('public.' || t.tbl)::regclass) then
      raise exception 'WP10 Stage A refused: public.% must have RLS enabled and NOT forced.', t.tbl;
    end if;
  end loop;
  if to_regprocedure('public.app_has_permission(text,text)') is null
     or not has_function_privilege('authenticated', to_regprocedure('public.app_has_permission(text,text)'), 'EXECUTE') then
    raise exception 'WP10 Stage A refused: public.app_has_permission(text,text) missing or not executable by authenticated.';
  end if;
end $$;

-- 1. categories
drop policy categories_authenticated_crud on public.categories;
create policy categories_authenticated_read on public.categories
  for select to authenticated using ((select auth.uid()) is not null);
create policy categories_authenticated_insert on public.categories
  for insert to authenticated
  with check ((select public.app_has_permission('module:manage-categories', 'view')) and (select public.app_has_permission('module:manage-categories', 'edit')));
create policy categories_authenticated_update on public.categories
  for update to authenticated
  using ((select public.app_has_permission('module:manage-categories', 'view')) and (select public.app_has_permission('module:manage-categories', 'edit')))
  with check ((select public.app_has_permission('module:manage-categories', 'view')) and (select public.app_has_permission('module:manage-categories', 'edit')));
create policy categories_authenticated_delete on public.categories
  for delete to authenticated
  using ((select public.app_has_permission('module:manage-categories', 'view')) and (select public.app_has_permission('module:manage-categories', 'edit')));

-- 2. sub_categories
drop policy sub_categories_authenticated_crud on public.sub_categories;
create policy sub_categories_authenticated_read on public.sub_categories
  for select to authenticated using ((select auth.uid()) is not null);
create policy sub_categories_authenticated_insert on public.sub_categories
  for insert to authenticated
  with check ((select public.app_has_permission('module:manage-subcategories', 'view')) and (select public.app_has_permission('module:manage-subcategories', 'edit')));
create policy sub_categories_authenticated_update on public.sub_categories
  for update to authenticated
  using ((select public.app_has_permission('module:manage-subcategories', 'view')) and (select public.app_has_permission('module:manage-subcategories', 'edit')))
  with check ((select public.app_has_permission('module:manage-subcategories', 'view')) and (select public.app_has_permission('module:manage-subcategories', 'edit')));
create policy sub_categories_authenticated_delete on public.sub_categories
  for delete to authenticated
  using ((select public.app_has_permission('module:manage-subcategories', 'view')) and (select public.app_has_permission('module:manage-subcategories', 'edit')));

-- 3. product_groups
drop policy product_groups_authenticated_crud on public.product_groups;
create policy product_groups_authenticated_read on public.product_groups
  for select to authenticated using ((select auth.uid()) is not null);
create policy product_groups_authenticated_insert on public.product_groups
  for insert to authenticated
  with check ((select public.app_has_permission('module:manage-product-groups', 'view')) and (select public.app_has_permission('module:manage-product-groups', 'edit')));
create policy product_groups_authenticated_update on public.product_groups
  for update to authenticated
  using ((select public.app_has_permission('module:manage-product-groups', 'view')) and (select public.app_has_permission('module:manage-product-groups', 'edit')))
  with check ((select public.app_has_permission('module:manage-product-groups', 'view')) and (select public.app_has_permission('module:manage-product-groups', 'edit')));
create policy product_groups_authenticated_delete on public.product_groups
  for delete to authenticated
  using ((select public.app_has_permission('module:manage-product-groups', 'view')) and (select public.app_has_permission('module:manage-product-groups', 'edit')));

-- 4. sub_groups
drop policy sub_groups_authenticated_crud on public.sub_groups;
create policy sub_groups_authenticated_read on public.sub_groups
  for select to authenticated using ((select auth.uid()) is not null);
create policy sub_groups_authenticated_insert on public.sub_groups
  for insert to authenticated
  with check ((select public.app_has_permission('module:manage-subgroups', 'view')) and (select public.app_has_permission('module:manage-subgroups', 'edit')));
create policy sub_groups_authenticated_update on public.sub_groups
  for update to authenticated
  using ((select public.app_has_permission('module:manage-subgroups', 'view')) and (select public.app_has_permission('module:manage-subgroups', 'edit')))
  with check ((select public.app_has_permission('module:manage-subgroups', 'view')) and (select public.app_has_permission('module:manage-subgroups', 'edit')));
create policy sub_groups_authenticated_delete on public.sub_groups
  for delete to authenticated
  using ((select public.app_has_permission('module:manage-subgroups', 'view')) and (select public.app_has_permission('module:manage-subgroups', 'edit')));

-- 5. in-transaction post-assertion: exact expected end state, grants untouched; any mismatch raises and the whole transaction rolls back
do $$
declare t record; cmd text; pol text; expr text; n int;
begin
  for t in select * from (values ('categories','module:manage-categories'), ('sub_categories','module:manage-subcategories'),
                                 ('product_groups','module:manage-product-groups'), ('sub_groups','module:manage-subgroups')) v(tbl, target) loop
    select count(*) into n from pg_policy where polrelid = ('public.' || t.tbl)::regclass;
    if n <> 4 then raise exception 'WP10 Stage A post-check: public.% has % policies, expected 4', t.tbl, n; end if;
    foreach cmd in array array['r','a','w','d'] loop
      pol := t.tbl || '_authenticated_' || case cmd when 'r' then 'read' when 'a' then 'insert' when 'w' then 'update' else 'delete' end;
      if not exists (select 1 from pg_policy p where p.polrelid = ('public.' || t.tbl)::regclass and p.polname = pol and p.polcmd = cmd and p.polpermissive
                       and p.polroles = array[(select oid from pg_roles where rolname = 'authenticated')]::oid[]) then
        raise exception 'WP10 Stage A post-check: policy % missing or wrong command/role', pol;
      end if;
      if cmd <> 'r' then
        select coalesce(pg_get_expr(polqual, polrelid), '') || ' || ' || coalesce(pg_get_expr(polwithcheck, polrelid), '') into expr from pg_policy where polrelid = ('public.' || t.tbl)::regclass and polname = pol;
        if expr !~ ('app_has_permission\(''' || t.target || '''(::text)?, ''view''(::text)?\)') or expr !~ ('app_has_permission\(''' || t.target || '''(::text)?, ''edit''(::text)?\)') then
          raise exception 'WP10 Stage A post-check: policy % does not gate on % view AND edit (%)', pol, t.target, expr;
        end if;
      end if;
    end loop;
    if not (has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'INSERT') and has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'UPDATE')
        and has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'DELETE') and has_table_privilege('authenticated', ('public.' || t.tbl)::regclass, 'SELECT')) then
      raise exception 'WP10 Stage A post-check: grants on public.% changed unexpectedly (Stage A must not alter grants)', t.tbl;
    end if;
  end loop;
end $$;

commit;
