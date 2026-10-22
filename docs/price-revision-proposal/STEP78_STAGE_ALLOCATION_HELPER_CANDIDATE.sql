-- STEP 78 / read-only reusable joint-stage allocation calculation.
-- Candidate function NOT deployed. Based on an approved policy row if it exists.
-- All dependent joint_process_* tables remain NOT DEPLOYED at authoring.
-- This function calculates per-reference-batch equivalent stage cycles, NOT
-- money, kg-solid equipment loads, monthly labour or overhead allocations.
CREATE FUNCTION costing.fn_joint_stage_cycle_allocation(p_policy_id bigint)
RETURNS TABLE(base_step_id bigint, product_id integer,
              common_equivalent_cycles numeric,
              continuation_equivalent_cycles numeric,
              total_equivalent_cycles numeric)
LANGUAGE sql STABLE SET search_path TO 'costing','pg_temp'
AS $$
  SELECT st.base_step_id, ot.product_id,
         st.common_cycles * ot.output_qty / pol.reference_output_qty,
         CASE WHEN st.continuation_product_id=ot.product_id
              THEN st.continuation_cycles ELSE 0::numeric END,
         st.common_cycles * ot.output_qty / pol.reference_output_qty
          + CASE WHEN st.continuation_product_id=ot.product_id
                 THEN st.continuation_cycles ELSE 0::numeric END
  FROM costing.joint_process_policy pol
  JOIN costing.joint_process_stage st ON st.policy_id=pol.id
  JOIN costing.joint_process_output ot ON ot.policy_id=pol.id
  WHERE pol.id=p_policy_id AND pol.allocation_method='OUTPUT_MASS'
    AND pol.reference_output_qty>0
    AND (SELECT sum(output_qty) FROM costing.joint_process_output
         WHERE policy_id=pol.id)=pol.reference_output_qty
$$;
-- Deployment blockers: approved/dated policy resolution, validated actor and
-- stage route lineage, reverse grants, immutability, journal, authorization,
-- proper conversion of physical stage cycles into resource-specific labour and
-- overhead intensity, AU5 joint batch equivalents and monetary conservation.
-- Never call this helper alone to determine final SKU costs.
