-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_resolve_route_family_for_product(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns bigint
language sql
stable
security definer
set search_path=costing,public
as $function$
  select m.route_family_id
  from public.products p
  join public.sub_groups sg on sg.id=p.sub_group_id
  join costing.production_route_family_product_group_map m
    on m.product_group_id=sg.product_group_id
   and m.status='APPROVED'
   and m.effective_from<=coalesce(p_as_of_date,current_date)
   and (m.effective_to is null or m.effective_to>=coalesce(p_as_of_date,current_date))
  join costing.production_route_family f
    on f.id=m.route_family_id
   and f.status='APPROVED'
   and f.effective_from<=coalesce(p_as_of_date,current_date)
   and (f.effective_to is null or f.effective_to>=coalesce(p_as_of_date,current_date))
  where p.id=p_product_id
  order by m.effective_from desc,m.id desc
  limit 1
$function$;

create or replace function costing.fn_resolve_effective_route_family_route(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns bigint
language sql
stable
security definer
set search_path=costing,public
as $function$
  with f as (
    select costing.fn_resolve_route_family_for_product(p_product_id,p_as_of_date) route_family_id
  )
  select r.id
  from costing.production_route_family_route r,f
  where r.route_family_id=f.route_family_id
    and r.status='APPROVED'
    and r.effective_from<=coalesce(p_as_of_date,current_date)
    and (r.effective_to is null or r.effective_to>=coalesce(p_as_of_date,current_date))
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1
$function$;

create or replace function costing.fn_effective_product_process_route_steps(p_product_route_id bigint)
returns table(
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
stable
security definer
set search_path=costing,public
as $function$
with pr as (
  select * from costing.product_process_route where id=p_product_route_id
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
  where o.product_route_id=p_product_route_id and o.base_step_id is not null
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
  where o.product_route_id=p_product_route_id and o.operation_type='ADD_STEP'
)
select * from resolved_base
union all
select * from added
order by sequence_no,effective_step_key
$function$;

create or replace function costing.fn_resolve_effective_product_process_route(
  p_product_id integer,
  p_as_of_date date default current_date
)
returns bigint
language sql
stable
security definer
set search_path=costing,public
as $function$
  select r.id
  from costing.product_process_route r
  where r.product_id=p_product_id
    and r.status='APPROVED'
    and r.effective_from<=coalesce(p_as_of_date,current_date)
    and (r.effective_to is null or r.effective_to>=coalesce(p_as_of_date,current_date))
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1
$function$;

create or replace function costing.fn_validate_route_family_route(p_family_route_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path=costing,public
as $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
begin
  select * into v_route from costing.production_route_family_route where id=p_family_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('ROUTE_FAMILY_ROUTE_NOT_FOUND')); end if;
  select count(*),count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE'),count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),count(*) filter(where route_step_scope='PRODUCTION_PROCESS')
  into v_steps,v_rm,v_fg,v_prod
  from costing.production_route_family_route_step where family_route_id=p_family_route_id;
  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;
  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE'); end if;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod);
end
$function$;

create or replace function costing.fn_validate_product_process_route(p_product_route_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path=costing,public
as $function$
declare
  v_route costing.product_process_route%rowtype;
  v_errors jsonb := '[]'::jsonb;
  v_product_group_id integer;
  v_family_id bigint;
  v_base_family_id bigint;
  v_batch_product_id integer;
  v_steps integer;
  v_rm integer;
  v_fg integer;
  v_prod integer;
begin
  select * into v_route from costing.product_process_route where id=p_product_route_id;
  if not found then return jsonb_build_object('valid',false,'errors',jsonb_build_array('PRODUCT_ROUTE_NOT_FOUND')); end if;

  select sg.product_group_id into v_product_group_id
  from public.products p join public.sub_groups sg on sg.id=p.sub_group_id
  where p.id=v_route.product_id;

  select route_family_id into v_family_id
  from costing.production_route_family_product_group_map
  where product_group_id=v_product_group_id and status='APPROVED'
    and effective_from<=coalesce(v_route.effective_from,current_date)
    and (effective_to is null or effective_to>=coalesce(v_route.effective_from,current_date))
  order by effective_from desc,id desc limit 1;

  select route_family_id into v_base_family_id
  from costing.production_route_family_route where id=v_route.base_route_family_route_id;

  if v_family_id is null then v_errors:=v_errors||jsonb_build_array('NO_APPROVED_ROUTE_FAMILY_MAPPING');
  elsif v_family_id<>v_base_family_id then v_errors:=v_errors||jsonb_build_array('ROUTE_FAMILY_MAPPING_MISMATCH'); end if;

  if not exists(select 1 from costing.production_route_family_route where id=v_route.base_route_family_route_id and status='APPROVED') then
    v_errors:=v_errors||jsonb_build_array('BASE_ROUTE_FAMILY_ROUTE_NOT_APPROVED');
  end if;

  select product_id into v_batch_product_id from public.production_batch_size_ref where id=v_route.batch_size_ref_id;
  if v_batch_product_id is distinct from v_route.product_id then v_errors:=v_errors||jsonb_build_array('BATCH_REFERENCE_PRODUCT_MISMATCH'); end if;

  if exists(
    select 1 from costing.product_process_route_override o
    join costing.production_route_family_route_step s on s.id=o.base_step_id
    where o.product_route_id=p_product_route_id and s.family_route_id<>v_route.base_route_family_route_id
  ) then v_errors:=v_errors||jsonb_build_array('OVERRIDE_REFERENCES_FOREIGN_ROUTE_FAMILY_STEP'); end if;

  select count(*),count(*) filter(where route_step_scope='BOUNDARY_RM_ISSUE'),count(*) filter(where route_step_scope='BOUNDARY_FG_TRANSFER'),count(*) filter(where route_step_scope='PRODUCTION_PROCESS')
  into v_steps,v_rm,v_fg,v_prod
  from costing.fn_effective_product_process_route_steps(p_product_route_id);
  if v_steps=0 then v_errors:=v_errors||jsonb_build_array('NO_ROUTE_STEPS'); end if;
  if v_rm<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_RM_ISSUE_BOUNDARY'); end if;
  if v_fg<>1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_EXACTLY_ONE_FG_TRANSFER_BOUNDARY'); end if;
  if v_prod<1 then v_errors:=v_errors||jsonb_build_array('REQUIRES_PRODUCTION_PROCESS_STEP'); end if;
  if exists(select 1 from costing.fn_effective_product_process_route_steps(p_product_route_id) group by sequence_no having count(*)>1) then
    v_errors:=v_errors||jsonb_build_array('DUPLICATE_EFFECTIVE_SEQUENCE');
  end if;
  if v_route.evidence_status not in ('MANUAL_COMPLETE','HISTORICAL_COMPLETE') then v_errors:=v_errors||jsonb_build_array('INCOMPLETE_ROUTE_EVIDENCE'); end if;
  return jsonb_build_object('valid',jsonb_array_length(v_errors)=0,'errors',v_errors,'step_count',v_steps,'rm_boundary_count',v_rm,'fg_boundary_count',v_fg,'production_step_count',v_prod);
end
$function$;

drop view if exists costing.v_product_process_route_readiness;
create view costing.v_product_process_route_readiness as
select p.id product_id,p.item product_name,
       c.id category_id,c.category_name,
       sc.id sub_category_id,sc.subcategory_name,
       pg.id product_group_id,pg.group_name product_group_name,
       fm.route_family_id,rf.family_code route_family_code,rf.family_name route_family_name,
       pr.id product_route_id,pr.route_version,pr.status route_status,pr.effective_from,pr.effective_to,pr.evidence_status,
       pr.base_route_family_route_id,pr.batch_size_ref_id,
       case
         when fm.route_family_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
         when fr.id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
         when pr.id is null then 'BLOCKED_NO_APPROVED_PRODUCT_PROCESS_ROUTE'
         when not coalesce((costing.fn_validate_product_process_route(pr.id)->>'valid')::boolean,false) then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
         else 'READY'
       end readiness_status,
       case when pr.id is null then jsonb_build_object('valid',false,'errors',jsonb_build_array('NO_APPROVED_PRODUCT_ROUTE')) else costing.fn_validate_product_process_route(pr.id) end validation
from public.products p
join public.sub_groups sg on sg.id=p.sub_group_id
join public.product_groups pg on pg.id=sg.product_group_id
join public.sub_categories sc on sc.id=pg.sub_category_id
join public.categories c on c.id=sc.category_id
left join lateral (
  select m.route_family_id
  from costing.production_route_family_product_group_map m
  where m.product_group_id=pg.id and m.status='APPROVED' and m.effective_from<=current_date and (m.effective_to is null or m.effective_to>=current_date)
  order by m.effective_from desc,m.id desc limit 1
) fm on true
left join costing.production_route_family rf on rf.id=fm.route_family_id
left join lateral (
  select r.id
  from costing.production_route_family_route r
  where r.route_family_id=fm.route_family_id and r.status='APPROVED' and r.effective_from<=current_date and (r.effective_to is null or r.effective_to>=current_date)
  order by r.effective_from desc,r.route_version desc,r.id desc limit 1
) fr on true
left join lateral (
  select x.*
  from costing.product_process_route x
  where x.product_id=p.id and x.status='APPROVED' and x.effective_from<=current_date and (x.effective_to is null or x.effective_to>=current_date)
  order by x.effective_from desc,x.route_version desc,x.id desc limit 1
) pr on true
where upper(coalesce(p.status,''))='ACTIVE';

revoke all on costing.v_product_process_route_readiness from public,anon,authenticated;
grant select on costing.v_product_process_route_readiness to service_role,postgres;