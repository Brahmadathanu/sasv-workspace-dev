-- backfilled from live schema_migrations on 2026-10-24, CI-016
delete from public.activities
where id = 239
  and activity_name = 'Kashayam preparation'
  and section_id = 4
  and sub_section_id = 9
  and area_id = 77
  and not exists (
    select 1 from costing.production_route_family_route_step s where s.activity_id = 239
  )
  and not exists (
    select 1 from costing.product_process_route_override o where o.activity_id = 239
  );