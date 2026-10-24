-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter policy "users can request access (insert)"
on public.hub_access_requests
with check ((select auth.uid()) = user_id);

alter policy "users can view their requests"
on public.hub_access_requests
using ((select auth.uid()) = user_id);

alter policy "users can read their own access"
on public.hub_user_access
using (user_id = (select auth.uid()));

alter policy "hua_read_own"
on public.hub_user_access
using ((select auth.uid()) = user_id);

alter policy "user reads own access rows"
on public.hub_user_access
using (user_id = (select auth.uid()));

alter policy "etl_jobs_admin_insert"
on public.etl_jobs
with check (is_etl_admin((select auth.uid())));

alter policy "etl_jobs_admin_update"
on public.etl_jobs
using (is_etl_admin((select auth.uid())))
with check (is_etl_admin((select auth.uid())));

alter policy "upc_select_self"
on public.user_permissions_canonical
using (user_id = (select auth.uid()));