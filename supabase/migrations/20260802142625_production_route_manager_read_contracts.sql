-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_manager_readiness(
  p_as_of_date date default current_date,
  p_search text default null,
  p_readiness_status text default null,
  p_product_group_id integer default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,100),500));
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager', false);

  with filtered as (
    select r.*
    from costing.v_product_process_route_readiness r
    where (p_product_group_id is null or r.product_group_id=p_product_group_id)
      and (p_readiness_status is null or r.readiness_status=p_readiness_status)
      and (
        nullif(btrim(p_search),'') is null
        or r.product_name ilike '%'||btrim(p_search)||'%'
        or r.product_group_name ilike '%'||btrim(p_search)||'%'
        or r.product_id::text=btrim(p_search)
      )
  ), page as (
    select * from filtered
    order by product_group_name nulls last, product_name, product_id
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'as_of_date',p_as_of_date,
    'total_count',(select count(*) from filtered),
    'limit',v_limit,
    'offset',v_offset,
    'rows',coalesce((select jsonb_agg(to_jsonb(page) order by product_group_name nulls last,product_name,product_id) from page),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.rpc_get_production_route_master_options(
  p_product_id integer default null,
  p_product_group_id integer default null,
  p_as_of_date date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
declare v_group_id integer; v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager', false);
  v_group_id := coalesce(p_product_group_id, case when p_product_id is not null then costing.fn_product_group_id_for_product(p_product_id) end);

  select jsonb_build_object(
    'product',case when p_product_id is null then null else (
      select jsonb_build_object('product_id',p.id,'product_name',p.item,'status',p.status,'base_uom',p.uom_base,'product_group_id',costing.fn_product_group_id_for_product(p.id))
      from public.products p where p.id=p_product_id
    ) end,
    'product_group',case when v_group_id is null then null else (
      select jsonb_build_object('product_group_id',g.id,'product_group_name',g.group_name)
      from public.product_groups g where g.id=v_group_id
    ) end,
    'approved_group_routes',coalesce((
      select jsonb_agg(jsonb_build_object('group_route_id',g.id,'route_code',g.route_code,'route_name',g.route_name,'route_version',g.route_version,'effective_from',g.effective_from,'effective_to',g.effective_to,'status',g.status) order by g.route_version desc)
      from costing.product_group_process_route g
      where (v_group_id is null or g.product_group_id=v_group_id) and g.status='APPROVED'
    ),'[]'::jsonb),
    'batch_size_references',coalesce((
      select jsonb_agg(jsonb_build_object('batch_size_ref_id',b.id,'product_id',b.product_id,'preferred_batch_size',b.preferred_batch_size,'min_batch_size',b.min_batch_size,'max_batch_size',b.max_batch_size,'effective_from',b.effective_from,'is_active',b.is_active) order by b.effective_from desc,b.id desc)
      from public.production_batch_size_ref b
      where (p_product_id is null or b.product_id=p_product_id)
    ),'[]'::jsonb),
    'behaviours',coalesce((select jsonb_agg(to_jsonb(x) order by x.code) from costing.production_route_behaviour x where x.status='APPROVED'),'[]'::jsonb),
    'resource_classes',coalesce((select jsonb_agg(to_jsonb(x) order by x.code) from costing.production_resource_class x where x.status='APPROVED'),'[]'::jsonb),
    'cost_centres',coalesce((
      select jsonb_agg(jsonb_build_object(
        'cost_centre_id',c.id,'code',c.cost_centre_code,'name',c.cost_centre_name,'type',c.cost_centre_type,
        'section_id',c.section_id,'subsection_id',c.subsection_id,'area_id',c.area_id,'plant_id',c.plant_id,
        'default_resource_class_code',c.default_resource_class_code,'pool_scope',c.pool_scope,'status',c.status
      ) order by c.cost_centre_name,c.id)
      from costing.production_cost_centre c
      where c.status='APPROVED' and c.effective_from<=p_as_of_date and (c.effective_to is null or c.effective_to>=p_as_of_date)
    ),'[]'::jsonb),
    'activities',coalesce((
      select jsonb_agg(jsonb_build_object(
        'activity_id',a.id,'activity_name',a.activity_name,'activity_kind_id',a.kind_id,'activity_kind',k.name,'short_code',k.short_code,
        'section_id',a.section_id,'subsection_id',a.sub_section_id,'area_id',a.area_id
      ) order by a.activity_name,a.id)
      from public.activities a join public.activity_kinds k on k.id=a.kind_id
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.rpc_get_product_group_route_detail(p_group_route_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
declare v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager', false);
  if not exists(select 1 from costing.product_group_process_route where id=p_group_route_id) then
    raise exception 'Product Group route % not found',p_group_route_id;
  end if;
  select jsonb_build_object(
    'header',to_jsonb(g) || jsonb_build_object('product_group_name',pg.group_name),
    'validation',costing.fn_validate_group_process_route(g.id),
    'steps',coalesce((
      select jsonb_agg(to_jsonb(s) || jsonb_build_object(
        'activity_name',a.activity_name,'activity_kind',ak.name,'activity_short_code',ak.short_code,
        'cost_centre_code',cc.cost_centre_code,'cost_centre_name',cc.cost_centre_name,
        'section_name',sec.section_name,'subsection_name',sub.subsection_name,'area_name',ar.area_name,'plant_name',pm.plant_name
      ) order by s.sequence_no,s.id)
      from costing.product_group_process_route_step s
      join public.activities a on a.id=s.activity_id
      join public.activity_kinds ak on ak.id=a.kind_id
      join costing.production_cost_centre cc on cc.id=s.cost_centre_id
      join public.sections sec on sec.id=s.section_id
      join public.subsections sub on sub.id=s.subsection_id
      join public.areas ar on ar.id=s.area_id
      left join public.plant_machinery pm on pm.id=s.plant_id
      where s.group_route_id=g.id
    ),'[]'::jsonb)
  ) into v_result
  from costing.product_group_process_route g
  join public.product_groups pg on pg.id=g.product_group_id
  where g.id=p_group_route_id;
  return v_result;
end;
$$;

create or replace function public.rpc_get_product_route_detail(p_product_route_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
declare v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager', false);
  if not exists(select 1 from costing.product_process_route where id=p_product_route_id) then
    raise exception 'Product route % not found',p_product_route_id;
  end if;
  select jsonb_build_object(
    'header',to_jsonb(r) || jsonb_build_object('product_name',p.item,'product_group_id',g.product_group_id,'base_group_route_code',g.route_code,'base_group_route_name',g.route_name),
    'validation',costing.fn_validate_product_process_route(r.id),
    'overrides',coalesce((select jsonb_agg(to_jsonb(o) order by coalesce(o.sequence_no,999999),o.id) from costing.product_process_route_override o where o.product_route_id=r.id),'[]'::jsonb),
    'effective_steps',coalesce((
      select jsonb_agg(to_jsonb(e) || jsonb_build_object(
        'activity_name',a.activity_name,'activity_kind',ak.name,'activity_short_code',ak.short_code,
        'cost_centre_code',cc.cost_centre_code,'cost_centre_name',cc.cost_centre_name,
        'section_name',sec.section_name,'subsection_name',sub.subsection_name,'area_name',ar.area_name,'plant_name',pm.plant_name
      ) order by e.sequence_no,e.effective_step_key)
      from costing.fn_effective_product_process_route_steps(r.id) e
      join public.activities a on a.id=e.activity_id
      join public.activity_kinds ak on ak.id=a.kind_id
      join costing.production_cost_centre cc on cc.id=e.cost_centre_id
      join public.sections sec on sec.id=e.section_id
      join public.subsections sub on sub.id=e.subsection_id
      join public.areas ar on ar.id=e.area_id
      left join public.plant_machinery pm on pm.id=e.plant_id
    ),'[]'::jsonb)
  ) into v_result
  from costing.product_process_route r
  join public.products p on p.id=r.product_id
  join costing.product_group_process_route g on g.id=r.base_group_route_id
  where r.id=p_product_route_id;
  return v_result;
end;
$$;

create or replace function public.rpc_get_effective_product_process_route(p_product_id integer,p_as_of_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
declare v_route_id bigint;
begin
  perform public.require_permission('module:production-route-manager', false);
  v_route_id:=costing.fn_resolve_effective_product_process_route(p_product_id,p_as_of_date);
  if v_route_id is null then
    return jsonb_build_object('product_id',p_product_id,'as_of_date',p_as_of_date,'readiness_status','BLOCKED_NO_APPROVED_PRODUCT_PROCESS_ROUTE','product_route_id',null,'steps','[]'::jsonb);
  end if;
  return public.rpc_get_product_route_detail(v_route_id) || jsonb_build_object('as_of_date',p_as_of_date,'readiness_status','READY');
end;
$$;

create or replace function public.rpc_get_product_group_route_history(p_product_group_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
begin
  perform public.require_permission('module:production-route-manager', false);
  return jsonb_build_object(
    'product_group_id',p_product_group_id,
    'rows',coalesce((select jsonb_agg(to_jsonb(g) order by g.route_version desc,g.id desc) from costing.product_group_process_route g where g.product_group_id=p_product_group_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.rpc_get_product_route_history(p_product_id integer)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
begin
  perform public.require_permission('module:production-route-manager', false);
  return jsonb_build_object(
    'product_id',p_product_id,
    'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.route_version desc,r.id desc) from costing.product_process_route r where r.product_id=p_product_id),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.rpc_get_production_route_manager_readiness(date,text,text,integer,integer,integer) from public,anon;
revoke all on function public.rpc_get_production_route_master_options(integer,integer,date) from public,anon;
revoke all on function public.rpc_get_product_group_route_detail(bigint) from public,anon;
revoke all on function public.rpc_get_product_route_detail(bigint) from public,anon;
revoke all on function public.rpc_get_effective_product_process_route(integer,date) from public,anon;
revoke all on function public.rpc_get_product_group_route_history(integer) from public,anon;
revoke all on function public.rpc_get_product_route_history(integer) from public,anon;
grant execute on function public.rpc_get_production_route_manager_readiness(date,text,text,integer,integer,integer) to authenticated,service_role;
grant execute on function public.rpc_get_production_route_master_options(integer,integer,date) to authenticated,service_role;
grant execute on function public.rpc_get_product_group_route_detail(bigint) to authenticated,service_role;
grant execute on function public.rpc_get_product_route_detail(bigint) to authenticated,service_role;
grant execute on function public.rpc_get_effective_product_process_route(integer,date) to authenticated,service_role;
grant execute on function public.rpc_get_product_group_route_history(integer) to authenticated,service_role;
grant execute on function public.rpc_get_product_route_history(integer) to authenticated,service_role;