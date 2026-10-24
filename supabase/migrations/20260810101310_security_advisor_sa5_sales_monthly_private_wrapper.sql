-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter materialized view public.sales_monthly set schema app_private;

revoke all on table app_private.sales_monthly from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;
grant select on table app_private.sales_monthly to authenticated, service_role;

create view public.sales_monthly
with (security_invoker=true)
as
select sku_id, product_id, region_id, godown_id, month_start,
       qty_units, qty_billed, billed_amount, source_max_inserted_at
from app_private.sales_monthly;

revoke all on table public.sales_monthly from public, anon, authenticated;
grant select on table public.sales_monthly to authenticated;

create or replace function public.refresh_sales_monthly()
returns void
language sql
set search_path to 'pg_catalog','public','app_private','pg_temp'
as $function$
  refresh materialized view concurrently app_private.sales_monthly;
$function$;

create or replace function public.refresh_sales_monthly_both()
returns void
language plpgsql
set search_path to 'pg_catalog','public','app_private','pg_temp'
as $function$
begin
  begin
    refresh materialized view concurrently app_private.sales_monthly;
  exception when others then
    raise notice 'Could not refresh sales_monthly: %', SQLERRM;
  end;

  begin
    refresh materialized view concurrently public.sales_monthly_v2;
  exception when others then
    raise notice 'Could not refresh sales_monthly_v2: %', SQLERRM;
  end;
end
$function$;

commit;