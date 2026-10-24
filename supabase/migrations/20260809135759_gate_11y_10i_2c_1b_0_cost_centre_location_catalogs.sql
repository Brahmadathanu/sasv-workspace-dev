-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_master_options(
  p_product_id integer default null,
  p_product_group_id integer default null,
  p_route_family_id bigint default null,
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'costing'
as $function$
declare
  v_as_of date := coalesce(p_as_of_date,current_date);
  v_group_id integer;
  v_family_id bigint;
begin
  perform public.require_permission('module:production-route-manager',false);

  v_group_id := coalesce(
    p_product_group_id,
    case when p_product_id is not null then costing.fn_product_group_id_for_product(p_product_id) end
  );

  v_family_id := coalesce(
    p_route_family_id,
    case when p_product_id is not null then costing.fn_resolve_route_family_for_product(p_product_id,v_as_of) end
  );

  return jsonb_build_object(
    'as_of_date',v_as_of,

    'sections',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'section_id',s.id,
          'section_name',s.section_name
        )
        order by s.section_name,s.id
      )
      from public.sections s
    ),'[]'::jsonb),

    'subsections',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subsection_id',ss.id,
          'subsection_name',ss.subsection_name,
          'section_id',ss.section_id
        )
        order by ss.section_id,ss.subsection_name,ss.id
      )
      from public.subsections ss
    ),'[]'::jsonb),

    'areas',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'area_id',a.id,
          'area_name',a.area_name,
          'section_id',a.section_id,
          'subsection_id',a.subsection_id
        )
        order by a.section_id,a.subsection_id nulls first,a.area_name,a.id
      )
      from public.areas a
    ),'[]'::jsonb),

    'plants',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'plant_id',p.id,
          'plant_name',p.plant_name,
          'section_id',p.section_id,
          'subsection_id',p.subsection_id,
          'area_id',p.area_id,
          'status',p.status,
          'type_id',p.type_id
        )
        order by p.section_id,p.subsection_id,p.area_id,p.plant_name,p.id
      )
      from public.plant_machinery p
    ),'[]'::jsonb),

    'product_groups',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_group_id',pg.id,
          'product_group_name',pg.group_name,
          'sub_category_id',sc.id,
          'sub_category_name',sc.subcategory_name,
          'category_id',c.id,
          'category_name',c.category_name,
          'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name
        )
        order by c.category_name,sc.subcategory_name,pg.group_name,pg.id
      )
      from public.product_groups pg
      join public.sub_categories sc on sc.id=pg.sub_category_id
      join public.categories c on c.id=sc.category_id
    ),'[]'::jsonb),

    'route_families',coalesce((
      select jsonb_agg(to_jsonb(f) order by f.family_name,f.id)
      from costing.production_route_family f
      where f.status in ('DRAFT','IN_REVIEW','APPROVED')
        and (p_route_family_id is null or f.id=p_route_family_id)
    ),'[]'::jsonb),

    'route_family_mappings',coalesce((
      select jsonb_agg(
        to_jsonb(m)||jsonb_build_object(
          'family_code',f.family_code,
          'family_name',f.family_name,
          'product_group_name',pg.group_name,
          'sub_category_name',sc.subcategory_name,
          'category_name',c.category_name,
          'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name
        )
        order by f.family_name,c.category_name,sc.subcategory_name,pg.group_name
      )
      from costing.production_route_family_product_group_map m
      join costing.production_route_family f on f.id=m.route_family_id
      join public.product_groups pg on pg.id=m.product_group_id
      join public.sub_categories sc on sc.id=pg.sub_category_id
      join public.categories c on c.id=sc.category_id
      where m.status in ('DRAFT','IN_REVIEW','APPROVED')
        and (v_family_id is null or m.route_family_id=v_family_id)
        and (v_group_id is null or m.product_group_id=v_group_id)
    ),'[]'::jsonb),

    'products',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id',p.id,
          'product_name',p.item,
          'status',p.status,
          'base_uom',p.uom_base,
          'product_group_id',sg.product_group_id,
          'product_group_name',pg.group_name,
          'sub_category_name',sc.subcategory_name,
          'category_name',c.category_name,
          'hierarchy_label',c.category_name||' › '||sc.subcategory_name||' › '||pg.group_name
        )
        order by p.item,p.id
      )
      from public.products p
      join public.sub_groups sg on sg.id=p.sub_group_id
      join public.product_groups pg on pg.id=sg.product_group_id
      join public.sub_categories sc on sc.id=pg.sub_category_id
      join public.categories c on c.id=sc.category_id
      where upper(coalesce(p.status,''))='ACTIVE'
        and (v_group_id is null or sg.product_group_id=v_group_id)
    ),'[]'::jsonb),

    'approved_route_family_routes',coalesce((
      select jsonb_agg(
        to_jsonb(r)||jsonb_build_object('family_code',f.family_code,'family_name',f.family_name)
        order by f.family_name,r.route_version desc
      )
      from costing.production_route_family_route r
      join costing.production_route_family f on f.id=r.route_family_id
      where r.status='APPROVED'
        and r.effective_from<=v_as_of
        and (r.effective_to is null or r.effective_to>=v_as_of)
        and (v_family_id is null or r.route_family_id=v_family_id)
    ),'[]'::jsonb),

    'batch_size_references',coalesce((
      select jsonb_agg(to_jsonb(b) order by b.product_id,b.effective_from desc,b.id desc)
      from public.production_batch_size_ref b
      where b.is_active
        and b.effective_from<=v_as_of
        and (p_product_id is null or b.product_id=p_product_id)
    ),'[]'::jsonb),

    'behaviours',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code)
      from costing.production_route_behaviour x
      where x.is_active
    ),'[]'::jsonb),

    'resource_classes',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order,x.code)
      from costing.production_resource_class x
      where x.is_active
    ),'[]'::jsonb),

    'cost_centres',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.cost_centre_name,x.id)
      from costing.production_cost_centre x
      where x.status='APPROVED'
        and x.effective_from<=v_as_of
        and (x.effective_to is null or x.effective_to>=v_as_of)
    ),'[]'::jsonb),

    'activities',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'activity_id',a.id,
          'activity_name',a.activity_name,
          'activity_kind_id',a.kind_id,
          'activity_kind',k.name,
          'short_code',k.short_code,
          'section_id',a.section_id,
          'subsection_id',a.sub_section_id,
          'area_id',a.area_id
        )
        order by a.activity_name,a.id
      )
      from public.activities a
      join public.activity_kinds k on k.id=a.kind_id
    ),'[]'::jsonb)
  );
end
$function$;