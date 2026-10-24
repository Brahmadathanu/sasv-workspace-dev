-- backfilled from live schema_migrations on 2026-10-24, CI-016
update costing.production_route_family_product_group_map m
set status='INACTIVE',
    effective_to=m.effective_from,
    updated_at=clock_timestamp()
from costing.production_route_family f
where f.id=m.route_family_id
  and f.family_code='DRY_POWDER_CHOORNAM'
  and m.product_group_id in (23,24,64,65,81)
  and m.status='APPROVED';

comment on table costing.production_route_family_product_group_map is
'Governed Route Family mapping. Dry Powder/Choornam fallback excludes Kudineer Choornam and Kvatha/Kashaya Choornam groups; those require separate manufacturing-route architecture.';