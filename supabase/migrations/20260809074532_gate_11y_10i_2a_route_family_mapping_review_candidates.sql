-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_route_family_mapping_review_candidates(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_as_of_date date default current_date,
    p_candidate_class text default null,
    p_product_group_id integer default null,
    p_search text default null,
    p_limit integer default 100,
    p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
    v_period_start date := date_trunc('month', p_period_start)::date;
    v_as_of_date date := coalesce(p_as_of_date, current_date);
    v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
    v_offset integer := greatest(coalesce(p_offset,0),0);
    v_candidate_class text := nullif(upper(btrim(p_candidate_class)),'');
    v_run costing.costing_refresh_run%rowtype;
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager', false);

    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    if v_candidate_class is not null
       and v_candidate_class not in ('SAME_GROUP_SINGLE_FAMILY_EVIDENCE','NO_READY_SAME_GROUP_EVIDENCE','AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE') then
        raise exception 'Invalid candidate class %', p_candidate_class;
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id=p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % not found', p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Route-family mapping review context does not match refresh run %', p_refresh_run_id;
    end if;

    with recipients as materialized (
        select distinct w.product_id
        from costing.product_direct_labour_workload_snapshot w
        where w.refresh_run_id=p_refresh_run_id
          and w.period_start=v_period_start
          and w.valuation_date=p_valuation_date
    ), readiness as materialized (
        select r.*
        from costing.fn_product_process_route_readiness(v_as_of_date) r
        join recipients x on x.product_id=r.product_id
    ), ready_group_evidence as materialized (
        select
            r.product_group_id,
            count(*)::integer as ready_products_same_group,
            count(distinct r.route_family_id)::integer as distinct_ready_route_families_same_group,
            array_agg(distinct r.route_family_id order by r.route_family_id) filter(where r.route_family_id is not null) as ready_route_family_ids,
            min(r.route_family_id) filter(where r.route_family_id is not null) as sole_ready_route_family_id
        from readiness r
        where r.readiness_status='READY'
        group by r.product_group_id
    ), candidate_rows as materialized (
        select
            r.product_id,
            r.product_name,
            r.category_id,
            r.category_name,
            r.sub_category_id,
            r.subcategory_name,
            r.product_group_id,
            r.product_group_name,
            r.readiness_status,
            r.validation,
            coalesce(e.ready_products_same_group,0) as ready_products_same_group,
            coalesce(e.distinct_ready_route_families_same_group,0) as distinct_ready_route_families_same_group,
            coalesce(e.ready_route_family_ids,'{}'::bigint[]) as ready_route_family_ids,
            case when coalesce(e.distinct_ready_route_families_same_group,0)=1 then e.sole_ready_route_family_id end as candidate_route_family_id,
            case
                when coalesce(e.distinct_ready_route_families_same_group,0)=1 then 'SAME_GROUP_SINGLE_FAMILY_EVIDENCE'
                when coalesce(e.distinct_ready_route_families_same_group,0)=0 then 'NO_READY_SAME_GROUP_EVIDENCE'
                else 'AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE'
            end as candidate_class
        from readiness r
        left join ready_group_evidence e on e.product_group_id=r.product_group_id
        where r.readiness_status='BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
    ), enriched as materialized (
        select
            c.*,
            f.family_code as candidate_route_family_code,
            f.family_name as candidate_route_family_name,
            f.status as candidate_route_family_status,
            exists(
                select 1
                from costing.production_route_family_product_group_map gm
                where gm.product_group_id=c.product_group_id
                  and gm.status in ('DRAFT','IN_REVIEW')
                  and (gm.effective_to is null or gm.effective_to>=v_as_of_date)
            ) as has_pending_group_mapping,
            exists(
                select 1
                from costing.production_route_family_product_map pm
                where pm.product_id=c.product_id
                  and pm.status in ('DRAFT','IN_REVIEW')
                  and (pm.effective_to is null or pm.effective_to>=v_as_of_date)
            ) as has_pending_product_assignment
        from candidate_rows c
        left join costing.production_route_family f on f.id=c.candidate_route_family_id
    ), filtered as materialized (
        select *
        from enriched e
        where (v_candidate_class is null or e.candidate_class=v_candidate_class)
          and (p_product_group_id is null or e.product_group_id=p_product_group_id)
          and (
              nullif(btrim(p_search),'') is null
              or e.product_name ilike '%'||btrim(p_search)||'%'
              or e.product_group_name ilike '%'||btrim(p_search)||'%'
              or e.category_name ilike '%'||btrim(p_search)||'%'
              or e.subcategory_name ilike '%'||btrim(p_search)||'%'
              or coalesce(e.candidate_route_family_name,'') ilike '%'||btrim(p_search)||'%'
              or coalesce(e.candidate_route_family_code,'') ilike '%'||btrim(p_search)||'%'
              or e.product_id::text=btrim(p_search)
          )
    ), page as (
        select *
        from filtered
        order by
            case candidate_class
                when 'SAME_GROUP_SINGLE_FAMILY_EVIDENCE' then 1
                when 'AMBIGUOUS_SAME_GROUP_FAMILY_EVIDENCE' then 2
                else 3
            end,
            category_name, subcategory_name, product_group_name, product_name, product_id
        limit v_limit offset v_offset
    ), class_summary as (
        select candidate_class,
               count(*)::integer as product_count,
               count(distinct product_group_id)::integer as product_group_count
        from enriched
        group by candidate_class
    )
    select jsonb_build_object(
        'period_start',v_period_start,
        'valuation_date',p_valuation_date,
        'refresh_run_id',p_refresh_run_id,
        'as_of_date',v_as_of_date,
        'total_blocked_product_count',(select count(*) from enriched),
        'filtered_count',(select count(*) from filtered),
        'limit',v_limit,
        'offset',v_offset,
        'class_summary',coalesce((select jsonb_agg(to_jsonb(s) order by s.candidate_class) from class_summary s),'[]'::jsonb),
        'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.category_name,p.subcategory_name,p.product_group_name,p.product_name,p.product_id) from page p),'[]'::jsonb)
    ) into v_result;

    return v_result;
end;
$function$;

revoke all on function public.rpc_get_route_family_mapping_review_candidates(date,date,bigint,date,text,integer,text,integer,integer) from public;
revoke all on function public.rpc_get_route_family_mapping_review_candidates(date,date,bigint,date,text,integer,text,integer,integer) from anon;
grant execute on function public.rpc_get_route_family_mapping_review_candidates(date,date,bigint,date,text,integer,text,integer,integer) to authenticated;
grant execute on function public.rpc_get_route_family_mapping_review_candidates(date,date,bigint,date,text,integer,text,integer,integer) to service_role;