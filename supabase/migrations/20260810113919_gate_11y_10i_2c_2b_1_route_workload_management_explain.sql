-- backfilled from live schema_migrations on 2026-10-24, CI-016
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
set search_path = public, costing, pg_temp
as $function$
declare
    v_period_start date;
    v_run costing.costing_refresh_run%rowtype;
    v_product_name text;
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager', false);

    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null or p_product_id is null then
        raise exception 'period_start, valuation_date, refresh_run_id and product_id are required';
    end if;

    v_period_start := date_trunc('month', p_period_start)::date;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % not found', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Explain context does not match refresh run %', p_refresh_run_id;
    end if;

    select coalesce(max(d.product_name), max(p.product_name))
      into v_product_name
    from costing.product_direct_labour_workload_snapshot d
    full join costing.product_production_overhead_workload_snapshot p
      on p.period_start=d.period_start
     and p.valuation_date=d.valuation_date
     and p.refresh_run_id=d.refresh_run_id
     and p.product_id=d.product_id
    where coalesce(d.period_start,p.period_start)=v_period_start
      and coalesce(d.valuation_date,p.valuation_date)=p_valuation_date
      and coalesce(d.refresh_run_id,p.refresh_run_id)=p_refresh_run_id
      and coalesce(d.product_id,p.product_id)=p_product_id;

    if v_product_name is null then
        raise exception 'Product % has no frozen DL/POH workload evidence in refresh run %', p_product_id, p_refresh_run_id;
    end if;

    with
    dlw as materialized (
        select *
        from costing.product_direct_labour_workload_snapshot
        where period_start=v_period_start
          and valuation_date=p_valuation_date
          and refresh_run_id=p_refresh_run_id
          and product_id=p_product_id
        order by id desc
        limit 1
    ),
    pohw as materialized (
        select *
        from costing.product_production_overhead_workload_snapshot
        where period_start=v_period_start
          and valuation_date=p_valuation_date
          and refresh_run_id=p_refresh_run_id
          and product_id=p_product_id
        order by id desc
        limit 1
    ),
    dl_steps as materialized (
        select
            s.*,
            a.activity_name,
            cc.cost_centre_code,
            cc.cost_centre_name,
            cc.pool_scope as cost_centre_pool_scope,
            sf.note as scope_factor_note,
            bf.note as attendance_factor_note
        from costing.product_direct_labour_step_snapshot s
        left join public.activities a on a.id=s.activity_id
        left join costing.production_cost_centre cc on cc.id=s.cost_centre_id
        left join costing.direct_labour_scope_factor sf
          on sf.policy_id=s.policy_id and sf.scope_code=s.direct_labour_scope
        left join costing.direct_labour_behaviour_factor bf
          on bf.policy_id=s.policy_id and bf.behaviour_code=s.behaviour_code
        where s.period_start=v_period_start
          and s.valuation_date=p_valuation_date
          and s.refresh_run_id=p_refresh_run_id
          and s.product_id=p_product_id
    ),
    poh_steps as materialized (
        select
            s.*,
            d.activity_id,
            d.activity_name,
            d.cost_centre_id,
            d.cost_centre_code,
            d.cost_centre_name,
            d.cost_centre_pool_scope,
            sf.note as scope_factor_note,
            bf.note as behaviour_factor_note,
            rf.note as resource_factor_note
        from costing.product_production_overhead_step_snapshot s
        left join dl_steps d
          on d.effective_step_key=s.effective_step_key
         and d.sequence_no::numeric=s.sequence_no::numeric
        left join costing.production_overhead_scope_factor sf
          on sf.policy_id=s.policy_id and sf.scope_code=s.production_overhead_scope
        left join costing.production_overhead_behaviour_factor bf
          on bf.policy_id=s.policy_id and bf.behaviour_code=s.behaviour_code
        left join costing.production_overhead_resource_factor rf
          on rf.policy_id=s.policy_id and rf.resource_class_code=s.resource_class_code
        where s.period_start=v_period_start
          and s.valuation_date=p_valuation_date
          and s.refresh_run_id=p_refresh_run_id
          and s.product_id=p_product_id
    ),
    dl_skus as materialized (
        select *
        from costing.sku_direct_labour_allocation_snapshot
        where period_start=v_period_start
          and valuation_date=p_valuation_date
          and refresh_run_id=p_refresh_run_id
          and product_id=p_product_id
        order by sku_id
    ),
    poh_skus as materialized (
        select *
        from costing.sku_production_overhead_allocation_snapshot
        where period_start=v_period_start
          and valuation_date=p_valuation_date
          and refresh_run_id=p_refresh_run_id
          and product_id=p_product_id
        order by sku_id
    ),
    dl_policy as materialized (
        select p.*
        from costing.direct_labour_workload_policy p
        join dlw w on w.policy_id=p.id
    ),
    poh_policy as materialized (
        select p.*
        from costing.production_overhead_workload_policy p
        join pohw w on w.policy_id=p.id
    ),
    dl_recon as (
        select jsonb_build_object(
            'step_factor_sum', coalesce((select sum(step_labour_factor) from dl_steps),0),
            'route_intensity', (select direct_labour_route_intensity from dlw),
            'route_intensity_delta', coalesce((select sum(step_labour_factor) from dl_steps),0)-coalesce((select direct_labour_route_intensity from dlw),0),
            'expected_workload_units', coalesce((select direct_labour_route_intensity from dlw),0)*coalesce((select standard_batch_count from dlw),0),
            'stored_workload_units', (select direct_labour_workload_units from dlw),
            'workload_units_delta', coalesce((select direct_labour_route_intensity from dlw),0)*coalesce((select standard_batch_count from dlw),0)-coalesce((select direct_labour_workload_units from dlw),0),
            'expected_workload_share', case when coalesce((select company_eligible_workload_units from dlw),0)>0 then (select direct_labour_workload_units from dlw)/(select company_eligible_workload_units from dlw) end,
            'stored_workload_share', (select product_workload_share from dlw),
            'expected_product_allocation', case when coalesce((select company_eligible_workload_units from dlw),0)>0 then ((select direct_labour_workload_units from dlw)/(select company_eligible_workload_units from dlw))*(select direct_labour_pool_amount from dlw) end,
            'stored_product_allocation', (select product_direct_labour_allocation from dlw)
        ) as j
    ),
    poh_recon as (
        select jsonb_build_object(
            'step_factor_sum', coalesce((select sum(step_factor) from poh_steps),0),
            'route_factor', (select route_factor from pohw),
            'route_factor_delta', coalesce((select sum(step_factor) from poh_steps),0)-coalesce((select route_factor from pohw),0),
            'expected_workload_units', coalesce((select route_factor from pohw),0)*coalesce((select rounded_batch_count from pohw),0),
            'stored_workload_units', (select workload_units from pohw),
            'workload_units_delta', coalesce((select route_factor from pohw),0)*coalesce((select rounded_batch_count from pohw),0)-coalesce((select workload_units from pohw),0),
            'expected_workload_share', case when coalesce((select company_ready_workload_units from pohw),0)>0 then (select workload_units from pohw)/(select company_ready_workload_units from pohw) end,
            'stored_workload_share', (select max(product_workload_share) from poh_skus),
            'pool_amount', (select max(production_overhead_pool_amount) from poh_skus),
            'expected_product_allocation', case when coalesce((select company_ready_workload_units from pohw),0)>0 then ((select workload_units from pohw)/(select company_ready_workload_units from pohw))*(select max(production_overhead_pool_amount) from poh_skus) end,
            'stored_product_allocation', (select max(product_production_overhead_allocation) from poh_skus)
        ) as j
    )
    select jsonb_build_object(
        'read_only', true,
        'frozen_exact_run', true,
        'records_created', 0,
        'monetary_allocation_created', false,
        'context', jsonb_build_object(
            'period_start', v_period_start,
            'valuation_date', p_valuation_date,
            'refresh_run_id', p_refresh_run_id,
            'valuation_context_source', v_run.valuation_context_source,
            'run_status', v_run.overall_status,
            'product_id', p_product_id,
            'product_name', v_product_name
        ),
        'direct_labour', case when exists(select 1 from dlw) then jsonb_build_object(
            'policy', (select jsonb_build_object(
                'policy_id',id,
                'policy_code',policy_code,
                'policy_version',policy_version,
                'formula_type',formula_type,
                'status',status,
                'effective_from',effective_from,
                'effective_to',effective_to,
                'approval_reference',approval_reference,
                'policy_note',policy_note
            ) from dl_policy),
            'workload', (select jsonb_build_object(
                'workload_status',workload_status,
                'workload_reason_code',workload_reason_code,
                'workload_note',workload_note,
                'route_family_id',route_family_id,
                'family_route_id',family_route_id,
                'product_route_id',product_route_id,
                'effective_route_source',effective_route_source,
                'monthly_product_base_qty',monthly_product_base_qty,
                'monthly_driver_status',monthly_driver_status,
                'standard_batch_count',standard_batch_count,
                'route_intensity',direct_labour_route_intensity,
                'product_workload_units',direct_labour_workload_units,
                'recipient_product_count',recipient_product_count,
                'eligible_product_count',eligible_product_count,
                'blocked_product_count',blocked_product_count,
                'eligible_coverage_ratio',eligible_coverage_ratio,
                'company_eligible_workload_units',company_eligible_workload_units,
                'product_workload_share',product_workload_share,
                'pool_amount',direct_labour_pool_amount,
                'product_allocation',product_direct_labour_allocation,
                'pool_snapshot_id',direct_labour_pool_snapshot_id
            ) from dlw),
            'steps', coalesce((select jsonb_agg(jsonb_build_object(
                'sequence_no',sequence_no,
                'effective_step_key',effective_step_key,
                'source_type',source_type,
                'activity_id',activity_id,
                'activity_name',activity_name,
                'cost_centre_id',cost_centre_id,
                'cost_centre_code',cost_centre_code,
                'cost_centre_name',cost_centre_name,
                'cost_centre_pool_scope',cost_centre_pool_scope,
                'direct_labour_scope',direct_labour_scope,
                'scope_factor',scope_factor,
                'scope_factor_note',scope_factor_note,
                'behaviour_code',behaviour_code,
                'attendance_factor',attendance_factor,
                'attendance_factor_note',attendance_factor_note,
                'resource_class_code',resource_class_code,
                'expected_occurrence_count',expected_occurrence_count,
                'standard_cycle_count',standard_cycle_count,
                'step_factor',step_labour_factor
            ) order by sequence_no,effective_step_key) from dl_steps),'[]'::jsonb),
            'skus', coalesce((select jsonb_agg(jsonb_build_object(
                'sku_id',sku_id,
                'pack_size',pack_size,
                'pack_uom',pack_uom,
                'sku_base_qty_per_unit',sku_base_qty_per_unit,
                'sku_within_product_share',sku_within_product_share,
                'allocation_status',direct_labour_allocation_status,
                'allocation_reason_code',allocation_reason_code,
                'product_allocation',product_direct_labour_allocation,
                'cost_per_base_uom',direct_labour_cost_per_base_uom,
                'cost_per_sku_unit',direct_labour_cost_per_sku,
                'resolved_sales_units',resolved_sales_units,
                'resolved_sales_base_qty',resolved_sales_base_qty
            ) order by sku_id) from dl_skus),'[]'::jsonb),
            'reconciliation', (select j from dl_recon)
        ) else null end,
        'production_overhead', case when exists(select 1 from pohw) then jsonb_build_object(
            'policy', (select jsonb_build_object(
                'policy_id',id,
                'policy_code',policy_code,
                'policy_version',policy_version,
                'formula_type',formula_type,
                'status',status,
                'effective_from',effective_from,
                'effective_to',effective_to,
                'approval_reference',approval_reference,
                'policy_note',policy_note,
                'behaviour_multipliers_currently_neutral', not exists(select 1 from costing.production_overhead_behaviour_factor f where f.policy_id=id and f.factor<>1),
                'resource_multipliers_currently_neutral', not exists(select 1 from costing.production_overhead_resource_factor f where f.policy_id=id and f.factor<>1)
            ) from poh_policy),
            'workload', (select jsonb_build_object(
                'workload_status',workload_status,
                'workload_reason_code',workload_reason_code,
                'workload_note',workload_note,
                'route_family_id',route_family_id,
                'family_route_id',family_route_id,
                'product_route_id',product_route_id,
                'effective_route_source',effective_route_source,
                'preferred_batch_size',preferred_batch_size,
                'monthly_product_base_qty',monthly_product_base_qty,
                'monthly_driver_status',monthly_driver_status,
                'monthly_batch_equivalents',monthly_batch_equivalents,
                'rounded_batch_count',rounded_batch_count,
                'route_factor',route_factor,
                'product_workload_units',workload_units,
                'recipient_product_count',recipient_product_count,
                'ready_product_count',ready_product_count,
                'blocked_product_count',blocked_product_count,
                'workload_coverage_ratio',workload_coverage_ratio,
                'company_ready_workload_units',company_ready_workload_units,
                'product_workload_share',(select max(product_workload_share) from poh_skus),
                'pool_amount',(select max(production_overhead_pool_amount) from poh_skus),
                'product_allocation',(select max(product_production_overhead_allocation) from poh_skus),
                'pool_snapshot_id',pool_snapshot_id
            ) from pohw),
            'steps', coalesce((select jsonb_agg(jsonb_build_object(
                'sequence_no',sequence_no,
                'effective_step_key',effective_step_key,
                'source_type',source_type,
                'activity_id',activity_id,
                'activity_name',activity_name,
                'cost_centre_id',cost_centre_id,
                'cost_centre_code',cost_centre_code,
                'cost_centre_name',cost_centre_name,
                'cost_centre_pool_scope',cost_centre_pool_scope,
                'production_overhead_scope',production_overhead_scope,
                'scope_factor',scope_factor,
                'scope_factor_note',scope_factor_note,
                'behaviour_code',behaviour_code,
                'behaviour_factor',behaviour_factor,
                'behaviour_factor_note',behaviour_factor_note,
                'resource_class_code',resource_class_code,
                'resource_factor',resource_factor,
                'resource_factor_note',resource_factor_note,
                'expected_occurrence_count',expected_occurrence_count,
                'standard_cycle_count',standard_cycle_count,
                'step_factor',step_factor
            ) order by sequence_no,effective_step_key) from poh_steps),'[]'::jsonb),
            'skus', coalesce((select jsonb_agg(jsonb_build_object(
                'sku_id',sku_id,
                'pack_size',pack_size,
                'pack_uom',pack_uom,
                'sku_base_qty_per_unit',sku_base_qty_per_unit,
                'monthly_sku_base_qty',monthly_sku_base_qty,
                'sku_within_product_share',sku_within_product_share,
                'allocation_status',allocation_status,
                'allocation_reason_code',allocation_reason_code,
                'product_allocation',product_production_overhead_allocation,
                'cost_per_base_uom',production_overhead_cost_per_base_uom,
                'cost_per_sku_unit',production_overhead_cost_per_sku
            ) order by sku_id) from poh_skus),'[]'::jsonb),
            'reconciliation', (select j from poh_recon)
        ) else null end,
        'management_note', 'Frozen exact-run evidence. Route classifications are authoring inputs; factor values and monetary outputs shown here are the factors captured by this refresh run. Current route edits do not rewrite historical explain evidence.'
    ) into v_result;

    return v_result;
end;
$function$;

revoke all on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) from public;
revoke all on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) from anon;
grant execute on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) to authenticated;
grant execute on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) to service_role;
grant execute on function public.rpc_get_route_workload_management_explain(date,date,bigint,bigint) to postgres;