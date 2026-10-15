-- AU-3c: remove end-user write access to Tally expense inputs (D-023, approved by Dr. Brahmadathan U 2026-10-15 22:26 IST).
-- Caller proof: docs/costing/au3c/AU3C_CALLER_IMPACT.md (only service_role writes; 0 authenticated statements since 2026-08-11).
-- Keeps SELECT for authenticated; service_role (ETL) untouched. Rollback: docs/costing/au3c/AU3C_REVOKE_ROLLBACK.sql.
set local lock_timeout = '5s';
revoke insert, update, delete on table public.tally_expenses_snapshot from authenticated;
drop policy if exists tally_expenses_snapshot_authenticated_crud on public.tally_expenses_snapshot;
create policy tally_expenses_snapshot_authenticated_read on public.tally_expenses_snapshot
  for select to authenticated using ((select auth.uid()) is not null);
