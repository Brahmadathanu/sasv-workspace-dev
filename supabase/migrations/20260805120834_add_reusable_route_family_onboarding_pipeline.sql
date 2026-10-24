-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_validate_route_family_onboarding_package(
  p_family jsonb,
  p_route jsonb,
  p_steps jsonb
) returns jsonb
language plpgsql
stable security definer
set search_path=costing,public,pg_temp
as $$
declare
  v_errors jsonb:='[]'::jsonb;
  v_family_allowed constant text[]:=array['family_code','family_name','effective_from','description','supersedes_family_id'];
  v_route_allowed constant text[]:=array['route_name','effective_from','source_type','evidence_status','route_note','supersedes_route_id'];
  v_step_allowed constant text[]:=array['step_key','sequence_no','activity_id','cost_centre_id','section_id','subsection_id','area_id','plant_id','behaviour_code','resource_class_code','route_step_scope','expected_occurrence_count','standard_cycle_count','is_mandatory','allows_repeat','allows_skip_with_approval','production_overhead_scope','direct_labour_scope','step_note'];
  v_unknown text[];
  v_step jsonb;
  v_idx integer:=0;
  v_rm integer:=0;
  v_fg integer:=0;
  v_prod integer:=0;
begin
  if p_family is null or jsonb_typeof(p_family)<>'object' then
    v_errors:=v_errors||jsonb_build_array('FAMILY_OBJECT_REQUIRED');
  else
    select array_agg(k order by k) into v_unknown from jsonb_object_keys(p_family) k where not(k=any(v_family_allowed));
    if coalesce(cardinality(v_unknown),0)>0 then v_errors:=v_errors||jsonb_build_array('UNSUPPORTED_FAMILY_KEYS:'||array_to_string(v_unknown,',')); end if;
    if nullif(btrim(p_family->>'family_code'),'') is null then v_errors:=v_errors||jsonb_build_array('FAMILY_CODE_REQUIRED'); end if;
    if nullif(btrim(p_family->>'family_name'),'') is null then v_errors:=v_errors||jsonb_build_array('FAMILY_NAME_REQUIRED'); end if;
    if p_family ? 'effective_from' and nullif(btrim(p_family->>'effective_from'),'') is null then v_errors:=v_errors||jsonb_build_array('FAMILY_EFFECTIVE_FROM_BLANK'); end if;
  end if;

  if p_route is null or jsonb_typeof(p_route)<>'object' then
    v_errors:=v_errors||jsonb_build_array('ROUTE_OBJECT_REQUIRED');
  else
    select array_agg(k order by k) into v_unknown from jsonb_object_keys(p_route) k where not(k=any(v_route_allowed));
    if coalesce(cardinality(v_unknown),0)>0 then v_errors:=v_errors||jsonb_build_array('UNSUPPORTED_ROUTE_KEYS:'||array_to_string(v_unknown,',')); end if;
    if nullif(btrim(p_route->>'route_name'),'') is null then v_errors:=v_errors||jsonb_build_array('ROUTE_NAME_REQUIRED'); end if;
    if upper(coalesce(nullif(btrim(p_route->>'source_type'),''),'MANUAL')) not in ('MANUAL','HISTORICAL_CANDIDATE','COPIED_VERSION') then v_errors:=v_errors||jsonb_build_array('INVALID_ROUTE_SOURCE_TYPE'); end if;
    if upper(coalesce(nullif(btrim(p_route->>'evidence_status'),''),'MANUAL_COMPLETE')) not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE','PARTIAL_EVIDENCE','NO_EVIDENCE') then v_errors:=v_errors||jsonb_build_array('INVALID_ROUTE_EVIDENCE_STATUS'); end if;
  end if;

  if p_steps is null or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps)=0 then
    v_errors:=v_errors||jsonb_build_array('NONEMPTY_STEPS_ARRAY_REQUIRED');
  else
    for v_step in select value from jsonb_array_elements(p_steps) loop
      v_idx:=v_idx+1;
      if jsonb_typeof(v_step)<>'object' then
        v_errors:=v_errors||jsonb_build_array(format('STEP_%s_OBJECT_REQUIRED',v_idx));
        continue;
      end if;
      select array_agg(k order by k) into v_unknown from jsonb_object_keys(v_step) k where not(k=any(v_step_allowed));
      if coalesce(cardinality(v_unknown),0)>0 then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_UNSUPPORTED_KEYS:%s',v_idx,array_to_string(v_unknown,','))); end if;
      if nullif(btrim(v_step->>'step_key'),'') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_KEY_REQUIRED',v_idx)); end if;
      if nullif(v_step->>'sequence_no','') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_SEQUENCE_REQUIRED',v_idx)); end if;
      if nullif(v_step->>'activity_id','') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_ACTIVITY_REQUIRED',v_idx)); end if;
      if nullif(v_step->>'cost_centre_id','') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_COST_CENTRE_REQUIRED',v_idx)); end if;
      if nullif(v_step->>'section_id','') is null or nullif(v_step->>'subsection_id','') is null or nullif(v_step->>'area_id','') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_LOCATION_REQUIRED',v_idx)); end if;
      if nullif(btrim(v_step->>'behaviour_code'),'') is null or nullif(btrim(v_step->>'resource_class_code'),'') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_DRIVER_CLASS_REQUIRED',v_idx)); end if;
      if nullif(btrim(v_step->>'route_step_scope'),'') is null then v_errors:=v_errors||jsonb_build_array(format('STEP_%s_SCOPE_REQUIRED',v_idx)); end if;
      if v_step->>'route_step_scope'='BOUNDARY_RM_ISSUE' then v_rm:=v_rm+1; end if;
      if v_step->>'route_step_scope'='BOUNDARY_FG_TRANSFER' then v_fg:=v_fg+1; end if;
      if v_step->>'route_step_scope'='PRODUCTION_PROCESS' then v_prod:=v_prod+1; end if;
    end loop;
    if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('PACKAGE_REQUIRES_EXACTLY_ONE_RM_BOUNDARY'); end if;
    if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('PACKAGE_REQUIRES_EXACTLY_ONE_FG_BOUNDARY'); end if;
    if v_prod<1 then v_errors:=v_errors||jsonb_build_array('PACKAGE_REQUIRES_PRODUCTION_PROCESS_STEP'); end if;
    if exists(select 1 from (select value->>'step_key' k,count(*) c from jsonb_array_elements(p_steps) group by 1 having count(*)>1)x) then v_errors:=v_errors||jsonb_build_array('DUPLICATE_STEP_KEY'); end if;
    if exists(select 1 from (select (value->>'sequence_no')::numeric n,count(*) c from jsonb_array_elements(p_steps) group by 1 having count(*)>1)x) then v_errors:=v_errors||jsonb_build_array('DUPLICATE_STEP_SEQUENCE'); end if;
  end if;

  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',case when jsonb_typeof(p_steps)='array' then jsonb_array_length(p_steps) else 0 end);
