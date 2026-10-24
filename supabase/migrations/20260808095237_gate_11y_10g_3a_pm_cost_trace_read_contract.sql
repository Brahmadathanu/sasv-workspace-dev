-- backfilled from live schema_migrations on 2026-10-24, CI-016
insert into public.permission_targets(key,kind,label,sort_order,is_assignable,meta)
values
('role:material-cost-pm-trace','role','Material Cost — PM Trace Detail',953,true,jsonb_build_object('domain','costing','capability','pm_trace_view','module_key','material-cost-manager','confidential',true)),
('role:material-cost-pm-trace-export','role','Material Cost — PM Trace Export',954,true,jsonb_build_object('domain','costing','capability','pm_trace_export','module_key','material-cost-manager','confidential',true))
on conflict (key) do update set
  kind=excluded.kind,label=excluded.label,sort_order=excluded.sort_order,is_assignable=excluded.is_assignable,meta=excluded.meta;

create or replace function public.rpc_get_material_rate_pm_cost_trace(
  p_period_start date,
  p_product_id bigint default null,
  p_sku_id bigint default null,
  p_stock_item_id bigint default null,
  p_review_state text default null,
  p_bom_source text default null,
  p_warning_status text default null,
  p_search_text text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table(
  period_start date, valuation_date date, refresh_run_id bigint,
  product_id bigint, product_name text, sku_id bigint, sku_column_label text,
  stock_item_id bigint, stock_item_code text, stock_item_name text,
  pm_source text, sku_quantity numeric, quantity_uom text,
  selected_rate numeric, rate_source text, rate_date date,
  pm_line_cost numeric, contribution_share_percent numeric,
  warning_code text, warning_text text, action_required text,
  approval_block_flag boolean, review_required_flag boolean,
  review_state text, trace_component text,
  snapshot_refreshed_at timestamptz, total_row_count bigint
)
language plpgsql stable security definer
set search_path='public','costing','pg_temp'
as $$
declare
  v_period date := date_trunc('month',p_period_start)::date;
  v_limit integer := least(greatest(coalesce(p_limit,25),1),200);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_review text := upper(nullif(btrim(p_review_state),''));
  v_warn text := upper(nullif(btrim(p_warning_status),''));
  v_search text := nullif(btrim(p_search_text),'');
begin
  perform public.require_permission('module:material-cost-manager',false);
  perform public.require_permission('role:material-cost-pm-trace',false);
  if p_period_start is null then raise exception 'p_period_start is required'; end if;
  if v_review is not null and v_review not in ('READY','REVIEW_REQUIRED','BLOCKED') then
    raise exception 'Unsupported p_review_state: %',p_review_state;
  end if;
  if v_warn is not null and v_warn not in ('HAS_WARNING','STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED','MISSING_MATERIAL_RATE','NO_WARNING') then
    raise exception 'Unsupported p_warning_status: %',p_warning_status;
  end if;
  return query
  with cr as (
    select r.period_start,r.valuation_date,r.refresh_run_id
    from costing.v_current_successful_costing_refresh_run r
    where r.period_start=v_period
    limit 1
  ), base as (
    select p.*, i.code as stock_item_code,
      case when coalesce(p.approval_block_flag,false) or coalesce(p.required_missing_rate_block_flag,false) then 'BLOCKED'
           when coalesce(p.review_required_flag,false) or coalesce(p.rate_warning_flag,false) or coalesce(p.action_required,'OK')<>'OK' then 'REVIEW_REQUIRED'
           else 'READY' end::text as review_state,
      case when p.is_override then 'PM_SKU_OVERRIDE' else 'PM_BOM' end::text as pm_source,
      sum(coalesce(p.pm_cost_per_sku_line,0)) over(partition by p.sku_id) as sku_pm_total
    from costing.sku_pm_material_cost_line_snapshot p
    join cr on cr.period_start=p.period_start and cr.valuation_date=p.valuation_date and cr.refresh_run_id=p.refresh_run_id
    left join public.inv_stock_item i on i.id=p.stock_item_id
  ), filtered as (
    select b.* from base b
    where (p_product_id is null or b.product_id=p_product_id)
      and (p_sku_id is null or b.sku_id=p_sku_id)
      and (p_stock_item_id is null or b.stock_item_id=p_stock_item_id)
      and (v_review is null or b.review_state=v_review)
      and (nullif(btrim(p_bom_source),'') is null or upper(b.pm_source)=upper(btrim(p_bom_source)))
      and (v_search is null or b.stock_item_code ilike '%'||v_search||'%' or b.stock_item_name ilike '%'||v_search||'%' or b.product_name ilike '%'||v_search||'%' or concat_ws(' ',b.pack_size,b.pack_uom) ilike '%'||v_search||'%')
      and (v_warn is null
           or (v_warn='HAS_WARNING' and (coalesce(b.rate_warning_flag,false) or coalesce(b.approval_block_flag,false) or coalesce(b.review_required_flag,false)))
           or (v_warn='NO_WARNING' and not (coalesce(b.rate_warning_flag,false) or coalesce(b.approval_block_flag,false) or coalesce(b.review_required_flag,false)))
           or (v_warn in ('STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED','MISSING_MATERIAL_RATE') and upper(coalesce(b.rate_warning_code,''))=v_warn))
  ), counted as (select f.*,count(*) over()::bigint total_row_count from filtered f)
  select c.period_start,c.valuation_date,c.refresh_run_id,
         c.product_id,c.product_name,c.sku_id,concat_ws(' ',trim(to_char(c.pack_size,'FM999999999.########')),c.pack_uom),
         c.stock_item_id,c.stock_item_code,c.stock_item_name,c.pm_source,
         c.qty_required_unit_final,c.uom_code,c.selected_rate,c.rate_source,c.rate_date,
         c.pm_cost_per_sku_line,
         case when c.sku_pm_total>0 then round((coalesce(c.pm_cost_per_sku_line,0)/c.sku_pm_total)*100,6) else null end,
         c.rate_warning_code,c.rate_warning_text,c.action_required,c.approval_block_flag,c.review_required_flag,
         c.review_state,'PM'::text,c.captured_at,c.total_row_count
  from counted c
  order by c.product_name,c.pack_size,c.pack_uom,c.source_duplicate_ordinal,c.stock_item_name,c.stock_item_id
  limit v_limit offset v_offset;
end;$$;

create or replace function public.rpc_get_material_rate_pm_cost_trace_filter_options(
  p_period_start date,
  p_product_id bigint default null
)
returns jsonb
language plpgsql stable security definer
set search_path='public','costing','pg_temp'
as $$
declare v_period date:=date_trunc('month',p_period_start)::date; v_result jsonb;
begin
  perform public.require_permission('module:material-cost-manager',false);
  perform public.require_permission('role:material-cost-pm-trace',false);
  if p_period_start is null then raise exception 'p_period_start is required'; end if;
  with cr as (
    select r.period_start,r.valuation_date,r.refresh_run_id from costing.v_current_successful_costing_refresh_run r where r.period_start=v_period limit 1
  ), b as (
    select p.*,case when p.is_override then 'PM_SKU_OVERRIDE' else 'PM_BOM' end pm_source
    from costing.sku_pm_material_cost_line_snapshot p join cr on cr.period_start=p.period_start and cr.valuation_date=p.valuation_date and cr.refresh_run_id=p.refresh_run_id
  )
  select jsonb_build_object(
    'period_start',v_period,
    'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',x.product_id,'product_name',x.product_name) order by x.product_name) from (select distinct product_id,product_name from b)x),'[]'::jsonb),
    'skus',coalesce((select jsonb_agg(jsonb_build_object('sku_id',x.sku_id,'product_id',x.product_id,'sku_column_label',concat_ws(' ',trim(to_char(x.pack_size,'FM999999999.########')),x.pack_uom)) order by x.product_id,x.pack_size,x.pack_uom,x.sku_id) from (select distinct sku_id,product_id,pack_size,pack_uom from b where p_product_id is null or product_id=p_product_id)x),'[]'::jsonb),
    'bom_sources',jsonb_build_array('PM_BOM','PM_SKU_OVERRIDE'),
    'review_states',jsonb_build_array('READY','REVIEW_REQUIRED','BLOCKED'),
    'warning_statuses',jsonb_build_array('HAS_WARNING','STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED','MISSING_MATERIAL_RATE','NO_WARNING'),
    'trace_component','PM',
    'valuation_date',(select valuation_date from cr),
    'refresh_run_id',(select refresh_run_id from cr),
    'snapshot_refreshed_at',(select max(captured_at) from b)
  ) into v_result;
  return v_result;
