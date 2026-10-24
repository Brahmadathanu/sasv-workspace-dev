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
    v_run costing.costing_refresh_run%rowtype;
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager',false);

    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id=p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % not found',p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST'
    then
        raise exception 'Exact-run readiness context does not match refresh run %',p_refresh_run_id;
    end if;

    with recipients as (
        select
            b.product_id,
            max(b.product_name) as product_name,
            max(b.product_base_uom) as product_base_uom,
            count(*)::integer as recipient_sku_count,
            max(b.monthly_product_allocation_base_qty) as monthly_product_base_qty,
            max(b.monthly_driver_status) as monthly_driver_status,
            count(*) filter(where b.assumption_id is null and b.default_policy_id is null)::integer as actual_source_sku_count,
            count(*) filter(where b.assumption_id is not null)::integer as assumption_source_sku_count,
            count(*) filter(where b.default_policy_id is not null)::integer as default_source_sku_count,
            jsonb_agg(
                jsonb_build_object(
                    'sku_id',b.sku_id,
                    'monthly_allocation_base_qty',b.monthly_allocation_base_qty,
                    'monthly_driver_method',b.monthly_driver_method,
                    'monthly_driver_source',b.monthly_driver_source,
                    'monthly_driver_source_month',b.monthly_driver_source_month,
                    'monthly_driver_status',b.monthly_driver_status,
                    'assumption_id',b.assumption_id,
                    'assumption_basis',b.assumption_basis,
                    'default_policy_id',b.default_policy_id,
                    'default_policy_scenario',b.default_policy_scenario
                ) order by b.sku_id
            ) as sku_quantity_evidence
        from costing.sku_sales_allocation_basis_snapshot b
        where b.period_start=v_period_start
          and b.valuation_date=p_valuation_date
          and b.refresh_run_id=p_refresh_run_id
        group by b.product_id
    ), batch_ref as (
        select distinct on (b.product_id)
            b.product_id,
            b.id as batch_size_ref_id,
            b.preferred_batch_size,
            b.min_batch_size,
            b.max_batch_size,
            b.effective_from as batch_size_effective_from
        from public.production_batch_size_ref b
        where b.is_active=true
          and b.effective_from<=p_valuation_date
        order by b.product_id,b.effective_from desc,b.id desc
    ), route_readiness as materialized (
        select *
        from costing.fn_product_process_route_readiness(p_valuation_date)
    ), enriched as (
        select
            r.product_id,
            r.product_name,
            p.status as product_status,
            r.product_base_uom,
            r.recipient_sku_count,
            c.id as category_id,
            c.category_name,
            sc.id as sub_category_id,
            sc.subcategory_name,
            pg.id as product_group_id,
            pg.group_name as product_group_name,
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
            b.batch_size_effective_from,
            case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0
                 then r.monthly_product_base_qty/b.preferred_batch_size end as raw_batch_requirement,
            case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0
                 then ceil(r.monthly_product_base_qty/b.preferred_batch_size)::bigint end as standard_batch_count,
            rr.route_family_id,
            rr.route_family_code,
            rr.route_family_name,
            rr.effective_family_route_id as family_route_id,
            rr.product_route_id,
            rr.effective_route_source,
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
            rr.validation as route_validation,
            nullif(rr.validation->>'step_count','')::integer as effective_step_count,
            case
                when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0
                    then 'BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY'
                when r.monthly_driver_status='BLOCKED'
                    then 'BLOCKED_MONTHLY_QUANTITY_DRIVER'
                when b.batch_size_ref_id is null or b.preferred_batch_size is null or b.preferred_batch_size<=0
                    then 'BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE'
                when rr.readiness_status is null
                    then 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
                when rr.readiness_status<>'READY'
                    then rr.readiness_status
                when r.monthly_driver_status='REVIEW_REQUIRED'
                    then 'REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER'
                else 'READY'
            end as readiness_status,
            case
                when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0
                    then 'A positive governed monthly Product quantity is required.'
                when r.monthly_driver_status='BLOCKED'
                    then 'The exact-run monthly quantity driver is blocked.'
                when b.batch_size_ref_id is null or b.preferred_batch_size is null or b.preferred_batch_size<=0
                    then 'An effective positive preferred batch size is mandatory.'
                when rr.readiness_status is null
                    then 'A valid effective Product manufacturing route is mandatory.'
                when rr.readiness_status<>'READY'
                    then 'The effective Product manufacturing route is not ready.'
                when r.monthly_driver_status='REVIEW_REQUIRED'
                    then 'The route and batch foundation is calculable, but the monthly quantity source requires review.'
                else 'Exact-run route and batch foundation is ready.'
            end as readiness_note,
            case when rr.readiness_status is null or rr.readiness_status<>'READY'
                 then rr.validation->'errors' else '[]'::jsonb end as readiness_errors
        from recipients r
        join public.products p on p.id=r.product_id
        join public.sub_groups sg on sg.id=p.sub_group_id
        join public.product_groups pg on pg.id=sg.product_group_id
        join public.sub_categories sc on sc.id=pg.sub_category_id
        join public.categories c on c.id=sc.category_id
        left join batch_ref b on b.product_id=r.product_id
        left join route_readiness rr on rr.product_id=r.product_id
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
            from (select readiness_status,count(*) cnt from enriched group by readiness_status)s
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