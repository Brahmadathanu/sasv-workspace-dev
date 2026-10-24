-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter materialized view public.mv_forecast_plan_12m set schema app_private;

revoke all on table app_private.mv_forecast_plan_12m from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;
grant select on table app_private.mv_forecast_plan_12m to authenticated, service_role;

create view public.mv_forecast_plan_12m
with (security_invoker=true)
as
select sku_id, region_id, godown_id, month_start,
       demand_baseline, supply_llt, supply_seasonal, supply_final
from app_private.mv_forecast_plan_12m;

revoke all on table public.mv_forecast_plan_12m from public, anon, authenticated;
grant select on table public.mv_forecast_plan_12m to authenticated;

create or replace function public.refresh_mv_forecast_plan_12m()
returns void
language plpgsql
set search_path to 'pg_catalog','public','app_private','pg_temp'
as $function$
begin
  begin
    execute 'REFRESH MATERIALIZED VIEW CONCURRENTLY app_private.mv_forecast_plan_12m';
  exception when others then
    raise notice 'Concurrent refresh failed (%), falling back to non-concurrent refresh', SQLERRM;
    execute 'REFRESH MATERIALIZED VIEW app_private.mv_forecast_plan_12m';
  end;
end;
$function$;

select cron.alter_job(
  21,
  schedule => '10 3 * * *',
  command => 'REFRESH MATERIALIZED VIEW CONCURRENTLY app_private.mv_forecast_plan_12m;',
  active => true
);

commit;