-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function lab.fn_get_active_spec_profile_id_for_fg_group(
  p_product_group_id integer,
  p_as_of_date date default current_date
)
returns bigint
language plpgsql
security definer
set search_path to 'lab', 'public'
as $function$
declare
  v_group_key text;
  v_spec_profile_id bigint;
  v_as_of_date date := coalesce(p_as_of_date, current_date);
begin
  select lower(trim(group_name))
    into v_group_key
  from public.product_groups
  where id = p_product_group_id;

  if v_group_key is null then
    raise exception 'Invalid product_group_id %', p_product_group_id;
  end if;

  if v_as_of_date >= current_date then
    select m.spec_profile_id
      into v_spec_profile_id
    from lab.spec_profile_product_group_map m
    join public.product_groups pg
      on pg.id = m.product_group_id
    join lab.spec_profile sp
      on sp.id = m.spec_profile_id
    where lower(trim(pg.group_name)) = v_group_key
      and m.is_active = true
      and sp.is_active = true
      and sp.subject_type = 'FG'
      and sp.spec_kind = 'BASE'
      and (sp.effective_from is null or sp.effective_from <= v_as_of_date)
      and (sp.effective_to is null or sp.effective_to >= v_as_of_date)
    order by
      sp.effective_from desc nulls last,
      m.created_at desc,
      sp.created_at desc,
      sp.id desc
    limit 1;
  else
    select m.spec_profile_id
      into v_spec_profile_id
    from lab.spec_profile_product_group_map m
    join public.product_groups pg
      on pg.id = m.product_group_id
    join lab.spec_profile sp
      on sp.id = m.spec_profile_id
    where lower(trim(pg.group_name)) = v_group_key
      and sp.subject_type = 'FG'
      and sp.spec_kind = 'BASE'
      and m.created_at < (v_as_of_date + 1)::timestamp
      and (sp.effective_from is null or sp.effective_from <= v_as_of_date)
      and (sp.effective_to is null or sp.effective_to >= v_as_of_date)
    order by
      sp.effective_from desc nulls last,
      m.created_at desc,
      sp.created_at desc,
      sp.id desc
    limit 1;
  end if;

  return v_spec_profile_id;
end;
$function$;

revoke all on function lab.fn_get_active_spec_profile_id_for_fg_group(integer,date) from public;
grant execute on function lab.fn_get_active_spec_profile_id_for_fg_group(integer,date) to authenticated, service_role, postgres;