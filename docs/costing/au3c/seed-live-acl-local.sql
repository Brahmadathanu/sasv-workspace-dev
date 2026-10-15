-- Local only: reproduce the live ACL/RLS state captured 2026-10-15 before testing AU-3c.
alter table public.tally_expenses_snapshot enable row level security;
grant all on table public.tally_expenses_snapshot to service_role;
grant select, insert, update, delete on table public.tally_expenses_snapshot to authenticated;
drop policy if exists tally_expenses_snapshot_authenticated_read on public.tally_expenses_snapshot;
drop policy if exists tally_expenses_snapshot_authenticated_crud on public.tally_expenses_snapshot;
create policy tally_expenses_snapshot_authenticated_crud on public.tally_expenses_snapshot
  for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
grant usage, select on sequence public.tally_expenses_snapshot_id_seq to service_role, authenticated;
