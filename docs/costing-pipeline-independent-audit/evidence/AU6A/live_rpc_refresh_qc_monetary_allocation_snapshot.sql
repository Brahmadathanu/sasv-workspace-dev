CREATE OR REPLACE FUNCTION costing.rpc_refresh_qc_monetary_allocation_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, product_row_count bigint, sku_row_count bigint, blocked_product_count bigint, review_required_product_count bigint, ready_product_count bigint, allocated_pool_amount numeric, pool_difference numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_pool costing.cost_pool_monthly_snapshot%rowtype;
    v_workload_count bigint;
    v_basis_product_count bigint;
    v_total_ready_workload numeric;
    v_recipient_count integer;
    v_included_count integer;
    v_excluded_count integer;
    v_coverage numeric;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % does not exist', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'QC monetary allocation context does not match refresh run %', p_refresh_run_id;
    end if;

    select * into v_pool
    from costing.cost_pool_monthly_snapshot p
    where p.refresh_run_id = p_refresh_run_id
      and p.period_start = v_period_start
      and p.valuation_date = p_valuation_date
      and p.allocation_pool = 'QUALITY_CONTROL_OVERHEAD';

    if not found then
        raise exception 'Frozen QUALITY_CONTROL_OVERHEAD pool is missing for refresh run %', p_refresh_run_id;
    end if;

    select
      count(*)::bigint,
      max(recipient_product_count),
      max(resolved_product_count),
      max(excluded_product_count),
      max(resolved_coverage_ratio),
      sum(workload_units) filter (where workload_status = 'READY')
    into
      v_workload_count,
      v_recipient_count,
      v_included_count,
      v_excluded_count,
      v_coverage,
      v_total_ready_workload
    from costing.product_qc_workload_snapshot w
    where w.refresh_run_id = p_refresh_run_id
      and w.period_start = v_period_start
      and w.valuation_date = p_valuation_date;

    if v_workload_count = 0 or v_workload_count <> v_recipient_count then
        raise exception 'Complete Product QC workload evidence is required for refresh run %', p_refresh_run_id;
    end if;

    if v_total_ready_workload is null or v_total_ready_workload <= 0 then
        raise exception 'Positive resolved Product QC workload is required for refresh run %', p_refresh_run_id;
    end if;

    select count(*)::bigint into v_basis_product_count from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id);

    if v_basis_product_count <> v_recipient_count then
        raise exception 'Canonical Product absorption basis is incomplete or inconsistent for refresh run %', p_refresh_run_id;
    end if;

    delete from costing.sku_qc_allocation_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    delete from costing.product_qc_allocation_snapshot p
    where p.refresh_run_id = p_refresh_run_id;

    insert into costing.product_qc_allocation_snapshot (
      period_start, valuation_date, refresh_run_id,
      product_workload_snapshot_id, policy_id, quality_control_pool_snapshot_id,
      product_id, product_name, product_group_id, protocol_category_id, base_spec_profile_id,
      workload_units, company_resolved_workload_units, product_workload_share,
      quality_control_pool_amount, product_qc_allocation_amount,
      product_base_uom, product_absorption_base_qty,
      absorption_basis_source, absorption_basis_method, absorption_basis_source_month,
      absorption_basis_status, absorption_basis_note,
      qc_cost_per_product_base_uom,
      allocation_status, allocation_reason_code, allocation_note,
      recipient_product_count, included_product_count, excluded_product_count, resolved_coverage_ratio,
      refreshed_at
    )
    with product_basis as (
      select d.product_id,d.product_name,d.product_base_uom,
             d.total_manufacturing_base_qty as product_absorption_base_qty,
             d.demand_source as absorption_basis_source,
             'TOTAL_MANUFACTURING_DEMAND'::text as absorption_basis_method,
             v_period_start as absorption_basis_source_month,
             d.monthly_driver_status as absorption_basis_status,
             d.demand_note as absorption_basis_note
      from costing.fn_total_manufacturing_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id) d
    )
    select
      w.period_start, w.valuation_date, w.refresh_run_id,
      w.id, w.policy_id, v_pool.id,
      w.product_id, coalesce(w.product_name, pb.product_name), w.product_group_id, w.protocol_category_id, w.base_spec_profile_id,
      w.workload_units,
      v_total_ready_workload,
      case when w.workload_status = 'READY' then w.workload_units / v_total_ready_workload else null end,
      v_pool.total_pool_amount,
      case when w.workload_status = 'READY' and v_pool.pool_status <> 'BLOCKED'
           then v_pool.total_pool_amount * (w.workload_units / v_total_ready_workload)
           else null end,
      pb.product_base_uom,
      case when w.workload_status = 'READY' then pb.product_absorption_base_qty else null end,
      pb.absorption_basis_source,
      pb.absorption_basis_method,
      pb.absorption_basis_source_month,
      pb.absorption_basis_status,
      pb.absorption_basis_note,
      case when w.workload_status = 'READY'
                 and v_pool.pool_status <> 'BLOCKED'
                 and pb.product_absorption_base_qty > 0
           then (v_pool.total_pool_amount * (w.workload_units / v_total_ready_workload)) / pb.product_absorption_base_qty
           else null end,
      case
        when w.workload_status = 'BLOCKED' then 'BLOCKED'
        when v_pool.pool_status = 'BLOCKED' then 'BLOCKED'
        when pb.absorption_basis_status = 'BLOCKED' or pb.product_absorption_base_qty is null or pb.product_absorption_base_qty <= 0 then 'BLOCKED'
        when w.workload_status = 'REVIEW_REQUIRED' or v_pool.pool_status = 'REVIEW_REQUIRED' or pb.absorption_basis_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
        else 'READY'
      end,
      case
        when w.workload_status = 'BLOCKED' then w.workload_reason_code
        when v_pool.pool_status = 'BLOCKED' then 'BLOCKED_QC_POOL'
        when pb.absorption_basis_status = 'BLOCKED' or pb.product_absorption_base_qty is null or pb.product_absorption_base_qty <= 0 then 'BLOCKED_QC_ABSORPTION_DENOMINATOR'
        when w.workload_status = 'REVIEW_REQUIRED' then w.workload_reason_code
        when v_pool.pool_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED_QC_POOL'
        when pb.absorption_basis_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED_QC_ABSORPTION_BASIS'
        else 'READY_QC_WORKLOAD_AND_ABSORPTION'
      end,
      case
        when w.workload_status = 'BLOCKED' then w.workload_note
        when v_pool.pool_status = 'BLOCKED' then v_pool.pool_note
        when pb.absorption_basis_status = 'BLOCKED' or pb.product_absorption_base_qty is null or pb.product_absorption_base_qty <= 0 then 'Positive governed Product absorption quantity is unavailable.'
        when pb.absorption_basis_status = 'REVIEW_REQUIRED' then 'QC allocation is valid; the per-base-UOM rate uses a governed assumption or default quantity and requires review.'
        else 'QC pool share is driven by effective-spec Method 3 workload; per-base-UOM absorption uses the governed monthly Product quantity.'
      end,
      v_recipient_count, v_included_count, v_excluded_count, v_coverage,
      clock_timestamp()
    from costing.product_qc_workload_snapshot w
    join product_basis pb on pb.product_id = w.product_id
    where w.refresh_run_id = p_refresh_run_id
      and w.period_start = v_period_start
      and w.valuation_date = p_valuation_date;

    insert into costing.sku_qc_allocation_snapshot (
      period_start, valuation_date, refresh_run_id,
      product_qc_allocation_snapshot_id, sales_allocation_basis_snapshot_id,
      sku_id, product_id, product_name, pack_size, pack_uom,
      product_base_uom, sku_base_qty_per_unit,
      qc_cost_per_product_base_uom, quality_control_overhead_cost_per_sku,
      allocation_status, allocation_reason_code, allocation_note,
      refreshed_at
    )
    select
      b.period_start, b.valuation_date, b.refresh_run_id,
      p.id, b.id,
      b.sku_id, b.product_id, b.product_name, b.pack_size, b.pack_uom,
      b.product_base_uom,
      case when p.allocation_status <> 'BLOCKED' then b.sku_base_qty_per_unit else null end,
      p.qc_cost_per_product_base_uom,
      case when p.allocation_status <> 'BLOCKED' and b.sku_base_qty_per_unit > 0
           then p.qc_cost_per_product_base_uom * b.sku_base_qty_per_unit
           else null end,
      case
        when p.allocation_status = 'BLOCKED' then 'BLOCKED'
        when b.sku_base_qty_per_unit is null or b.sku_base_qty_per_unit <= 0 then 'BLOCKED'
        when p.allocation_status = 'REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
        else 'READY'
      end,
      case
        when p.allocation_status = 'BLOCKED' then p.allocation_reason_code
        when b.sku_base_qty_per_unit is null or b.sku_base_qty_per_unit <= 0 then 'BLOCKED_INVALID_SKU_BASE_CONVERSION'
        when p.allocation_status = 'REVIEW_REQUIRED' then p.allocation_reason_code
        else 'READY_QC_SKU_CONVERSION'
      end,
      case
        when p.allocation_status = 'BLOCKED' then p.allocation_note
        when b.sku_base_qty_per_unit is null or b.sku_base_qty_per_unit <= 0 then 'Positive SKU base quantity per unit is required.'
        when p.allocation_status = 'REVIEW_REQUIRED' then p.allocation_note
        else 'Product QC cost per base UOM converted to the SKU using its governed base quantity per unit.'
      end,
      clock_timestamp()
    from costing.sku_sales_allocation_basis_snapshot b
    join costing.product_qc_allocation_snapshot p
      on p.refresh_run_id = b.refresh_run_id
     and p.product_id = b.product_id
    where b.refresh_run_id = p_refresh_run_id
      and b.period_start = v_period_start
      and b.valuation_date = p_valuation_date;

    return query
    select
      v_period_start,
      count(*)::bigint,
      (select count(*)::bigint from costing.sku_qc_allocation_snapshot s where s.refresh_run_id = p_refresh_run_id),
      count(*) filter (where p.allocation_status = 'BLOCKED')::bigint,
      count(*) filter (where p.allocation_status = 'REVIEW_REQUIRED')::bigint,
      count(*) filter (where p.allocation_status = 'READY')::bigint,
      coalesce(sum(p.product_qc_allocation_amount),0),
      v_pool.total_pool_amount - coalesce(sum(p.product_qc_allocation_amount),0)
    from costing.product_qc_allocation_snapshot p
    where p.refresh_run_id = p_refresh_run_id;
end;
$function$
