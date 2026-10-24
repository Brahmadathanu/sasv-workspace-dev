-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.rpc_refresh_sku_internal_material_conversion_snapshot(
  p_period_start date,p_valuation_date date,p_refresh_run_id bigint
)
returns table(refreshed_period_start date,inserted_row_count bigint,blocked_count bigint,review_required_count bigint,ready_count bigint)
language plpgsql security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;
  select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Internal conversion snapshot context mismatch for run %',p_refresh_run_id;
  end if;

  if (select count(*) from costing.product_rm_material_cost_line_snapshot where refresh_run_id=p_refresh_run_id)=0 then
    raise exception 'Frozen Product RM line snapshot is missing for run %',p_refresh_run_id;
  end if;
  if (select count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=p_refresh_run_id)=0 then
    raise exception 'Canonical SKU allocation basis is missing for run %',p_refresh_run_id;
  end if;

  delete from costing.sku_internal_material_conversion_snapshot where refresh_run_id=p_refresh_run_id;

  insert into costing.sku_internal_material_conversion_snapshot(
    period_start,valuation_date,refresh_run_id,sku_id,product_id,product_name,pack_size,pack_uom,sku_base_qty_per_unit,
    internal_source_line_count,internal_conversion_cost_per_product_base_uom,internal_conversion_cost_per_sku,
    conversion_status,conversion_reason_code,conversion_note,evidence_json,refreshed_at
  )
  with internal_lines as (
    select l.product_id,l.purchase_stock_item_id,l.purchase_stock_item_name,l.qty_purchase_form_per_base_unit,
           il.source_product_id,
           r.total_conversion_burden_per_base,r.conversion_status as source_conversion_status,r.reason_code,r.evidence_json
    from costing.product_rm_material_cost_line_snapshot l
    join costing.internal_material_source_lineage il
      on il.consume_stock_item_id=l.purchase_stock_item_id
     and il.status='APPROVED'
     and il.effective_from<=p_valuation_date
     and (il.effective_to is null or il.effective_to>=p_valuation_date)
    left join lateral costing.fn_resolve_product_internal_conversion_burden(
      il.source_product_id,p_refresh_run_id,array[l.product_id]::bigint[]
    ) r on true
    where l.refresh_run_id=p_refresh_run_id
      and coalesce(l.is_optional,false)=false
  ), product_conv as (
    select product_id,count(*)::bigint source_line_count,
      case
        when bool_or(source_conversion_status='BLOCKED' or total_conversion_burden_per_base is null or qty_purchase_form_per_base_unit is null)
          then null::numeric
        else sum(qty_purchase_form_per_base_unit*total_conversion_burden_per_base)
      end as per_base,
      case
        when bool_or(source_conversion_status='BLOCKED' or total_conversion_burden_per_base is null or qty_purchase_form_per_base_unit is null) then 'BLOCKED'
        when bool_or(source_conversion_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
        else 'READY'
      end as status,
      jsonb_agg(jsonb_build_object(
        'stock_item_id',purchase_stock_item_id,'source_product_id',source_product_id,
        'qty_per_product_base',qty_purchase_form_per_base_unit,'source_conversion_per_base',total_conversion_burden_per_base,
        'source_status',source_conversion_status,'reason_code',reason_code,'source_evidence',evidence_json
      ) order by purchase_stock_item_id) as evidence
    from internal_lines
    group by product_id
  )
  select b.period_start,b.valuation_date,b.refresh_run_id,b.sku_id,b.product_id,b.product_name,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,
    coalesce(pc.source_line_count,0),
    case when pc.product_id is null then 0 else pc.per_base end,
    case when pc.product_id is null then 0
         when pc.per_base is null or b.sku_base_qty_per_unit is null then null
         else pc.per_base*b.sku_base_qty_per_unit end,
    coalesce(pc.status,'READY'),
    case when pc.product_id is null then 'NO_INTERNAL_MATERIAL_SOURCE' else 'INTERNAL_MATERIAL_SOURCE_CONVERSION' end,
    case when pc.product_id is null then 'No approved internal-material source is consumed by this Product.'
         when pc.status='BLOCKED' then 'Internal material conversion cost is blocked by upstream source-product conversion evidence.'
         when pc.status='REVIEW_REQUIRED' then 'Internal material conversion cost is calculated but inherits review-required upstream conversion evidence.'
         else 'Internal material conversion cost is resolved from approved source-product lineage.' end,
    coalesce(pc.evidence,'[]'::jsonb),clock_timestamp()
  from costing.sku_sales_allocation_basis_snapshot b
  left join product_conv pc on pc.product_id=b.product_id
  where b.refresh_run_id=p_refresh_run_id;

  if exists(
    select 1 from costing.sku_internal_material_conversion_snapshot s
    where s.refresh_run_id=p_refresh_run_id
      and ((s.conversion_status='BLOCKED' and s.internal_conversion_cost_per_sku is not null)
        or (s.conversion_status<>'BLOCKED' and s.internal_conversion_cost_per_sku is null))
  ) then
    raise exception 'Internal conversion snapshot contains invalid null/status semantics for run %',p_refresh_run_id;
  end if;

  return query select v_period_start,count(*)::bigint,
    count(*) filter(where conversion_status='BLOCKED')::bigint,
    count(*) filter(where conversion_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where conversion_status='READY')::bigint
  from costing.sku_internal_material_conversion_snapshot where refresh_run_id=p_refresh_run_id;
end;
$$;

alter table costing.sku_prime_cost_snapshot add column if not exists internal_material_conversion_cost_per_sku numeric;
alter table costing.sku_prime_cost_snapshot add column if not exists internal_material_conversion_status text;
alter table costing.sku_manufacturing_cop_snapshot add column if not exists internal_material_conversion_cost_per_sku numeric;
alter table costing.sku_manufacturing_cop_snapshot add column if not exists internal_material_conversion_status text;

create or replace function costing.rpc_refresh_sku_prime_cost_snapshot(p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
returns table(refreshed_period_start date,inserted_row_count bigint,blocked_count bigint,review_required_count bigint,ready_count bigint)
language plpgsql security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_material_count bigint;
  v_labour_count bigint;
  v_conversion_count bigint;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;
  select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Prime-cost context mismatch for run %',p_refresh_run_id;
  end if;

  -- All prerequisite Stage-03 allocations already exist at this point in the canonical chain.
  perform * from costing.rpc_refresh_sku_internal_material_conversion_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

  select count(*) into v_material_count from costing.sku_material_cost_snapshot where refresh_run_id=p_refresh_run_id;
  select count(*) into v_labour_count from costing.sku_direct_labour_allocation_snapshot where refresh_run_id=p_refresh_run_id;
  select count(*) into v_conversion_count from costing.sku_internal_material_conversion_snapshot where refresh_run_id=p_refresh_run_id;

  if v_material_count=0 or v_labour_count=0 or v_conversion_count=0 then
    raise exception 'Prime-cost prerequisites missing for run %: material %, labour %, internal conversion %',p_refresh_run_id,v_material_count,v_labour_count,v_conversion_count;
  end if;
  if v_material_count<>v_labour_count or v_material_count<>v_conversion_count then
    raise exception 'Prime-cost prerequisite row-count mismatch for run %: material %, labour %, internal conversion %',p_refresh_run_id,v_material_count,v_labour_count,v_conversion_count;
  end if;

  delete from costing.sku_prime_cost_snapshot where refresh_run_id=p_refresh_run_id;

  insert into costing.sku_prime_cost_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,
    sku_id,product_id,product_name,pack_size,pack_uom,
    rm_cost_per_sku,pm_cost_per_sku,material_cost_per_sku,direct_labour_cost_per_sku,
    internal_material_conversion_cost_per_sku,internal_material_conversion_status,prime_cost_per_sku,
    material_costing_status,direct_labour_allocation_status,
    allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
    prime_costing_status,prime_costing_note,refreshed_at
  )
  select m.period_start,m.valuation_date,m.refresh_run_id,b.id,
    m.sku_id,m.product_id,m.product_name,m.pack_size,m.pack_uom,
    m.rm_cost_per_sku,m.pm_cost_per_sku,m.material_cost_per_sku,dl.direct_labour_cost_per_sku,
    ic.internal_conversion_cost_per_sku,ic.conversion_status,
    case when m.material_cost_per_sku is null or dl.direct_labour_cost_per_sku is null or ic.internal_conversion_cost_per_sku is null
         then null::numeric
         else m.material_cost_per_sku+dl.direct_labour_cost_per_sku+ic.internal_conversion_cost_per_sku end,
    m.material_costing_status,dl.direct_labour_allocation_status,
    b.allocation_basis_source,b.allocation_resolution_status,b.allocation_resolution_note,
    case
      when m.material_costing_status='BLOCKED' or dl.direct_labour_allocation_status='BLOCKED' or ic.conversion_status='BLOCKED' then 'BLOCKED'
      when m.material_cost_per_sku is null or dl.direct_labour_cost_per_sku is null or ic.internal_conversion_cost_per_sku is null then 'BLOCKED'
      when m.material_costing_status='REVIEW_REQUIRED' or dl.direct_labour_allocation_status='REVIEW_REQUIRED' or ic.conversion_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when m.material_costing_status='BLOCKED' then 'Prime cost is blocked because material cost is blocked.'
      when dl.direct_labour_allocation_status='BLOCKED' then 'Prime cost is blocked because direct labour allocation is blocked.'
      when ic.conversion_status='BLOCKED' then 'Prime cost is blocked because internal source-product conversion burden is blocked.'
      when m.material_cost_per_sku is null or dl.direct_labour_cost_per_sku is null or ic.internal_conversion_cost_per_sku is null then 'Prime cost is blocked because one or more required components are missing.'
      when m.material_costing_status='REVIEW_REQUIRED' or dl.direct_labour_allocation_status='REVIEW_REQUIRED' or ic.conversion_status='REVIEW_REQUIRED' then 'Prime cost is calculated, but one or more components require review.'
      else 'Prime cost is ready.'
    end,
    clock_timestamp()
  from costing.sku_material_cost_snapshot m
  join costing.sku_direct_labour_allocation_snapshot dl
    on dl.refresh_run_id=m.refresh_run_id and dl.sku_id=m.sku_id
  join costing.sku_sales_allocation_basis_snapshot b
    on b.id=dl.allocation_basis_snapshot_id and b.refresh_run_id=dl.refresh_run_id and b.sku_id=dl.sku_id
  join costing.sku_internal_material_conversion_snapshot ic
    on ic.refresh_run_id=m.refresh_run_id and ic.sku_id=m.sku_id
  where m.refresh_run_id=p_refresh_run_id;

  return query select v_period_start,count(*)::bigint,
    count(*) filter(where prime_costing_status='BLOCKED')::bigint,
    count(*) filter(where prime_costing_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where prime_costing_status='READY')::bigint
  from costing.sku_prime_cost_snapshot where refresh_run_id=p_refresh_run_id;
end;
$$;

create or replace function costing.rpc_refresh_sku_manufacturing_cop_snapshot(p_period_start date,p_valuation_date date,p_refresh_run_id bigint)
returns table(refreshed_period_start date,inserted_row_count bigint,blocked_count bigint,review_required_count bigint,ready_count bigint)
language plpgsql security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_prime_count bigint;
  v_overhead_count bigint;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then raise exception 'period_start, valuation_date and refresh_run_id are required'; end if;
  select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then raise exception 'Manufacturing-COP context mismatch for run %',p_refresh_run_id; end if;

  select count(*) into v_prime_count from costing.sku_prime_cost_snapshot where refresh_run_id=p_refresh_run_id;
  select count(*) into v_overhead_count from costing.sku_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id;
  if v_prime_count=0 or v_overhead_count=0 or v_prime_count<>v_overhead_count then
    raise exception 'Manufacturing-COP prerequisite mismatch for run %: prime %, overhead %',p_refresh_run_id,v_prime_count,v_overhead_count;
  end if;

  delete from costing.sku_manufacturing_cop_snapshot where refresh_run_id=p_refresh_run_id;

  insert into costing.sku_manufacturing_cop_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,
    sku_id,product_id,product_name,pack_size,pack_uom,
    rm_cost_per_sku,pm_cost_per_sku,material_cost_per_sku,direct_labour_cost_per_sku,
    internal_material_conversion_cost_per_sku,internal_material_conversion_status,
    production_overhead_cost_per_sku,quality_control_overhead_cost_per_sku,materials_stores_overhead_cost_per_sku,
    prime_cost_per_sku,manufacturing_cop_per_sku,
    material_costing_status,direct_labour_allocation_status,production_overhead_allocation_status,
    quality_control_overhead_allocation_status,materials_stores_overhead_allocation_status,
    allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
    manufacturing_cop_status,manufacturing_cop_note,refreshed_at
  )
  select p.period_start,p.valuation_date,p.refresh_run_id,p.allocation_basis_snapshot_id,
    p.sku_id,p.product_id,p.product_name,p.pack_size,p.pack_uom,
    p.rm_cost_per_sku,p.pm_cost_per_sku,p.material_cost_per_sku,p.direct_labour_cost_per_sku,
    p.internal_material_conversion_cost_per_sku,p.internal_material_conversion_status,
    oh.production_overhead_cost_per_sku,oh.quality_control_overhead_cost_per_sku,oh.materials_stores_overhead_cost_per_sku,
    p.prime_cost_per_sku,
    case when p.prime_cost_per_sku is null or oh.production_overhead_cost_per_sku is null
           or oh.quality_control_overhead_cost_per_sku is null or oh.materials_stores_overhead_cost_per_sku is null
         then null::numeric
         else p.prime_cost_per_sku+oh.production_overhead_cost_per_sku+oh.quality_control_overhead_cost_per_sku+oh.materials_stores_overhead_cost_per_sku end,
    p.material_costing_status,p.direct_labour_allocation_status,oh.production_overhead_allocation_status,
    oh.quality_control_overhead_allocation_status,oh.materials_stores_overhead_allocation_status,
    p.allocation_basis_source,p.allocation_resolution_status,p.allocation_resolution_note,
    case
      when p.prime_costing_status='BLOCKED' or oh.production_overhead_allocation_status='BLOCKED'
        or oh.quality_control_overhead_allocation_status='BLOCKED' or oh.materials_stores_overhead_allocation_status='BLOCKED' then 'BLOCKED'
      when p.prime_cost_per_sku is null or oh.production_overhead_cost_per_sku is null
        or oh.quality_control_overhead_cost_per_sku is null or oh.materials_stores_overhead_cost_per_sku is null then 'BLOCKED'
      when p.prime_costing_status='REVIEW_REQUIRED' or oh.production_overhead_allocation_status='REVIEW_REQUIRED'
        or oh.quality_control_overhead_allocation_status='REVIEW_REQUIRED' or oh.materials_stores_overhead_allocation_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when p.prime_costing_status='BLOCKED' then 'Manufacturing COP is blocked because prime cost is blocked.'
      when oh.production_overhead_allocation_status='BLOCKED' then 'Manufacturing COP is blocked because production overhead is blocked.'
      when oh.quality_control_overhead_allocation_status='BLOCKED' then 'Manufacturing COP is blocked because quality-control overhead is blocked.'
      when oh.materials_stores_overhead_allocation_status='BLOCKED' then 'Manufacturing COP is blocked because Materials / Stores overhead is blocked.'
      when p.prime_costing_status='REVIEW_REQUIRED' or oh.production_overhead_allocation_status='REVIEW_REQUIRED'
        or oh.quality_control_overhead_allocation_status='REVIEW_REQUIRED' or oh.materials_stores_overhead_allocation_status='REVIEW_REQUIRED'
        then 'Manufacturing COP is calculated, but one or more components require review.'
      else 'Manufacturing COP is ready.'
    end,
    clock_timestamp()
  from costing.sku_prime_cost_snapshot p
  join costing.sku_overhead_allocation_snapshot oh
    on oh.refresh_run_id=p.refresh_run_id and oh.sku_id=p.sku_id
  where p.refresh_run_id=p_refresh_run_id;

  return query select v_period_start,count(*)::bigint,
    count(*) filter(where manufacturing_cop_status='BLOCKED')::bigint,
    count(*) filter(where manufacturing_cop_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where manufacturing_cop_status='READY')::bigint
  from costing.sku_manufacturing_cop_snapshot where refresh_run_id=p_refresh_run_id;
end;
$$;