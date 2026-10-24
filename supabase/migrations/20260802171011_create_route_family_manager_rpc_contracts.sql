-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_manager_readiness(
  p_as_of_date date default current_date,
  p_search text default null,
  p_readiness_status text default null,
  p_route_family_id bigint default null,
  p_product_group_id integer default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $function$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,100),500)); v_offset integer:=greatest(coalesce(p_offset,0),0); v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  with filtered as (
    select r.* from costing.v_product_process_route_readiness r
    where (p_route_family_id is null or r.route_family_id=p_route_family_id)
      and (p_product_group_id is null or r.product_group_id=p_product_group_id)
      and (p_readiness_status is null or r.readiness_status=p_readiness_status)
      and (nullif(btrim(p_search),'') is null
        or r.product_name ilike '%'||btrim(p_search)||'%'
        or r.product_group_name ilike '%'||btrim(p_search)||'%'
        or r.route_family_name ilike '%'||btrim(p_search)||'%'
        or r.category_name ilike '%'||btrim(p_search)||'%'
        or r.subcategory_name ilike '%'||btrim(p_search)||'%'
        or r.product_id::text=btrim(p_search))
  ), page as (
    select * from filtered order by category_name,subcategory_name,product_group_name,product_name,product_id limit v_limit offset v_offset
  )
  select jsonb_build_object('as_of_date',coalesce(p_as_of_date,current_date),'total_count',(select count(*) from filtered),'limit',v_limit,'offset',v_offset,'rows',coalesce((select jsonb_agg(to_jsonb(page) order by category_name,subcategory_name,product_group_name,product_name,product_id) from page),'[]'::jsonb)) into v_result;
  return v_result;
end
$function$;

create or replace function public.rpc_get_production_route_master_options(
  p_product_id integer default null,
  p_product_group_id integer default null,
  p_route_family_id bigint default null,
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $function$
declare v_as_of date:=coalesce(p_as_of_date,current_date); v_group_id integer; v_family_id bigint;
begin
  perform public.require_permission('module:production-route-manager',false);
  v_group_id:=coalesce(p_product_group_id,case when p_product_id is not null then costing.fn_product_group_id_for_product(p_product_id) end);
  v_family_id:=coalesce(p_route_family_id,case when p_product_id is not null then costing.fn_resolve_route_family_for_product(p_product_id,v_as_of) end);
  return jsonb_build_object(
    'as_of_date',v_as_of,
    'product_groups',coalesce((select jsonb_agg(jsonb_build_object('product_group_id',pg.id,'product_group_name',pg.group_name,'sub_category_id',sc.id,'sub_category_name',sc.subcategory_name,'category_id',c.id,'category_name',c.category_name,'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name) order by c.category_name,sc.subcategory_name,pg.group_name,pg.id) from public.product_groups pg join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id),'[]'::jsonb),
    'route_families',coalesce((select jsonb_agg(to_jsonb(f) order by f.family_name,f.id) from costing.production_route_family f where f.status in ('DRAFT','IN_REVIEW','APPROVED') and (p_route_family_id is null or f.id=p_route_family_id)),'[]'::jsonb),
    'route_family_mappings',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name,'product_group_name',pg.group_name,'sub_category_name',sc.subcategory_name,'category_name',c.category_name,'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name) order by f.family_name,c.category_name,sc.subcategory_name,pg.group_name) from costing.production_route_family_product_group_map m join costing.production_route_family f on f.id=m.route_family_id join public.product_groups pg on pg.id=m.product_group_id join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id where m.status in ('DRAFT','IN_REVIEW','APPROVED') and (v_family_id is null or m.route_family_id=v_family_id) and (v_group_id is null or m.product_group_id=v_group_id)),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('product_id',p.id,'product_name',p.item,'status',p.status,'base_uom',p.uom_base,'product_group_id',sg.product_group_id,'product_group_name',pg.group_name,'sub_category_name',sc.subcategory_name,'category_name',c.category_name,'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name) order by p.item,p.id) from public.products p join public.sub_groups sg on sg.id=p.sub_group_id join public.product_groups pg on pg.id=sg.product_group_id join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id where upper(coalesce(p.status,''))='ACTIVE' and (v_group_id is null or sg.product_group_id=v_group_id)),'[]'::jsonb),
    'approved_route_family_routes',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name) order by f.family_name,r.route_version desc) from costing.production_route_family_route r join costing.production_route_family f on f.id=r.route_family_id where r.status='APPROVED' and r.effective_from<=v_as_of and (r.effective_to is null or r.effective_to>=v_as_of) and (v_family_id is null or r.route_family_id=v_family_id)),'[]'::jsonb),
    'batch_size_references',coalesce((select jsonb_agg(to_jsonb(b) order by b.product_id,b.effective_from desc,b.id desc) from public.production_batch_size_ref b where b.is_active and b.effective_from<=v_as_of and (p_product_id is null or b.product_id=p_product_id)),'[]'::jsonb),
    'behaviours',coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code) from costing.production_route_behaviour x where x.is_active),'[]'::jsonb),
    'resource_classes',coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code) from costing.production_resource_class x where x.is_active),'[]'::jsonb),
    'cost_centres',coalesce((select jsonb_agg(to_jsonb(x) order by x.cost_centre_name,x.id) from costing.production_cost_centre x where x.status='APPROVED' and x.effective_from<=v_as_of and (x.effective_to is null or x.effective_to>=v_as_of)),'[]'::jsonb),
    'activities',coalesce((select jsonb_agg(jsonb_build_object('activity_id',a.id,'activity_name',a.activity_name,'activity_kind_id',a.kind_id,'activity_kind',k.name,'short_code',k.short_code,'section_id',a.section_id,'subsection_id',a.sub_section_id,'area_id',a.area_id) order by a.activity_name,a.id) from public.activities a join public.activity_kinds k on k.id=a.kind_id),'[]'::jsonb)
  );
