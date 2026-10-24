CREATE OR REPLACE FUNCTION costing.rpc_refresh_sku_prime_cost_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
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
$function$
