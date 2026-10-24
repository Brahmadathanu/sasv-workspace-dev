-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint)
  rename to rpc_get_route_workload_management_explain_core;

create or replace function public.rpc_get_route_workload_management_explain(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint,
  p_product_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_base jsonb;
  v_component jsonb;
  v_component_active boolean;
  v_model_code text;
  v_mfg_pool numeric;
  v_pack_pool numeric;
  v_total_pool numeric;
  v_mfg_product_allocation numeric;
  v_pack_product_allocation numeric;
  v_combined_product_allocation numeric;
  v_expected_package_units numeric;
  v_company_expected_package_units numeric;
  v_mfg_component_snapshot_id bigint;
  v_pack_component_snapshot_id bigint;
begin
  perform public.require_permission('module:production-route-manager', false);

  v_base := public.rpc_get_route_workload_management_explain_core(
    p_period_start,p_valuation_date,p_refresh_run_id,p_product_id
  );

  select exists(
    select 1
    from costing.sku_direct_labour_allocation_snapshot s
    where s.refresh_run_id=p_refresh_run_id
      and s.product_id=p_product_id
      and s.direct_labour_component_model_code is not null
  ) into v_component_active;

  if not v_component_active then
    v_component := jsonb_build_object(
      'component_model_active',false,
      'model_code','LEGACY_UNIFIED_ROUTE_ATTENDANCE',
      'historical_exact_run',true,
      'management_note','This exact run predates the Manufacturing Labour + Packing Labour component model. The frozen Direct Labour evidence remains the historical unified route-attendance allocation and is not rewritten.'
    );
  else
    select max(s.direct_labour_component_model_code),
           max(s.direct_labour_pool_amount),
           max(s.manufacturing_direct_labour_pool_amount),
           max(s.packing_labour_pool_amount),
           max(s.product_direct_labour_allocation)
      into v_model_code,v_total_pool,v_mfg_pool,v_pack_pool,v_combined_product_allocation
    from costing.sku_direct_labour_allocation_snapshot s
    where s.refresh_run_id=p_refresh_run_id
      and s.product_id=p_product_id;

    select pw.product_direct_labour_allocation,
           pw.manufacturing_labour_component_pool_snapshot_id
      into v_mfg_product_allocation,v_mfg_component_snapshot_id
    from costing.product_direct_labour_workload_snapshot pw
    where pw.refresh_run_id=p_refresh_run_id
      and pw.product_id=p_product_id
    order by pw.id desc
    limit 1;

    select coalesce(sum(pk.packing_labour_allocation),0),
           coalesce(sum(pk.expected_package_units),0),
           max(pk.company_expected_package_units),
           max(pk.packing_labour_component_pool_snapshot_id)
      into v_pack_product_allocation,v_expected_package_units,
           v_company_expected_package_units,v_pack_component_snapshot_id
    from costing.sku_packing_labour_workload_snapshot pk
    where pk.refresh_run_id=p_refresh_run_id
      and pk.product_id=p_product_id;

    v_component := jsonb_build_object(
      'component_model_active',true,
      'model_code',v_model_code,
      'historical_exact_run',true,
      'combined_direct_labour_pool',v_total_pool,
      'manufacturing_labour',jsonb_build_object(
        'pool_amount',v_mfg_pool,
        'component_pool_snapshot_id',v_mfg_component_snapshot_id,
        'driver','ROUNDED_STANDARD_BATCHES × ROUTE_ATTENDANCE_INTENSITY',
        'product_allocation',v_mfg_product_allocation,
        'workload',(v_base#>'{direct_labour,workload}'),
        'steps',(v_base#>'{direct_labour,steps}'),
        'reconciliation',(v_base#>'{direct_labour,reconciliation}')
      ),
      'packing_labour',jsonb_build_object(
        'pool_amount',v_pack_pool,
        'component_pool_snapshot_id',v_pack_component_snapshot_id,
        'driver','FROZEN_MONTHLY_ALLOCATION_UNITS',
        'product_expected_package_units',v_expected_package_units,
        'company_expected_package_units',v_company_expected_package_units,
        'product_allocation',v_pack_product_allocation,
        'skus',coalesce((
          select jsonb_agg(jsonb_build_object(
            'sku_id',pk.sku_id,
            'pack_size',pk.pack_size,
            'pack_uom',pk.pack_uom,
            'expected_package_units',pk.expected_package_units,
            'package_workload_share',pk.package_workload_share,
            'allocation_status',pk.workload_status,
            'allocation_reason_code',pk.workload_reason_code,
            'packing_labour_allocation',pk.packing_labour_allocation,
            'packing_labour_cost_per_sku_unit',pk.packing_labour_cost_per_sku_unit,
            'source_method',pk.source_method
          ) order by pk.sku_id)
          from costing.sku_packing_labour_workload_snapshot pk
          where pk.refresh_run_id=p_refresh_run_id and pk.product_id=p_product_id
        ),'[]'::jsonb)
      ),
      'combined',jsonb_build_object(
        'product_allocation',v_combined_product_allocation,
        'expected_product_allocation',coalesce(v_mfg_product_allocation,0)+coalesce(v_pack_product_allocation,0),
        'product_allocation_delta',coalesce(v_combined_product_allocation,0)-(coalesce(v_mfg_product_allocation,0)+coalesce(v_pack_product_allocation,0)),
        'pool_component_sum',coalesce(v_mfg_pool,0)+coalesce(v_pack_pool,0),
        'pool_reconciliation_delta',coalesce(v_total_pool,0)-(coalesce(v_mfg_pool,0)+coalesce(v_pack_pool,0)),
        'skus',coalesce((
          select jsonb_agg(jsonb_build_object(
            'sku_id',s.sku_id,
            'pack_size',s.pack_size,
            'pack_uom',s.pack_uom,
            'allocation_status',s.direct_labour_allocation_status,
            'allocation_reason_code',s.allocation_reason_code,
            'manufacturing_labour_allocation',s.manufacturing_direct_labour_allocation,
            'packing_labour_allocation',s.packing_labour_allocation,
            'manufacturing_labour_cost_per_sku',s.manufacturing_direct_labour_cost_per_sku,
            'packing_labour_cost_per_sku',s.packing_labour_cost_per_sku,
            'combined_direct_labour_cost_per_sku',s.direct_labour_cost_per_sku
          ) order by s.sku_id)
          from costing.sku_direct_labour_allocation_snapshot s
          where s.refresh_run_id=p_refresh_run_id and s.product_id=p_product_id
        ),'[]'::jsonb)
      ),
      'management_note','Direct Labour is the sum of two frozen exact-run components: Manufacturing Labour allocated by route-attendance workload and Packing Labour allocated by frozen expected package units. The normal Cost Sheet may continue to present one combined Direct Labour line.'
    );
  end if;

  return jsonb_set(
    v_base,
    '{direct_labour,component_model}',
    v_component,
    true
  );
end;
$function$;

revoke all on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) from public, anon;
grant execute on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) to authenticated, service_role;
revoke all on function public.rpc_get_route_workload_management_explain_core(date,date,bigint,bigint) from public, anon;
grant execute on function public.rpc_get_route_workload_management_explain_core(date,date,bigint,bigint) to authenticated, service_role;