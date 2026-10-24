-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- user_permissions_canonical: preserve existing self/admin RLS, remove anonymous and privileged table grants.
revoke all privileges on table public.user_permissions_canonical from anon, authenticated;
grant select, insert, update, delete on table public.user_permissions_canonical to authenticated;

-- permission_targets: authenticated registry read; admin-only writes.
revoke all privileges on table public.permission_targets from anon, authenticated;
grant select, insert, update, delete on table public.permission_targets to authenticated;
drop policy if exists pt_read_all on public.permission_targets;
drop policy if exists pt_write_admin_only on public.permission_targets;
create policy pt_read_authenticated
on public.permission_targets
for select to authenticated
using ((select auth.uid()) is not null);
create policy pt_write_admin_only
on public.permission_targets
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- user_presence: signed-in users may see presence; only own row may be inserted/updated/deleted.
revoke all privileges on table public.user_presence from anon, authenticated;
grant select, insert, update, delete on table public.user_presence to authenticated;
drop policy if exists read_all on public.user_presence;
drop policy if exists upsert_own_insert on public.user_presence;
drop policy if exists upsert_own_update on public.user_presence;
drop policy if exists delete_own on public.user_presence;
create policy user_presence_authenticated_read
on public.user_presence
for select to authenticated
using ((select auth.uid()) is not null);
create policy user_presence_insert_own
on public.user_presence
for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy user_presence_update_own
on public.user_presence
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy user_presence_delete_own
on public.user_presence
for delete to authenticated
using ((select auth.uid()) = user_id);