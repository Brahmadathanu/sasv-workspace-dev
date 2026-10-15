-- AU-3c DRAFT: remove end-user write access to Tally expense inputs. DO NOT RUN without explicit user approval.
-- Keeps SELECT (views/MIS read it). service_role (the ETL worker) is untouched.
-- Deploy on its own (not together with #68), ideally between ETL pulls (the worker writes ~09:00 IST daily).
begin;
set local lock_timeout = '5s';
-- capture state for the record
select grantee, string_agg(privilege_type, ',' order by privilege_type) privs
  from information_schema.role_table_grants
 where table_schema='public' and table_name='tally_expenses_snapshot' group by 1 order by 1;

revoke insert, update, delete on table public.tally_expenses_snapshot from authenticated;
-- the old policy allowed ALL commands to any logged-in user; replace with read-only
drop policy if exists tally_expenses_snapshot_authenticated_crud on public.tally_expenses_snapshot;
create policy tally_expenses_snapshot_authenticated_read on public.tally_expenses_snapshot
  for select to authenticated using ((select auth.uid()) is not null);

-- verification: must return 0 rows
select privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='tally_expenses_snapshot' and grantee in ('authenticated','anon')
   and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
commit;
