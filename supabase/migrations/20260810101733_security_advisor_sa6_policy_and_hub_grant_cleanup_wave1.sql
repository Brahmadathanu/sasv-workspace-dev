-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

-- Tighten Hub table grants to only operations justified by current policies.
revoke all on table public.admin_audit from anon, authenticated;
grant select on table public.admin_audit to authenticated;

revoke all on table public.hub_access_requests from anon, authenticated;
grant select, insert on table public.hub_access_requests to authenticated;

revoke all on table public.hub_profiles from anon, authenticated;
grant select, update on table public.hub_profiles to authenticated;

revoke all on table public.hub_user_access from anon, authenticated;
grant select on table public.hub_user_access to authenticated;

revoke all on table public.hub_utilities from anon, authenticated;
grant select on table public.hub_utilities to anon, authenticated;

-- Remove PUBLIC-role duplicates and recreate only where no authenticated equivalent exists.
drop policy if exists "admin_audit_read" on public.admin_audit;
create policy "admin_audit_read_authenticated"
on public.admin_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.user_permissions_canonical upc
    where upc.user_id::text = (select auth.uid())::text
      and upc.target = 'module:admin-v2'
      and upc.can_view = true
  )
);

drop policy if exists "hub_access_requests: insert own" on public.hub_access_requests;
drop policy if exists "hub_access_requests: read own" on public.hub_access_requests;

drop policy if exists "hub_profiles: read own" on public.hub_profiles;
drop policy if exists "hub_profiles: update own" on public.hub_profiles;
create policy "hub_profiles_read_own_authenticated"
on public.hub_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);
create policy "hub_profiles_update_own_authenticated"
on public.hub_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "hub_user_access: read own" on public.hub_user_access;

-- Redundant with the explicit anon+authenticated public-read policy.
drop policy if exists "hub_utils_read" on public.hub_utilities;

-- Normalize authenticated-only literal-true policies to signed-in predicates.
drop policy if exists "authenticated_select_analysis_status_history" on lab.analysis_status_history;
create policy "authenticated_select_analysis_status_history"
on lab.analysis_status_history for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "protocol_category_insert_authenticated" on lab.protocol_category;
create policy "protocol_category_insert_authenticated"
on lab.protocol_category for insert to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "protocol_category_select_authenticated" on lab.protocol_category;
create policy "protocol_category_select_authenticated"
on lab.protocol_category for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "protocol_category_update_authenticated" on lab.protocol_category;
create policy "protocol_category_update_authenticated"
on lab.protocol_category for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "read_test_default_method_map" on lab.test_default_method_map;
create policy "read_test_default_method_map"
on lab.test_default_method_map for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "heartbeats_read_all" on public.agent_heartbeats;
create policy "heartbeats_read_all"
on public.agent_heartbeats for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "daily_work_log_select_authenticated" on public.daily_work_log;
create policy "daily_work_log_select_authenticated"
on public.daily_work_log for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "etl_jobs_read_all" on public.etl_jobs;
create policy "etl_jobs_read_all"
on public.etl_jobs for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "event_skus_select_authenticated" on public.event_skus;
create policy "event_skus_select_authenticated"
on public.event_skus for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "packaging_events_select_authenticated" on public.packaging_events;
create policy "packaging_events_select_authenticated"
on public.packaging_events for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "plm_bom_header_select" on public.plm_bom_header;
create policy "plm_bom_header_select"
on public.plm_bom_header for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "plm_bom_line_select" on public.plm_bom_line;
create policy "plm_bom_line_select"
on public.plm_bom_line for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "storage_cleanup_read_all" on public.storage_cleanup_queue;
create policy "storage_cleanup_read_all"
on public.storage_cleanup_queue for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Allow authenticated read access to RM RMS stock snapshot" on public.tally_rm_rms_stock_snapshot;
create policy "Allow authenticated read access to RM RMS stock snapshot"
on public.tally_rm_rms_stock_snapshot for select to authenticated
using ((select auth.uid()) is not null);

commit;