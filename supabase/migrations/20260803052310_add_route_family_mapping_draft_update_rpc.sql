-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_update_route_family_mapping_draft(
  p_mapping_id bigint,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'costing'
as $function$
declare
  v_mapping costing.production_route_family_product_group_map%rowtype;
  v_allowed_keys constant text[] := array['effective_from','mapping_basis','mapping_note'];
  v_unknown_keys text[];
  v_basis text;
begin
  perform public.require_permission('module:production-route-manager', true);

  if p_mapping_id is null or p_mapping_id <= 0 then
    raise exception 'A valid mapping ID is required';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'A non-empty mapping patch object is required';
  end if;

  select array_agg(k order by k)
  into v_unknown_keys
  from jsonb_object_keys(p_patch) as k
  where not (k = any(v_allowed_keys));

  if coalesce(cardinality(v_unknown_keys),0) > 0 then
    raise exception 'Unsupported mapping patch keys: %', array_to_string(v_unknown_keys, ', ');
  end if;

  if p_patch ? 'mapping_basis' then
    v_basis := upper(nullif(btrim(p_patch->>'mapping_basis'),''));
    if v_basis is null or v_basis not in ('MANUAL','HISTORICAL_REVIEW','MIGRATED') then
      raise exception 'Mapping basis must be MANUAL, HISTORICAL_REVIEW, or MIGRATED';
    end if;
  end if;

  if p_patch ? 'effective_from' and nullif(btrim(p_patch->>'effective_from'),'') is null then
    raise exception 'Effective-from date cannot be blank when supplied';
  end if;

  update costing.production_route_family_product_group_map m
  set
    effective_from = case
      when p_patch ? 'effective_from' then (p_patch->>'effective_from')::date
      else m.effective_from
    end,
    mapping_basis = case
      when p_patch ? 'mapping_basis' then v_basis
      else m.mapping_basis
    end,
    mapping_note = case
      when p_patch ? 'mapping_note' then nullif(btrim(p_patch->>'mapping_note'),'')
      else m.mapping_note
    end,
    updated_at = now()
  where m.id = p_mapping_id
    and m.status in ('DRAFT','IN_REVIEW')
  returning m.* into v_mapping;

  if not found then
    if exists (
      select 1
      from costing.production_route_family_product_group_map
      where id = p_mapping_id
    ) then
      raise exception 'Only DRAFT or IN_REVIEW Route Family mappings may be updated';
    end if;
    raise exception 'Route Family mapping % not found', p_mapping_id;
  end if;

  return jsonb_build_object(
    'mapping', to_jsonb(v_mapping),
    'mapping_id', v_mapping.id,
    'status', v_mapping.status,
    'updated', true
  );
end
$function$;

revoke all on function public.rpc_update_route_family_mapping_draft(bigint,jsonb) from public;
revoke all on function public.rpc_update_route_family_mapping_draft(bigint,jsonb) from anon;
grant execute on function public.rpc_update_route_family_mapping_draft(bigint,jsonb) to authenticated;

do $block$
begin
  if has_function_privilege('public','public.rpc_update_route_family_mapping_draft(bigint,jsonb)','EXECUTE') then
    raise exception 'PUBLIC must not execute rpc_update_route_family_mapping_draft';
  end if;
  if has_function_privilege('anon','public.rpc_update_route_family_mapping_draft(bigint,jsonb)','EXECUTE') then
    raise exception 'anon must not execute rpc_update_route_family_mapping_draft';
  end if;
  if not has_function_privilege('authenticated','public.rpc_update_route_family_mapping_draft(bigint,jsonb)','EXECUTE') then
    raise exception 'authenticated must execute rpc_update_route_family_mapping_draft';
  end if;
end
$block$;