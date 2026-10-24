-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_kind_id uuid;
  v_section_id integer;
  v_subsection_id integer;
  v_area_id integer;
begin
  select id into v_kind_id
  from public.activity_kinds
  where short_code='DRYIN2';

  if v_kind_id is null then
    raise exception 'Activity Kind DRYIN2 - Drying in firewood oven not found';
  end if;

  select s.id, ss.id, a.id
    into v_section_id, v_subsection_id, v_area_id
  from public.sections s
  join public.subsections ss on ss.section_id=s.id
  join public.areas a on a.section_id=s.id and a.subsection_id=ss.id
  where s.section_name='Processing Section'
    and ss.subsection_name='Powder Formulations'
    and a.area_name='-'
  order by a.id
  limit 1;

  if v_section_id is null or v_subsection_id is null or v_area_id is null then
    raise exception 'Processing Section > Powder Formulations > - location not found';
  end if;

  if not exists(
    select 1
    from public.activities
    where section_id=v_section_id
      and sub_section_id=v_subsection_id
      and area_id=v_area_id
      and activity_name='Drying in firewood oven'
  ) then
    insert into public.activities(
      activity_name,section_id,sub_section_id,area_id,duration_days,kind_id
    ) values(
      'Drying in firewood oven',v_section_id,v_subsection_id,v_area_id,0,v_kind_id
    );
  end if;
end
$$;