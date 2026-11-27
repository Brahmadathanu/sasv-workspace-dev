-- WP10 classification SELECT hardening - 02 APPLY. PROPOSED / UNAPPLIED. Owner approval, preflight PASS and a coverage review (04) are required first.
-- Effect: the four _authenticated_read policies change from "any authenticated JWT" to "an authenticated identity that holds at least one canonical
-- View or Edit grant on any module" (public.app_is_provisioned_user()). Shared taxonomy reads by every provisioned module/view/RPC/costing workflow keep working.
-- NOT done here: no write-policy change, no GRANT/REVOKE on tables, no Stage B, no per-module read restriction, no data change.
-- State-aware and fail-closed: identity-only read policies -> replaced; already provisioned -> no-op; anything else -> RAISE (nothing changes).
begin;
set local lock_timeout = '5s';

create or replace function public.app_is_provisioned_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_permissions_canonical c
    where c.user_id = (select auth.uid())
      and (coalesce(c.can_view, false) or coalesce(c.can_edit, false))
  )
$$;
revoke all on function public.app_is_provisioned_user() from public, anon;
grant execute on function public.app_is_provisioned_user() to authenticated;

do $$
declare
  t text; pol text; q text; n int; identity_only int := 0; provisioned int := 0;
begin
  foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
    pol := t || '_authenticated_read';
    select count(*) into n from pg_policy where polrelid = ('public.' || t)::regclass;
    if n <> 4 then raise exception 'WP10 SELECT hardening refused: public.% has % policies (expected 4 Stage A policies)', t, n; end if;
    select pg_get_expr(polqual, polrelid) into q from pg_policy where polrelid = ('public.' || t)::regclass and polname = pol and polcmd = 'r';
    if q is null then raise exception 'WP10 SELECT hardening refused: public.% lacks policy %', t, pol; end if;
    if q ilike '%app_is_provisioned_user%' then provisioned := provisioned + 1;
    elsif q ilike '%auth.uid()%' and q ilike '%is not null%' and q not ilike '%app_has_permission%' then identity_only := identity_only + 1;
    else raise exception 'WP10 SELECT hardening refused: public.% read policy has an unexpected predicate: %', t, q; end if;
  end loop;
  if provisioned = 4 then raise notice 'WP10 SELECT hardening: already applied (no-op)'; return; end if;
  if identity_only <> 4 then raise exception 'WP10 SELECT hardening refused: mixed state (identity_only=%, provisioned=%)', identity_only, provisioned; end if;

  foreach t in array array['categories','sub_categories','product_groups','sub_groups'] loop
    execute format('drop policy %I on public.%I', t || '_authenticated_read', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.app_is_provisioned_user()))', t || '_authenticated_read', t);
  end loop;
end $$;
commit;
