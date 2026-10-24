-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10I.2C.3F.1B.2B.1
-- Archive-aware core route resolution, validation and readiness.

create or replace function costing.fn_resolve_effective_product_process_route(
  p_product_id integer,
  p_as_of_date date default current_date
) returns bigint
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_date date := coalesce(p_as_of_date,current_date);
  v_count integer;
  v_id bigint;
begin
  select count(*), min(r.id)
  into v_count,v_id
  from costing.product_process_route r
  where r.product_id=p_product_id
    and r.archived_at is null
    and r.status='APPROVED'
    and r.effective_from<=v_date
    and (r.effective_to is null or r.effective_to>=v_date);

  if v_count>1 then
    raise exception 'AMBIGUOUS_APPROVED_PRODUCT_ROUTE for Product % as of %',p_product_id,v_date;
  end if;
  return v_id;
end
$function$;

create or replace function costing.fn_effective_product_process_route_steps(
  p_product_route_id bigint
) returns table(
  product_route_id bigint,
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
language sql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with pr as (
  select r.*
  from costing.product_process_route r
  join costing.production_route_family_route fr on fr.id=r.base_route_family_route_id
  join costing.production_route_family f on f.id=fr.route_family_id
  where r.id=p_product_route_id
    and r.archived_at is null
    and fr.archived_at is null
    and f.archived_at is null
), base as (
  select s.*
  from pr
  join costing.production_route_family_route_step s
    on s.family_route_id=pr.base_route_family_route_id
), agg as (
  select o.base_step_id,
         bool_or(o.operation_type='BYPASS_STEP') bypassed,
         max(o.id) filter(where o.operation_type='REPLACE_STEP') replace_id,
         max(o.id) filter(where o.operation_type='ALTER_LOCATION') location_id,
         max(o.id) filter(where o.operation_type='ALTER_RESOURCE') resource_id,
         max(o.id) filter(where o.operation_type='ALTER_CYCLE') cycle_id,
         max(o.id) filter(where o.operation_type='ALTER_MANDATORY_STATUS') mandatory_id
  from costing.product_process_route_override o
  join pr on pr.id=o.product_route_id
  where o.base_step_id is not null
  group by o.base_step_id
), resolved_base as (
  select
    p_product_route_id product_route_id,
    b.step_key effective_step_key,
    coalesce(rep.sequence_no,b.sequence_no) sequence_no,
    coalesce(rep.activity_id,b.activity_id) activity_id,
    coalesce(rep.cost_centre_id,loc.cost_centre_id,res.cost_centre_id,b.cost_centre_id) cost_centre_id,
    coalesce(rep.section_id,loc.section_id,b.section_id) section_id,
    coalesce(rep.subsection_id,loc.subsection_id,b.subsection_id) subsection_id,
    coalesce(rep.area_id,loc.area_id,b.area_id) area_id,
    coalesce(rep.plant_id,loc.plant_id,res.plant_id,b.plant_id) plant_id,
    coalesce(rep.behaviour_code,res.behaviour_code,b.behaviour_code) behaviour_code,
    coalesce(rep.resource_class_code,res.resource_class_code,b.resource_class_code) resource_class_code,
    coalesce(rep.route_step_scope,b.route_step_scope) route_step_scope,
    coalesce(rep.expected_occurrence_count,cyc.expected_occurrence_count,b.expected_occurrence_count) expected_occurrence_count,
    coalesce(rep.standard_cycle_count,cyc.standard_cycle_count,b.standard_cycle_count) standard_cycle_count,
    coalesce(rep.is_mandatory,man.is_mandatory,b.is_mandatory) is_mandatory,
    coalesce(rep.allows_repeat,man.allows_repeat,b.allows_repeat) allows_repeat,
    coalesce(rep.allows_skip_with_approval,man.allows_skip_with_approval,b.allows_skip_with_approval) allows_skip_with_approval,
    coalesce(rep.production_overhead_scope,b.production_overhead_scope) production_overhead_scope,
    coalesce(rep.direct_labour_scope,b.direct_labour_scope) direct_labour_scope,
    case when coalesce(a.replace_id,a.location_id,a.resource_id,a.cycle_id,a.mandatory_id) is null then 'ROUTE_FAMILY' else 'PRODUCT_OVERRIDE' end source_type,
    b.id base_step_id,
    coalesce(a.replace_id,a.location_id,a.resource_id,a.cycle_id,a.mandatory_id) override_id
  from base b
  left join agg a on a.base_step_id=b.id
  left join costing.product_process_route_override rep on rep.id=a.replace_id
  left join costing.product_process_route_override loc on loc.id=a.location_id
  left join costing.product_process_route_override res on res.id=a.resource_id
  left join costing.product_process_route_override cyc on cyc.id=a.cycle_id
  left join costing.product_process_route_override man on man.id=a.mandatory_id
  where coalesce(a.bypassed,false)=false
), added as (
  select
    p_product_route_id product_route_id,
    o.override_step_key effective_step_key,
    o.sequence_no,o.activity_id,o.cost_centre_id,o.section_id,o.subsection_id,o.area_id,o.plant_id,
    o.behaviour_code,o.resource_class_code,o.route_step_scope,
    o.expected_occurrence_count,o.standard_cycle_count,o.is_mandatory,o.allows_repeat,o.allows_skip_with_approval,
    o.production_overhead_scope,o.direct_labour_scope,
    'PRODUCT_ADDED_STEP'::text source_type,
    null::bigint base_step_id,o.id override_id
  from costing.product_process_route_override o
  join pr on pr.id=o.product_route_id
  where o.operation_type='ADD_STEP'
)
select * from resolved_base
union all
select * from added
order by sequence_no,effective_step_key
$function$;

create or replace function costing.fn_effective_product_process_steps(
  p_product_id integer,
  p_as_of_date date default current_date
) returns table(
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
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_date date := coalesce(p_as_of_date,current_date);
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
begin
  v_family_id := costing.fn_resolve_route_family_for_product(p_product_id,v_date);
  if v_family_id is null then return; end if;

  v_family_route_id := costing.fn_resolve_effective_route_family_route(p_product_id,v_date);
  if v_family_route_id is null then return; end if;

  v_product_route_id := costing.fn_resolve_effective_product_process_route(p_product_id,v_date);

  if v_product_route_id is not null then
    return query
    select p_product_id,e.product_route_id,v_family_route_id,e.effective_step_key,e.sequence_no,
           e.activity_id,e.cost_centre_id,e.section_id,e.subsection_id,e.area_id,e.plant_id,
           e.behaviour_code,e.resource_class_code,e.route_step_scope,e.expected_occurrence_count,
           e.standard_cycle_count,e.is_mandatory,e.allows_repeat,e.allows_skip_with_approval,
           e.production_overhead_scope,e.direct_labour_scope,e.source_type,e.base_step_id,e.override_id
    from costing.fn_effective_product_process_route_steps(v_product_route_id) e
    order by e.sequence_no,e.effective_step_key;
  else
    return query
    select p_product_id,null::bigint,v_family_route_id,s.step_key,s.sequence_no,s.activity_id,s.cost_centre_id,
           s.section_id,s.subsection_id,s.area_id,s.plant_id,s.behaviour_code,s.resource_class_code,
           s.route_step_scope,s.expected_occurrence_count,s.standard_cycle_count,s.is_mandatory,
           s.allows_repeat,s.allows_skip_with_approval,s.production_overhead_scope,s.direct_labour_scope,
           'ROUTE_FAMILY_INHERITED'::text,s.id,null::bigint
    from costing.production_route_family_route_step s
    where s.family_route_id=v_family_route_id
    order by s.sequence_no,s.step_key;
  end if;
end
$function$;

create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint)
returns jsonb
language plpgsql
stable security definer
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
  select * into v_route from costing.production_route_family_route where id=p_family_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('ROUTE_FAMILY_ROUTE_NOT_FOUND')); end if;
  if v_route.archived_at is not null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_ROUTE_FAMILY_ROUTE'),'family_route_id',p_family_route_id);
  end if;
  if exists(select 1 from costing.production_route_family f where f.id=v_route.route_family_id and f.archived_at is not null) then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_ROUTE_FAMILY'),'family_route_id',p_family_route_id,'route_family_id',v_route.route_family_id);
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
    'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod,'validation_as_of',v_as_of);
