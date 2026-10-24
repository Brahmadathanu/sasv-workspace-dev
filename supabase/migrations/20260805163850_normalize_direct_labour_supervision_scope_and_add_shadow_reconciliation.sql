-- backfilled from live schema_migrations on 2026-10-24, CI-016
update costing.direct_labour_scope_factor
set factor = 1.00,
    note = 'Included in Direct Labour; the route behaviour attendance factor alone determines the reduced supervisory or monitoring intensity.'
where policy_id = 1
  and scope_code = 'SUPERVISION';

create or replace function costing.fn_preview_direct_labour_shadow_monetary_reconciliation(
    p_policy_id bigint,
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_reference_pool_amount numeric,
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
    v_workload jsonb;
    v_result jsonb;
begin
    if p_policy_id is null
       or p_period_start is null
       or p_valuation_date is null
       or p_refresh_run_id is null
       or p_reference_pool_amount is null
    then
        raise exception 'policy_id, period_start, valuation_date, refresh_run_id and reference_pool_amount are required';
    end if;

    if p_reference_pool_amount < 0 then
        raise exception 'reference_pool_amount cannot be negative';
    end if;

    v_period_start := date_trunc('month', p_period_start)::date;

    v_workload := costing.fn_preview_direct_labour_shadow_workload(
        p_policy_id,
        v_period_start,
        p_valuation_date,
        p_refresh_run_id,
        p_route_family_id
    );

    with product_rows as (
        select x.*
        from jsonb_to_recordset(v_workload -> 'rows') as x(
            product_id bigint,
            product_name text,
            product_base_uom text,
            recipient_sku_count integer,
            monthly_product_base_qty numeric,
            monthly_driver_status text,
            standard_batch_count bigint,
            route_family_id bigint,
            family_route_id bigint,
            product_route_id bigint,
            effective_route_source text,
            foundation_status text,
            workload_status text,
            direct_labour_route_intensity numeric,
            direct_labour_workload_units numeric,
            sku_quantity_evidence jsonb
        )
    ),
    eligible_products as (
        select *
        from product_rows
        where workload_status in ('READY', 'REVIEW_REQUIRED_FOUNDATION')
          and direct_labour_workload_units > 0
    ),
    company as (
        select
            count(*)::bigint as eligible_product_count,
            sum(direct_labour_workload_units) as eligible_company_workload_units
        from eligible_products
    ),
    product_allocations as (
        select
            p.*,
            c.eligible_product_count,
            c.eligible_company_workload_units,
            p.direct_labour_workload_units
                / nullif(c.eligible_company_workload_units, 0) as product_workload_share,
            p_reference_pool_amount
                * p.direct_labour_workload_units
                / nullif(c.eligible_company_workload_units, 0) as shadow_product_allocation
        from eligible_products p
        cross join company c
    ),
    sku_basis as (
        select
            b.id as allocation_basis_snapshot_id,
            b.sku_id,
            b.product_id,
            b.product_name,
            b.pack_size,
            b.pack_uom,
            b.sku_base_qty_per_unit,
            b.monthly_allocation_base_qty,
            b.monthly_product_allocation_base_qty,
            b.monthly_driver_status,
            b.monthly_driver_source,
            b.assumption_id,
            b.default_policy_id
        from costing.sku_sales_allocation_basis_snapshot b
        where b.period_start = v_period_start
          and b.valuation_date = p_valuation_date
          and b.refresh_run_id = p_refresh_run_id
    ),
    sku_allocations as (
        select
            s.*,
            p.workload_status as product_workload_status,
            p.direct_labour_route_intensity,
            p.standard_batch_count,
            p.direct_labour_workload_units,
            p.product_workload_share,
            p.shadow_product_allocation,
            case
                when s.monthly_product_allocation_base_qty > 0
                then s.monthly_allocation_base_qty
                     / s.monthly_product_allocation_base_qty
            end as sku_within_product_share,
            case
                when s.monthly_product_allocation_base_qty > 0
                then p.shadow_product_allocation
                     * s.monthly_allocation_base_qty
                     / s.monthly_product_allocation_base_qty
            end as shadow_sku_allocation_amount,
            case
                when s.monthly_product_allocation_base_qty > 0
                 and s.sku_base_qty_per_unit > 0
                then (
                    p.shadow_product_allocation
                    / s.monthly_product_allocation_base_qty
                ) * s.sku_base_qty_per_unit
            end as shadow_direct_labour_cost_per_sku
        from sku_basis s
        join product_allocations p
          on p.product_id = s.product_id
    ),
    reconciliation as (
        select
            p_reference_pool_amount as reference_pool_amount,
            coalesce(sum(distinct_product_allocation), 0) as product_allocation_total,
            coalesce((select sum(shadow_sku_allocation_amount) from sku_allocations), 0) as sku_allocation_total
        from (
            select distinct product_id, shadow_product_allocation as distinct_product_allocation
            from product_allocations
        ) p
    )
    select jsonb_build_object(
        'preview_only', true,
        'records_created', 0,
        'monetary_snapshot_created', false,
        'stage03_cutover_status', 'NOT_AUTHORISED_BY_THIS_GATE',
        'pool_authority', 'EXPLICIT_ANALYTICAL_REFERENCE_ONLY',
        'pool_authority_note', 'The supplied pool is used only for shadow reconciliation. It is not asserted to be a frozen exact-run pool.',
        'coverage_policy', 'FULL_COMPANY_MONETARY_CUTOVER_REQUIRES_ALL_RECIPIENT_PRODUCTS_READY',
        'covered_subset_allocation_warning', 'The shadow allocation distributes the reference pool only across currently eligible Products. It proves arithmetic and SKU absorption, but it is not economically valid for final costing until full-company coverage is accepted.',
        'policy_id', p_policy_id,
        'period_start', v_period_start,
        'valuation_date', p_valuation_date,
        'refresh_run_id', p_refresh_run_id,
        'route_family_id', p_route_family_id,
        'workload_summary', v_workload -> 'summary',
        'reconciliation', (
            select jsonb_build_object(
                'reference_pool_amount', r.reference_pool_amount,
                'product_allocation_total', r.product_allocation_total,
                'sku_allocation_total', r.sku_allocation_total,
                'product_variance', r.reference_pool_amount - r.product_allocation_total,
                'sku_variance', r.reference_pool_amount - r.sku_allocation_total,
                'product_reconciled', abs(r.reference_pool_amount - r.product_allocation_total) < 0.000001,
                'sku_reconciled', abs(r.reference_pool_amount - r.sku_allocation_total) < 0.000001
            )
            from reconciliation r
        ),
        'product_allocations', coalesce(
            (select jsonb_agg(to_jsonb(p) order by p.product_name, p.product_id) from product_allocations p),
            '[]'::jsonb
        ),
        'sku_allocations', coalesce(
            (select jsonb_agg(to_jsonb(s) order by s.product_name, s.product_id, s.sku_id) from sku_allocations s),
            '[]'::jsonb
        )
    ) into v_result;

    return v_result;
end;
$function$;

create or replace function public.rpc_preview_direct_labour_shadow_monetary_reconciliation(
    p_policy_id bigint,
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_reference_pool_amount numeric,
    p_route_family_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
begin
    perform public.require_permission('module:production-route-manager', false);

    return costing.fn_preview_direct_labour_shadow_monetary_reconciliation(
        p_policy_id,
        p_period_start,
        p_valuation_date,
        p_refresh_run_id,
        p_reference_pool_amount,
        p_route_family_id
    );
end;
$function$;

revoke all on function costing.fn_preview_direct_labour_shadow_monetary_reconciliation(bigint,date,date,bigint,numeric,bigint) from public, anon, authenticated;
revoke all on function public.rpc_preview_direct_labour_shadow_monetary_reconciliation(bigint,date,date,bigint,numeric,bigint) from public, anon;
grant execute on function public.rpc_preview_direct_labour_shadow_monetary_reconciliation(bigint,date,date,bigint,numeric,bigint) to authenticated, service_role, postgres;