exception when others then
  return jsonb_build_object('valid',false,'errors',v_errors||jsonb_build_array('PACKAGE_TYPE_VALIDATION_ERROR:'||sqlerrm));
end$$;

create or replace function public.rpc_create_route_family_onboarding_draft(
  p_family jsonb,
  p_route jsonb,
  p_steps jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare
  v_validation jsonb;
  v_family_id bigint;
  v_route_id bigint;
  v_version integer;
  v_route_code text;
  v_step jsonb;
begin
  perform public.require_permission('module:production-route-manager',true);
  v_validation:=costing.fn_validate_route_family_onboarding_package(p_family,p_route,p_steps);
  if not coalesce((v_validation->>'valid')::boolean,false) then raise exception 'Invalid Route Family onboarding package: %',v_validation->'errors'; end if;

  insert into costing.production_route_family(family_code,family_name,effective_from,description,supersedes_family_id,created_by)
  values(upper(btrim(p_family->>'family_code')),btrim(p_family->>'family_name'),nullif(p_family->>'effective_from','')::date,nullif(btrim(p_family->>'description'),''),nullif(p_family->>'supersedes_family_id','')::bigint,auth.uid())
  returning id into v_family_id;

  v_version:=1;
  v_route_code:=upper(btrim(p_family->>'family_code'))||'_ROUTE';
  insert into costing.production_route_family_route(route_family_id,route_code,route_version,route_name,effective_from,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(v_family_id,v_route_code,v_version,btrim(p_route->>'route_name'),coalesce(nullif(p_route->>'effective_from','')::date,nullif(p_family->>'effective_from','')::date),upper(coalesce(nullif(btrim(p_route->>'source_type'),''),'MANUAL')),upper(coalesce(nullif(btrim(p_route->>'evidence_status'),''),'MANUAL_COMPLETE')),nullif(btrim(p_route->>'route_note'),''),nullif(p_route->>'supersedes_route_id','')::bigint,auth.uid())
  returning id into v_route_id;

  for v_step in select value from jsonb_array_elements(p_steps) loop
    insert into costing.production_route_family_route_step(
      family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
      behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,
      is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note,created_by
    ) values(
      v_route_id,upper(btrim(v_step->>'step_key')),(v_step->>'sequence_no')::numeric,(v_step->>'activity_id')::integer,(v_step->>'cost_centre_id')::bigint,
      (v_step->>'section_id')::integer,(v_step->>'subsection_id')::integer,(v_step->>'area_id')::integer,nullif(v_step->>'plant_id','')::integer,
      upper(btrim(v_step->>'behaviour_code')),upper(btrim(v_step->>'resource_class_code')),upper(btrim(v_step->>'route_step_scope')),
      coalesce(nullif(v_step->>'expected_occurrence_count','')::numeric,1),coalesce(nullif(v_step->>'standard_cycle_count','')::numeric,1),
      coalesce((v_step->>'is_mandatory')::boolean,true),coalesce((v_step->>'allows_repeat')::boolean,false),coalesce((v_step->>'allows_skip_with_approval')::boolean,false),
      upper(coalesce(nullif(btrim(v_step->>'production_overhead_scope'),''),'INCLUDE')),upper(coalesce(nullif(btrim(v_step->>'direct_labour_scope'),''),'INCLUDE')),
      nullif(btrim(v_step->>'step_note'),''),auth.uid()
    );
  end loop;

  return jsonb_build_object(
    'route_family_id',v_family_id,'family_route_id',v_route_id,'route_version',v_version,
    'family_status','DRAFT','route_status','DRAFT','validation',costing.fn_validate_route_family_route(v_route_id),
    'next_actions',jsonb_build_array('APPROVE_ROUTE_FAMILY','SUBMIT_ROUTE_FOR_REVIEW','APPROVE_ROUTE','ASSIGN_PRODUCTS_OR_PRODUCT_GROUPS')
  );
end$$;

create or replace function public.rpc_clone_route_family_route_draft(
  p_source_family_route_id bigint,
  p_effective_from date,
  p_route_name text default null,
  p_route_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare
  v_source costing.production_route_family_route%rowtype;
  v_id bigint;
  v_version integer;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into v_source from costing.production_route_family_route where id=p_source_family_route_id and status in ('APPROVED','SUPERSEDED','INACTIVE');
  if not found then raise exception 'Source Route Family route must be an approved historical version'; end if;
  if p_effective_from is null then raise exception 'effective_from is required'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.production_route_family_route where route_family_id=v_source.route_family_id;
  insert into costing.production_route_family_route(route_family_id,route_code,route_version,route_name,effective_from,source_type,evidence_status,route_note,supersedes_route_id,created_by)
  values(v_source.route_family_id,v_source.route_code,v_version,coalesce(nullif(btrim(p_route_name),''),v_source.route_name),p_effective_from,'COPIED_VERSION',v_source.evidence_status,coalesce(nullif(btrim(p_route_note),''),'Copied from Route Family route '||p_source_family_route_id),p_source_family_route_id,auth.uid())
  returning id into v_id;
  insert into costing.production_route_family_route_step(family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note,created_by)
  select v_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note,auth.uid()
  from costing.production_route_family_route_step where family_route_id=p_source_family_route_id order by sequence_no,id;
  return jsonb_build_object('family_route_id',v_id,'route_family_id',v_source.route_family_id,'route_version',v_version,'status','DRAFT','validation',costing.fn_validate_route_family_route(v_id));
end$$;

create or replace function costing.fn_route_family_onboarding_status(
  p_route_family_id bigint,
  p_period_start date default null,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
) returns jsonb
language plpgsql
stable security definer
set search_path=costing,public,pg_temp
as $$
declare
  v_family costing.production_route_family%rowtype;
  v_route costing.production_route_family_route%rowtype;
  v_recipient_count integer;
  v_family_recipient_count integer;
  v_valid_count integer;
  v_assignments integer;
  v_group_maps integer;
begin
  select * into v_family from costing.production_route_family where id=p_route_family_id;
  if not found then raise exception 'Route Family % not found',p_route_family_id; end if;
  select * into v_route from costing.production_route_family_route where route_family_id=p_route_family_id order by route_version desc,id desc limit 1;
  select count(*) into v_assignments from costing.production_route_family_product_map where route_family_id=p_route_family_id and status in ('DRAFT','IN_REVIEW','APPROVED');
  select count(*) into v_group_maps from costing.production_route_family_product_group_map where route_family_id=p_route_family_id and status in ('DRAFT','IN_REVIEW','APPROVED');
  if p_refresh_run_id is not null then
    if p_period_start is null or p_valuation_date is null then raise exception 'period_start and valuation_date are required with refresh_run_id'; end if;
    with r as (select * from costing.fn_costing_recipient_products(p_period_start,p_valuation_date,p_refresh_run_id))
    select count(*),count(*) filter(where costing.fn_resolve_route_family_for_product(product_id::integer,p_valuation_date)=p_route_family_id),count(*) filter(where costing.fn_resolve_route_family_for_product(product_id::integer,p_valuation_date)=p_route_family_id and coalesce((costing.fn_validate_effective_product_process_route(product_id::integer,p_valuation_date)->>'valid')::boolean,false))
    into v_recipient_count,v_family_recipient_count,v_valid_count from r;
  end if;
  return jsonb_build_object(
    'route_family',to_jsonb(v_family),
    'latest_route',case when v_route.id is null then null else to_jsonb(v_route) end,
    'latest_route_validation',case when v_route.id is null then null else costing.fn_validate_route_family_route(v_route.id) end,
    'product_assignment_count',v_assignments,
    'product_group_mapping_count',v_group_maps,
    'recipient_context',case when p_refresh_run_id is null then null else jsonb_build_object('period_start',date_trunc('month',p_period_start)::date,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'company_recipient_count',v_recipient_count,'family_recipient_count',v_family_recipient_count,'valid_effective_route_count',v_valid_count,'family_recipient_coverage_ratio',v_valid_count::numeric/nullif(v_family_recipient_count,0)) end,
    'architecture_stage',case
      when v_family.status<>'APPROVED' then 'FAMILY_APPROVAL_PENDING'
      when v_route.id is null then 'ROUTE_DRAFT_REQUIRED'
      when v_route.status='DRAFT' then 'ROUTE_REVIEW_PENDING'
      when v_route.status='REVIEW_REQUIRED' then 'ROUTE_APPROVAL_PENDING'
      when v_route.status='APPROVED' and v_assignments+v_group_maps=0 then 'ASSIGNMENT_PENDING'
      when v_route.status='APPROVED' then 'ONBOARDING_ACTIVE'
      else 'ROUTE_VERSION_NOT_ACTIVE' end,
    'data_quality_gate_status','DEFERRED_UNTIL_PIPELINE_COMPLETE'
  );
end$$;

create or replace function public.rpc_get_route_family_onboarding_status(
  p_route_family_id bigint,
  p_period_start date default null,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_route_family_onboarding_status(p_route_family_id,p_period_start,p_valuation_date,p_refresh_run_id);
end$$;

grant execute on function public.rpc_create_route_family_onboarding_draft(jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.rpc_clone_route_family_route_draft(bigint,date,text,text) to authenticated;
grant execute on function public.rpc_get_route_family_onboarding_status(bigint,date,date,bigint) to authenticated;
revoke all on function costing.fn_validate_route_family_onboarding_package(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function costing.fn_route_family_onboarding_status(bigint,date,date,bigint) from public,anon,authenticated;