end
$function$;

create or replace function costing.fn_validate_product_process_route(p_product_route_id bigint)
returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_route costing.product_process_route%rowtype;
  v_errors jsonb:='[]'::jsonb;
  v_family_id bigint;
  v_base_family_id bigint;
  v_batch_product_id integer;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_duplicate_sequence boolean:=false;
begin
  select * into v_route from costing.product_process_route where id=p_product_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('PRODUCT_ROUTE_NOT_FOUND')); end if;
  if v_route.archived_at is not null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('ARCHIVED_PRODUCT_ROUTE'),'product_route_id',p_product_route_id);
  end if;

  v_family_id:=costing.fn_resolve_route_family_for_product(v_route.product_id,coalesce(v_route.effective_from,current_date));
  select route_family_id into v_base_family_id
  from costing.production_route_family_route
  where id=v_route.base_route_family_route_id and archived_at is null;

  if v_base_family_id is null then v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_ARCHIVED_OR_MISSING'); end if;
  if v_family_id is null then v_errors:=v_errors||jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ASSIGNMENT');
  elsif v_family_id<>v_base_family_id then v_errors:=v_errors||jsonb_build_array('ROUTE_FAMILY_ASSIGNMENT_MISMATCH'); end if;

  if not exists(
    select 1 from costing.production_route_family_route r
    join costing.production_route_family f on f.id=r.route_family_id
    where r.id=v_route.base_route_family_route_id and r.archived_at is null and f.archived_at is null and r.status='APPROVED'
  ) then v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_NOT_APPROVED'); end if;

  select product_id into v_batch_product_id from public.production_batch_size_ref where id=v_route.batch_size_ref_id;
  if v_batch_product_id is distinct from v_route.product_id then v_errors:=v_errors||jsonb_build_array('BATCH_REFERENCE_PRODUCT_MISMATCH'); end if;

  if exists(
    select 1 from costing.product_process_route_override o
    join costing.production_route_family_route_step s on s.id=o.base_step_id
    where o.product_route_id=p_product_route_id and s.family_route_id<>v_route.base_route_family_route_id
  ) then v_errors:=v_errors||jsonb_build_array('OVERRIDE_REFERENCES_FOREIGN_ROUTE_FAMILY_STEP'); end if;

  with es as materialized (select * from costing.fn_effective_product_process_route_steps(p_product_route_id)),
  counts as (
    select count(*)::integer steps,
           count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE')::integer rm,
           count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER')::integer fg,
           count(*) filter(where route_step_scope='PRODUCTION_PROCESS')::integer prod
    from es
  ), dup as (select exists(select 1 from es group by sequence_no having count(*)>1) has_dup)
  select counts.steps,counts.rm,counts.fg,counts.prod,dup.has_dup into v_steps,v_rm,v_fg,v_prod,v_duplicate_sequence from counts cross join dup;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;
  if coalesce(v_duplicate_sequence,false) then v_errors:=v_errors||jsonb_build_array('DUPLICATE_EFFECTIVE_SEQUENCE'); end if;
  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE'); end if;

  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,
    'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod,'resolved_route_family_id',v_family_id);
