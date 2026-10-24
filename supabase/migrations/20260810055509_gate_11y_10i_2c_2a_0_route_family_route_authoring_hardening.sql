-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_as_of date;
begin
  select * into v_route
  from costing.production_route_family_route
  where id=p_family_route_id;

  if not found then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ROUTE_FAMILY_ROUTE_NOT_FOUND'));
  end if;

  v_as_of := coalesce(v_route.effective_from,current_date);

  select count(*),
         count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE'),
         count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),
         count(*) filter(where route_step_scope='PRODUCTION_PROCESS')
  into v_steps,v_rm,v_fg,v_prod
  from costing.production_route_family_route_step
  where family_route_id=p_family_route_id;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;

  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then
    v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE');
  end if;

  if exists(
    select 1
    from costing.production_route_family_route_step s
    join public.subsections ss on ss.id=s.subsection_id
    join public.areas a on a.id=s.area_id
    left join public.plant_machinery pm on pm.id=s.plant_id
    where s.family_route_id=p_family_route_id
      and (
        ss.section_id is distinct from s.section_id
        or a.section_id is distinct from s.section_id
        or a.subsection_id is distinct from s.subsection_id
        or (s.plant_id is not null and (
          pm.section_id is distinct from s.section_id
          or pm.subsection_id is distinct from s.subsection_id
          or pm.area_id is distinct from s.area_id
        ))
      )
  ) then
    v_errors:=v_errors||jsonb_build_array('STEP_LOCATION_HIERARCHY_MISMATCH');
  end if;

  if exists(
    select 1
    from costing.production_route_family_route_step s
    join public.activities a on a.id=s.activity_id
    where s.family_route_id=p_family_route_id
      and (
        a.section_id is distinct from s.section_id
        or a.sub_section_id is distinct from s.subsection_id
        or a.area_id is distinct from s.area_id
      )
  ) then
    v_errors:=v_errors||jsonb_build_array('ACTIVITY_LOCATION_MISMATCH');
  end if;

  if exists(
    select 1
    from costing.production_route_family_route_step s
    join costing.production_cost_centre cc on cc.id=s.cost_centre_id
    where s.family_route_id=p_family_route_id
      and (
        cc.status<>'APPROVED'
        or cc.effective_from>v_as_of
        or (cc.effective_to is not null and cc.effective_to<v_as_of)
      )
  ) then
    v_errors:=v_errors||jsonb_build_array('COST_CENTRE_NOT_APPROVED_OR_EFFECTIVE');
  end if;

  if exists(
    select 1
    from costing.production_route_family_route_step s
    left join costing.production_route_behaviour b on b.code=s.behaviour_code
    left join costing.production_resource_class rc on rc.code=s.resource_class_code
    where s.family_route_id=p_family_route_id
      and (coalesce(b.is_active,false)=false or coalesce(rc.is_active,false)=false)
  ) then
    v_errors:=v_errors||jsonb_build_array('INACTIVE_BEHAVIOUR_OR_RESOURCE_CLASS');
  end if;

  if exists(
    select 1
    from costing.production_route_family_route_step s
    join costing.production_cost_centre cc on cc.id=s.cost_centre_id
    where s.family_route_id=p_family_route_id
      and cc.pool_scope='EXCLUDED_OTHER_POOL'
      and (s.production_overhead_scope<>'EXCLUDE_OTHER_POOL' or s.direct_labour_scope<>'EXCLUDE_OTHER_POOL')
  ) then
    v_errors:=v_errors||jsonb_build_array('EXCLUDED_COST_CENTRE_REQUIRES_DL_AND_POH_EXCLUSION');
  end if;

  if exists(
    select 1
    from costing.production_route_family_route_step s
    where s.family_route_id=p_family_route_id
      and s.route_step_scope in ('QC_OTHER_POOL','STORES_OTHER_POOL','NON_PRODUCTION')
      and (s.production_overhead_scope<>'EXCLUDE_OTHER_POOL' or s.direct_labour_scope<>'EXCLUDE_OTHER_POOL')
  ) then
    v_errors:=v_errors||jsonb_build_array('OTHER_POOL_STEP_REQUIRES_DL_AND_POH_EXCLUSION');
  end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'step_count',v_steps,
    'rm_boundary_count',v_rm,
    'fg_boundary_count',v_fg,
    'production_step_count',v_prod,
    'validation_as_of',v_as_of
  );
