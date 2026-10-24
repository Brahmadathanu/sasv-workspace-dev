-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_resolve_internal_material_rm_rate_as_of(
  p_stock_item_id bigint,
  p_as_of_date date,
  p_visited_source_product_ids bigint[] default array[]::bigint[]
)
returns table(
  stock_item_id bigint,
  source_product_id bigint,
  source_product_name text,
  source_product_base_uom text,
  transfer_uom_id bigint,
  transfer_uom_code text,
  resolution_status text,
  selected_rate numeric,
  warning_flag boolean,
  warning_code text,
  warning_text text,
  blocking_line_count bigint,
  review_line_count bigint,
  evidence_json jsonb
)
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
  v_lineage costing.internal_material_source_lineage%rowtype;
  v_source_name text;
  v_source_status text;
  v_source_base_uom text;
  v_transfer_uom_code text;
  v_req record;
  v_child record;
  v_rate record;
  v_total numeric := 0;
  v_blocking bigint := 0;
  v_review bigint := 0;
  v_evidence jsonb := '[]'::jsonb;
  v_child_count bigint;
begin
  if p_stock_item_id is null or p_as_of_date is null then
    raise exception 'stock_item_id and as_of_date are required';
  end if;

  select l.* into v_lineage
  from costing.internal_material_source_lineage l
  where l.consume_stock_item_id=p_stock_item_id
    and l.status='APPROVED'
    and l.effective_from<=p_as_of_date
    and (l.effective_to is null or l.effective_to>=p_as_of_date)
  order by l.effective_from desc,l.id desc
  limit 1;

  if not found then
    return query select p_stock_item_id,null::bigint,null::text,null::text,null::bigint,null::text,
      'NO_APPROVED_LINEAGE'::text,null::numeric,false,null::text,'No approved internal-material lineage exists.'::text,
      1::bigint,0::bigint,'[]'::jsonb;
    return;
  end if;

  select p.item,p.status into v_source_name,v_source_status
  from public.products p where p.id=v_lineage.source_product_id;

  select u.code into v_transfer_uom_code from public.inv_uom u where u.id=v_lineage.transfer_uom_id;

  if v_source_status is distinct from 'Active' then
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,null::text,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'BLOCKED'::text,null::numeric,false,
      'INTERNAL_SOURCE_PRODUCT_INACTIVE'::text,'Internal source product is not Active.'::text,
      1::bigint,0::bigint,jsonb_build_array(jsonb_build_object('source_product_id',v_lineage.source_product_id,'status',v_source_status));
    return;
  end if;

  if v_lineage.source_product_id = any(coalesce(p_visited_source_product_ids,array[]::bigint[])) then
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,null::text,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'BLOCKED'::text,null::numeric,false,
      'INTERNAL_LINEAGE_CYCLE'::text,'Internal material lineage cycle detected.'::text,
      1::bigint,0::bigint,jsonb_build_array(jsonb_build_object('visited',p_visited_source_product_ids,'source_product_id',v_lineage.source_product_id));
    return;
  end if;

  select max(r.product_base_uom) into v_source_base_uom
  from costing.fn_build_product_rm_requirement_as_of(p_as_of_date) r
  where r.product_id=v_lineage.source_product_id;

  if v_source_base_uom is null then
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,null::text,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'BLOCKED'::text,null::numeric,false,
      'INTERNAL_SOURCE_RM_REQUIREMENT_MISSING'::text,'No RM requirement foundation exists for internal source product.'::text,
      1::bigint,0::bigint,'[]'::jsonb;
    return;
  end if;

  if lower(trim(v_source_base_uom)) is distinct from lower(trim(v_transfer_uom_code)) then
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,v_source_base_uom,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'BLOCKED'::text,null::numeric,false,
      'INTERNAL_TRANSFER_UOM_MISMATCH'::text,
      format('Source product base UOM %s does not match transfer UOM %s.',v_source_base_uom,v_transfer_uom_code),
      1::bigint,0::bigint,'[]'::jsonb;
    return;
  end if;

  for v_req in
    select *
    from costing.fn_build_product_rm_requirement_as_of(p_as_of_date) r
    where r.product_id=v_lineage.source_product_id
    order by r.level,r.purchase_stock_item_id,r.consume_stock_item_id
  loop
    if coalesce(v_req.calculation_warning_flag,false) then
      if coalesce(v_req.is_optional,false) then v_review:=v_review+1; else v_blocking:=v_blocking+1; end if;
      v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
        'stock_item_id',v_req.purchase_stock_item_id,'status','CALCULATION_WARNING','code',v_req.calculation_warning_code,'optional',v_req.is_optional));
      continue;
    end if;

    if v_req.qty_purchase_form_per_base_unit is null then
      if coalesce(v_req.is_optional,false) then v_review:=v_review+1; else v_blocking:=v_blocking+1; end if;
      v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object('stock_item_id',v_req.purchase_stock_item_id,'status','MISSING_QTY','optional',v_req.is_optional));
      continue;
    end if;

    select count(*) into v_child_count
    from costing.internal_material_source_lineage l
    where l.consume_stock_item_id=v_req.purchase_stock_item_id
      and l.status='APPROVED'
      and l.effective_from<=p_as_of_date
      and (l.effective_to is null or l.effective_to>=p_as_of_date);

    if v_child_count>1 then
      if coalesce(v_req.is_optional,false) then v_review:=v_review+1; else v_blocking:=v_blocking+1; end if;
      v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object('stock_item_id',v_req.purchase_stock_item_id,'status','AMBIGUOUS_INTERNAL_LINEAGE','count',v_child_count));
      continue;
    elsif v_child_count=1 then
      select * into v_child
      from costing.fn_resolve_internal_material_rm_rate_as_of(
        v_req.purchase_stock_item_id,p_as_of_date,
        coalesce(p_visited_source_product_ids,array[]::bigint[])||v_lineage.source_product_id
      );

      if v_child.selected_rate is null then
        if coalesce(v_req.is_optional,false) then v_review:=v_review+1; else v_blocking:=v_blocking+1; end if;
      else
        v_total:=v_total + v_req.qty_purchase_form_per_base_unit*v_child.selected_rate;
        if coalesce(v_child.warning_flag,false) or v_child.resolution_status='REVIEW_REQUIRED' then v_review:=v_review+1; end if;
      end if;
      v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
        'stock_item_id',v_req.purchase_stock_item_id,'qty_per_base',v_req.qty_purchase_form_per_base_unit,
        'rate_source','INTERNAL_SOURCE_PRODUCT_RM_STANDARD_COST','rate',v_child.selected_rate,
        'status',v_child.resolution_status,'warning_code',v_child.warning_code,'optional',v_req.is_optional));
    else
      select * into v_rate
      from costing.fn_resolve_material_rate_as_of(v_req.purchase_stock_item_id,p_as_of_date);

      if v_rate.selected_rate is null then
        if coalesce(v_req.is_optional,false) then v_review:=v_review+1; else v_blocking:=v_blocking+1; end if;
      else
        v_total:=v_total + v_req.qty_purchase_form_per_base_unit*v_rate.selected_rate;
        if coalesce(v_rate.warning_flag,false) then v_review:=v_review+1; end if;
      end if;
      v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
        'stock_item_id',v_req.purchase_stock_item_id,'qty_per_base',v_req.qty_purchase_form_per_base_unit,
        'rate_source',v_rate.rate_source,'rate',v_rate.selected_rate,'status',v_rate.resolution_status,
        'warning_code',v_rate.warning_code,'optional',v_req.is_optional));
    end if;
  end loop;

  if v_blocking>0 then
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,v_source_base_uom,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'BLOCKED'::text,null::numeric,false,
      'INTERNAL_SOURCE_RM_BLOCKED'::text,
      format('Internal source Product RM cost is blocked by %s required line(s).',v_blocking),v_blocking,v_review,v_evidence;
  elsif v_review>0 then
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,v_source_base_uom,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'REVIEW_REQUIRED'::text,v_total,true,
      'INTERNAL_SOURCE_REVIEW_REQUIRED'::text,
      format('Internal source Product RM cost is resolved but %s line(s) require review.',v_review),0::bigint,v_review,v_evidence;
  else
    return query select p_stock_item_id,v_lineage.source_product_id,v_source_name,v_source_base_uom,
      v_lineage.transfer_uom_id,v_transfer_uom_code,'RESOLVED'::text,v_total,false,null::text,
      'Internal source Product RM standard cost resolved.'::text,0::bigint,0::bigint,v_evidence;
  end if;
