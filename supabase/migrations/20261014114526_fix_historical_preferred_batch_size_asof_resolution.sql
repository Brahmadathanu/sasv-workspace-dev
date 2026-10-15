CREATE OR REPLACE FUNCTION costing.fn_preview_shared_standard_batch_route_foundation(p_period_start date, p_valuation_date date, p_refresh_run_id bigint, p_route_family_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_period_start date;
    v_run costing.costing_refresh_run%rowtype;
    v_result jsonb;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;
    v_period_start := date_trunc('month', p_period_start)::date;
    select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Shared standard batch-route preview context does not match refresh run %',p_refresh_run_id;
    end if;

    with commercial_recipients as materialized (
        select b.product_id,max(b.product_name) product_name,max(b.product_base_uom) product_base_uom,
               max(b.monthly_product_allocation_base_qty) commercial_product_base_qty,
               case when bool_or(ar.effective_status='BLOCKED') then 'BLOCKED'
                    when bool_or(ar.effective_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'
                    else 'READY' end commercial_driver_status,
               count(*)::integer recipient_sku_count,
               count(*) filter(where b.assumption_id is null and b.default_policy_id is null)::integer actual_source_sku_count,
               count(*) filter(where b.assumption_id is not null)::integer assumption_source_sku_count,
               count(*) filter(where b.default_policy_id is not null)::integer default_source_sku_count,
               jsonb_agg(jsonb_build_object(
                 'sku_id',b.sku_id,'monthly_allocation_base_qty',b.monthly_allocation_base_qty,
                 'monthly_driver_method',b.monthly_driver_method,'monthly_driver_source',b.monthly_driver_source,
                 'monthly_driver_source_month',b.monthly_driver_source_month,'monthly_driver_status',b.monthly_driver_status,
                 'monthly_driver_effective_status',ar.effective_status,'quantity_driver_acceptance_id',ar.acceptance_id,
                 'assumption_id',b.assumption_id,'assumption_basis',b.assumption_basis,
                 'default_policy_id',b.default_policy_id,'default_policy_scenario',b.default_policy_scenario
               ) order by b.sku_id) sku_quantity_evidence
        from costing.sku_sales_allocation_basis_snapshot b
        cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
        where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
        group by b.product_id
    ), internal_recipients as materialized (
        select * from costing.fn_internal_source_product_demand_as_of(v_period_start,p_valuation_date,p_refresh_run_id)
    ), recipient_ids as materialized (
        select product_id from commercial_recipients
        union
        select source_product_id from internal_recipients
    ), recipients as materialized (
        select ids.product_id,
               coalesce(c.product_name,d.source_product_name,p.item)::text product_name,
               coalesce(c.product_base_uom,d.source_product_base_uom)::text product_base_uom,
               coalesce(c.commercial_product_base_qty,0)+coalesce(d.monthly_internal_demand_base_qty,0) monthly_product_base_qty,
               case when coalesce(c.commercial_driver_status,'READY')='BLOCKED' or coalesce(d.monthly_driver_status,'READY')='BLOCKED' then 'BLOCKED'
                    when coalesce(c.commercial_driver_status,'READY')='REVIEW_REQUIRED' or coalesce(d.monthly_driver_status,'READY')='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
                    else 'READY' end monthly_driver_status,
               coalesce(c.recipient_sku_count,0)::integer recipient_sku_count,
               coalesce(c.actual_source_sku_count,0)::integer actual_source_sku_count,
               coalesce(c.assumption_source_sku_count,0)::integer assumption_source_sku_count,
               coalesce(c.default_source_sku_count,0)::integer default_source_sku_count,
               coalesce(c.sku_quantity_evidence,'[]'::jsonb)
                 || case when d.source_product_id is not null then jsonb_build_array(jsonb_build_object(
                      'source_type','INTERNAL_MATERIAL_DEMAND','monthly_internal_demand_base_qty',d.monthly_internal_demand_base_qty,
                      'monthly_driver_status',d.monthly_driver_status,'source_path_count',d.source_path_count,
                      'evidence',d.evidence_json)) else '[]'::jsonb end as sku_quantity_evidence
        from recipient_ids ids
        join public.products p on p.id=ids.product_id
        left join commercial_recipients c on c.product_id=ids.product_id
        left join internal_recipients d on d.source_product_id=ids.product_id
        where p.status='Active'
    ), batch_ref as materialized (
        select distinct on (b.product_id) b.product_id,b.id batch_size_ref_id,b.preferred_batch_size,b.min_batch_size,b.max_batch_size,b.effective_from
        from public.production_batch_size_ref b
        where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
        order by b.product_id,b.effective_from desc,b.id desc
    ), route_validation as materialized (
        select r.product_id,costing.fn_validate_effective_product_process_route(r.product_id::integer,p_valuation_date) route_validation from recipients r
    ), route_context as materialized (
        select rv.product_id,nullif(rv.route_validation->>'route_family_id','')::bigint route_family_id,
               nullif(rv.route_validation->>'family_route_id','')::bigint family_route_id,
               nullif(rv.route_validation->>'product_route_id','')::bigint product_route_id,rv.route_validation
        from route_validation rv
    ), step_context as materialized (
        select r.product_id,count(e.effective_step_key)::integer effective_step_count,
               count(e.effective_step_key) filter(where e.direct_labour_scope='INCLUDE')::integer direct_labour_include_step_count,
               count(e.effective_step_key) filter(where e.direct_labour_scope='SUPERVISION')::integer direct_labour_supervision_step_count,
               count(e.effective_step_key) filter(where e.direct_labour_scope='EXCLUDE_OTHER_POOL')::integer direct_labour_excluded_step_count,
               count(e.effective_step_key) filter(where e.production_overhead_scope='INCLUDE')::integer production_overhead_include_step_count,
               count(e.effective_step_key) filter(where e.production_overhead_scope='PASSIVE')::integer production_overhead_passive_step_count,
               count(e.effective_step_key) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer production_overhead_excluded_step_count,
               jsonb_agg(jsonb_build_object(
                 'effective_step_key',e.effective_step_key,'sequence_no',e.sequence_no,'activity_id',e.activity_id,
                 'cost_centre_id',e.cost_centre_id,'behaviour_code',e.behaviour_code,'resource_class_code',e.resource_class_code,
                 'expected_occurrence_count',e.expected_occurrence_count,'standard_cycle_count',e.standard_cycle_count,
                 'direct_labour_scope',e.direct_labour_scope,'production_overhead_scope',e.production_overhead_scope,
                 'source_type',e.source_type,'base_step_id',e.base_step_id,'override_id',e.override_id
               ) order by e.sequence_no,e.effective_step_key) filter(where e.effective_step_key is not null) step_evidence
        from recipients r
        left join lateral costing.fn_effective_product_process_steps(r.product_id::integer,p_valuation_date) e on true
        group by r.product_id
    ), rows as (
        select r.product_id,r.product_name,r.product_base_uom,r.recipient_sku_count,r.monthly_product_base_qty,r.monthly_driver_status,
               r.actual_source_sku_count,r.assumption_source_sku_count,r.default_source_sku_count,r.sku_quantity_evidence,
               b.batch_size_ref_id,b.preferred_batch_size,b.min_batch_size,b.max_batch_size,b.effective_from batch_size_effective_from,
               case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0 then r.monthly_product_base_qty/b.preferred_batch_size end raw_batch_requirement,
               case when b.preferred_batch_size>0 and r.monthly_product_base_qty>0 then ceil(r.monthly_product_base_qty/b.preferred_batch_size)::bigint end standard_batch_count,
               rc.route_family_id,rc.family_route_id,rc.product_route_id,rc.route_validation->>'route_source' effective_route_source,rc.route_validation,
               coalesce(s.effective_step_count,0) effective_step_count,
               coalesce(s.direct_labour_include_step_count,0) direct_labour_include_step_count,
               coalesce(s.direct_labour_supervision_step_count,0) direct_labour_supervision_step_count,
               coalesce(s.direct_labour_excluded_step_count,0) direct_labour_excluded_step_count,
               coalesce(s.production_overhead_include_step_count,0) production_overhead_include_step_count,
               coalesce(s.production_overhead_passive_step_count,0) production_overhead_passive_step_count,
               coalesce(s.production_overhead_excluded_step_count,0) production_overhead_excluded_step_count,
               coalesce(s.step_evidence,'[]'::jsonb) step_evidence,
               case when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'BLOCKED_NO_GOVERNED_MONTHLY_PRODUCT_QUANTITY'
                    when r.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_QUANTITY_DRIVER'
                    when b.batch_size_ref_id is null or b.preferred_batch_size is null or b.preferred_batch_size<=0 then 'BLOCKED_NO_EFFECTIVE_PREFERRED_BATCH_SIZE'
                    when coalesce((rc.route_validation->>'valid')::boolean,false)=false then 'BLOCKED_NO_VALID_EFFECTIVE_ROUTE'
                    when coalesce(s.effective_step_count,0)=0 then 'BLOCKED_NO_EFFECTIVE_ROUTE_STEPS'
                    when r.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER'
                    else 'READY' end foundation_status,
               case when r.monthly_product_base_qty is null or r.monthly_product_base_qty<=0 then 'A positive governed monthly Product quantity is required. Commercial demand and approved internal-material demand are both eligible evidence.'
                    when r.monthly_driver_status='BLOCKED' then 'The exact-run monthly quantity driver is blocked.'
                    when b.batch_size_ref_id is null or b.preferred_batch_size is null or b.preferred_batch_size<=0 then 'An effective positive preferred batch size is mandatory.'
                    when coalesce((rc.route_validation->>'valid')::boolean,false)=false then 'A valid effective Product manufacturing route is mandatory.'
                    when coalesce(s.effective_step_count,0)=0 then 'The effective route contains no usable steps.'
                    when r.monthly_driver_status='REVIEW_REQUIRED' then 'The foundation is calculable but its commercial/internal quantity evidence requires review.'
                    else 'Shared standard batch-and-route foundation is ready using total manufacturing demand (commercial plus internal consumption).' end foundation_note
        from recipients r left join batch_ref b on b.product_id=r.product_id
        left join route_context rc on rc.product_id=r.product_id
        left join step_context s on s.product_id=r.product_id
        where p_route_family_id is null or rc.route_family_id=p_route_family_id
    )
    select jsonb_build_object(
      'preview_only',true,'records_created',0,'monetary_allocation_created',false,'stage03_cutover_status','NOT_AUTHORISED_BY_THIS_GATE',
      'period_start',v_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'route_family_id',p_route_family_id,
      'readiness_rule',jsonb_build_object(
        'existing_sku','Governed total manufacturing demand is commercial monthly demand plus approved internal-material demand; effective preferred batch size is mandatory.',
        'manufacturing_only_internal_source','Approved downstream internal-material demand, effective preferred batch size and effective route are mandatory.',
        'bmr_dependency',false,'forecast_dependency',false,'daily_work_log_dependency',false),
      'summary',jsonb_build_object(
        'recipient_product_count',count(*),'ready_count',count(*) filter(where foundation_status='READY'),
        'review_required_count',count(*) filter(where foundation_status like 'REVIEW_REQUIRED%'),'blocked_count',count(*) filter(where foundation_status like 'BLOCKED%'),
        'products_using_actual_sales_only',count(*) filter(where actual_source_sku_count>0 and assumption_source_sku_count=0 and default_source_sku_count=0),
        'products_using_assumption',count(*) filter(where assumption_source_sku_count>0),'products_using_default_policy',count(*) filter(where default_source_sku_count>0),
        'total_standard_batch_count',sum(standard_batch_count) filter(where foundation_status in ('READY','REVIEW_REQUIRED_MONTHLY_QUANTITY_DRIVER'))),
      'status_counts',coalesce((select jsonb_object_agg(foundation_status,cnt) from (select foundation_status,count(*) cnt from rows group by foundation_status)x),'{}'::jsonb),
      'rows',coalesce(jsonb_agg(to_jsonb(rows) order by product_name,product_id),'[]'::jsonb)
    ) into v_result from rows;
    return v_result;
end;
$function$
