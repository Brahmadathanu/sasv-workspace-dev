-- backfilled from live schema_migrations on 2026-10-24, CI-016
insert into costing.production_overhead_workload_policy (
  policy_code,
  policy_version,
  status,
  effective_from,
  effective_to,
  formula_type,
  approval_reference,
  policy_note,
  approved_by,
  approved_at,
  created_by
)
select
  policy_code,
  3,
  'DRAFT',
  date '2026-08-06',
  null,
  formula_type,
  null,
  policy_note || ' Effective from 2026-08-06 to preserve prior exact-run historical governance.',
  null,
  null,
  created_by
from costing.production_overhead_workload_policy
where id = 2
  and not exists (
    select 1
    from costing.production_overhead_workload_policy
    where policy_code = 'PRODUCTION_ROUTE_BATCH_EQUIVALENT'
      and policy_version = 3
  );

insert into costing.production_overhead_scope_factor (policy_id, scope_code, factor, note)
select p3.id, f.scope_code, f.factor, f.note
from costing.production_overhead_workload_policy p3
join costing.production_overhead_scope_factor f on f.policy_id = 2
where p3.policy_code = 'PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p3.policy_version = 3
  and not exists (
    select 1 from costing.production_overhead_scope_factor x
    where x.policy_id = p3.id and x.scope_code = f.scope_code
  );

insert into costing.production_overhead_behaviour_factor (policy_id, behaviour_code, factor, note)
select p3.id, f.behaviour_code, f.factor, f.note
from costing.production_overhead_workload_policy p3
join costing.production_overhead_behaviour_factor f on f.policy_id = 2
where p3.policy_code = 'PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p3.policy_version = 3
  and not exists (
    select 1 from costing.production_overhead_behaviour_factor x
    where x.policy_id = p3.id and x.behaviour_code = f.behaviour_code
  );

insert into costing.production_overhead_resource_factor (policy_id, resource_class_code, factor, note)
select p3.id, f.resource_class_code, f.factor, f.note
from costing.production_overhead_workload_policy p3
join costing.production_overhead_resource_factor f on f.policy_id = 2
where p3.policy_code = 'PRODUCTION_ROUTE_BATCH_EQUIVALENT'
  and p3.policy_version = 3
  and not exists (
    select 1 from costing.production_overhead_resource_factor x
    where x.policy_id = p3.id and x.resource_class_code = f.resource_class_code
  );