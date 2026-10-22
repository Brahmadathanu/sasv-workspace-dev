-- G0 STEP 69 -- REVIEW-ONLY joint-process schema and invariants.
-- This file is NOT a deployable migration. No DDL is executed by this script.
-- Proposed minimal governed relation (requires policy approval before creation):
--
-- costing.joint_manufacturing_process
--   id bigint identity pk; process_code text unique; reference_output_qty numeric(18,6);
--   output_uom text; effective_from date; effective_to date;
--   allocation_method text; approval_reference text; created_at timestamptz.
-- costing.joint_manufacturing_output
--   process_id bigint fk; product_id integer; output_qty numeric(18,6);
--   is_continuation_output boolean; primary key(process_id,product_id).
-- costing.joint_manufacturing_shared_stage
--   process_id bigint fk; base_step_id bigint fk;
--   common_cycles numeric(18,6); continuing_cycles numeric(18,6);
--   continuation_product_id integer; primary key(process_id,base_step_id).
-- costing.joint_manufacturing_beneficiary
--   process_id bigint fk; product_id integer; common_share numeric(18,12);
--   primary key(process_id,product_id).
--
-- Required exclusion/guards in eventual migration:
-- non-overlap of approved effective dated process definitions;
-- all outputs and stage keys valid for both effective routes;
-- output sum=reference_output_qty; beneficiary common_share sum exactly 1;
-- continuation output belongs to approved outputs; no negative cycles or
-- shares; no duplicate base steps; fail closed if allocation unapproved.
-- Never assume product184 gets 5/110 of common financial cost without approval.
--
-- Test 1: route overrides and their repeated stage cycles, live read-only:
SELECT r.product_id, o.base_step_id, b.step_key,
       o.expected_occurrence_count, o.standard_cycle_count,
       coalesce(o.resource_class_code,b.resource_class_code) AS resource_class_code
FROM costing.product_process_route_override o
JOIN costing.product_process_route r ON r.id=o.product_route_id
JOIN costing.production_route_family_route_step b ON b.id=o.base_step_id
WHERE r.product_id IN (183,184)
  AND o.base_step_id IN (1389,1390,1391,1392)
  AND r.status='APPROVED'
  AND r.effective_from<=DATE '2026-10-22'
  AND (r.effective_to IS NULL OR r.effective_to>DATE '2026-10-22')
ORDER BY o.base_step_id,r.product_id;
--
-- Expected exactly 8 rows; product183: 101 cycles each; product184: 41 each.
-- Four stage pairs physically 41 common+60 continuing=101, not 142.
--
-- Test 2: frozen snapshot provenance, live read-only:
SELECT product_id, preferred_batch_size, monthly_product_base_qty,
       monthly_batch_equivalents, route_factor, workload_units
FROM costing.product_production_overhead_workload_snapshot
WHERE refresh_run_id=136 AND product_id IN (183,184)
ORDER BY product_id;
--
-- Before execution of any schema change, test conservation against
-- frozen monthly pool and product/SKU snapshot sums, dated run136 invariance,
-- manual filtration scoped handling and standalone-product regressions.
