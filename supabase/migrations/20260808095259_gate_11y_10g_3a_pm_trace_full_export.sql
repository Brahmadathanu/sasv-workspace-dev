-- backfilled from live schema_migrations on 2026-10-24, CI-016
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
declare
  v_period date:=date_trunc('month',p_period_start)::date;
  v_review text:=upper(nullif(btrim(p_review_state),''));
  v_warn text:=upper(nullif(btrim(p_warning_status),''));
  v_search text:=nullif(btrim(p_search_text),'');
begin
  perform public.require_permission('module:material-cost-manager',false);
  perform public.require_permission('role:material-cost-pm-trace',false);
  perform public.require_permission('role:material-cost-pm-trace-export',false);
  if p_period_start is null then raise exception 'p_period_start is required'; end if;
  if v_review is not null and v_review not in ('READY','REVIEW_REQUIRED','BLOCKED') then raise exception 'Unsupported p_review_state: %',p_review_state; end if;
  if v_warn is not null and v_warn not in ('HAS_WARNING','STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED','MISSING_MATERIAL_RATE','NO_WARNING') then raise exception 'Unsupported p_warning_status: %',p_warning_status; end if;
  return query
  with cr as (
    select r.period_start,r.valuation_date,r.refresh_run_id from costing.v_current_successful_costing_refresh_run r where r.period_start=v_period limit 1
  ), base as (
    select p.*,i.code stock_item_code,
      case when coalesce(p.approval_block_flag,false) or coalesce(p.required_missing_rate_block_flag,false) then 'BLOCKED'
           when coalesce(p.review_required_flag,false) or coalesce(p.rate_warning_flag,false) or coalesce(p.action_required,'OK')<>'OK' then 'REVIEW_REQUIRED'
           else 'READY' end::text review_state,
      case when p.is_override then 'PM_SKU_OVERRIDE' else 'PM_BOM' end::text pm_source,
      sum(coalesce(p.pm_cost_per_sku_line,0)) over(partition by p.sku_id) sku_pm_total
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
  ), counted as (select f.*,count(*) over()::bigint export_total_row_count from filtered f)
  select c.period_start,c.valuation_date,c.refresh_run_id,c.product_name,
         concat_ws(' ',trim(to_char(c.pack_size,'FM999999999.########')),c.pack_uom),c.stock_item_code,c.stock_item_name,c.pm_source,
         c.qty_required_unit_final,c.uom_code,c.selected_rate,c.rate_source,c.rate_date,c.pm_cost_per_sku_line,
         case when c.sku_pm_total>0 then round((coalesce(c.pm_cost_per_sku_line,0)/c.sku_pm_total)*100,6) else null end,
         c.review_state,c.rate_warning_code,c.rate_warning_text,c.captured_at,c.export_total_row_count
  from counted c
  order by c.product_name,c.pack_size,c.pack_uom,c.source_duplicate_ordinal,c.stock_item_name,c.stock_item_id;
end;$$;
revoke all on function public.rpc_export_material_rate_pm_cost_trace(date,bigint,bigint,bigint,text,text,text,text) from public,anon;
grant execute on function public.rpc_export_material_rate_pm_cost_trace(date,bigint,bigint,bigint,text,text,text,text) to authenticated,service_role,postgres;