end
$function$;

create or replace function public.rpc_upsert_route_family_route_step(
  p_family_route_id bigint,
  p_step_id bigint default null,
  p_step jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_status text;
  v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);

  select status into v_status
  from costing.production_route_family_route
  where id=p_family_route_id
  for update;

  if v_status not in ('DRAFT','REVIEW_REQUIRED') then
    raise exception 'Route Family route is read-only in status %',v_status;
  end if;

  if p_step_id is null then
    insert into costing.production_route_family_route_step(
      family_route_id,step_key,sequence_no,activity_id,cost_centre_id,
      section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,
      route_step_scope,expected_occurrence_count,standard_cycle_count,
      is_mandatory,allows_repeat,allows_skip_with_approval,
      production_overhead_scope,direct_labour_scope,step_note,created_by
    ) values(
      p_family_route_id,p_step->>'step_key',(p_step->>'sequence_no')::numeric,
      (p_step->>'activity_id')::integer,(p_step->>'cost_centre_id')::bigint,
      (p_step->>'section_id')::integer,(p_step->>'subsection_id')::integer,
      (p_step->>'area_id')::integer,nullif(p_step->>'plant_id','')::integer,
      p_step->>'behaviour_code',p_step->>'resource_class_code',p_step->>'route_step_scope',
      coalesce((p_step->>'expected_occurrence_count')::numeric,1),
      coalesce((p_step->>'standard_cycle_count')::numeric,1),
      coalesce((p_step->>'is_mandatory')::boolean,true),
      coalesce((p_step->>'allows_repeat')::boolean,false),
      coalesce((p_step->>'allows_skip_with_approval')::boolean,false),
      coalesce(p_step->>'production_overhead_scope','INCLUDE'),
      coalesce(p_step->>'direct_labour_scope','INCLUDE'),
      nullif(p_step->>'step_note',''),auth.uid()
    ) returning id into v_id;
  else
    update costing.production_route_family_route_step s set
      step_key=coalesce(p_step->>'step_key',s.step_key),
      sequence_no=coalesce((p_step->>'sequence_no')::numeric,s.sequence_no),
      activity_id=coalesce((p_step->>'activity_id')::integer,s.activity_id),
      cost_centre_id=coalesce((p_step->>'cost_centre_id')::bigint,s.cost_centre_id),
      section_id=coalesce((p_step->>'section_id')::integer,s.section_id),
      subsection_id=coalesce((p_step->>'subsection_id')::integer,s.subsection_id),
      area_id=coalesce((p_step->>'area_id')::integer,s.area_id),
      plant_id=case when p_step ? 'plant_id' then nullif(p_step->>'plant_id','')::integer else s.plant_id end,
      behaviour_code=coalesce(p_step->>'behaviour_code',s.behaviour_code),
      resource_class_code=coalesce(p_step->>'resource_class_code',s.resource_class_code),
      route_step_scope=coalesce(p_step->>'route_step_scope',s.route_step_scope),
      expected_occurrence_count=coalesce((p_step->>'expected_occurrence_count')::numeric,s.expected_occurrence_count),
      standard_cycle_count=coalesce((p_step->>'standard_cycle_count')::numeric,s.standard_cycle_count),
      is_mandatory=coalesce((p_step->>'is_mandatory')::boolean,s.is_mandatory),
      allows_repeat=coalesce((p_step->>'allows_repeat')::boolean,s.allows_repeat),
      allows_skip_with_approval=coalesce((p_step->>'allows_skip_with_approval')::boolean,s.allows_skip_with_approval),
      production_overhead_scope=coalesce(p_step->>'production_overhead_scope',s.production_overhead_scope),
      direct_labour_scope=coalesce(p_step->>'direct_labour_scope',s.direct_labour_scope),
      step_note=case when p_step ? 'step_note' then nullif(p_step->>'step_note','') else s.step_note end,
      updated_at=now()
    where s.id=p_step_id and s.family_route_id=p_family_route_id
    returning id into v_id;
  end if;

  if v_id is null then raise exception 'Route Family step not found'; end if;

  if v_status='REVIEW_REQUIRED' then
    update costing.production_route_family_route
    set status='DRAFT',updated_at=now()
    where id=p_family_route_id;
  end if;

  return jsonb_build_object(
    'step_id',v_id,
    'family_route_id',p_family_route_id,
    'route_status',case when v_status='REVIEW_REQUIRED' then 'DRAFT' else v_status end,
    'validation',costing.fn_validate_route_family_route(p_family_route_id)
  );
