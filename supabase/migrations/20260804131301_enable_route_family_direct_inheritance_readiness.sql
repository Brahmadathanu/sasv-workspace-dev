-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_effective_product_process_steps(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns table(
  product_id integer,
  product_route_id bigint,
  family_route_id bigint,
  effective_step_key text,
  sequence_no numeric,
  activity_id integer,
  cost_centre_id bigint,
  section_id integer,
  subsection_id integer,
  area_id integer,
  plant_id integer,
  behaviour_code text,
  resource_class_code text,
  route_step_scope text,
  expected_occurrence_count numeric,
  standard_cycle_count numeric,
  is_mandatory boolean,
  allows_repeat boolean,
  allows_skip_with_approval boolean,
  production_overhead_scope text,
  direct_labour_scope text,
  source_type text,
  base_step_id bigint,
  override_id bigint
)
language plpgsql
stable
security definer
set search_path to 'costing','public'
as $$
declare
  v_product_route_id bigint;
  v_family_route_id bigint;
begin
  v_family_route_id := costing.fn_resolve_effective_route_family_route(p_product_id,coalesce(p_as_of_date,current_date));
  if v_family_route_id is null then
    return;
  end if;

  v_product_route_id := costing.fn_resolve_effective_product_process_route(p_product_id,coalesce(p_as_of_date,current_date));

  if v_product_route_id is not null then
    return query
    select
      p_product_id,
      e.product_route_id,
      v_family_route_id,
      e.effective_step_key,
      e.sequence_no,
      e.activity_id,
      e.cost_centre_id,
      e.section_id,
      e.subsection_id,
      e.area_id,
      e.plant_id,
      e.behaviour_code,
      e.resource_class_code,
      e.route_step_scope,
      e.expected_occurrence_count,
      e.standard_cycle_count,
      e.is_mandatory,
      e.allows_repeat,
      e.allows_skip_with_approval,
      e.production_overhead_scope,
      e.direct_labour_scope,
      e.source_type,
      e.base_step_id,
      e.override_id
    from costing.fn_effective_product_process_route_steps(v_product_route_id) e
    order by e.sequence_no,e.effective_step_key;
  else
    return query
    select
      p_product_id,
      null::bigint,
      v_family_route_id,
      s.step_key,
      s.sequence_no,
      s.activity_id,
      s.cost_centre_id,
      s.section_id,
      s.subsection_id,
      s.area_id,
      s.plant_id,
      s.behaviour_code,
      s.resource_class_code,
      s.route_step_scope,
      s.expected_occurrence_count,
      s.standard_cycle_count,
      s.is_mandatory,
      s.allows_repeat,
      s.allows_skip_with_approval,
      s.production_overhead_scope,
      s.direct_labour_scope,
      'ROUTE_FAMILY_INHERITED'::text,
      s.id,
      null::bigint
    from costing.production_route_family_route_step s
    where s.family_route_id=v_family_route_id
    order by s.sequence_no,s.step_key;
  end if;
end;
$$;

create or replace function costing.fn_validate_effective_product_process_route(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public'
as $$
declare
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_errors jsonb := '[]'::jsonb;
begin
  v_family_id := costing.fn_resolve_route_family_for_product(p_product_id,coalesce(p_as_of_date,current_date));
  if v_family_id is null then
    return jsonb_build_object(
      'valid',false,
      'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_MAPPING'),
      'route_source',null,
      'product_id',p_product_id
    );
  end if;

  v_family_route_id := costing.fn_resolve_effective_route_family_route(p_product_id,coalesce(p_as_of_date,current_date));
  if v_family_route_id is null then
    return jsonb_build_object(
      'valid',false,
      'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ROUTE'),
      'route_source',null,
      'product_id',p_product_id,
      'route_family_id',v_family_id
    );
  end if;

  v_product_route_id := costing.fn_resolve_effective_product_process_route(p_product_id,coalesce(p_as_of_date,current_date));

  if v_product_route_id is not null then
    return costing.fn_validate_product_process_route(v_product_route_id)
      || jsonb_build_object(
        'route_source','PRODUCT_ROUTE',
        'product_id',p_product_id,
        'route_family_id',v_family_id,
        'family_route_id',v_family_route_id,
        'product_route_id',v_product_route_id
      );
  end if;

  select
    count(*),
    count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE'),
    count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),
    count(*) filter(where route_step_scope='PRODUCTION_PROCESS')
  into v_steps,v_rm,v_fg,v_prod
  from costing.fn_effective_product_process_steps(p_product_id,coalesce(p_as_of_date,current_date));

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;

  return jsonb_build_object(
    'valid',jsonb_array_length(v_errors)=0,
    'errors',v_errors,
    'step_count',v_steps,
    'rm_boundary_count',v_rm,
    'fg_boundary_count',v_fg,
    'production_step_count',v_prod,
    'route_source','ROUTE_FAMILY_INHERITED',
    'product_id',p_product_id,
    'route_family_id',v_family_id,
    'family_route_id',v_family_route_id,
    'product_route_id',null
  );
end;
$$;

