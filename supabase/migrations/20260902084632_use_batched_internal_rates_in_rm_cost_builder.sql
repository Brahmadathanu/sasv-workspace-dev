-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_build_product_rm_cost_lines_as_of(p_period_start date, p_valuation_date date)
returns table(period_start date, valuation_date date, product_id bigint, product_name text, product_base_uom text, conversion_to_base numeric, root_bom_id bigint, reference_output_qty numeric, reference_output_uom_code text, process_loss_pct numeric, consume_stock_item_id bigint, consume_stock_item_name text, purchase_stock_item_id bigint, purchase_stock_item_name text, consume_uom_id bigint, consume_uom_code text, purchase_uom_id bigint, purchase_uom_code text, qty_consume_form_per_base_unit numeric, qty_purchase_form_per_base_unit numeric, form_conversion_factor numeric, form_conversion_applied boolean, form_conversion_id bigint, form_conversion_status text, source text, level integer, parent_bom_type text, explosion_path jsonb, is_optional boolean, selected_rate numeric, rate_source text, rate_date date, selected_uom_id bigint, selected_manual_rate_id bigint, selected_purchase_fact_id bigint, selected_vendor_id bigint, selected_stock_valuation_source text, rate_resolution_status text, rate_warning_flag boolean, rate_warning_code text, rate_warning_text text, rm_cost_per_base_unit_line numeric, action_required text, approval_block_flag boolean, calculation_warning_flag boolean, calculation_warning_code text)
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period_start date;
begin
  if p_period_start is null then raise exception 'Costing period is required'; end if;
  if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
  v_period_start:=date_trunc('month',p_period_start)::date;
  if p_valuation_date<v_period_start or p_valuation_date>(v_period_start+interval '1 month - 1 day')::date then
    raise exception 'Valuation date % is outside costing period %',p_valuation_date,v_period_start;
  end if;

  return query
  with requirements as materialized (
    select * from costing.fn_build_product_rm_requirement_as_of(p_valuation_date)
  ), requested_rate_items as materialized (
    select array_agg(distinct r.purchase_stock_item_id order by r.purchase_stock_item_id)
      filter(where r.purchase_stock_item_id is not null) stock_item_ids
    from requirements r
  ), resolved_rates as materialized (
    select rate.*
    from requested_rate_items x
    cross join lateral costing.fn_resolve_material_rates_as_of(coalesce(x.stock_item_ids,array[]::bigint[]),p_valuation_date) rate
  ), lineage as materialized (
    select distinct on (l.consume_stock_item_id) l.*
    from costing.internal_material_source_lineage l
    where l.status='APPROVED'
      and l.effective_from<=p_valuation_date
      and (l.effective_to is null or l.effective_to>=p_valuation_date)
    order by l.consume_stock_item_id,l.effective_from desc,l.id desc
  ), internal_rates as materialized (
    select * from costing.fn_resolve_internal_material_rm_rates_as_of(p_valuation_date)
  )
  select
    v_period_start,p_valuation_date,
    r.product_id,r.product_name,r.product_base_uom,r.conversion_to_base,
    r.root_bom_id,r.reference_output_qty,r.reference_output_uom_code,r.process_loss_pct,
    r.consume_stock_item_id,r.consume_stock_item_name,r.purchase_stock_item_id,r.purchase_stock_item_name,
    r.consume_uom_id,r.consume_uom_code,r.purchase_uom_id,r.purchase_uom_code,
    r.qty_consume_form_per_base_unit,r.qty_purchase_form_per_base_unit,
    r.form_conversion_factor,r.form_conversion_applied,r.form_conversion_id,r.form_conversion_status,
    r.source,r.level,r.parent_bom_type,r.explosion_path,coalesce(r.is_optional,false),
    case when lin.id is not null then ir.selected_rate else rate.selected_rate end,
    case when lin.id is not null then 'INTERNAL_SOURCE_PRODUCT_RM_STANDARD_COST' else rate.rate_source end,
    case when lin.id is not null then p_valuation_date else rate.rate_date end,
    case when lin.id is not null then lin.transfer_uom_id else rate.selected_uom_id end,
    case when lin.id is not null then null::bigint else rate.selected_manual_rate_id end,
    case when lin.id is not null then null::bigint else rate.selected_purchase_fact_id end,
    case when lin.id is not null then null::bigint else rate.selected_vendor_id end,
    case when lin.id is not null then null::text else rate.selected_stock_valuation_source end,
    case when lin.id is not null then ir.resolution_status else rate.resolution_status end,
    case when lin.id is not null then coalesce(ir.warning_flag,false) else rate.warning_flag end,
    case when lin.id is not null then ir.warning_code else rate.warning_code end,
    case when lin.id is not null then ir.warning_text else rate.warning_text end,
    case
      when r.calculation_warning_flag=true then null::numeric
      when (case when lin.id is not null then ir.selected_rate else rate.selected_rate end) is null then null::numeric
      else r.qty_purchase_form_per_base_unit*(case when lin.id is not null then ir.selected_rate else rate.selected_rate end)
    end,
    case
      when r.calculation_warning_flag=true then 'REVIEW_CALCULATION'
      when lin.id is null and rate.resolution_status='AMBIGUOUS' then 'BLOCKING_AMBIGUOUS_RATE'
      when (case when lin.id is not null then ir.selected_rate else rate.selected_rate end) is null and coalesce(r.is_optional,false)=false then 'BLOCKING_MISSING_REQUIRED_RATE'
      when (case when lin.id is not null then ir.selected_rate else rate.selected_rate end) is null and coalesce(r.is_optional,false)=true then 'OPTIONAL_MISSING_RATE'
      when lin.id is not null and coalesce(ir.warning_flag,false) then 'REVIEW_RATE'
      when lin.id is null and rate.warning_code=any(array['STALE_PURCHASE_RATE','STOCK_VALUATION_FALLBACK','MANUAL_RATE_USED']::text[]) then 'REVIEW_RATE'
      else 'OK'
    end,
    case
      when r.calculation_warning_flag=true then true
      when lin.id is null and rate.resolution_status='AMBIGUOUS' then true
      when (case when lin.id is not null then ir.selected_rate else rate.selected_rate end) is null and coalesce(r.is_optional,false)=false then true
      else false
    end,
    r.calculation_warning_flag,r.calculation_warning_code
  from requirements r
  left join resolved_rates rate on rate.stock_item_id=r.purchase_stock_item_id
  left join lineage lin on lin.consume_stock_item_id=r.purchase_stock_item_id
  left join internal_rates ir on ir.stock_item_id=r.purchase_stock_item_id;
end;
$function$;