end
$function$;

create or replace function public.rpc_delete_route_family_route_step(
  p_family_route_id bigint,
  p_step_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_status text;
  v_deleted boolean;
begin
  perform public.require_permission('module:production-route-manager',true);

  select status into v_status
  from costing.production_route_family_route
  where id=p_family_route_id
  for update;

  if v_status not in ('DRAFT','REVIEW_REQUIRED') then
    raise exception 'Route Family route is read-only in status %',v_status;
  end if;

  delete from costing.production_route_family_route_step
  where id=p_step_id and family_route_id=p_family_route_id;
  v_deleted:=found;

  if v_deleted and v_status='REVIEW_REQUIRED' then
    update costing.production_route_family_route
    set status='DRAFT',updated_at=now()
    where id=p_family_route_id;
  end if;

  return jsonb_build_object(
    'deleted',v_deleted,
    'family_route_id',p_family_route_id,
    'route_status',case when v_deleted and v_status='REVIEW_REQUIRED' then 'DRAFT' else v_status end,
    'validation',costing.fn_validate_route_family_route(p_family_route_id)
  );
end
$function$;

create or replace function public.rpc_approve_route_family_route(
  p_family_route_id bigint,
  p_approval_reference text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_old costing.production_route_family_route%rowtype;
  v_validation jsonb;
  v_ref text:=nullif(btrim(p_approval_reference),'');
begin
  perform public.require_permission('module:production-route-manager',true);

  if v_ref is null or upper(v_ref) in ('-','—','NA','N/A','AUTO','MIGRATION') then
    raise exception 'A meaningful approval reference is required';
  end if;

  select * into v_route
  from costing.production_route_family_route
  where id=p_family_route_id
  for update;

  if not found then raise exception 'Route Family route not found'; end if;
  if v_route.status<>'REVIEW_REQUIRED' then raise exception 'Route Family route must be in review'; end if;
  if v_route.effective_from is null then raise exception 'Route Family route effective_from is required before approval'; end if;

  if not exists(
    select 1 from costing.production_route_family
    where id=v_route.route_family_id and status='APPROVED'
  ) then
    raise exception 'Route Family must be approved first';
  end if;

  v_validation:=costing.fn_validate_route_family_route(p_family_route_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Route Family route validation failed: %',v_validation->'errors';
  end if;

  if v_route.supersedes_route_id is not null then
    select * into v_old
    from costing.production_route_family_route
    where id=v_route.supersedes_route_id
    for update;

    if not found or v_old.status<>'APPROVED' or v_old.route_family_id<>v_route.route_family_id then
      raise exception 'supersedes_route_id must identify the current approved route of the same Route Family';
    end if;

    if v_route.effective_from<=v_old.effective_from then
      raise exception 'Successor route effective_from % must be after prior approved route effective_from %',v_route.effective_from,v_old.effective_from;
    end if;

    if exists(
      select 1
      from costing.production_route_family_route r
      where r.id not in (p_family_route_id,v_old.id)
        and r.route_family_id=v_route.route_family_id
        and r.status='APPROVED'
        and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]')
            && daterange(v_route.effective_from,'infinity'::date,'[]')
    ) then
      raise exception 'Another approved Route Family route overlaps the successor effective period';
    end if;

    update costing.production_route_family_route
    set status='SUPERSEDED',effective_to=v_route.effective_from-1,updated_at=now()
    where id=v_old.id;
  else
    if exists(
      select 1
      from costing.production_route_family_route r
      where r.id<>p_family_route_id
        and r.route_family_id=v_route.route_family_id
        and r.status='APPROVED'
        and daterange(r.effective_from,coalesce(r.effective_to,'infinity'::date),'[]')
            && daterange(v_route.effective_from,'infinity'::date,'[]')
    ) then
      raise exception 'An approved Route Family route overlaps the requested effective period; create a successor version linked by supersedes_route_id';
    end if;
  end if;

  update costing.production_route_family_route
  set status='APPROVED',
      approval_reference=v_ref,
      approved_by=auth.uid(),
      approved_at=clock_timestamp(),
      updated_at=now()
  where id=p_family_route_id;

  return jsonb_build_object(
    'family_route_id',p_family_route_id,
    'status','APPROVED',
    'superseded_route_id',v_route.supersedes_route_id,
    'validation',v_validation
  );
end
$function$;

create or replace function public.rpc_supersede_route_family_route(
  p_old_family_route_id bigint,
  p_new_family_route_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_new_from date;
  v_old_family bigint;
  v_new_family bigint;
  v_old_status text;
  v_new_status text;
begin
  perform public.require_permission('module:production-route-manager',true);

  select effective_from,route_family_id,status
  into v_new_from,v_new_family,v_new_status
  from costing.production_route_family_route
  where id=p_new_family_route_id;

  select route_family_id,status
  into v_old_family,v_old_status
  from costing.production_route_family_route
  where id=p_old_family_route_id;

  if v_new_status='APPROVED' and v_old_status='SUPERSEDED' and v_new_family=v_old_family then
    return jsonb_build_object(
      'old_family_route_id',p_old_family_route_id,
      'new_family_route_id',p_new_family_route_id,
      'status','SUPERSEDED',
      'already_applied',true
    );
  end if;

  if v_new_status<>'APPROVED' or v_old_status<>'APPROVED' or v_new_family is null or v_old_family is null or v_new_family<>v_old_family then
    raise exception 'Both routes must be approved versions of the same Route Family';
  end if;

  if v_new_from is null then raise exception 'New approved Route Family route must have effective_from'; end if;

  update costing.production_route_family_route
  set status='SUPERSEDED',effective_to=v_new_from-1,updated_at=now()
  where id=p_old_family_route_id;

  return jsonb_build_object(
    'old_family_route_id',p_old_family_route_id,
    'new_family_route_id',p_new_family_route_id,
    'status','SUPERSEDED',
    'already_applied',false
  );
end
$function$;

revoke execute on function public.rpc_upsert_route_family_route_step(bigint,bigint,jsonb) from public,anon;
revoke execute on function public.rpc_delete_route_family_route_step(bigint,bigint) from public,anon;
revoke execute on function public.rpc_approve_route_family_route(bigint,text) from public,anon;
revoke execute on function public.rpc_supersede_route_family_route(bigint,bigint) from public,anon;
grant execute on function public.rpc_upsert_route_family_route_step(bigint,bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_delete_route_family_route_step(bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_approve_route_family_route(bigint,text) to authenticated,service_role;
grant execute on function public.rpc_supersede_route_family_route(bigint,bigint) to authenticated,service_role;