create or replace view costing.v_product_process_route_readiness as
select
  p.id as product_id,
  p.item as product_name,
  c.id as category_id,
  c.category_name,
  sc.id as sub_category_id,
  sc.subcategory_name,
  pg.id as product_group_id,
  pg.group_name as product_group_name,
  fm.route_family_id,
  rf.family_code as route_family_code,
  rf.family_name as route_family_name,
  pr.id as product_route_id,
  pr.route_version,
  pr.status as route_status,
  pr.effective_from,
  pr.effective_to,
  pr.evidence_status,
  pr.base_route_family_route_id,
  pr.batch_size_ref_id,
  case
    when fm.route_family_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
    when fr.id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
    when not coalesce((costing.fn_validate_effective_product_process_route(p.id,current_date)->>'valid')::boolean,false)
      then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
    else 'READY'
  end as readiness_status,
  costing.fn_validate_effective_product_process_route(p.id,current_date) as validation,
  fr.id as effective_family_route_id,
  case when pr.id is null then 'ROUTE_FAMILY_INHERITED' else 'PRODUCT_ROUTE' end as effective_route_source
from public.products p
join public.sub_groups sg on sg.id=p.sub_group_id
join public.product_groups pg on pg.id=sg.product_group_id
join public.sub_categories sc on sc.id=pg.sub_category_id
join public.categories c on c.id=sc.category_id
left join lateral (
  select m.route_family_id
  from costing.production_route_family_product_group_map m
  where m.product_group_id=pg.id
    and m.status='APPROVED'
    and m.effective_from<=current_date
    and (m.effective_to is null or m.effective_to>=current_date)
  order by m.effective_from desc,m.id desc
  limit 1
) fm on true
left join costing.production_route_family rf on rf.id=fm.route_family_id
left join lateral (
  select r.id
  from costing.production_route_family_route r
  where r.route_family_id=fm.route_family_id
    and r.status='APPROVED'
    and r.effective_from<=current_date
    and (r.effective_to is null or r.effective_to>=current_date)
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1
) fr on true
left join lateral (
  select x.*
  from costing.product_process_route x
  where x.product_id=p.id
    and x.status='APPROVED'
    and x.effective_from<=current_date
    and (x.effective_to is null or x.effective_to>=current_date)
  order by x.effective_from desc,x.route_version desc,x.id desc
  limit 1
) pr on true
where upper(coalesce(p.status,''))='ACTIVE';

create or replace function public.rpc_get_effective_product_process_route(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing'
as $$
declare
  v_validation jsonb;
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
  v_steps jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);

  v_validation:=costing.fn_validate_effective_product_process_route(p_product_id,coalesce(p_as_of_date,current_date));
  v_family_id:=nullif(v_validation->>'route_family_id','')::bigint;
  v_family_route_id:=nullif(v_validation->>'family_route_id','')::bigint;
  v_product_route_id:=nullif(v_validation->>'product_route_id','')::bigint;

  if not coalesce((v_validation->>'valid')::boolean,false) then
    return jsonb_build_object(
      'product_id',p_product_id,
      'as_of_date',coalesce(p_as_of_date,current_date),
      'route_family_id',v_family_id,
      'base_route_family_route_id',v_family_route_id,
      'product_route_id',v_product_route_id,
      'readiness_status',case
        when v_validation->'errors' ? 'NO_APPROVED_ROUTE_FAMILY_MAPPING' then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
        when v_validation->'errors' ? 'NO_APPROVED_ROUTE_FAMILY_ROUTE' then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
        else 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
      end,
      'validation',v_validation,
      'steps','[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(
    to_jsonb(e)||jsonb_build_object(
      'activity_name',a.activity_name,
      'activity_kind',ak.name,
      'activity_short_code',ak.short_code,
      'cost_centre_code',cc.cost_centre_code,
      'cost_centre_name',cc.cost_centre_name,
      'section_name',sec.section_name,
      'subsection_name',sub.subsection_name,
      'area_name',ar.area_name,
      'plant_name',pm.plant_name
    ) order by e.sequence_no,e.effective_step_key
  ),'[]'::jsonb)
  into v_steps
  from costing.fn_effective_product_process_steps(p_product_id,coalesce(p_as_of_date,current_date)) e
  join public.activities a on a.id=e.activity_id
  join public.activity_kinds ak on ak.id=a.kind_id
  join costing.production_cost_centre cc on cc.id=e.cost_centre_id
  join public.sections sec on sec.id=e.section_id
  join public.subsections sub on sub.id=e.subsection_id
  join public.areas ar on ar.id=e.area_id
  left join public.plant_machinery pm on pm.id=e.plant_id;

  return jsonb_build_object(
    'product_id',p_product_id,
    'as_of_date',coalesce(p_as_of_date,current_date),
    'route_family_id',v_family_id,
    'base_route_family_route_id',v_family_route_id,
    'product_route_id',v_product_route_id,
    'route_source',v_validation->>'route_source',
    'readiness_status','READY',
    'validation',v_validation,
    'steps',v_steps
  );
end;
$$;

revoke all on function costing.fn_effective_product_process_steps(integer,date) from public,anon,authenticated;
revoke all on function costing.fn_validate_effective_product_process_route(integer,date) from public,anon,authenticated;
grant execute on function costing.fn_effective_product_process_steps(integer,date) to service_role;
grant execute on function costing.fn_validate_effective_product_process_route(integer,date) to service_role;
