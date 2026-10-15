-- AU-3c rollback: restore the exact pre-change grants and policy (captured live 2026-10-15).
begin;
set local lock_timeout = '5s';
drop policy if exists tally_expenses_snapshot_authenticated_read on public.tally_expenses_snapshot;
create policy tally_expenses_snapshot_authenticated_crud on public.tally_expenses_snapshot
  for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null);
grant insert, update, delete on table public.tally_expenses_snapshot to authenticated;
commit;
