-- 2026-06-09: Admin-only canonical access cleanup
--
-- Final access model:
--   Signup creates only a Supabase Auth user.
--   Admin grants access directly through canonical admin tools.
--   Grants are stored in public.user_permissions_canonical.
--   Hub/App navigation shows only granted modules.
--
-- This removes the temporary request/approval layer and the legacy exposed hub
-- pending-request view that Supabase flags for auth.users exposure.

begin;

-- Remove public-schema view that exposes auth.users email through PostgREST.
drop view if exists public.v_hub_requests_pending;

-- Remove the temporary canonical request layer, if it was applied.
drop function if exists public.admin_decide_access_request(bigint, text, text, text);
drop function if exists public.admin_list_access_requests(text, integer);
drop function if exists public.request_access(text, text);
drop table if exists public.access_requests;

-- Keep legacy hub request functions unavailable from API roles. They are no
-- longer part of the workflow; admin grants are made directly.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'hub_request_access') then
    revoke execute on function public.hub_request_access from public, anon, authenticated;
  end if;

  if exists (select 1 from pg_proc where proname = 'approve_hub_request') then
    revoke execute on function public.approve_hub_request from public, anon, authenticated;
  end if;

  if exists (select 1 from pg_proc where proname = 'deny_hub_request') then
    revoke execute on function public.deny_hub_request from public, anon, authenticated;
  end if;

  if exists (select 1 from pg_proc where proname = 'approve_all_requests_for_user') then
    revoke execute on function public.approve_all_requests_for_user from public, anon, authenticated;
  end if;

  if exists (select 1 from pg_proc where proname = 'approve_request_by_email_key') then
    revoke execute on function public.approve_request_by_email_key from public, anon, authenticated;
  end if;
end $$;

-- Correct the earlier helper signature if the previous hardening script was
-- applied. This helper is still useful for direct admin grant/revoke auditing.
create or replace function public.log_admin_action(
  admin_id text,
  action_type text,
  target_id text default null,
  action_details text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id bigint;
begin
  insert into public.admin_audit (
    action_type,
    admin_user_id,
    target_user_id,
    details
  ) values (
    action_type,
    admin_id::uuid,
    nullif(target_id, '')::uuid,
    action_details
  ) returning id into audit_id;

  return audit_id;
end;
$$;

revoke execute on function public.log_admin_action(text, text, text, text) from public, anon;
grant execute on function public.log_admin_action(text, text, text, text) to authenticated, service_role;

commit;
