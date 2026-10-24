-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_preview_product_process_route_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public'
as $function$
declare
  v_product jsonb;
  v_family_id bigint;
  v_family_route_id bigint;
  v_family jsonb;
  v_comparison jsonb;
  v_eligible_batches integer;
begin
  v_product := costing.fn_preview_product_process_route_evidence(p_product_id,p_as_of_date,p_lookback_months);
  v_eligible_batches := coalesce((v_product->'summary'->>'eligible_batches')::integer,0);
  v_family_id := costing.fn_resolve_route_family_for_product(p_product_id::integer,p_as_of_date);

  if v_family_id is null then
    return v_product || jsonb_build_object(
      'route_family_context',jsonb_build_object('status','NO_APPROVED_ROUTE_FAMILY_MAPPING'),
      'family_comparison','[]'::jsonb
    );
  end if;

  v_family_route_id := costing.fn_resolve_effective_route_family_route(p_product_id::integer,p_as_of_date);
  if v_family_route_id is null then
    return v_product || jsonb_build_object(
      'route_family_context',jsonb_build_object('status','NO_APPROVED_ROUTE_FAMILY_ROUTE','route_family_id',v_family_id),
      'family_comparison','[]'::jsonb
    );
  end if;

  v_family := costing.fn_preview_route_family_candidate(v_family_id,null,p_as_of_date,p_lookback_months);

  with product_kind as (
    select
      x->>'activity_kind_id' activity_kind_id,
      max(x->>'activity_short_code') activity_short_code,
      max(x->>'activity_kind_name') activity_kind_name,
      max((x->>'batch_coverage')::numeric) product_batch_coverage,
      max(case x->>'evidence_class'
        when 'CORE_EVIDENCE' then 4
        when 'COMMON_EVIDENCE' then 3
        when 'OCCASIONAL_EVIDENCE' then 2
        when 'EXCEPTION_EVIDENCE' then 1
        else 0 end) evidence_rank,
      (array_agg((x->>'area_id')::integer order by (x->>'batch_coverage')::numeric desc,(x->>'area_id')::integer))[1] modal_area_id,
      (array_agg(nullif(x->>'plant_id','')::integer order by (x->>'batch_coverage')::numeric desc,(x->>'area_id')::integer))[1] modal_plant_id
    from jsonb_array_elements(v_product->'candidate_steps') x
    group by x->>'activity_kind_id'
  ), approved_family_kind as (
    select
      ak.id::text activity_kind_id,
      max(ak.short_code) activity_short_code,
      max(ak.name) activity_kind_name,
      min(s.area_id) approved_area_id,
      case when count(distinct s.area_id)=1 then min(s.area_id) else null end governed_area_id,
      case when count(distinct s.plant_id) filter(where s.plant_id is not null)=1
           and count(*) filter(where s.plant_id is null)=0
        then min(s.plant_id) filter(where s.plant_id is not null)
        else null end governed_plant_id,
      bool_or(s.is_mandatory) is_mandatory,
      jsonb_agg(jsonb_build_object(
        'base_step_id',s.id,
        'step_key',s.step_key,
        'sequence_no',s.sequence_no,
        'area_id',s.area_id,
        'plant_id',s.plant_id,
        'resource_class_code',s.resource_class_code,
        'route_step_scope',s.route_step_scope
      ) order by s.sequence_no,s.id) approved_steps
    from costing.production_route_family_route_step s
    join public.activities a on a.id=s.activity_id
    join public.activity_kinds ak on ak.id=a.kind_id
    where s.family_route_id=v_family_route_id
    group by ak.id
  ), cmp as (
    select
      coalesce(pk.activity_kind_id,fk.activity_kind_id) activity_kind_id,
      coalesce(pk.activity_short_code,fk.activity_short_code) activity_short_code,
      coalesce(pk.activity_kind_name,fk.activity_kind_name) activity_kind_name,
      pk.product_batch_coverage,
      case pk.evidence_rank
        when 4 then 'CORE_EVIDENCE'
        when 3 then 'COMMON_EVIDENCE'
        when 2 then 'OCCASIONAL_EVIDENCE'
        when 1 then 'EXCEPTION_EVIDENCE'
        else 'NO_EVIDENCE' end product_evidence_class,
      pk.modal_area_id product_modal_area_id,
      fk.governed_area_id family_governed_area_id,
      pk.modal_plant_id product_modal_plant_id,
      fk.governed_plant_id family_governed_plant_id,
      fk.is_mandatory family_step_mandatory,
      fk.approved_steps family_approved_steps,
      case
        when fk.activity_kind_id is null and pk.evidence_rank>=3 then 'ADD_STEP_CANDIDATE'
        when fk.activity_kind_id is null and pk.evidence_rank=1 then 'INFORMATIONAL_EXCEPTION_LOGGING'
        when fk.activity_kind_id is not null and pk.activity_kind_id is null and v_eligible_batches>=3 and fk.is_mandatory then 'REVIEW_MISSING_APPROVED_STEP'
        when fk.activity_kind_id is not null and pk.evidence_rank>=3
          and fk.governed_area_id is not null
          and pk.modal_area_id is distinct from fk.governed_area_id then 'LOCATION_OVERRIDE_CANDIDATE'
        when fk.activity_kind_id is not null and pk.evidence_rank>=3
          and fk.governed_plant_id is not null
          and pk.modal_plant_id is distinct from fk.governed_plant_id then 'RESOURCE_OVERRIDE_CANDIDATE'
        when pk.evidence_rank=1 then 'INFORMATIONAL_EXCEPTION_LOGGING'
        else 'ALIGNED_OR_NO_DELTA'
      end delta_suggestion
    from product_kind pk
    full join approved_family_kind fk on fk.activity_kind_id=pk.activity_kind_id
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by c.activity_kind_name),'[]'::jsonb)
  into v_comparison
  from cmp c;

  return v_product || jsonb_build_object(
    'route_family_context',jsonb_build_object(
      'status','APPROVED_ROUTE_FAMILY_ROUTE',
      'route_family_id',v_family_id,
      'family_route_id',v_family_route_id,
      'route_family',v_family->'route_family',
      'summary',v_family->'summary'
    ),
    'family_comparison',v_comparison
  );
