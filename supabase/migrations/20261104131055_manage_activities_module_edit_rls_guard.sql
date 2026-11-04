-- Live-applied migration reconciliation.
-- Supabase migration version: 20261104131055
-- Supabase migration name: manage_activities_module_edit_rls_guard
-- Applied on 2026-11-04; repository copy reflects the verified live policies.
--
-- Preserve authenticated SELECT because Daily Work Log directly reads
-- public.activities for activity choices and duration calculations.
-- Gate all direct table writes by canonical Manage Activities edit access.
-- No changes to activity data, foreign keys, production routes, or costing.
begin;

drop policy if exists activities_authenticated_crud on public.activities;

create policy activities_authenticated_read on public.activities
  for select to authenticated
  using ((select auth.uid()) is not null);

create policy activities_manage_insert on public.activities
  for insert to authenticated
  with check (exists (
    select 1 from public.user_permissions_canonical p
    where p.user_id = (select auth.uid())
      and p.target = 'module:manage-activities'
      and p.can_view is true
      and p.can_edit is true
  ));

create policy activities_manage_update on public.activities
  for update to authenticated
  using (exists (
    select 1 from public.user_permissions_canonical p
    where p.user_id = (select auth.uid())
      and p.target = 'module:manage-activities'
      and p.can_view is true
      and p.can_edit is true
  ))
  with check (exists (
    select 1 from public.user_permissions_canonical p
    where p.user_id = (select auth.uid())
      and p.target = 'module:manage-activities'
      and p.can_view is true
      and p.can_edit is true
  ));

create policy activities_manage_delete on public.activities
  for delete to authenticated
  using (exists (
    select 1 from public.user_permissions_canonical p
    where p.user_id = (select auth.uid())
      and p.target = 'module:manage-activities'
      and p.can_view is true
      and p.can_edit is true
  ));

commit;
