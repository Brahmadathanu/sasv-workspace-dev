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
  v_total numeric := 0;
  v_blocking bigint := 0;
  v_review bigint := 0;
  v_bulk_total numeric := 0;
  v_bulk_blocking bigint := 0;
  v_bulk_review bigint := 0;
  v_bulk_evidence jsonb := '[]'::jsonb;
  v_req record;
  v_child record;
  v_evidence jsonb := '[]'::jsonb;
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

  with req as materialized (
    select r.*
    from costing.fn_build_product_rm_requirement_as_of(p_as_of_date) r
    where r.product_id=v_lineage.source_product_id
      and not exists (
        select 1 from costing.internal_material_source_lineage il
        where il.consume_stock_item_id=r.purchase_stock_item_id
          and il.status='APPROVED'
          and il.effective_from<=p_as_of_date
          and (il.effective_to is null or il.effective_to>=p_as_of_date)
      )
  ), ids as (
    select array_agg(distinct req.purchase_stock_item_id order by req.purchase_stock_item_id)
      filter(where req.purchase_stock_item_id is not null) as stock_item_ids
    from req
  ), rates as materialized (
    select rr.*
    from ids
    cross join lateral costing.fn_resolve_material_rates_as_of(coalesce(ids.stock_item_ids,array[]::bigint[]),p_as_of_date) rr
  ), classified as (
    select req.*,rates.selected_rate as resolved_selected_rate,rates.rate_source as resolved_rate_source,
      rates.resolution_status as resolved_resolution_status,rates.warning_flag as resolved_warning_flag,
      rates.warning_code as resolved_warning_code,
      case
        when coalesce(req.calculation_warning_flag,false) then true
        when rates.resolution_status='AMBIGUOUS' then true
        when rates.selected_rate is null and coalesce(req.is_optional,false)=false then true
        else false
      end as is_blocking,
      case
        when coalesce(req.calculation_warning_flag,false)=false
         and rates.resolution_status is distinct from 'AMBIGUOUS'
         and not (rates.selected_rate is null and coalesce(req.is_optional,false)=false)
         and ((rates.selected_rate is null and coalesce(req.is_optional,false)=true) or coalesce(rates.warning_flag,false))
        then true else false
      end as is_review
    from req
    left join rates on rates.stock_item_id=req.purchase_stock_item_id
  )
  select
    coalesce(sum(case when not c.is_blocking and c.resolved_selected_rate is not null then c.qty_purchase_form_per_base_unit*c.resolved_selected_rate else 0 end),0),
    count(*) filter(where c.is_blocking),
    count(*) filter(where c.is_review),
    coalesce(jsonb_agg(jsonb_build_object(
      'stock_item_id',c.purchase_stock_item_id,'qty_per_base',c.qty_purchase_form_per_base_unit,
      'rate_source',c.resolved_rate_source,'rate',c.resolved_selected_rate,'resolution_status',c.resolved_resolution_status,
      'warning_code',c.resolved_warning_code,'optional',c.is_optional,'calculation_warning_code',c.calculation_warning_code
    ) order by c.purchase_stock_item_id),'[]'::jsonb)
  into v_bulk_total,v_bulk_blocking,v_bulk_review,v_bulk_evidence
  from classified c;

  v_total:=v_total+coalesce(v_bulk_total,0);
  v_blocking:=v_blocking+coalesce(v_bulk_blocking,0);
  v_review:=v_review+coalesce(v_bulk_review,0);
  v_evidence:=v_evidence||coalesce(v_bulk_evidence,'[]'::jsonb);

  for v_req in
    select r.*
    from costing.fn_build_product_rm_requirement_as_of(p_as_of_date) r
    where r.product_id=v_lineage.source_product_id
      and exists (
        select 1 from costing.internal_material_source_lineage il
        where il.consume_stock_item_id=r.purchase_stock_item_id
          and il.status='APPROVED'
          and il.effective_from<=p_as_of_date
          and (il.effective_to is null or il.effective_to>=p_as_of_date)
      )
    order by r.level,r.purchase_stock_item_id,r.consume_stock_item_id
  loop
    if coalesce(v_req.calculation_warning_flag,false) or v_req.qty_purchase_form_per_base_unit is null then
      v_blocking:=v_blocking+1;
      v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
        'stock_item_id',v_req.purchase_stock_item_id,'status','BLOCKED_CHILD_CALCULATION','code',v_req.calculation_warning_code));
      continue;
    end if;

    select * into v_child
    from costing.fn_resolve_internal_material_rm_rate_as_of(
      v_req.purchase_stock_item_id,p_as_of_date,
      coalesce(p_visited_source_product_ids,array[]::bigint[])||v_lineage.source_product_id
    );

    if v_child.selected_rate is null then
      if coalesce(v_req.is_optional,false) then v_review:=v_review+1; else v_blocking:=v_blocking+1; end if;
    else
      v_total:=v_total+v_req.qty_purchase_form_per_base_unit*v_child.selected_rate;
      if coalesce(v_child.warning_flag,false) or v_child.resolution_status='REVIEW_REQUIRED' then v_review:=v_review+1; end if;
    end if;

    v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object(
      'stock_item_id',v_req.purchase_stock_item_id,'qty_per_base',v_req.qty_purchase_form_per_base_unit,
      'rate_source','INTERNAL_SOURCE_PRODUCT_RM_STANDARD_COST','rate',v_child.selected_rate,
      'status',v_child.resolution_status,'warning_code',v_child.warning_code,'optional',v_req.is_optional));
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