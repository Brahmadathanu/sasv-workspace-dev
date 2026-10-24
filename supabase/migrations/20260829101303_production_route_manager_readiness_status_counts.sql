-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_production_route_manager_readiness(
  p_as_of_date date default current_date,
  p_search text default null::text,
  p_readiness_status text default null::text,
  p_route_family_id bigint default null::bigint,
  p_product_group_id integer default null::integer,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'costing', 'pg_temp'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 100), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_as_of date := coalesce(p_as_of_date, current_date);
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager', false);

  with readiness as materialized (
    select r.*
    from costing.fn_product_process_route_readiness(v_as_of) r
  ),
  count_scope as (
    select r.*
    from readiness r
    where (p_route_family_id is null or r.route_family_id = p_route_family_id)
      and (p_product_group_id is null or r.product_group_id = p_product_group_id)
      and (
        nullif(btrim(p_search), '') is null
        or r.product_name ilike '%' || btrim(p_search) || '%'
        or r.product_group_name ilike '%' || btrim(p_search) || '%'
        or r.route_family_name ilike '%' || btrim(p_search) || '%'
        or r.category_name ilike '%' || btrim(p_search) || '%'
        or r.subcategory_name ilike '%' || btrim(p_search) || '%'
        or r.product_id::text = btrim(p_search)
      )
  ),
  filtered as (
    select r.*
    from count_scope r
    where (p_readiness_status is null or r.readiness_status = p_readiness_status)
  ),
  page as (
    select *
    from filtered
    order by category_name, subcategory_name, product_group_name, product_name, product_id
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'as_of_date', v_as_of,
    'total_count', (select count(*) from filtered),
    'limit', v_limit,
    'offset', v_offset,
    'status_counts', coalesce((
      select jsonb_object_agg(readiness_status, cnt order by readiness_status)
      from (
        select readiness_status, count(*) as cnt
        from count_scope
        group by readiness_status
      ) s
    ), '{}'::jsonb),
    'data_quality_gate_status', 'DEFERRED_UNTIL_PIPELINE_COMPLETE',
    'rows', coalesce((
      select jsonb_agg(
        to_jsonb(page)
        order by category_name, subcategory_name, product_group_name, product_name, product_id
      )
      from page
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;