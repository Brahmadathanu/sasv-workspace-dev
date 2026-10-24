-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_route_family_foundation_review(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint,
    p_as_of_date date default current_date,
    p_lookback_months integer default null,
    p_group_evidence_class text default null,
    p_product_group_id integer default null,
    p_search text default null,
    p_limit integer default 25,
    p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_as_of_date date := coalesce(p_as_of_date,current_date);
    v_limit integer := greatest(1,least(coalesce(p_limit,25),100));
    v_offset integer := greatest(coalesce(p_offset,0),0);
    v_group_evidence_class text := nullif(upper(btrim(p_group_evidence_class)),'');
    v_run costing.costing_refresh_run%rowtype;
    v_policy costing.production_route_candidate_policy%rowtype;
    v_lookback integer;
    v_result jsonb;
begin
    perform public.require_permission('module:production-route-manager',false);

    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    if v_group_evidence_class is not null
       and v_group_evidence_class not in (
         'ALL_PRODUCTS_SUFFICIENT',
         'MIXED_WITH_SUFFICIENT',
         'LIMITED_ONLY',
         'LIMITED_AND_NONE',
         'NO_EVIDENCE_ALL'
       ) then
        raise exception 'Invalid group evidence class %',p_group_evidence_class;
    end if;

    select * into v_run
    from costing.costing_refresh_run r
    where r.id=p_refresh_run_id;

    if not found then
        raise exception 'Costing refresh run % not found',p_refresh_run_id;
    end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Route-family foundation review context does not match refresh run %',p_refresh_run_id;
    end if;

    select * into v_policy
    from costing.fn_resolve_production_route_candidate_policy(v_as_of_date);

    v_lookback := least(
        coalesce(p_lookback_months,v_policy.default_lookback_months),
        v_policy.maximum_lookback_months
    );

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
        select r.product_group_id,
               count(*)::integer as ready_products_same_group
        from readiness r
        where r.readiness_status='READY'
        group by r.product_group_id
    ), target_products as materialized (
        select r.product_id,
               r.product_name,
               r.category_id,
               r.category_name,
               r.sub_category_id,
               r.subcategory_name,
               r.product_group_id,
               r.product_group_name,
               r.readiness_status
        from readiness r
        left join ready_group_evidence ge on ge.product_group_id=r.product_group_id
        where r.readiness_status='BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
          and coalesce(ge.ready_products_same_group,0)=0
    ), product_evidence as materialized (
        select t.*,
               coalesce((e.ev->'summary'->>'eligible_batches')::integer,0) as eligible_batches,
               coalesce(e.ev->'summary'->>'candidate_status','NO_ELIGIBLE_HISTORY') as candidate_status,
               case
                 when coalesce((e.ev->'summary'->>'eligible_batches')::integer,0)>=v_policy.min_eligible_batches
                      and coalesce(e.ev->'summary'->>'candidate_status','')='REVIEWABLE_CANDIDATE'
                   then 'HISTORICAL_EVIDENCE_SUFFICIENT'
                 when coalesce((e.ev->'summary'->>'eligible_batches')::integer,0)>0
                   then 'HISTORICAL_EVIDENCE_LIMITED'
                 else 'NO_ELIGIBLE_HISTORICAL_EVIDENCE'
               end as evidence_class
        from target_products t
        cross join lateral (
            select costing.fn_preview_product_process_route_evidence(
                t.product_id::bigint,v_as_of_date,v_lookback
            ) as ev
        ) e
    ), grouped as materialized (
        select
            p.category_id,
            max(p.category_name) as category_name,
            p.sub_category_id,
            max(p.subcategory_name) as subcategory_name,
            p.product_group_id,
            max(p.product_group_name) as product_group_name,
            count(*)::integer as product_count,
            count(*) filter(where p.evidence_class='HISTORICAL_EVIDENCE_SUFFICIENT')::integer as sufficient_products,
            count(*) filter(where p.evidence_class='HISTORICAL_EVIDENCE_LIMITED')::integer as limited_products,
            count(*) filter(where p.evidence_class='NO_ELIGIBLE_HISTORICAL_EVIDENCE')::integer as no_evidence_products,
            coalesce(sum(p.eligible_batches),0)::integer as total_eligible_batches,
            round(avg(p.eligible_batches)::numeric,2) as avg_eligible_batches,
            max(p.eligible_batches)::integer as max_eligible_batches,
            case
              when count(*) filter(where p.evidence_class='HISTORICAL_EVIDENCE_SUFFICIENT')=count(*)
                then 'ALL_PRODUCTS_SUFFICIENT'
              when count(*) filter(where p.evidence_class='HISTORICAL_EVIDENCE_SUFFICIENT')>0
                then 'MIXED_WITH_SUFFICIENT'
              when count(*) filter(where p.evidence_class='HISTORICAL_EVIDENCE_LIMITED')>0
                   and count(*) filter(where p.evidence_class='NO_ELIGIBLE_HISTORICAL_EVIDENCE')>0
                then 'LIMITED_AND_NONE'
              when count(*) filter(where p.evidence_class='HISTORICAL_EVIDENCE_LIMITED')>0
                then 'LIMITED_ONLY'
              else 'NO_EVIDENCE_ALL'
            end as group_evidence_class,
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'product_id',p.product_id,
                  'product_name',p.product_name,
                  'evidence_class',p.evidence_class,
                  'eligible_batches',p.eligible_batches,
                  'candidate_status',p.candidate_status
                )
                order by
                  case p.evidence_class
                    when 'HISTORICAL_EVIDENCE_SUFFICIENT' then 1
                    when 'HISTORICAL_EVIDENCE_LIMITED' then 2
                    else 3
                  end,
                  p.eligible_batches desc,
                  p.product_name,
                  p.product_id
              ),'[]'::jsonb
            ) as products
        from product_evidence p
        group by p.category_id,p.sub_category_id,p.product_group_id
    ), filtered as materialized (
        select g.*
        from grouped g
        where (v_group_evidence_class is null or g.group_evidence_class=v_group_evidence_class)
          and (p_product_group_id is null or g.product_group_id=p_product_group_id)
          and (
             nullif(btrim(p_search),'') is null
             or g.category_name ilike '%'||btrim(p_search)||'%'
             or g.subcategory_name ilike '%'||btrim(p_search)||'%'
             or g.product_group_name ilike '%'||btrim(p_search)||'%'
             or g.product_group_id::text=btrim(p_search)
             or exists (
                 select 1
                 from product_evidence pe
                 where pe.product_group_id=g.product_group_id
                   and (pe.product_name ilike '%'||btrim(p_search)||'%' or pe.product_id::text=btrim(p_search))
             )
          )
    ), page_groups as materialized (
        select g.*
        from filtered g
        order by
          case g.group_evidence_class
            when 'ALL_PRODUCTS_SUFFICIENT' then 1
            when 'MIXED_WITH_SUFFICIENT' then 2
            when 'LIMITED_ONLY' then 3
            when 'LIMITED_AND_NONE' then 4
            else 5
          end,
          g.total_eligible_batches desc,
          g.product_count desc,
          g.category_name,g.subcategory_name,g.product_group_name,g.product_group_id
        limit v_limit offset v_offset
    ), page_enriched as (
        select pg.*,
               fp.preview->'summary' as foundation_summary,
               fp.preview->'family_steps' as family_steps,
               fp.preview->'policy' as historical_policy,
               coalesce(fp.preview->>'approvable','false')::boolean as approvable,
               fp.preview->>'approval_note' as approval_note
        from page_groups pg
        cross join lateral (
            select costing.fn_preview_route_family_candidate(
                null,
                array[pg.product_group_id],
                v_as_of_date,
                v_lookback
            ) as preview
        ) fp
    ), class_summary as (
        select group_evidence_class,
               count(*)::integer as group_count,
               sum(product_count)::integer as product_count
        from grouped
        group by group_evidence_class
    )
    select jsonb_build_object(
        'period_start',v_period_start,
        'valuation_date',p_valuation_date,
        'refresh_run_id',p_refresh_run_id,
        'as_of_date',v_as_of_date,
        'lookback_months',v_lookback,
        'policy',jsonb_build_object(
            'policy_code',v_policy.policy_code,
            'version_no',v_policy.version_no,
            'min_eligible_batches',v_policy.min_eligible_batches,
            'core_threshold',v_policy.core_threshold,
            'common_threshold',v_policy.common_threshold,
            'occasional_threshold',v_policy.occasional_threshold
        ),
        'target_product_count',(select count(*) from product_evidence),
        'target_product_group_count',(select count(*) from grouped),
        'filtered_group_count',(select count(*) from filtered),
        'limit',v_limit,
        'offset',v_offset,
        'class_summary',coalesce((select jsonb_agg(to_jsonb(s) order by s.group_evidence_class) from class_summary s),'[]'::jsonb),
        'groups',coalesce((
            select jsonb_agg(to_jsonb(p) order by
              case p.group_evidence_class
                when 'ALL_PRODUCTS_SUFFICIENT' then 1
                when 'MIXED_WITH_SUFFICIENT' then 2
                when 'LIMITED_ONLY' then 3
                when 'LIMITED_AND_NONE' then 4
                else 5
              end,
              p.total_eligible_batches desc,
              p.product_count desc,
              p.category_name,p.subcategory_name,p.product_group_name,p.product_group_id
            )
            from page_enriched p
        ),'[]'::jsonb),
        'approvable',false,
        'approval_note','Foundation evidence is review-only. It never creates a Route Family, mapping or approved route.'
    ) into v_result;

    return v_result;
end;
$function$;

revoke all on function public.rpc_get_route_family_foundation_review(date,date,bigint,date,integer,text,integer,text,integer,integer) from public, anon;
grant execute on function public.rpc_get_route_family_foundation_review(date,date,bigint,date,integer,text,integer,text,integer,integer) to authenticated, service_role, postgres;

comment on function public.rpc_get_route_family_foundation_review(date,date,bigint,date,integer,text,integer,text,integer,integer)
is 'Governed read-only Route Family foundation review for current route-family-blocked costing recipients. Summarizes Product-Group historical process evidence and representative family-step evidence without creating or approving Route Families, mappings or routes.';