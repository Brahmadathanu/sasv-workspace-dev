-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter materialized view public.mv_system_plan_monthly set schema app_private;
alter materialized view public.mv_wip_rollup set schema app_private;
alter materialized view public.mv_bottled_rollup set schema app_private;
alter materialized view public.mv_fg_bulk_rollup set schema app_private;
alter materialized view public.mv_bmr_rollup set schema app_private;

revoke all on table app_private.mv_system_plan_monthly from public, anon, authenticated;
revoke all on table app_private.mv_wip_rollup from public, anon, authenticated;
revoke all on table app_private.mv_bottled_rollup from public, anon, authenticated;
revoke all on table app_private.mv_fg_bulk_rollup from public, anon, authenticated;
revoke all on table app_private.mv_bmr_rollup from public, anon, authenticated;

grant usage on schema app_private to authenticated, service_role;
grant select on table app_private.mv_system_plan_monthly to authenticated, service_role;
grant select on table app_private.mv_wip_rollup to authenticated, service_role;
grant select on table app_private.mv_bottled_rollup to authenticated, service_role;
grant select on table app_private.mv_fg_bulk_rollup to authenticated, service_role;
grant select on table app_private.mv_bmr_rollup to authenticated, service_role;

create view public.mv_system_plan_monthly with (security_invoker=true) as select * from app_private.mv_system_plan_monthly;
create view public.mv_wip_rollup with (security_invoker=true) as select * from app_private.mv_wip_rollup;
create view public.mv_bottled_rollup with (security_invoker=true) as select * from app_private.mv_bottled_rollup;
create view public.mv_fg_bulk_rollup with (security_invoker=true) as select * from app_private.mv_fg_bulk_rollup;
create view public.mv_bmr_rollup with (security_invoker=true) as select * from app_private.mv_bmr_rollup;

revoke all on table public.mv_system_plan_monthly from public, anon, authenticated;
revoke all on table public.mv_wip_rollup from public, anon, authenticated;
revoke all on table public.mv_bottled_rollup from public, anon, authenticated;
revoke all on table public.mv_fg_bulk_rollup from public, anon, authenticated;
revoke all on table public.mv_bmr_rollup from public, anon, authenticated;

grant select on table public.mv_system_plan_monthly to authenticated;
grant select on table public.mv_wip_rollup to authenticated;
grant select on table public.mv_bottled_rollup to authenticated;
grant select on table public.mv_fg_bulk_rollup to authenticated;
grant select on table public.mv_bmr_rollup to authenticated;

create or replace function public.process_supply_rollup_refresh()
returns void
language plpgsql
set search_path to 'pg_catalog','public','app_private','pg_temp'
as $function$
declare
  req timestamptz;
  ran timestamptz;
  ok boolean := true;
begin
  select last_requested, last_run into req, ran
  from public.supply_rollup_refresh_queue
  where id = 1;

  if req is null or (ran is not null and ran >= req) then
    return;
  end if;

  begin
    refresh materialized view app_private.mv_bottled_rollup;
  exception when others then
    ok := false;
    raise notice 'Refresh failed for mv_bottled_rollup: %', sqlerrm;
  end;

  begin
    refresh materialized view app_private.mv_fg_bulk_rollup;
  exception when others then
    ok := false;
    raise notice 'Refresh failed for mv_fg_bulk_rollup: %', sqlerrm;
  end;

  begin
    refresh materialized view app_private.mv_wip_rollup;
  exception when others then
    ok := false;
    raise notice 'Refresh failed for mv_wip_rollup: %', sqlerrm;
  end;

  begin
    refresh materialized view app_private.mv_bmr_rollup;
  exception when others then
    ok := false;
    raise notice 'Refresh failed for mv_bmr_rollup: %', sqlerrm;
  end;

  if ok then
    update public.supply_rollup_refresh_queue
       set last_run = now()
     where id = 1;
  else
    raise notice 'One or more rollup refreshes failed; last_run not updated so it will retry.';
  end if;
end
$function$;

create or replace function public.refresh_supply_rollups()
returns void
language plpgsql
set search_path to 'pg_catalog','public','app_private','pg_temp'
as $function$
begin
  perform 1;
  refresh materialized view concurrently app_private.mv_system_plan_monthly;
  refresh materialized view concurrently app_private.mv_bottled_rollup;
  refresh materialized view concurrently app_private.mv_fg_bulk_rollup;
  refresh materialized view concurrently app_private.mv_wip_rollup;
  refresh materialized view concurrently app_private.mv_bmr_rollup;
end;
$function$;

commit;