-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_family_id bigint;
  v_v1_id bigint;
  v_v2_id bigint;
begin
  select id into v_family_id
  from costing.production_route_family
  where family_code='OIL_FORMULATIONS_REGULAR';

  if v_family_id is null then raise exception 'Oil Route Family not found'; end if;

  select id into v_v1_id
  from costing.production_route_family_route
  where route_family_id=v_family_id and route_version=1;

  select id into v_v2_id
  from costing.production_route_family_route
  where route_family_id=v_family_id and route_version=2;

  if v_v2_id is null then
    insert into costing.production_route_family_route(
      route_family_id,route_code,route_version,route_name,status,
      effective_from,effective_to,source_type,evidence_status,
      route_note,supersedes_route_id,created_by,created_at,updated_at
    ) values(
      v_family_id,'OIL_FORMULATIONS_REGULAR_ROUTE',2,
      'Oil Formulations - Regular Manufacturing Route','DRAFT',
      date '2026-07-01',null,'COPIED_VERSION','HISTORICAL_COMPLETE',
      'Version 2 preserves the approved Oil backbone and explicitly permits governed Product-level bypass of hydraulic oil recovery where the approved Product process does not require hydraulic recovery. Historical absence alone does not approve bypass; a Product route with meaningful justification remains mandatory.',
      v_v1_id,auth.uid(),now(),now()
    ) returning id into v_v2_id;

    insert into costing.production_route_family_route_step(
      family_route_id,step_key,sequence_no,activity_id,cost_centre_id,
      section_id,subsection_id,area_id,plant_id,behaviour_code,
      resource_class_code,route_step_scope,expected_occurrence_count,
      standard_cycle_count,is_mandatory,allows_repeat,
      allows_skip_with_approval,production_overhead_scope,
      direct_labour_scope,step_note,created_by,created_at,updated_at
    )
    select
      v_v2_id,s.step_key,s.sequence_no,s.activity_id,s.cost_centre_id,
      s.section_id,s.subsection_id,s.area_id,s.plant_id,s.behaviour_code,
      s.resource_class_code,s.route_step_scope,s.expected_occurrence_count,
      s.standard_cycle_count,s.is_mandatory,s.allows_repeat,
      case when s.step_key='HYDRAULIC_OIL_RECOVERY' then true else s.allows_skip_with_approval end,
      s.production_overhead_scope,s.direct_labour_scope,
      case when s.step_key='HYDRAULIC_OIL_RECOVERY'
        then 'Normal Oil-family step for hydraulic recovery of oil retained in kalkam or processed solids. May be bypassed only through an approved Product route when the Product process genuinely does not require hydraulic recovery.'
        else s.step_note end,
      auth.uid(),now(),now()
    from costing.production_route_family_route_step s
    where s.family_route_id=v_v1_id;

    if not coalesce((costing.fn_validate_route_family_route(v_v2_id)->>'valid')::boolean,false) then
      raise exception 'Oil Route Version 2 validation failed: %',costing.fn_validate_route_family_route(v_v2_id);
    end if;

    update costing.production_route_family_route
    set status='REVIEW_REQUIRED',updated_at=now()
    where id=v_v2_id and status='DRAFT';

    update costing.production_route_family_route
    set status='APPROVED',approval_reference='PRM-ROUTE-OIL_FORMULATIONS_REGULAR-V2-APP-20260701',
        approved_by=auth.uid(),approved_at=now(),updated_at=now()
    where id=v_v2_id and status='REVIEW_REQUIRED';
  end if;

  update costing.production_route_family_route
  set status='SUPERSEDED',effective_to=date '2026-07-01',updated_at=now()
  where id=v_v1_id and status='APPROVED';
end$$;