end;$$;

create or replace function public.rpc_export_material_rate_pm_cost_trace(
  p_period_start date,
  p_product_id bigint default null,
  p_sku_id bigint default null,
  p_stock_item_id bigint default null,
  p_review_state text default null,
  p_bom_source text default null,
  p_warning_status text default null,
  p_search_text text default null
)
returns table(
  period_start date, valuation_date date, refresh_run_id bigint,
  product_name text, sku_column_label text, stock_item_code text, stock_item_name text,
  pm_source text, sku_quantity numeric, quantity_uom text, selected_rate numeric,
  rate_source text, rate_date date, pm_line_cost numeric, contribution_share_percent numeric,
  review_state text, warning_code text, warning_text text, snapshot_refreshed_at timestamptz,
  export_total_row_count bigint
)
language plpgsql stable security definer
set search_path='public','costing','pg_temp'
as $$
begin
  perform public.require_permission('module:material-cost-manager',false);
  perform public.require_permission('role:material-cost-pm-trace',false);
  perform public.require_permission('role:material-cost-pm-trace-export',false);
  return query
  select x.period_start,x.valuation_date,x.refresh_run_id,x.product_name,x.sku_column_label,x.stock_item_code,x.stock_item_name,
         x.pm_source,x.sku_quantity,x.quantity_uom,x.selected_rate,x.rate_source,x.rate_date,x.pm_line_cost,x.contribution_share_percent,
         x.review_state,x.warning_code,x.warning_text,x.snapshot_refreshed_at,x.total_row_count
  from public.rpc_get_material_rate_pm_cost_trace(p_period_start,p_product_id,p_sku_id,p_stock_item_id,p_review_state,p_bom_source,p_warning_status,p_search_text,200,0) x
  order by x.product_name,x.sku_column_label,x.stock_item_name;
end;$$;

revoke all on function public.rpc_get_material_rate_pm_cost_trace(date,bigint,bigint,bigint,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.rpc_get_material_rate_pm_cost_trace(date,bigint,bigint,bigint,text,text,text,text,integer,integer) to authenticated,service_role,postgres;
revoke all on function public.rpc_get_material_rate_pm_cost_trace_filter_options(date,bigint) from public,anon;
grant execute on function public.rpc_get_material_rate_pm_cost_trace_filter_options(date,bigint) to authenticated,service_role,postgres;
revoke all on function public.rpc_export_material_rate_pm_cost_trace(date,bigint,bigint,bigint,text,text,text,text) from public,anon;
grant execute on function public.rpc_export_material_rate_pm_cost_trace(date,bigint,bigint,bigint,text,text,text,text) to authenticated,service_role,postgres;