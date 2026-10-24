-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10I.2C.3F.1B.3A
-- Active Product Subgroup mapping read contract + master option enrichment.

create or replace function public.rpc_get_production_route_manager_subgroup_mappings(
  p_status text default null,
  p_search text default null,
  p_route_family_id bigint default null,
  p_product_group_id integer default null,
  p_product_subgroup_id integer default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,100),500));
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_status text:=nullif(upper(btrim(p_status)),'');
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  if v_status is not null and v_status not in('DRAFT','IN_REVIEW','APPROVED','INACTIVE','SUPERSEDED') then raise exception 'Invalid Subgroup mapping status %',p_status; end if;

  with rows0 as materialized (
    select m.id mapping_id,m.status,m.route_family_id,f.family_code route_family_code,f.family_name route_family_name,
           m.product_subgroup_id,sg.sub_group_name product_subgroup_name,sg.product_group_id,pg.group_name product_group_name,
           sc.id sub_category_id,sc.subcategory_name,c.id category_id,c.category_name,
           concat_ws(' › ',c.category_name,sc.subcategory_name,pg.group_name,sg.sub_group_name) hierarchy_label,
           m.mapping_basis,m.mapping_note,m.effective_from,m.effective_to,m.approval_reference,m.approved_by,m.approved_at,
           m.supersedes_mapping_id,m.created_by,m.created_at,m.updated_at,
           case when m.status='DRAFT' then jsonb_build_array('SUBMIT_FOR_REVIEW')
                when m.status='IN_REVIEW' then jsonb_build_array('APPROVE')
                when m.status='APPROVED' then jsonb_build_array('INACTIVATE') else '[]'::jsonb end lifecycle_actions,
           true definition_read_only
    from costing.production_route_family_product_subgroup_map m
    join public.sub_groups sg on sg.id=m.product_subgroup_id
    join public.product_groups pg on pg.id=sg.product_group_id
    join public.sub_categories sc on sc.id=pg.sub_category_id
    join public.categories c on c.id=sc.category_id
    join costing.production_route_family f on f.id=m.route_family_id and f.archived_at is null
    where m.archived_at is null
      and (p_route_family_id is null or m.route_family_id=p_route_family_id)
      and (p_product_group_id is null or sg.product_group_id=p_product_group_id)
      and (p_product_subgroup_id is null or m.product_subgroup_id=p_product_subgroup_id)
      and (nullif(btrim(p_search),'') is null
           or sg.sub_group_name ilike '%'||btrim(p_search)||'%'
           or pg.group_name ilike '%'||btrim(p_search)||'%'
           or f.family_name ilike '%'||btrim(p_search)||'%'
           or f.family_code ilike '%'||btrim(p_search)||'%'
           or c.category_name ilike '%'||btrim(p_search)||'%'
           or sc.subcategory_name ilike '%'||btrim(p_search)||'%'
           or m.id::text=btrim(p_search)
           or m.product_subgroup_id::text=btrim(p_search))
  ), filtered as (select * from rows0 where v_status is null or status=v_status),
  page as (
    select * from filtered
    order by case status when 'DRAFT' then 1 when 'IN_REVIEW' then 2 when 'APPROVED' then 3 when 'INACTIVE' then 4 when 'SUPERSEDED' then 5 else 6 end,
             category_name,subcategory_name,product_group_name,product_subgroup_name,effective_from desc,mapping_id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'status_filter',v_status,'total_count',(select count(*) from filtered),'limit',v_limit,'offset',v_offset,
    'status_counts',coalesce((select jsonb_object_agg(status,cnt order by status) from (select status,count(*) cnt from rows0 group by status)s),'{}'::jsonb),
    'rows',coalesce((select jsonb_agg(to_jsonb(p) order by
      case status when 'DRAFT' then 1 when 'IN_REVIEW' then 2 when 'APPROVED' then 3 when 'INACTIVE' then 4 when 'SUPERSEDED' then 5 else 6 end,
      category_name,subcategory_name,product_group_name,product_subgroup_name,effective_from desc,mapping_id desc) from page p),'[]'::jsonb)
  ) into v_result;
  return v_result;
end
$function$;

