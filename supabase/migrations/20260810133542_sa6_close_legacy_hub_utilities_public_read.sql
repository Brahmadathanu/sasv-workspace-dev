-- backfilled from live schema_migrations on 2026-10-24, CI-016
drop policy if exists "utils are public-readable" on public.hub_utilities;
revoke all on table public.hub_utilities from anon;
revoke all on table public.hub_utilities from authenticated;
grant select on table public.hub_utilities to authenticated;
create policy "hub_utilities_authenticated_read"
on public.hub_utilities
for select
to authenticated
using ((select auth.uid()) is not null);