end
$function$;

create or replace function public.rpc_get_route_family_route_history(p_route_family_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
begin
  perform public.require_permission('module:production-route-manager',false);
  return jsonb_build_object('route_family_id',p_route_family_id,'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.route_version desc,r.id desc) from costing.production_route_family_route r where r.route_family_id=p_route_family_id),'[]'::jsonb));
end
$function$;

create or replace function public.rpc_get_route_family_route_detail(p_family_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  select jsonb_build_object('header',to_jsonb(r)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name),'validation',costing.fn_validate_route_family_route(r.id),'steps',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('activity_name',a.activity_name,'activity_kind',ak.name,'activity_short_code',ak.short_code,'cost_centre_code',cc.cost_centre_code,'cost_centre_name',cc.cost_centre_name,'section_name',sec.section_name,'subsection_name',sub.subsection_name,'area_name',ar.area_name,'plant_name',pm.plant_name) order by s.sequence_no,s.id) from costing.production_route_family_route_step s join public.activities a on a.id=s.activity_id join public.activity_kinds ak on ak.id=a.kind_id join costing.production_cost_centre cc on cc.id=s.cost_centre_id join public.sections sec on sec.id=s.section_id join public.subsections sub on sub.id=s.subsection_id join public.areas ar on ar.id=s.area_id left join public.plant_machinery pm on pm.id=s.plant_id where s.family_route_id=r.id),'[]'::jsonb)) into v_result from costing.production_route_family_route r join costing.production_route_family f on f.id=r.route_family_id where r.id=p_family_route_id;
  if v_result is null then raise exception 'Route Family route % not found',p_family_route_id; end if;
  return v_result;
end
$function$;

