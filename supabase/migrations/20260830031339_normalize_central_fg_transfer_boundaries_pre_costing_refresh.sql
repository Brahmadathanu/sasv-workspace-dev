-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

alter table costing.production_route_family_route_step disable trigger trg_route_family_route_step_immutable;
alter table costing.product_process_route_override disable trigger trg_product_route_override_immutable;

update costing.production_route_family_route_step s
set activity_id = 299,
    cost_centre_id = 39,
    section_id = 6,
    subsection_id = 21,
    area_id = 94,
    plant_id = null,
    resource_class_code = 'GENERAL_AREA',
    production_overhead_scope = 'EXCLUDE_OTHER_POOL',
    direct_labour_scope = 'EXCLUDE_OTHER_POOL',
    updated_at = now()
from costing.production_route_family_route r
where r.id = s.family_route_id
  and r.status = 'APPROVED'
  and r.archived_at is null
  and s.route_step_scope = 'BOUNDARY_FG_TRANSFER'
  and s.cost_centre_id in (28,39);

update costing.product_process_route_override o
set activity_id = 299,
    cost_centre_id = 39,
    section_id = 6,
    subsection_id = 21,
    area_id = 94,
    plant_id = null,
    resource_class_code = 'GENERAL_AREA',
    production_overhead_scope = 'EXCLUDE_OTHER_POOL',
    direct_labour_scope = 'EXCLUDE_OTHER_POOL',
    updated_at = now()
from costing.product_process_route pr
where pr.id = o.product_route_id
  and pr.status = 'APPROVED'
  and pr.archived_at is null
  and o.route_step_scope = 'BOUNDARY_FG_TRANSFER'
  and o.cost_centre_id in (28,39);

alter table costing.production_route_family_route_step enable trigger trg_route_family_route_step_immutable;
alter table costing.product_process_route_override enable trigger trg_product_route_override_immutable;

commit;