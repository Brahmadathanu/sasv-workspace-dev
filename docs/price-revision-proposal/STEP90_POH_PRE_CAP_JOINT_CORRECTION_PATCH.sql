-- STEP 90: production overhead PRE-CAP integration candidate, NOT DEPLOYED
-- Insert into rpc_refresh_production_overhead_workload_snapshot immediately before
-- its existing "-- AU-6: default-volume cap" block.
-- Uses actual prospective scope/behaviour/resource and AU9 load resolver.
-- Currently limited to exactly two outputs and one approved effective policy.
-- MUST confirm change-control and monetary regression before deploying.
  IF p_valuation_date >= DATE '2026-10-23' THEN
    CREATE TEMP TABLE tmp_joint_po_stage ON COMMIT DROP AS
    WITH effective_policy AS (
      SELECT p.* FROM costing.joint_process_policy p
      WHERE p.effective_from<=p_valuation_date
      AND (p.effective_to IS NULL OR p.effective_to>p_valuation_date)
    ), joint_members AS (
      SELECT p.id policy_id,p.reference_output_qty,o.product_id,o.output_qty,
             f.monthly_product_base_qty,f.preferred_batch_size
      FROM effective_policy p JOIN costing.joint_process_output o ON o.policy_id=p.id
      JOIN tmp_po_foundation f ON f.product_id=o.product_id
    ), batch AS (
      SELECT policy_id, MAX(monthly_product_base_qty/output_qty) joint_b
      FROM joint_members
      GROUP BY policy_id
    ), operations AS (
      SELECT m.policy_id,m.product_id,s.base_step_id,s.common_cycles,
             s.continuation_cycles,s.continuation_product_id,m.output_qty,
             m.reference_output_qty,m.preferred_batch_size,
             m.monthly_product_base_qty,b.joint_b,
             sc.factor*bh.factor*rs.factor*e.expected_occurrence_count
             *CASE WHEN v_rl IS NULL OR ch.product_id IS NULL THEN 1
             ELSE costing.fn_au9_g4_route_step_loads(
               e.resource_class_code,ch.solid_kg,ch.output_qty,ch.output_uom,
               p_valuation_date,e.base_step_id,e.override_id,e.activity_id)
             END per_cycle_factor
      FROM joint_members m JOIN batch b ON b.policy_id=m.policy_id
      JOIN costing.joint_process_stage s ON s.policy_id=m.policy_id
      JOIN tmp_po_foundation f ON f.product_id=m.product_id
      CROSS JOIN LATERAL jsonb_to_recordset(
        CASE WHEN jsonb_typeof(f.step_evidence)='array'
          THEN f.step_evidence ELSE '[]'::jsonb END
      ) AS e(base_step_id bigint,override_id bigint,activity_id integer,
         resource_class_code text,production_overhead_scope text,
         behaviour_code text,expected_occurrence_count numeric,
         standard_cycle_count numeric)
      JOIN costing.production_overhead_scope_factor sc
        ON sc.policy_id=v_policy.id AND sc.scope_code=e.production_overhead_scope
      JOIN costing.production_overhead_behaviour_factor bh
        ON bh.policy_id=v_policy.id AND bh.behaviour_code=e.behaviour_code
      JOIN costing.production_overhead_resource_factor rs
        ON rs.policy_id=v_policy.id AND rs.resource_class_code=e.resource_class_code
      LEFT JOIN tmp_po_charge ch ON ch.product_id=m.product_id
      WHERE e.base_step_id=s.base_step_id
    )
    SELECT o.policy_id,o.product_id,
      SUM(o.monthly_product_base_qty/o.preferred_batch_size
          *o.per_cycle_factor*
            (o.common_cycles+CASE WHEN o.product_id=o.continuation_product_id
              THEN o.continuation_cycles ELSE 0 END)) original_shared_workload,
      SUM(costing.fn_joint_stage_member_workload(
        o.common_cycles,o.continuation_cycles,o.output_qty,
        o.reference_output_qty,o.product_id=o.continuation_product_id,
        o.joint_b,o.per_cycle_factor)) corrected_shared_workload,
      COUNT(*) found_steps
    FROM operations o GROUP BY o.policy_id,o.product_id;

    IF EXISTS(SELECT 1 FROM tmp_joint_po_stage WHERE found_steps<>4
       OR original_shared_workload IS NULL OR corrected_shared_workload IS NULL) THEN
       RAISE EXCEPTION 'JOINT_PO_STAGE_LINEAGE_INCOMPLETE';
    END IF;
    -- Not enabled until an explicit two-beneficiary, four-stage, nonjoint
    -- preservation and AU9 factor equality gate is verified:
    -- UPDATE tmp_po_product p SET workload_units = p.workload_units
    --    - j.original_shared_workload + j.corrected_shared_workload
    -- FROM tmp_joint_po_stage j WHERE p.product_id=j.product_id;
  END IF;
-- This currently creates traceable projections but deliberately leaves the
-- UPDATE commented. Do not deploy into live refresh before tests.