end
$function$;

create or replace function costing.fn_validate_effective_product_process_route(
  p_product_id integer,
  p_as_of_date date default current_date
) returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_date date:=coalesce(p_as_of_date,current_date);
  v_family_id bigint;
  v_family_route_id bigint;
  v_product_route_id bigint;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
  v_errors jsonb:='[]'::jsonb;
begin
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id,v_date);
  if v_family_id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_MAPPING'),'route_source',null,'product_id',p_product_id);
  end if;

  v_family_route_id:=costing.fn_resolve_effective_route_family_route(p_product_id,v_date);
  if v_family_route_id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_ROUTE'),'route_source',null,'product_id',p_product_id,'route_family_id',v_family_id);
  end if;

  v_product_route_id:=costing.fn_resolve_effective_product_process_route(p_product_id,v_date);
  if v_product_route_id is not null then
    return costing.fn_validate_product_process_route(v_product_route_id)
      || jsonb_build_object('route_source','PRODUCT_ROUTE','product_id',p_product_id,'route_family_id',v_family_id,
                            'family_route_id',v_family_route_id,'product_route_id',v_product_route_id);
  end if;

  select count(*)::integer,
         count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE')::integer,
         count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER')::integer,
         count(*) filter(where route_step_scope='PRODUCTION_PROCESS')::integer
  into v_steps,v_rm,v_fg,v_prod
  from costing.production_route_family_route_step
  where family_route_id=v_family_route_id;

  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;

  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,
    'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod,
    'route_source','ROUTE_FAMILY_INHERITED','product_id',p_product_id,'route_family_id',v_family_id,
    'family_route_id',v_family_route_id,'product_route_id',null);
end
$function$;

