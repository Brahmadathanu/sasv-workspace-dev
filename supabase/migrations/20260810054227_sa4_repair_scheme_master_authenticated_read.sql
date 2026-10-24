-- backfilled from live schema_migrations on 2026-10-24, CI-016
grant select on table costing.scheme_master to authenticated;
revoke all on table costing.scheme_master from anon;

drop policy if exists scheme_master_authenticated_read on costing.scheme_master;
create policy scheme_master_authenticated_read
on costing.scheme_master
for select
to authenticated
using ((select auth.uid()) is not null);