-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Forecast Console: canonical module permission convergence.
-- No CASCADE. Normal override mutations are RPC-governed; staging remains direct Data API but RLS-governed.

-- 1) Forecast override table becomes authenticated SELECT-only at the grant layer.
revoke insert, update, delete, truncate, references, trigger
  on table public.forecast_demand_overrides
  from authenticated;

grant select on table public.forecast_demand_overrides to authenticated;

-- Replace broad/deprecated policies with canonical module view permission.
drop policy if exists fdo_select on public.forecast_demand_overrides;
drop policy if exists fdo_write on public.forecast_demand_overrides;
drop policy if exists fdo_update on public.forecast_demand_overrides;
drop policy if exists fdo_delete on public.forecast_demand_overrides;

create policy forecast_demand_overrides_select_forecast_console
on public.forecast_demand_overrides
for select
to authenticated
using (
  public.app_has_permission_core((select auth.uid()), 'module:forecast-console', 'view')
);

-- 2) Staging table must be RLS protected and tied to the same module permission.
alter table public.marketing_overrides_staging enable row level security;

revoke all privileges on table public.marketing_overrides_staging from anon;
revoke truncate, references, trigger on table public.marketing_overrides_staging from authenticated;
grant select, insert, update, delete on table public.marketing_overrides_staging to authenticated;

drop policy if exists forecast_console_staging_select on public.marketing_overrides_staging;
drop policy if exists forecast_console_staging_insert on public.marketing_overrides_staging;
drop policy if exists forecast_console_staging_update on public.marketing_overrides_staging;
drop policy if exists forecast_console_staging_delete on public.marketing_overrides_staging;

create policy forecast_console_staging_select
on public.marketing_overrides_staging
for select
to authenticated
using (
  public.app_has_permission_core((select auth.uid()), 'module:forecast-console', 'view')
);

create policy forecast_console_staging_insert
on public.marketing_overrides_staging
for insert
to authenticated
with check (
  public.app_has_permission_core((select auth.uid()), 'module:forecast-console', 'edit')
);

create policy forecast_console_staging_update
on public.marketing_overrides_staging
for update
to authenticated
using (
  public.app_has_permission_core((select auth.uid()), 'module:forecast-console', 'edit')
)
with check (
  public.app_has_permission_core((select auth.uid()), 'module:forecast-console', 'edit')
);

create policy forecast_console_staging_delete
on public.marketing_overrides_staging
for delete
to authenticated
using (
  public.app_has_permission_core((select auth.uid()), 'module:forecast-console', 'edit')
);

-- 3) Promotion RPC: SECURITY DEFINER is retained because it writes two RLS-governed tables,
-- but it is now explicitly permission-guarded and has a pinned search_path.
create or replace function public.promote_all_staging(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_updated int := 0;
  v_inserted int := 0;
  v_deleted int := 0;
begin
  perform public.require_permission('module:forecast-console', true);

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Invalid promotion range: % to %', p_from, p_to;
  end if;

  with src as (
    select sku_id, region_id, godown_id, month_start, delta_units,
           coalesce(note, 'Promoted from staging (bulk)') as reason
    from public.marketing_overrides_staging
    where month_start >= p_from and month_start <= p_to
  ), upd as (
    update public.forecast_demand_overrides tgt
       set delta_units = s.delta_units,
           reason = s.reason,
           is_active = true,
           updated_at = now()
      from src s
     where tgt.sku_id = s.sku_id
       and tgt.region_id = s.region_id
       and tgt.godown_id = s.godown_id
       and tgt.month_start = s.month_start
    returning 1
  )
  select count(*) into v_updated from upd;

  with src as (
    select sku_id, region_id, godown_id, month_start, delta_units,
           coalesce(note, 'Promoted from staging (bulk)') as reason
    from public.marketing_overrides_staging
    where month_start >= p_from and month_start <= p_to
  ), ins as (
    insert into public.forecast_demand_overrides
      (sku_id, region_id, godown_id, month_start, delta_units, reason, is_active, updated_at)
    select s.sku_id, s.region_id, s.godown_id, s.month_start, s.delta_units, s.reason, true, now()
    from src s
    where not exists (
      select 1
      from public.forecast_demand_overrides t
      where t.sku_id = s.sku_id
        and t.region_id = s.region_id
        and t.godown_id = s.godown_id
        and t.month_start = s.month_start
    )
    returning 1
  )
  select count(*) into v_inserted from ins;

  delete from public.marketing_overrides_staging
   where month_start >= p_from and month_start <= p_to;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'inserted_count', v_inserted,
    'updated_count', v_updated,
    'deleted_staging_count', v_deleted
  );
end;
$function$;

revoke execute on function public.promote_all_staging(date,date) from public;
grant execute on function public.promote_all_staging(date,date) to authenticated, service_role;

-- 4) Deactivation RPC becomes the governed normal withdrawal path.
create or replace function public.deactivate_forecast_override(
  p_sku_id bigint,
  p_region_id integer,
  p_godown_id integer,
  p_month_start date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cnt int := 0;
begin
  perform public.require_permission('module:forecast-console', true);

  update public.forecast_demand_overrides
     set is_active = false,
         updated_at = now()
   where sku_id = p_sku_id
     and region_id = p_region_id
     and godown_id = p_godown_id
     and month_start = p_month_start
     and is_active = true;

  get diagnostics v_cnt = row_count;
  return v_cnt > 0;
end;
$function$;

revoke execute on function public.deactivate_forecast_override(bigint,integer,integer,date) from public;
grant execute on function public.deactivate_forecast_override(bigint,integer,integer,date) to authenticated, service_role;

-- 5) Retire unused alternate override writer.
drop function public.upsert_forecast_override(bigint,integer,integer,date,numeric,text,text,boolean,uuid);