revoke all on function public.rpc_get_production_route_manager_subgroup_mappings(text,text,bigint,integer,integer,integer,integer) from public,anon;
grant execute on function public.rpc_get_production_route_manager_subgroup_mappings(text,text,bigint,integer,integer,integer,integer) to authenticated;

create or replace function public.rpc_get_production_route_master_options(
  p_product_id integer default null,
  p_product_group_id integer default null,
  p_route_family_id bigint default null,
  p_as_of_date date default current_date
) returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_as_of date:=coalesce(p_as_of_date,current_date);
  v_group_id integer;
  v_subgroup_id integer;
  v_family_id bigint;
begin
  perform public.require_permission('module:production-route-manager',false);

  if p_product_id is not null then
    select sg.product_group_id,sg.id into v_group_id,v_subgroup_id
    from public.products p join public.sub_groups sg on sg.id=p.sub_group_id
    where p.id=p_product_id;
  end if;
  v_group_id:=coalesce(p_product_group_id,v_group_id);
  v_family_id:=coalesce(p_route_family_id,case when p_product_id is not null then costing.fn_resolve_route_family_for_product(p_product_id,v_as_of) end);

  return jsonb_build_object(
    'as_of_date',v_as_of,
    'sections',coalesce((select jsonb_agg(jsonb_build_object('section_id',s.id,'section_name',s.section_name) order by s.section_name,s.id) from public.sections s),'[]'::jsonb),
    'subsections',coalesce((select jsonb_agg(jsonb_build_object('subsection_id',ss.id,'subsection_name',ss.subsection_name,'section_id',ss.section_id) order by ss.section_id,ss.subsection_name,ss.id) from public.subsections ss),'[]'::jsonb),
    'areas',coalesce((select jsonb_agg(jsonb_build_object('area_id',a.id,'area_name',a.area_name,'section_id',a.section_id,'subsection_id',a.subsection_id) order by a.section_id,a.subsection_id nulls first,a.area_name,a.id) from public.areas a),'[]'::jsonb),
    'plants',coalesce((select jsonb_agg(jsonb_build_object('plant_id',p.id,'plant_name',p.plant_name,'section_id',p.section_id,'subsection_id',p.subsection_id,'area_id',p.area_id,'status',p.status,'type_id',p.type_id) order by p.section_id,p.subsection_id,p.area_id,p.plant_name,p.id) from public.plant_machinery p),'[]'::jsonb),

    'product_groups',coalesce((
      select jsonb_agg(jsonb_build_object('product_group_id',pg.id,'product_group_name',pg.group_name,'sub_category_id',sc.id,'sub_category_name',sc.subcategory_name,
        'category_id',c.id,'category_name',c.category_name,'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name)
        order by c.category_name,sc.subcategory_name,pg.group_name,pg.id)
      from public.product_groups pg join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id
    ),'[]'::jsonb),

    'product_subgroups',coalesce((
      select jsonb_agg(jsonb_build_object('product_subgroup_id',sg.id,'product_subgroup_name',sg.sub_group_name,'product_group_id',pg.id,'product_group_name',pg.group_name,
        'sub_category_id',sc.id,'sub_category_name',sc.subcategory_name,'category_id',c.id,'category_name',c.category_name,
        'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name||' › '||sg.sub_group_name)
        order by c.category_name,sc.subcategory_name,pg.group_name,sg.sub_group_name,sg.id)
      from public.sub_groups sg join public.product_groups pg on pg.id=sg.product_group_id
      join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id
      where (v_group_id is null or sg.product_group_id=v_group_id)
    ),'[]'::jsonb),

    'route_families',coalesce((select jsonb_agg(to_jsonb(f) order by f.family_name,f.id)
      from costing.production_route_family f
      where f.archived_at is null and f.status in('DRAFT','IN_REVIEW','APPROVED') and (p_route_family_id is null or f.id=p_route_family_id)),'[]'::jsonb),

    'route_family_mappings',coalesce((
      select jsonb_agg(to_jsonb(m)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name,'product_group_name',pg.group_name,
        'sub_category_name',sc.subcategory_name,'category_name',c.category_name,'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name)
        order by f.family_name,c.category_name,sc.subcategory_name,pg.group_name)
      from costing.production_route_family_product_group_map m
      join costing.production_route_family f on f.id=m.route_family_id and f.archived_at is null
      join public.product_groups pg on pg.id=m.product_group_id join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id
      where m.archived_at is null and m.status in('DRAFT','IN_REVIEW','APPROVED')
        and (v_family_id is null or m.route_family_id=v_family_id) and (v_group_id is null or m.product_group_id=v_group_id)
    ),'[]'::jsonb),

    'route_family_subgroup_mappings',coalesce((
      select jsonb_agg(to_jsonb(m)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name,'product_subgroup_name',sg.sub_group_name,
        'product_group_id',pg.id,'product_group_name',pg.group_name,'sub_category_name',sc.subcategory_name,'category_name',c.category_name,
        'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name||' › '||sg.sub_group_name)
        order by f.family_name,c.category_name,sc.subcategory_name,pg.group_name,sg.sub_group_name)
      from costing.production_route_family_product_subgroup_map m
      join costing.production_route_family f on f.id=m.route_family_id and f.archived_at is null
      join public.sub_groups sg on sg.id=m.product_subgroup_id join public.product_groups pg on pg.id=sg.product_group_id
      join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id
      where m.archived_at is null and m.status in('DRAFT','IN_REVIEW','APPROVED')
        and (v_family_id is null or m.route_family_id=v_family_id)
        and (v_group_id is null or sg.product_group_id=v_group_id)
        and (v_subgroup_id is null or m.product_subgroup_id=v_subgroup_id)
    ),'[]'::jsonb),

    'products',coalesce((
      select jsonb_agg(jsonb_build_object('product_id',p.id,'product_name',p.item,'status',p.status,'base_uom',p.uom_base,
        'product_subgroup_id',sg.id,'product_subgroup_name',sg.sub_group_name,'product_group_id',sg.product_group_id,'product_group_name',pg.group_name,
        'sub_category_name',sc.subcategory_name,'category_name',c.category_name,
        'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name||' › '||sg.sub_group_name)
        order by p.item,p.id)
      from public.products p join public.sub_groups sg on sg.id=p.sub_group_id join public.product_groups pg on pg.id=sg.product_group_id
      join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id
      where upper(coalesce(p.status,''))='ACTIVE' and (v_group_id is null or sg.product_group_id=v_group_id)
    ),'[]'::jsonb),

    'approved_route_family_routes',coalesce((
      select jsonb_agg(to_jsonb(r)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name) order by f.family_name,r.route_version desc)
      from costing.production_route_family_route r join costing.production_route_family f on f.id=r.route_family_id and f.archived_at is null
      where r.archived_at is null and r.status='APPROVED' and r.effective_from<=v_as_of and (r.effective_to is null or r.effective_to>=v_as_of)
        and (v_family_id is null or r.route_family_id=v_family_id)
    ),'[]'::jsonb),

    'batch_size_references',coalesce((select jsonb_agg(to_jsonb(b) order by b.product_id,b.effective_from desc,b.id desc)
      from public.production_batch_size_ref b where b.is_active and b.effective_from<=v_as_of and (p_product_id is null or b.product_id=p_product_id)),'[]'::jsonb),
    'behaviours',coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code) from costing.production_route_behaviour x where x.is_active),'[]'::jsonb),
    'resource_classes',coalesce((select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code) from costing.production_resource_class x where x.is_active),'[]'::jsonb),
    'cost_centres',coalesce((select jsonb_agg(to_jsonb(x) order by x.cost_centre_name,x.id) from costing.production_cost_centre x
      where x.status='APPROVED' and x.effective_from<=v_as_of and (x.effective_to is null or x.effective_to>=v_as_of)),'[]'::jsonb),
    'activities',coalesce((select jsonb_agg(jsonb_build_object('activity_id',a.id,'activity_name',a.activity_name,'activity_kind_id',a.kind_id,
      'activity_kind',k.name,'short_code',k.short_code,'section_id',a.section_id,'subsection_id',a.sub_section_id,'area_id',a.area_id)
      order by a.activity_name,a.id) from public.activities a join public.activity_kinds k on k.id=a.kind_id),'[]'::jsonb)
  );
end
$function$;