create or replace function costing.fn_product_process_route_readiness(p_as_of_date date default current_date)
returns table(
  product_id integer, product_name text, category_id integer, category_name text,
  sub_category_id integer, subcategory_name text, product_group_id integer, product_group_name text,
  route_family_id bigint, route_family_code text, route_family_name text, product_route_id bigint,
  route_version integer, route_status text, effective_from date, effective_to date, evidence_status text,
  base_route_family_route_id bigint, batch_size_ref_id bigint, readiness_status text, validation jsonb,
  effective_family_route_id bigint, effective_route_source text, route_family_assignment_source text,
  product_route_family_assignment_id bigint, product_group_route_family_mapping_id bigint,
  route_family_assignment_basis text, route_family_assignment_approval_reference text
)
language sql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with ctx as (select coalesce(p_as_of_date,current_date) as as_of_date),
base as (
  select p.id product_id,p.item product_name,c.id category_id,c.category_name,
         sc.id sub_category_id,sc.subcategory_name,pg.id product_group_id,pg.group_name product_group_name,
         sg.id product_subgroup_id,
         costing.fn_resolve_route_family_for_product(p.id,(select as_of_date from ctx)) route_family_id
  from public.products p
  join public.sub_groups sg on sg.id=p.sub_group_id
  join public.product_groups pg on pg.id=sg.product_group_id
  join public.sub_categories sc on sc.id=pg.sub_category_id
  join public.categories c on c.id=sc.category_id
  where upper(coalesce(p.status,''))='ACTIVE'
), resolved as (
  select b.*,
         pa.id product_assignment_id,pa.assignment_basis product_assignment_basis,pa.approval_reference product_assignment_approval_reference,
         sm.id subgroup_mapping_id,sm.mapping_basis subgroup_mapping_basis,sm.approval_reference subgroup_mapping_approval_reference,
         gm.id group_mapping_id,gm.mapping_basis group_mapping_basis,gm.approval_reference group_mapping_approval_reference,
         rf.family_code,rf.family_name,
         fr.id family_route_id,
         pr.id product_route_id,pr.route_version,pr.status route_status,pr.effective_from,pr.effective_to,
         pr.evidence_status,pr.base_route_family_route_id,pr.batch_size_ref_id,
         costing.fn_validate_effective_product_process_route(b.product_id,(select as_of_date from ctx)) validation
  from base b
  left join lateral (
    select m.* from costing.production_route_family_product_map m
    where m.product_id=b.product_id and m.archived_at is null and m.status='APPROVED'
      and m.effective_from<=(select as_of_date from ctx)
      and (m.effective_to is null or m.effective_to>=(select as_of_date from ctx))
    order by m.effective_from desc,m.id desc limit 1
  ) pa on true
  left join lateral (
    select m.* from costing.production_route_family_product_subgroup_map m
    where m.product_subgroup_id=b.product_subgroup_id and m.archived_at is null and m.status='APPROVED'
      and m.effective_from<=(select as_of_date from ctx)
      and (m.effective_to is null or m.effective_to>=(select as_of_date from ctx))
    order by m.effective_from desc,m.id desc limit 1
  ) sm on true
  left join lateral (
    select m.* from costing.production_route_family_product_group_map m
    where m.product_group_id=b.product_group_id and m.archived_at is null and m.status='APPROVED'
      and m.effective_from<=(select as_of_date from ctx)
      and (m.effective_to is null or m.effective_to>=(select as_of_date from ctx))
    order by m.effective_from desc,m.id desc limit 1
  ) gm on true
  left join costing.production_route_family rf on rf.id=b.route_family_id and rf.archived_at is null
  left join lateral (
    select r.id from costing.production_route_family_route r
    where r.route_family_id=b.route_family_id and r.archived_at is null and r.status='APPROVED'
      and r.effective_from<=(select as_of_date from ctx)
      and (r.effective_to is null or r.effective_to>=(select as_of_date from ctx))
    order by r.effective_from desc,r.route_version desc,r.id desc limit 1
  ) fr on true
  left join lateral (
    select r.* from costing.product_process_route r
    where r.product_id=b.product_id and r.archived_at is null and r.status='APPROVED'
      and r.effective_from<=(select as_of_date from ctx)
      and (r.effective_to is null or r.effective_to>=(select as_of_date from ctx))
    order by r.effective_from desc,r.route_version desc,r.id desc limit 1
  ) pr on true
)
select product_id,product_name,category_id,category_name,sub_category_id,subcategory_name,product_group_id,product_group_name,
       route_family_id,family_code,family_name,product_route_id,route_version,route_status,effective_from,effective_to,evidence_status,
       base_route_family_route_id,batch_size_ref_id,
       case when route_family_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
            when family_route_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
            when not coalesce((validation->>'valid')::boolean,false) then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
            else 'READY' end readiness_status,
       validation,family_route_id,
       case when product_route_id is null then 'ROUTE_FAMILY_INHERITED' else 'PRODUCT_ROUTE' end effective_route_source,
       case when product_assignment_id is not null then 'PRODUCT_ASSIGNMENT'
            when subgroup_mapping_id is not null then 'PRODUCT_SUBGROUP_FALLBACK'
            when group_mapping_id is not null then 'PRODUCT_GROUP_FALLBACK' else 'NONE' end route_family_assignment_source,
       product_assignment_id,group_mapping_id,
       coalesce(product_assignment_basis,subgroup_mapping_basis,group_mapping_basis),
       coalesce(product_assignment_approval_reference,subgroup_mapping_approval_reference,group_mapping_approval_reference)