end
$function$;

create or replace function costing.fn_preview_product_route_delta_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public'
as $function$
declare
  v_product jsonb;
  v_candidates jsonb;
  v_eligible_batches integer;
  v_add integer;
  v_location integer;
  v_resource integer;
  v_missing integer;
  v_info integer;
  v_review_class text;
begin
  v_product := costing.fn_preview_product_process_route_candidate(p_product_id,p_as_of_date,p_lookback_months);
  v_candidates := coalesce(v_product->'family_comparison','[]'::jsonb);
  v_eligible_batches := coalesce((v_product->'summary'->>'eligible_batches')::integer,0);

  select
    count(*) filter(where x->>'delta_suggestion'='ADD_STEP_CANDIDATE'),
    count(*) filter(where x->>'delta_suggestion'='LOCATION_OVERRIDE_CANDIDATE'),
    count(*) filter(where x->>'delta_suggestion'='RESOURCE_OVERRIDE_CANDIDATE'),
    count(*) filter(where x->>'delta_suggestion'='REVIEW_MISSING_APPROVED_STEP'),
    count(*) filter(where x->>'delta_suggestion'='INFORMATIONAL_EXCEPTION_LOGGING')
  into v_add,v_location,v_resource,v_missing,v_info
  from jsonb_array_elements(v_candidates) x;

  v_review_class := case
    when v_eligible_batches < 3 then 'INSUFFICIENT_EVIDENCE'
    when coalesce(v_missing,0)>0 then 'REVIEW_MISSING_APPROVED_STEP'
    when coalesce(v_add,0)>0 then 'REVIEW_ADDITIONAL_STEP'
    when coalesce(v_location,0)>0 then 'REVIEW_LOCATION_OVERRIDE'
    when coalesce(v_resource,0)>0 then 'REVIEW_RESOURCE_OVERRIDE'
    else 'NO_DELTA_REQUIRED'
  end;

  return jsonb_build_object(
    'product',v_product->'product',
    'product_candidate_summary',v_product->'summary',
    'route_family_context',v_product->'route_family_context',
    'delta_candidates',v_candidates,
    'delta_summary',jsonb_build_object(
      'review_class',v_review_class,
      'eligible_batches',v_eligible_batches,
      'add_step_candidate_count',coalesce(v_add,0),
      'location_override_candidate_count',coalesce(v_location,0),
      'resource_override_candidate_count',coalesce(v_resource,0),
      'missing_approved_step_count',coalesce(v_missing,0),
      'informational_exception_count',coalesce(v_info,0),
      'requires_product_route',v_review_class in ('REVIEW_MISSING_APPROVED_STEP','REVIEW_ADDITIONAL_STEP','REVIEW_LOCATION_OVERRIDE','REVIEW_RESOURCE_OVERRIDE')
    ),
    'approvable',false,
    'preview_only',true,
    'records_created',0,
    'approval_note','Delta proposals are review aids only. Product routes and overrides require explicit governed creation, validation and approval.'
  );
end
$function$;