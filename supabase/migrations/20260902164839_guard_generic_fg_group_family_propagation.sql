-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function lab.fn_set_active_fg_protocol_for_group_family(
  p_product_group_id integer,
  p_protocol_category_id bigint,
  p_remarks text default null::text
)
returns integer
language plpgsql
security definer
set search_path to 'lab','public'
as $function$
declare
  v_group_key text;
  v_count integer;
  v_is_generic boolean;
begin
  select lower(trim(group_name))
    into v_group_key
  from public.product_groups
  where id = p_product_group_id;

  if v_group_key is null then
    raise exception 'Invalid product_group_id %', p_product_group_id;
  end if;

  v_is_generic := v_group_key in ('xx','miscellaneous items');

  update lab.protocol_category_product_group_map m
  set is_active = false,
      updated_at = now()
  where m.product_group_id in (
    select pg.id
    from public.product_groups pg
    where (v_is_generic and pg.id = p_product_group_id)
       or (not v_is_generic and lower(trim(pg.group_name)) = v_group_key)
  )
    and m.is_active = true;

  insert into lab.protocol_category_product_group_map (
    protocol_category_id,
    product_group_id,
    is_active,
    remarks
  )
  select
    p_protocol_category_id,
    pg.id,
    true,
    coalesce(
      p_remarks,
      case when v_is_generic
           then 'Single-group FG protocol mapping for generic legacy group name'
           else 'Family-aware FG protocol mapping'
      end
    )
  from public.product_groups pg
  where (v_is_generic and pg.id = p_product_group_id)
     or (not v_is_generic and lower(trim(pg.group_name)) = v_group_key);

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function lab.fn_set_active_fg_group_spec_profile_family(
  p_product_group_id integer,
  p_spec_profile_id bigint,
  p_remarks text default null::text
)
returns integer
language plpgsql
security definer
set search_path to 'lab','public'
as $function$
declare
  v_group_key text;
  v_count integer;
  v_is_generic boolean;
begin
  select lower(trim(group_name))
    into v_group_key
  from public.product_groups
  where id = p_product_group_id;

  if v_group_key is null then
    raise exception 'Invalid product_group_id %', p_product_group_id;
  end if;

  v_is_generic := v_group_key in ('xx','miscellaneous items');

  update lab.spec_profile_product_group_map m
  set is_active = false,
      updated_at = now()
  where m.product_group_id in (
    select pg.id
    from public.product_groups pg
    where (v_is_generic and pg.id = p_product_group_id)
       or (not v_is_generic and lower(trim(pg.group_name)) = v_group_key)
  )
    and m.is_active = true;

  insert into lab.spec_profile_product_group_map (
    spec_profile_id,
    product_group_id,
    is_active,
    remarks
  )
  select
    p_spec_profile_id,
    pg.id,
    true,
    coalesce(
      p_remarks,
      case when v_is_generic
           then 'Single-group FG base spec mapping for generic legacy group name'
           else 'Family-aware FG base spec mapping'
      end
    )
  from public.product_groups pg
  where (v_is_generic and pg.id = p_product_group_id)
     or (not v_is_generic and lower(trim(pg.group_name)) = v_group_key);

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;