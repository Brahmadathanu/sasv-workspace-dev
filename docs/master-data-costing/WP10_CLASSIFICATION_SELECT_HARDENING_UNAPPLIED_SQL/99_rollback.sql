-- WP10 classification SELECT hardening - 99 ROLLBACK. PROPOSED / UNAPPLIED. Restores the four identity-only read policies (the Stage A state) and
-- removes the helper. Fail-closed: refuses unless all four read policies currently use the provisioned gate. No data, grant or write-policy change.
begin;
set local lock_timeout = '5s';
do $$
declare t text; q text;
begin
  foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
    select pg_get_expr(polqual, polrelid) into q from pg_policy where polrelid = ('public.' || t)::regclass and polname = t || '_authenticated_read' and polcmd = 'r';
    if q is null or q not ilike '%app_is_provisioned_user%' then raise exception 'WP10 SELECT hardening rollback refused: public.% read policy is not the provisioned gate', t; end if;
  end loop;
  foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
    execute format('drop policy %I on public.%I', t || '_authenticated_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null)', t || '_authenticated_read', t);
  end loop;
end $$;
drop function public.app_is_provisioned_user();
commit;