create or replace function public.rpc_upsert_product_route_override(
  p_product_route_id bigint,
  p_override_id bigint default null,
  p_override jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing'
as $function$
declare
  r costing.product_process_route%rowtype;
  v_id bigint;
  v_op text;
  v_base_step_id bigint;
  v_override_reason text;
  v_base_allows_skip boolean;
  v_base_family_route_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into r from costing.product_process_route where id=p_product_route_id for update;
  if not found then raise exception 'Product route % not found',p_product_route_id; end if;
  if r.status not in('DRAFT','REVIEW_REQUIRED','REJECTED') then raise exception 'Route status % is not editable',r.status; end if;

  v_op:=upper(nullif(btrim(p_override->>'operation_type'),''));
  v_override_reason:=nullif(btrim(p_override->>'override_reason'),'');

  if p_override_id is null then
    v_base_step_id:=nullif(p_override->>'base_step_id','')::bigint;
  else
    select coalesce(nullif(p_override->>'base_step_id','')::bigint,o.base_step_id),
           coalesce(v_op,o.operation_type),coalesce(v_override_reason,o.override_reason)
    into v_base_step_id,v_op,v_override_reason
    from costing.product_process_route_override o
    where o.id=p_override_id and o.product_route_id=p_product_route_id;
    if not found then raise exception 'Override % not found',p_override_id; end if;
  end if;

  if v_op='BYPASS_STEP' then
    if v_base_step_id is null then raise exception 'BYPASS_STEP requires a base step'; end if;
    if v_override_reason is null then raise exception 'BYPASS_STEP requires a meaningful Product-specific reason'; end if;
    select s.allows_skip_with_approval,s.family_route_id
    into v_base_allows_skip,v_base_family_route_id
    from costing.production_route_family_route_step s where s.id=v_base_step_id;
    if v_base_family_route_id is null then raise exception 'Base Route Family step % not found',v_base_step_id; end if;
    if v_base_family_route_id<>r.base_route_family_route_id then raise exception 'Bypass step does not belong to the Product route base family route'; end if;
    if not coalesce(v_base_allows_skip,false) then raise exception 'Base Route Family step % does not permit approved bypass',v_base_step_id; end if;
  end if;

  if p_override_id is null then
    insert into costing.product_process_route_override(
      product_route_id,operation_type,base_step_id,override_step_key,sequence_no,activity_id,cost_centre_id,
      section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,route_step_scope,
      expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,
      production_overhead_scope,direct_labour_scope,override_reason,created_by
    ) values(
      p_product_route_id,v_op,v_base_step_id,nullif(btrim(p_override->>'override_step_key'),''),
      nullif(p_override->>'sequence_no','')::numeric,nullif(p_override->>'activity_id','')::integer,
      nullif(p_override->>'cost_centre_id','')::bigint,nullif(p_override->>'section_id','')::integer,
      nullif(p_override->>'subsection_id','')::integer,nullif(p_override->>'area_id','')::integer,
      nullif(p_override->>'plant_id','')::integer,nullif(p_override->>'behaviour_code',''),
      nullif(p_override->>'resource_class_code',''),nullif(p_override->>'route_step_scope',''),
      nullif(p_override->>'expected_occurrence_count','')::numeric,nullif(p_override->>'standard_cycle_count','')::numeric,
      case when p_override ? 'is_mandatory' then (p_override->>'is_mandatory')::boolean end,
      case when p_override ? 'allows_repeat' then (p_override->>'allows_repeat')::boolean end,
      case when p_override ? 'allows_skip_with_approval' then (p_override->>'allows_skip_with_approval')::boolean end,
      nullif(p_override->>'production_overhead_scope',''),nullif(p_override->>'direct_labour_scope',''),
      v_override_reason,auth.uid()
    ) returning id into v_id;
  else
    update costing.product_process_route_override set
      operation_type=coalesce(v_op,operation_type),
      base_step_id=case when p_override ? 'base_step_id' then v_base_step_id else base_step_id end,
      override_step_key=case when p_override ? 'override_step_key' then nullif(btrim(p_override->>'override_step_key'),'') else override_step_key end,
      sequence_no=case when p_override ? 'sequence_no' then nullif(p_override->>'sequence_no','')::numeric else sequence_no end,
      activity_id=case when p_override ? 'activity_id' then nullif(p_override->>'activity_id','')::integer else activity_id end,
      cost_centre_id=case when p_override ? 'cost_centre_id' then nullif(p_override->>'cost_centre_id','')::bigint else cost_centre_id end,
      section_id=case when p_override ? 'section_id' then nullif(p_override->>'section_id','')::integer else section_id end,
      subsection_id=case when p_override ? 'subsection_id' then nullif(p_override->>'subsection_id','')::integer else subsection_id end,
      area_id=case when p_override ? 'area_id' then nullif(p_override->>'area_id','')::integer else area_id end,
      plant_id=case when p_override ? 'plant_id' then nullif(p_override->>'plant_id','')::integer else plant_id end,
      behaviour_code=case when p_override ? 'behaviour_code' then nullif(p_override->>'behaviour_code','') else behaviour_code end,
      resource_class_code=case when p_override ? 'resource_class_code' then nullif(p_override->>'resource_class_code','') else resource_class_code end,
      route_step_scope=case when p_override ? 'route_step_scope' then nullif(p_override->>'route_step_scope','') else route_step_scope end,
      expected_occurrence_count=case when p_override ? 'expected_occurrence_count' then nullif(p_override->>'expected_occurrence_count','')::numeric else expected_occurrence_count end,
      standard_cycle_count=case when p_override ? 'standard_cycle_count' then nullif(p_override->>'standard_cycle_count','')::numeric else standard_cycle_count end,
      is_mandatory=case when p_override ? 'is_mandatory' then (p_override->>'is_mandatory')::boolean else is_mandatory end,
      allows_repeat=case when p_override ? 'allows_repeat' then (p_override->>'allows_repeat')::boolean else allows_repeat end,
      allows_skip_with_approval=case when p_override ? 'allows_skip_with_approval' then (p_override->>'allows_skip_with_approval')::boolean else allows_skip_with_approval end,
      production_overhead_scope=case when p_override ? 'production_overhead_scope' then nullif(p_override->>'production_overhead_scope','') else production_overhead_scope end,
      direct_labour_scope=case when p_override ? 'direct_labour_scope' then nullif(p_override->>'direct_labour_scope','') else direct_labour_scope end,
      override_reason=coalesce(v_override_reason,override_reason),updated_at=now()
    where id=p_override_id returning id into v_id;
  end if;

  update costing.product_process_route set status='DRAFT',updated_at=now()
  where id=p_product_route_id and status in('REVIEW_REQUIRED','REJECTED');
  return public.rpc_get_product_route_detail(p_product_route_id);
end;
$function$;