create or replace function public.rpc_get_product_route_detail(p_product_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  select jsonb_build_object('header',to_jsonb(r)||jsonb_build_object('product_name',p.item,'base_route_family_code',fr.route_code,'base_route_family_name',fr.route_name,'route_family_id',fr.route_family_id),'validation',costing.fn_validate_product_process_route(r.id),'overrides',coalesce((select jsonb_agg(to_jsonb(o) order by coalesce(o.sequence_no,999999),o.id) from costing.product_process_route_override o where o.product_route_id=r.id),'[]'::jsonb),'effective_steps',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('activity_name',a.activity_name,'activity_kind',ak.name,'activity_short_code',ak.short_code,'cost_centre_code',cc.cost_centre_code,'cost_centre_name',cc.cost_centre_name,'section_name',sec.section_name,'subsection_name',sub.subsection_name,'area_name',ar.area_name,'plant_name',pm.plant_name) order by e.sequence_no,e.effective_step_key) from costing.fn_effective_product_process_route_steps(r.id) e join public.activities a on a.id=e.activity_id join public.activity_kinds ak on ak.id=a.kind_id join costing.production_cost_centre cc on cc.id=e.cost_centre_id join public.sections sec on sec.id=e.section_id join public.subsections sub on sub.id=e.subsection_id join public.areas ar on ar.id=e.area_id left join public.plant_machinery pm on pm.id=e.plant_id),'[]'::jsonb)) into v_result from costing.product_process_route r join public.products p on p.id=r.product_id join costing.production_route_family_route fr on fr.id=r.base_route_family_route_id where r.id=p_product_route_id;
  if v_result is null then raise exception 'Product route % not found',p_product_route_id; end if;
  return v_result;
end
$function$;

create or replace function public.rpc_get_effective_product_process_route(p_product_id integer,p_as_of_date date default current_date)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_route_id bigint; v_family_id bigint; v_family_route_id bigint;
begin
  perform public.require_permission('module:production-route-manager',false);
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id,p_as_of_date);
  if v_family_id is null then return jsonb_build_object('product_id',p_product_id,'as_of_date',p_as_of_date,'readiness_status','BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING','steps','[]'::jsonb); end if;
  v_family_route_id:=costing.fn_resolve_effective_route_family_route(p_product_id,p_as_of_date);
  if v_family_route_id is null then return jsonb_build_object('product_id',p_product_id,'route_family_id',v_family_id,'as_of_date',p_as_of_date,'readiness_status','BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE','steps','[]'::jsonb); end if;
  v_route_id:=costing.fn_resolve_effective_product_process_route(p_product_id,p_as_of_date);
  if v_route_id is null then return jsonb_build_object('product_id',p_product_id,'route_family_id',v_family_id,'base_route_family_route_id',v_family_route_id,'as_of_date',p_as_of_date,'readiness_status','BLOCKED_NO_APPROVED_PRODUCT_PROCESS_ROUTE','steps','[]'::jsonb); end if;
  return public.rpc_get_product_route_detail(v_route_id)||jsonb_build_object('as_of_date',p_as_of_date,'readiness_status','READY');
end
$function$;

create or replace function public.rpc_create_route_family(
  p_family_code text,p_family_name text,p_effective_from date default null,p_description text default null
)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_family_code),'') is null or nullif(btrim(p_family_name),'') is null then raise exception 'Family code and name are required'; end if;
  insert into costing.production_route_family(family_code,family_name,effective_from,description,created_by) values(upper(btrim(p_family_code)),btrim(p_family_name),p_effective_from,nullif(btrim(p_description),''),auth.uid()) returning id into v_id;
  return jsonb_build_object('route_family_id',v_id,'status','DRAFT');
end
$function$;

create or replace function public.rpc_map_product_group_to_route_family(
  p_route_family_id bigint,p_product_group_id integer,p_effective_from date default null,p_mapping_basis text default 'MANUAL',p_mapping_note text default null
)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if exists(select 1 from costing.production_route_family_product_group_map where product_group_id=p_product_group_id and status in ('DRAFT','IN_REVIEW','APPROVED') and (effective_to is null or effective_to>=coalesce(p_effective_from,current_date))) then raise exception 'Product Group % already has an active or pending Route Family mapping',p_product_group_id; end if;
  insert into costing.production_route_family_product_group_map(route_family_id,product_group_id,effective_from,mapping_basis,mapping_note,created_by) values(p_route_family_id,p_product_group_id,p_effective_from,upper(coalesce(p_mapping_basis,'MANUAL')),nullif(btrim(p_mapping_note),''),auth.uid()) returning id into v_id;
  return jsonb_build_object('mapping_id',v_id,'status','DRAFT');
