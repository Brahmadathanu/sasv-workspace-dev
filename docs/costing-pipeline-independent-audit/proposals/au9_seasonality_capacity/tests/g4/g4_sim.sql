-- LOCAL ONLY: simulated non-designated November run (9001) using the run-128 route lineage and batch charges.
create or replace function costing.local_g4_factors(p_vd date) returns table(allocation_pool text, product_id bigint, factor numeric, legacy numeric)
language sql stable as $f$
  select s.allocation_pool, s.product_id,
         sum(e.step_factor * costing.fn_au9_g4_route_step_loads(e.resource_class_code, s.solid_charge_kg, s.output_charge, s.output_charge_uom, p_vd,
                                                               e.base_step_id, e.override_id, e.activity_id)),
         s.scaled_factor
    from costing.route_load_scaling_snapshot s
    join costing.local_step_evidence e on e.allocation_pool = s.allocation_pool and e.product_id = s.product_id
   where s.refresh_run_id = 128
   group by s.allocation_pool, s.product_id, s.scaled_factor
$f$;
create or replace function costing.local_g4_capture(p_vd date) returns bigint language sql volatile as $f$
  select sum(costing.fn_au9_g4_capture_provenance(9001, date '2026-11-01', p_vd, s.allocation_pool, s.product_id,
                 s.solid_charge_kg, s.output_charge, s.output_charge_uom,
                 (select jsonb_agg(jsonb_build_object('effective_step_key', e.effective_step_key, 'sequence_no', e.sequence_no, 'source_type', e.source_type,
                          'base_step_id', e.base_step_id, 'override_id', e.override_id, 'activity_id', e.activity_id,
                          'resource_class_code', e.resource_class_code) order by e.sequence_no)
                    from costing.local_step_evidence e where e.allocation_pool = s.allocation_pool and e.product_id = s.product_id)))
    from costing.route_load_scaling_snapshot s where s.refresh_run_id = 128
$f$;