from resolved
$function$;

create or replace function costing.fn_route_family_onboarding_status(
  p_route_family_id bigint,
  p_period_start date default null,
  p_valuation_date date default null,
  p_refresh_run_id bigint default null
) returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_family costing.production_route_family%rowtype;
  v_route costing.production_route_family_route%rowtype;
  v_recipient_count integer;
  v_family_recipient_count integer;
  v_valid_count integer;
  v_assignments integer;
  v_subgroup_maps integer;
  v_group_maps integer;
begin
  select * into v_family from costing.production_route_family where id=p_route_family_id and archived_at is null;
  if not found then raise exception 'Active Route Family % not found',p_route_family_id; end if;

  select * into v_route from costing.production_route_family_route
  where route_family_id=p_route_family_id and archived_at is null
  order by route_version desc,id desc limit 1;
  select count(*) into v_assignments from costing.production_route_family_product_map
    where route_family_id=p_route_family_id and archived_at is null and status in ('DRAFT','IN_REVIEW','APPROVED');
  select count(*) into v_subgroup_maps from costing.production_route_family_product_subgroup_map
    where route_family_id=p_route_family_id and archived_at is null and status in ('DRAFT','IN_REVIEW','APPROVED');
  select count(*) into v_group_maps from costing.production_route_family_product_group_map
    where route_family_id=p_route_family_id and archived_at is null and status in ('DRAFT','IN_REVIEW','APPROVED');

  if p_refresh_run_id is not null then
    if p_period_start is null or p_valuation_date is null then raise exception 'period_start and valuation_date are required with refresh_run_id'; end if;
    with r as (select * from costing.fn_costing_recipient_products(p_period_start,p_valuation_date,p_refresh_run_id))
    select count(*),
           count(*) filter(where costing.fn_resolve_route_family_for_product(product_id::integer,p_valuation_date)=p_route_family_id),
           count(*) filter(where costing.fn_resolve_route_family_for_product(product_id::integer,p_valuation_date)=p_route_family_id
                             and coalesce((costing.fn_validate_effective_product_process_route(product_id::integer,p_valuation_date)->>'valid')::boolean,false))
    into v_recipient_count,v_family_recipient_count,v_valid_count from r;
  end if;

  return jsonb_build_object(
    'route_family',to_jsonb(v_family),
    'latest_route',case when v_route.id is null then null else to_jsonb(v_route) end,
    'latest_route_validation',case when v_route.id is null then null else costing.fn_validate_route_family_route(v_route.id) end,
    'product_assignment_count',v_assignments,
    'product_subgroup_mapping_count',v_subgroup_maps,
    'product_group_mapping_count',v_group_maps,
    'recipient_context',case when p_refresh_run_id is null then null else jsonb_build_object(
      'period_start',date_trunc('month',p_period_start)::date,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,
      'company_recipient_count',v_recipient_count,'family_recipient_count',v_family_recipient_count,
      'valid_effective_route_count',v_valid_count,'family_recipient_coverage_ratio',v_valid_count::numeric/nullif(v_family_recipient_count,0)) end,
    'architecture_stage',case
      when v_family.status<>'APPROVED' then 'FAMILY_APPROVAL_PENDING'
      when v_route.id is null then 'ROUTE_DRAFT_REQUIRED'
      when v_route.status='DRAFT' then 'ROUTE_REVIEW_PENDING'
      when v_route.status='REVIEW_REQUIRED' then 'ROUTE_APPROVAL_PENDING'
      when v_route.status='APPROVED' and v_assignments+v_subgroup_maps+v_group_maps=0 then 'ASSIGNMENT_PENDING'
      when v_route.status='APPROVED' then 'ONBOARDING_ACTIVE'
      else 'ROUTE_VERSION_NOT_ACTIVE' end,
    'data_quality_gate_status','DEFERRED_UNTIL_PIPELINE_COMPLETE'
  );
end
$function$;
