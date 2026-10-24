-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_kind_id uuid;
begin
  select id into v_kind_id
  from public.activity_kinds
  where name_norm='vessel processing'
  limit 1;

  if v_kind_id is null then
    insert into public.activity_kinds(name,name_norm,short_code)
    values('Vessel processing','vessel processing','VESPR')
    returning id into v_kind_id;
  end if;

  if not exists (
    select 1
    from public.activities
    where activity_name_norm='vessel processing'
      and section_id=4
      and sub_section_id=9
      and area_id=77
  ) then
    insert into public.activities(activity_name,section_id,sub_section_id,area_id,duration_days,kind_id)
    values('Vessel processing',4,9,77,0,v_kind_id);
  end if;
end $$;