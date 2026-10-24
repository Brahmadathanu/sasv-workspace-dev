-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_kind_id uuid;
  v_activity_id integer;
begin
  select id into v_activity_id
  from public.activities
  where id = 237
    and section_id = 4
    and sub_section_id = 6
    and area_id = 75;

  if v_activity_id is null then
    raise exception 'Expected Powder Formulations drying activity 237 not found at section 4 / subsection 6 / area 75';
  end if;

  select id into v_kind_id
  from public.activity_kinds
  where name_norm = lower(regexp_replace(btrim('Post-process drying'), '\\s+', ' ', 'g'))
     or short_code = 'PPDRY';

  if v_kind_id is null then
    insert into public.activity_kinds(id, name, name_norm, short_code)
    values (
      gen_random_uuid(),
      'Post-process drying',
      lower(regexp_replace(btrim('Post-process drying'), '\\s+', ' ', 'g')),
      'PPDRY'
    )
    returning id into v_kind_id;
  end if;

  update public.activities
  set activity_name = 'Post-process drying',
      kind_id = v_kind_id
  where id = v_activity_id;
end $$;