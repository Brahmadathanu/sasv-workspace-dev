-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.production_route_family
  add column if not exists allows_release_only_route boolean not null default false;

create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'costing', 'public', 'pg_temp'
as $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_qc integer;
  v_as_of date;
  v_release_only boolean := false;
begin
  select * into v_route from costing.production_route_family_route where id=p_family_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('ROUTE_FAMILY_ROUTE_NOT_FOUND')); end if;
  if v_route.archived_at is not null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_ROUTE_FAMILY_ROUTE'),'family_route_id',p_family_route_id);
  end if;

  select coalesce(f.allows_release_only_route,false)
    into v_release_only
  from costing.production_route_family f
  where f.id=v_route.route_family_id;

  if not found then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ROUTE_FAMILY_NOT_FOUND'),'family_route_id',p_family_route_id,'route_family_id',v_route.route_family_id);
  end if;

  if exists(select 1 from costing.production_route_family f where f.id=v_route.route_family_id and f.archived_at is not null) then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_ROUTE_FAMILY'),'family_route_id',p_family_route_id,'route_family_id',v_route.route_family_id);
  end if;

  v_as_of := coalesce(v_route.effective_from,current_date);
  select count(*),
         count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE'),
         count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),
         count(*) filter(where route_step_scope='PRODUCTION_PROCESS'),
         count(*) filter(where route_step_scope='QC_OTHER_POOL')
  into v_steps,v_rm,v_fg,v_prod,v_qc
  from costing.production_route_family_route_step
  where family_route_id=p_family_route_id;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;

  if v_release_only then
    if v_prod<>0 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_MUST_NOT_HAVE_PRODUCTION_PROCESS_STEP'); end if;
    if v_qc<>1 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_REQUIRES_EXACTLY_ONE_QC_STEP'); end if;
    if v_steps<>3 then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_REQUIRES_EXACTLY_THREE_STEPS'); end if;
    if exists(
      select 1 from costing.production_route_family_route_step s
      where s.family_route_id=p_family_route_id
        and s.route_step_scope not in ('BOUNDARY_RM_ISSUE','QC_OTHER_POOL','BOUNDARY_FG_TRANSFER')
    ) then v_errors:=v_errors||jsonb_build_array('RELEASE_ONLY_ROUTE_HAS_DISALLOWED_STEP_SCOPE'); end if;
  elsif v_prod<1 then
    v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP');
  end if;

  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE'); end if;

  if exists(
    select 1 from costing.production_route_family_route_step s
    join public.subsections ss on ss.id=s.subsection_id
    join public.areas a on a.id=s.area_id
    left join public.plant_machinery pm on pm.id=s.plant_id
    where s.family_route_id=p_family_route_id and (
      ss.section_id is distinct from s.section_id or a.section_id is distinct from s.section_id or a.subsection_id is distinct from s.subsection_id
      or (s.plant_id is not null and (pm.section_id is distinct from s.section_id or pm.subsection_id is distinct from s.subsection_id or pm.area_id is distinct from s.area_id))
    )
  ) then v_errors:=v_errors||jsonb_build_array('STEP_LOCATION_HIERARCHY_MISMATCH'); end if;

  if exists(
    select 1 from costing.production_route_family_route_step s
    join public.activities a on a.id=s.activity_id
    where s.family_route_id=p_family_route_id and (
      a.section_id is distinct from s.section_id or a.sub_section_id is distinct from s.subsection_id or a.area_id is distinct from s.area_id
    )
  ) then v_errors:=v_errors||jsonb_build_array('ACTIVITY_LOCATION_MISMATCH'); end if;

  if exists(
    select 1 from costing.production_route_family_route_step s
    join costing.production_cost_centre cc on cc.id=s.cost_centre_id
    where s.family_route_id=p_family_route_id and (cc.status<>'APPROVED' or cc.effective_from>v_as_of or (cc.effective_to is not null and cc.effective_to<v_as_of))
  ) then v_errors:=v_errors||jsonb_build_array('COST_CENTRE_NOT_APPROVED_OR_EFFECTIVE'); end if;

  if exists(
    select 1 from costing.production_route_family_route_step s
    left join costing.production_route_behaviour b on b.code=s.behaviour_code
    left join costing.production_resource_class rc on rc.code=s.resource_class_code
    where s.family_route_id=p_family_route_id and (coalesce(b.is_active,false)=false or coalesce(rc.is_active,false)=false)
  ) then v_errors:=v_errors||jsonb_build_array('INACTIVE_BEHAVIOUR_OR_RESOURCE_CLASS'); end if;

  if exists(
    select 1 from costing.production_route_family_route_step s
    join costing.production_cost_centre cc on cc.id=s.cost_centre_id
    where s.family_route_id=p_family_route_id and cc.pool_scope='EXCLUDED_OTHER_POOL'
      and (s.production_overhead_scope<>'EXCLUDE_OTHER_POOL' or s.direct_labour_scope<>'EXCLUDE_OTHER_POOL')
  ) then v_errors:=v_errors||jsonb_build_array('EXCLUDED_COST_CENTRE_REQUIRES_DL_AND_POH_EXCLUSION'); end if;

  if exists(
    select 1 from costing.production_route_family_route_step s
    where s.family_route_id=p_family_route_id and s.route_step_scope in ('QC_OTHER_POOL','STORES_OTHER_POOL','NON_PRODUCTION')
      and (s.production_overhead_scope<>'EXCLUDE_OTHER_POOL' or s.direct_labour_scope<>'EXCLUDE_OTHER_POOL')
  ) then v_errors:=v_errors||jsonb_build_array('OTHER_POOL_STEP_REQUIRES_DL_AND_POH_EXCLUSION'); end if;

  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,
    'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod,'qc_step_count',v_qc,
    'allows_release_only_route',v_release_only,'validation_as_of',v_as_of);
end
$function$;