end
$function$;

create or replace function public.rpc_create_route_family_route_draft(
  p_route_family_id bigint,p_route_name text,p_effective_from date default null,p_source_type text default 'MANUAL',p_evidence_status text default 'MANUAL_COMPLETE',p_route_note text default null,p_supersedes_route_id bigint default null
)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_version integer; v_code text; v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_route_name),'') is null then raise exception 'Route name is required'; end if;
  select coalesce(max(route_version),0)+1 into v_version from costing.production_route_family_route where route_family_id=p_route_family_id;
  select family_code||'_ROUTE' into v_code from costing.production_route_family where id=p_route_family_id;
  if v_code is null then raise exception 'Route Family % not found',p_route_family_id; end if;
  insert into costing.production_route_family_route(route_family_id,route_code,route_version,route_name,effective_from,source_type,evidence_status,route_note,supersedes_route_id,created_by) values(p_route_family_id,v_code,v_version,btrim(p_route_name),p_effective_from,upper(p_source_type),upper(p_evidence_status),nullif(btrim(p_route_note),''),p_supersedes_route_id,auth.uid()) returning id into v_id;
  return jsonb_build_object('family_route_id',v_id,'route_version',v_version,'status','DRAFT');
end
$function$;

create or replace function public.rpc_upsert_route_family_route_step(p_family_route_id bigint,p_step_id bigint default null,p_step jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_status text; v_id bigint;
begin
  perform public.require_permission('module:production-route-manager',true);
  select status into v_status from costing.production_route_family_route where id=p_family_route_id;
  if v_status not in ('DRAFT','REVIEW_REQUIRED') then raise exception 'Route Family route is read-only in status %',v_status; end if;
  if p_step_id is null then
    insert into costing.production_route_family_route_step(family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note,created_by)
    values(p_family_route_id,p_step->>'step_key',(p_step->>'sequence_no')::numeric,(p_step->>'activity_id')::integer,(p_step->>'cost_centre_id')::bigint,(p_step->>'section_id')::integer,(p_step->>'subsection_id')::integer,(p_step->>'area_id')::integer,nullif(p_step->>'plant_id','')::integer,p_step->>'behaviour_code',p_step->>'resource_class_code',p_step->>'route_step_scope',coalesce((p_step->>'expected_occurrence_count')::numeric,1),coalesce((p_step->>'standard_cycle_count')::numeric,1),coalesce((p_step->>'is_mandatory')::boolean,true),coalesce((p_step->>'allows_repeat')::boolean,false),coalesce((p_step->>'allows_skip_with_approval')::boolean,false),coalesce(p_step->>'production_overhead_scope','INCLUDE'),coalesce(p_step->>'direct_labour_scope','INCLUDE'),nullif(p_step->>'step_note',''),auth.uid()) returning id into v_id;
  else
    update costing.production_route_family_route_step s set
      step_key=coalesce(p_step->>'step_key',s.step_key),sequence_no=coalesce((p_step->>'sequence_no')::numeric,s.sequence_no),activity_id=coalesce((p_step->>'activity_id')::integer,s.activity_id),cost_centre_id=coalesce((p_step->>'cost_centre_id')::bigint,s.cost_centre_id),section_id=coalesce((p_step->>'section_id')::integer,s.section_id),subsection_id=coalesce((p_step->>'subsection_id')::integer,s.subsection_id),area_id=coalesce((p_step->>'area_id')::integer,s.area_id),plant_id=case when p_step ? 'plant_id' then nullif(p_step->>'plant_id','')::integer else s.plant_id end,behaviour_code=coalesce(p_step->>'behaviour_code',s.behaviour_code),resource_class_code=coalesce(p_step->>'resource_class_code',s.resource_class_code),route_step_scope=coalesce(p_step->>'route_step_scope',s.route_step_scope),expected_occurrence_count=coalesce((p_step->>'expected_occurrence_count')::numeric,s.expected_occurrence_count),standard_cycle_count=coalesce((p_step->>'standard_cycle_count')::numeric,s.standard_cycle_count),is_mandatory=coalesce((p_step->>'is_mandatory')::boolean,s.is_mandatory),allows_repeat=coalesce((p_step->>'allows_repeat')::boolean,s.allows_repeat),allows_skip_with_approval=coalesce((p_step->>'allows_skip_with_approval')::boolean,s.allows_skip_with_approval),production_overhead_scope=coalesce(p_step->>'production_overhead_scope',s.production_overhead_scope),direct_labour_scope=coalesce(p_step->>'direct_labour_scope',s.direct_labour_scope),step_note=case when p_step ? 'step_note' then nullif(p_step->>'step_note','') else s.step_note end,updated_at=now()
    where s.id=p_step_id and s.family_route_id=p_family_route_id returning id into v_id;
  end if;
  if v_id is null then raise exception 'Route Family step not found'; end if;
  return jsonb_build_object('step_id',v_id);
end
$function$;

create or replace function public.rpc_delete_route_family_route_step(p_family_route_id bigint,p_step_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$
declare v_status text;
begin perform public.require_permission('module:production-route-manager',true); select status into v_status from costing.production_route_family_route where id=p_family_route_id; if v_status not in ('DRAFT','REVIEW_REQUIRED') then raise exception 'Route Family route is read-only'; end if; delete from costing.production_route_family_route_step where id=p_step_id and family_route_id=p_family_route_id; return jsonb_build_object('deleted',found); end
$function$;

create or replace function public.rpc_validate_route_family_route(p_family_route_id bigint)
returns jsonb language plpgsql security definer set search_path=public,costing as $function$ begin perform public.require_permission('module:production-route-manager',false); return costing.fn_validate_route_family_route(p_family_route_id); end $function$;

revoke all on function public.rpc_get_production_route_manager_readiness(date,text,text,bigint,integer,integer,integer) from public,anon;
revoke all on function public.rpc_get_production_route_master_options(integer,integer,bigint,date) from public,anon;
revoke all on function public.rpc_get_route_family_route_history(bigint) from public,anon;
revoke all on function public.rpc_get_route_family_route_detail(bigint) from public,anon;
revoke all on function public.rpc_create_route_family(text,text,date,text) from public,anon;
revoke all on function public.rpc_map_product_group_to_route_family(bigint,integer,date,text,text) from public,anon;
revoke all on function public.rpc_create_route_family_route_draft(bigint,text,date,text,text,text,bigint) from public,anon;
revoke all on function public.rpc_upsert_route_family_route_step(bigint,bigint,jsonb) from public,anon;
revoke all on function public.rpc_delete_route_family_route_step(bigint,bigint) from public,anon;
revoke all on function public.rpc_validate_route_family_route(bigint) from public,anon;

grant execute on function public.rpc_get_production_route_manager_readiness(date,text,text,bigint,integer,integer,integer) to authenticated,service_role;
grant execute on function public.rpc_get_production_route_master_options(integer,integer,bigint,date) to authenticated,service_role;
grant execute on function public.rpc_get_route_family_route_history(bigint) to authenticated,service_role;
grant execute on function public.rpc_get_route_family_route_detail(bigint) to authenticated,service_role;
grant execute on function public.rpc_create_route_family(text,text,date,text) to authenticated,service_role;
grant execute on function public.rpc_map_product_group_to_route_family(bigint,integer,date,text,text) to authenticated,service_role;
grant execute on function public.rpc_create_route_family_route_draft(bigint,text,date,text,text,text,bigint) to authenticated,service_role;
grant execute on function public.rpc_upsert_route_family_route_step(bigint,bigint,jsonb) to authenticated,service_role;
grant execute on function public.rpc_delete_route_family_route_step(bigint,bigint) to authenticated,service_role;
grant execute on function public.rpc_validate_route_family_route(bigint) to authenticated,service_role;