-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter materialized view public.mv_production_priority_queue_current_month set schema app_private;

revoke all on table app_private.mv_production_priority_queue_current_month from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;
grant select on table app_private.mv_production_priority_queue_current_month to authenticated, service_role;

create view public.mv_production_priority_queue_current_month
with (security_invoker=true)
as
select * from app_private.mv_production_priority_queue_current_month;

revoke all on table public.mv_production_priority_queue_current_month from public, anon, authenticated;
grant select on table public.mv_production_priority_queue_current_month to authenticated;

create or replace function public.refresh_mv_production_priority_queue_current_month()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','app_private','pg_temp'
as $function$
begin
  perform set_config('statement_timeout', '10min', true);
  refresh materialized view app_private.mv_production_priority_queue_current_month;
end;
$function$;

commit;