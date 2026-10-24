-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_master_options(
  p_product_id integer default null,
  p_product_group_id integer default null,
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'costing'
as $function$
declare
  v_group_id integer;
  v_as_of_date date := coalesce(p_as_of_date, current_date);
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager', false);

  v_group_id := coalesce(
    p_product_group_id,
    case
      when p_product_id is not null
        then costing.fn_product_group_id_for_product(p_product_id)
    end
  );

  select jsonb_build_object(
    'product',
      case when p_product_id is null then null else (
        select jsonb_build_object(
          'product_id', p.id,
          'product_name', p.item,
          'status', p.status,
          'base_uom', p.uom_base,
          'product_group_id', costing.fn_product_group_id_for_product(p.id)
        )
        from public.products p
        where p.id = p_product_id
      ) end,

    'product_group',
      case when v_group_id is null then null else (
        select jsonb_build_object(
          'product_group_id', g.id,
          'product_group_name', g.group_name
        )
        from public.product_groups g
        where g.id = v_group_id
      ) end,

    'product_groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_group_id', g.id,
          'product_group_name', g.group_name,
          'sub_category_id', g.sub_category_id,
          'kind_id', g.kind_id
        )
        order by g.group_name, g.id
      )
      from public.product_groups g
    ), '[]'::jsonb),

    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_id', p.id,
          'product_name', p.item,
          'status', p.status,
          'base_uom', p.uom_base,
          'product_group_id', sg.product_group_id,
          'product_group_name', g.group_name
        )
        order by p.item, p.id
      )
      from public.products p
      join public.sub_groups sg on sg.id = p.sub_group_id
      join public.product_groups g on g.id = sg.product_group_id
      where upper(coalesce(p.status, '')) = 'ACTIVE'
        and (v_group_id is null or sg.product_group_id = v_group_id)
    ), '[]'::jsonb),

    'approved_group_routes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'group_route_id', g.id,
          'product_group_id', g.product_group_id,
          'route_code', g.route_code,
          'route_name', g.route_name,
          'route_version', g.route_version,
          'effective_from', g.effective_from,
          'effective_to', g.effective_to,
          'status', g.status
        )
        order by g.product_group_id, g.route_version desc
      )
      from costing.product_group_process_route g
      where (v_group_id is null or g.product_group_id = v_group_id)
        and g.status = 'APPROVED'
        and g.effective_from <= v_as_of_date
        and (g.effective_to is null or g.effective_to >= v_as_of_date)
    ), '[]'::jsonb),

    'batch_size_references', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'batch_size_ref_id', b.id,
          'product_id', b.product_id,
          'preferred_batch_size', b.preferred_batch_size,
          'min_batch_size', b.min_batch_size,
          'max_batch_size', b.max_batch_size,
          'effective_from', b.effective_from,
          'is_active', b.is_active
        )
        order by b.product_id, b.effective_from desc, b.id desc
      )
      from public.production_batch_size_ref b
      where (p_product_id is null or b.product_id = p_product_id)
        and b.is_active = true
        and b.effective_from <= v_as_of_date
    ), '[]'::jsonb),

    'behaviours', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order, x.code)
      from costing.production_route_behaviour x
      where x.is_active = true
    ), '[]'::jsonb),

    'resource_classes', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.sort_order, x.code)
      from costing.production_resource_class x
      where x.is_active = true
    ), '[]'::jsonb),

    'cost_centres', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'cost_centre_id', c.id,
          'code', c.cost_centre_code,
          'name', c.cost_centre_name,
          'type', c.cost_centre_type,
          'section_id', c.section_id,
          'subsection_id', c.subsection_id,
          'area_id', c.area_id,
          'plant_id', c.plant_id,
          'default_resource_class_code', c.default_resource_class_code,
          'pool_scope', c.pool_scope,
          'status', c.status
        )
        order by c.cost_centre_name, c.id
      )
      from costing.production_cost_centre c
      where c.status = 'APPROVED'
        and c.effective_from <= v_as_of_date
        and (c.effective_to is null or c.effective_to >= v_as_of_date)
    ), '[]'::jsonb),

    'activities', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'activity_id', a.id,
          'activity_name', a.activity_name,
          'activity_kind_id', a.kind_id,
          'activity_kind', k.name,
          'short_code', k.short_code,
          'section_id', a.section_id,
          'subsection_id', a.sub_section_id,
          'area_id', a.area_id
        )
        order by a.activity_name, a.id
      )
      from public.activities a
      join public.activity_kinds k on k.id = a.kind_id
    ), '[]'::jsonb),

    'as_of_date', v_as_of_date
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.rpc_get_production_route_master_options(integer, integer, date) from public, anon;
grant execute on function public.rpc_get_production_route_master_options(integer, integer, date) to authenticated, service_role, postgres;