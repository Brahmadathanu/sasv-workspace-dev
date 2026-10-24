-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_preview_shared_standard_batch_route_foundation(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_route_family_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public, pg_temp
as $function$
declare
    v_period_start date;
    v_run costing.costing_refresh_run%rowtype;
    v_result jsonb;
begin
    if p_period_start is null
       or p_valuation_date is null
       or p_refresh_run_id is null
    then
        raise exception
            'period_start, valuation_date and refresh_run_id are required';
    end if;

    v_period_start := date_trunc('month', p_period_start)::date;

    select *
    into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % not found', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST'
    then
        raise exception
            'Shared standard batch-route preview context does not match refresh run %',
            p_refresh_run_id;
    end if;

    with recipients as (
        select
            b.product_id,
            max(b.product_name) as product_name,
            max(b.product_base_uom) as product_base_uom,
            max(b.monthly_product_allocation_base_qty) as monthly_product_base_qty,
            max(b.monthly_driver_status) as monthly_driver_status,
            count(*)::integer as recipient_sku_count,
            count(*) filter (
                where b.monthly_driver_source = 'ACTUAL_MONTHLY_SALES'
            )::integer as actual_source_sku_count,
            count(*) filter (
                where b.assumption_id is not null
            )::integer as assumption_source_sku_count,
            count(*) filter (
                where b.default_policy_id is not null
            )::integer as default_source_sku_count,
            jsonb_agg(
                jsonb_build_object(
                    'sku_id', b.sku_id,
                    'monthly_allocation_base_qty', b.monthly_allocation_base_qty,
                    'monthly_driver_method', b.monthly_driver_method,
                    'monthly_driver_source', b.monthly_driver_source,
                    'monthly_driver_source_month', b.monthly_driver_source_month,
                    'monthly_driver_status', b.monthly_driver_status,
                    'assumption_id', b.assumption_id,
                    'assumption_basis', b.assumption_basis,
                    'default_policy_id', b.default_policy_id,
                    'default_policy_scenario', b.default_policy_scenario
                )
                order by b.sku_id
            ) as sku_quantity_evidence
        from costing.sku_sales_allocation_basis_snapshot b
        where b.period_start = v_period_start
          and b.valuation_date = p_valuation_date
          and b.refresh_run_id = p_refresh_run_id
        group by b.product_id
    ),
    batch_ref as (
        select distinct on (b.product_id)
            b.product_id,
            b.id as batch_size_ref_id,
            b.preferred_batch_size,
            b.min_batch_size,
            b.max_batch_size,
            b.effective_from
        from public.production_batch_size_ref b
        where b.is_active = true
          and b.effective_from <= p_valuation_date
        order by b.product_id, b.effective_from desc, b.id desc
    ),
    route_context as (
        select
            r.product_id,
            costing.fn_resolve_route_family_for_product(
                r.product_id::integer,
                p_valuation_date
            ) as route_family_id,
            costing.fn_resolve_effective_route_family_route(
                r.product_id::integer,
                p_valuation_date
            ) as family_route_id,
            costing.fn_resolve_effective_product_process_route(
                r.product_id::integer,
                p_valuation_date
            ) as product_route_id,
            costing.fn_validate_effective_product_process_route(
                r.product_id::integer,
                p_valuation_date
            ) as route_validation
        from recipients r
    ),
    step_context as (
        select
            r.product_id,
            count(e.effective_step_key)::integer as effective_step_count,
            count(e.effective_step_key) filter (
                where e.direct_labour_scope = 'INCLUDE'
            )::integer as direct_labour_include_step_count,
            count(e.effective_step_key) filter (
                where e.direct_labour_scope = 'SUPERVISION'
            )::integer as direct_labour_supervision_step_count,
            count(e.effective_step_key) filter (
                where e.direct_labour_scope = 'EXCLUDE_OTHER_POOL'
            )::integer as direct_labour_excluded_step_count,
            count(e.effective_step_key) filter (
                where e.production_overhead_scope = 'INCLUDE'
            )::integer as production_overhead_include_step_count,
            count(e.effective_step_key) filter (
                where e.production_overhead_scope = 'PASSIVE'
            )::integer as production_overhead_passive_step_count,
            count(e.effective_step_key) filter (
                where e.production_overhead_scope = 'EXCLUDE_OTHER_POOL'
            )::integer as production_overhead_excluded_step_count,
            jsonb_agg(
                jsonb_build_object(
                    'effective_step_key', e.effective_step_key,
                    'sequence_no', e.sequence_no,
                    'activity_id', e.activity_id,
                    'cost_centre_id', e.cost_centre_id,
                    'behaviour_code', e.behaviour_code,
                    'resource_class_code', e.resource_class_code,
                    'expected_occurrence_count', e.expected_occurrence_count,
                    'standard_cycle_count', e.standard_cycle_count,
                    'direct_labour_scope', e.direct_labour_scope,
                    'production_overhead_scope', e.production_overhead_scope,
                    'source_type', e.source_type,
                    'base_step_id', e.base_step_id,
                    'override_id', e.override_id
                )
                order by e.sequence_no, e.effective_step_key
            ) filter (where e.effective_step_key is not null) as step_evidence
        from recipients r
        left join lateral costing.fn_effective_product_process_steps(
            r.product_id::integer,
            p_valuation_date
        ) e on true
        group by r.product_id
    ),
    rows as (
        select
            r.product_id,
            r.product_name,
            r.product_base_uom,
            r.recipient_sku_count,
            r.monthly_product_base_qty,
            r.monthly_driver_status,
            r.actual_source_sku_count,
            r.assumption_source_sku_count,
            r.default_source_sku_count,
            r.sku_quantity_evidence,
            b.batch_size_ref_id,
            b.preferred_batch_size,
            b.min_batch_size,
            b.max_batch_size,
            b.effective_from as batch_size_effective_from,
            case
                when b.preferred_batch_size > 0
                 and r.monthly_product_base_qty > 0
                then r.monthly_product_base_qty / b.preferred_batch_size
            end as raw_batch_requirement,
            case
                when b.preferred_batch_size > 0
                 and r.monthly_product_base_qty > 0
                then ceil(r.monthly_product_base_qty / b.preferred_batch_size)::bigint
            end as standard_batch_count,
            rc.route_family_id,
            rc.family_route_id,
            rc.product_route_id,
            rc.route_validation ->> 'route_source' as effective_route_source,
            rc.route_validation,
            coalesce(s.effective_step_count, 0) as effective_step_count,
            coalesce(s.direct_labour_include_step_count, 0) as direct_labour_include_step_count,
            coalesce(s.direct_labour_supervision_step_count, 0) as direct_labour_supervision_step_count,
            coalesce(s.direct_labour_excluded_step_count, 0) as direct_labour_excluded_step_count,
            coalesce(s.production_overhead_include_step_count, 0) as production_overhead_include_step_count,
            coalesce(s.production_overhead_passive_step_count, 0) as production_overhead_passive_step_count,
            coalesce(s.production_overhead_excluded_step_count, 0) as production_overhead_excluded_step_count,
            coalesce(s.step_evidence, '[]'::jsonb) as step_evidence,
            case
                when r.monthly_product_base_qty is null
                  or r.monthly_product_base_qty <= 0
                    then 'BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY'
                when r.monthly_driver_status = 'BLOCKED'
                    then 'BLOCKED_MONTHLY_QUANTITY_DRIVER'
                when b.batch_size_ref_id is null
                  or b.preferred_batch_size is null
                  or b.preferred_batch_size <= 0
                    then 'BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE'
                when coalesce((rc.route_validation ->> 'valid')::boolean, false) = false
                    then 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
                when coalesce(s.effective_step_count, 0) = 0
                    then 'BLOCKED_NO_EFFECTIVE_ROUTE_STEPS'
                when r.monthly_driver_status = 'REVIEW_REQUIRED'
                    then 'REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER'
                else 'READY'
            end as foundation_status,
            case
                when r.monthly_product_base_qty is null
                  or r.monthly_product_base_qty <= 0
                    then 'A positive governed monthly Product quantity is required. Existing SKUs normally use sales evidence; missing or new SKUs require an approved assumption.'
                when r.monthly_driver_status = 'BLOCKED'
                    then 'The exact-run monthly quantity driver is blocked.'
                when b.batch_size_ref_id is null
                  or b.preferred_batch_size is null
                  or b.preferred_batch_size <= 0
                    then 'An effective positive preferred batch size is mandatory.'
                when coalesce((rc.route_validation ->> 'valid')::boolean, false) = false
                    then 'A valid effective Product manufacturing route is mandatory.'
                when coalesce(s.effective_step_count, 0) = 0
                    then 'The effective route contains no usable steps.'
                when r.monthly_driver_status = 'REVIEW_REQUIRED'
                    then 'The foundation is calculable but its monthly quantity source requires review.'
                else 'Shared standard batch-and-route foundation is ready for separate Direct Labour and Production Overhead factor lenses.'
            end as foundation_note
        from recipients r
        left join batch_ref b on b.product_id = r.product_id
        left join route_context rc on rc.product_id = r.product_id
        left join step_context s on s.product_id = r.product_id
        where p_route_family_id is null
           or rc.route_family_id = p_route_family_id
    )
    select jsonb_build_object(
        'preview_only', true,
        'records_created', 0,
        'monetary_allocation_created', false,
        'stage03_cutover_status', 'NOT_AUTHORISED_BY_THIS_GATE',
        'period_start', v_period_start,
        'valuation_date', p_valuation_date,
        'refresh_run_id', p_refresh_run_id,
        'route_family_id', p_route_family_id,
        'readiness_rule', jsonb_build_object(
            'existing_sku', 'Governed monthly quantity and effective preferred batch size are mandatory; sales is normal, approved assumption is allowed when sales is missing or unsuitable.',
            'new_sku_or_product', 'Approved manual quantity assumption, effective preferred batch size and effective route are mandatory.',
            'bmr_dependency', false,
            'forecast_dependency', false,
            'daily_work_log_dependency', false
        ),
        'summary', jsonb_build_object(
            'recipient_product_count', count(*),
            'ready_count', count(*) filter (where foundation_status = 'READY'),
            'review_required_count', count(*) filter (where foundation_status like 'REVIEW_REQUIRED%'),
            'blocked_count', count(*) filter (where foundation_status like 'BLOCKED%'),
            'products_using_actual_sales_only', count(*) filter (
                where actual_source_sku_count > 0
                  and assumption_source_sku_count = 0
                  and default_source_sku_count = 0
            ),
            'products_using_assumption', count(*) filter (
                where assumption_source_sku_count > 0
            ),
            'products_using_default_policy', count(*) filter (
                where default_source_sku_count > 0
            ),
            'total_standard_batch_count', sum(standard_batch_count) filter (
                where foundation_status in ('READY', 'REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER')
            )
        ),
        'status_counts', coalesce(
            (
                select jsonb_object_agg(foundation_status, cnt)
                from (
                    select foundation_status, count(*) as cnt
                    from rows
                    group by foundation_status
                ) x
            ),
            '{}'::jsonb
        ),
        'rows', coalesce(
            jsonb_agg(to_jsonb(rows) order by product_name, product_id),
            '[]'::jsonb
        )
    )
    into v_result
    from rows;

    return v_result;
end;
$function$;

revoke all on function costing.fn_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) from public;
revoke all on function costing.fn_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) from anon;
revoke all on function costing.fn_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) from authenticated;
grant execute on function costing.fn_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) to service_role;
grant execute on function costing.fn_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) to postgres;

create or replace function public.rpc_preview_shared_standard_batch_route_foundation(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_route_family_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
begin
    perform public.require_permission(
        'module:production-route-manager',
        false
    );

    return costing.fn_preview_shared_standard_batch_route_foundation(
        p_period_start,
        p_valuation_date,
        p_refresh_run_id,
        p_route_family_id
    );
end;
$function$;

revoke all on function public.rpc_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) from public;
revoke all on function public.rpc_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) from anon;
grant execute on function public.rpc_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) to authenticated;
grant execute on function public.rpc_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) to service_role;
grant execute on function public.rpc_preview_shared_standard_batch_route_foundation(date, date, bigint, bigint) to postgres;