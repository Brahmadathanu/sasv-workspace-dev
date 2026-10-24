-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_manager_exact_run_readiness(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_search text default null,
    p_readiness_status text default null,
    p_route_family_id bigint default null,
    p_product_group_id integer default null,
    p_limit integer default 100,
    p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
declare
    v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
    v_offset integer := greatest(coalesce(p_offset,0),0);
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_foundation jsonb;
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager',false);

    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    v_foundation := costing.fn_preview_shared_standard_batch_route_foundation(
        v_period_start,
        p_valuation_date,
        p_refresh_run_id,
        null
    );

    with foundation_rows as (
        select *
        from jsonb_to_recordset(coalesce(v_foundation->'rows','[]'::jsonb)) as f(
            product_id bigint,
            product_name text,
            product_base_uom text,
            recipient_sku_count integer,
            monthly_product_base_qty numeric,
            monthly_driver_status text,
            actual_source_sku_count integer,
            assumption_source_sku_count integer,
            default_source_sku_count integer,
            sku_quantity_evidence jsonb,
            batch_size_ref_id bigint,
            preferred_batch_size numeric,
            min_batch_size numeric,
            max_batch_size numeric,
            batch_size_effective_from date,
            raw_batch_requirement numeric,
            standard_batch_count bigint,
            route_family_id bigint,
            family_route_id bigint,
            product_route_id bigint,
            effective_route_source text,
            route_validation jsonb,
            effective_step_count integer,
            direct_labour_include_step_count integer,
            direct_labour_supervision_step_count integer,
            direct_labour_excluded_step_count integer,
            production_overhead_include_step_count integer,
            production_overhead_passive_step_count integer,
            production_overhead_excluded_step_count integer,
            step_evidence jsonb,
            foundation_status text,
            foundation_note text
        )
    ), enriched as (
        select
            f.*,
            p.status as product_status,
            c.id as category_id,
            c.category_name,
            sc.id as sub_category_id,
            sc.subcategory_name,
            pg.id as product_group_id,
            pg.group_name as product_group_name,
            rf.family_code as route_family_code,
            rf.family_name as route_family_name,
            rr.route_family_assignment_source,
            rr.route_family_assignment_basis,
            rr.product_route_family_assignment_id,
            rr.product_group_route_family_mapping_id,
            rr.route_family_assignment_approval_reference,
            rr.route_status,
            rr.route_version,
            rr.evidence_status,
            rr.effective_from as route_effective_from,
            rr.effective_to as route_effective_to,
            case
                when f.foundation_status = 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE' then
                    case
                        when rr.readiness_status = 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
                            then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
                        when rr.readiness_status = 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
                            then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
                        when rr.readiness_status = 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
                            then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
                        else 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
                    end
                else f.foundation_status
            end as readiness_status,
            case
                when f.foundation_status = 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
                     and rr.readiness_status is not null
                    then coalesce(rr.validation->'errors',f.route_validation->'errors')
                else f.route_validation->'errors'
            end as readiness_errors
        from foundation_rows f
        join public.products p on p.id=f.product_id
        join public.sub_groups sg on sg.id=p.sub_group_id
        join public.product_groups pg on pg.id=sg.product_group_id
        join public.sub_categories sc on sc.id=pg.sub_category_id
        join public.categories c on c.id=sc.category_id
        left join costing.production_route_family rf on rf.id=f.route_family_id
        left join lateral (
            select r.*
            from costing.fn_product_process_route_readiness(p_valuation_date) r
            where r.product_id=f.product_id
            limit 1
        ) rr on true
    ), filtered as (
        select *
        from enriched e
        where (p_readiness_status is null or e.readiness_status=p_readiness_status)
          and (p_route_family_id is null or e.route_family_id=p_route_family_id)
          and (p_product_group_id is null or e.product_group_id=p_product_group_id)
          and (
              nullif(btrim(p_search),'') is null
              or e.product_name ilike '%'||btrim(p_search)||'%'
              or e.product_group_name ilike '%'||btrim(p_search)||'%'
              or e.route_family_name ilike '%'||btrim(p_search)||'%'
              or e.category_name ilike '%'||btrim(p_search)||'%'
              or e.subcategory_name ilike '%'||btrim(p_search)||'%'
              or e.product_id::text=btrim(p_search)
          )
    ), page as (
        select *
        from filtered
        order by category_name,subcategory_name,product_group_name,product_name,product_id
        limit v_limit offset v_offset
    )
    select jsonb_build_object(
        'period_start',v_period_start,
        'valuation_date',p_valuation_date,
        'refresh_run_id',p_refresh_run_id,
        'total_count',(select count(*) from filtered),
        'limit',v_limit,
        'offset',v_offset,
        'status_counts',coalesce((
            select jsonb_object_agg(readiness_status,cnt order by readiness_status)
            from (
                select readiness_status,count(*) cnt
                from enriched
                group by readiness_status
            ) s
        ),'{}'::jsonb),
        'data_quality_gate_status','DEFERRED_UNTIL_PIPELINE_COMPLETE',
        'rows',coalesce((
            select jsonb_agg(to_jsonb(p) order by p.category_name,p.subcategory_name,p.product_group_name,p.product_name,p.product_id)
            from page p
        ),'[]'::jsonb)
    ) into v_result;

    return v_result;
end;
$function$;

revoke all on function public.rpc_get_production_route_manager_exact_run_readiness(date,date,bigint,text,text,bigint,integer,integer,integer) from public, anon;
grant execute on function public.rpc_get_production_route_manager_exact_run_readiness(date,date,bigint,text,text,bigint,integer,integer,integer) to authenticated;