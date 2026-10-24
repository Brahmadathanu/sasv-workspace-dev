-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_kind_id uuid;
  v_activity_id integer;
begin
  select id into v_kind_id
  from public.activity_kinds
  where short_code = 'KASPR'
    and name_norm = 'kashayam preparation'
  order by created_at, id
  limit 1;

  if v_kind_id is null then
    raise exception 'Existing KASPR / Kashayam preparation Activity Kind not found';
  end if;

  select id into v_activity_id
  from public.activities
  where kind_id = v_kind_id
    and section_id = 4
    and sub_section_id = 9
    and area_id = 77
    and activity_name_norm = 'kashayam preparation'
  limit 1;

  if v_activity_id is null then
    insert into public.activities(activity_name, section_id, sub_section_id, area_id, kind_id)
    values ('Kashayam preparation', 4, 9, 77, v_kind_id);
  end if;
end $$;