end;
$$;

create or replace function costing.fn_build_product_rm_cost_lines_as_of(p_period_start date, p_valuation_date date)
returns table(period_start date, valuation_date date, product_id bigint, product_name text, product_base_uom text, conversion_to_base numeric, root_bom_id bigint, reference_output_qty numeric, reference_output_uom_code text, process_loss_pct numeric, consume_stock_item_id bigint, consume_stock_item_name text, purchase_stock_item_id bigint, purchase_stock_item_name text, consume_uom_id bigint, consume_uom_code text, purchase_uom_id bigint, purchase_uom_code text, qty_consume_form_per_base_unit numeric, qty_purchase_form_per_base_unit numeric, form_conversion_factor numeric, form_conversion_applied boolean, form_conversion_id bigint, form_conversion_status text, source text, level integer, parent_bom_type text, explosion_path jsonb, is_optional boolean, selected_rate numeric, rate_source text, rate_date date, selected_uom_id bigint, selected_manual_rate_id bigint, selected_purchase_fact_id bigint, selected_vendor_id bigint, selected_stock_valuation_source text, rate_resolution_status text, rate_warning_flag boolean, rate_warning_code text, rate_warning_text text, rm_cost_per_base_unit_line numeric, action_required text, approval_block_flag boolean, calculation_warning_flag boolean, calculation_warning_code text)
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $$
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
    select distinct on (l.consume_stock_item_id)
      l.*
    from costing.internal_material_source_lineage l
    where l.status='APPROVED'
      and l.effective_from<=p_valuation_date
      and (l.effective_to is null or l.effective_to>=p_valuation_date)
    order by l.consume_stock_item_id,l.effective_from desc,l.id desc
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
  left join lateral costing.fn_resolve_internal_material_rm_rate_as_of(
    r.purchase_stock_item_id,p_valuation_date,array[r.product_id]::bigint[]
  ) ir on lin.id is not null;
end;
$$;