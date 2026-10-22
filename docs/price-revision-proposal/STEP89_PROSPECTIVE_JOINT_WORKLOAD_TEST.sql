-- Step 89: executed READ-ONLY projection for approved policy; no frozen run edits.
WITH demand(product_id, monthly_qty) AS (VALUES (183,9.8007::numeric),(184,0.091::numeric)),
member AS (
 SELECT o.product_id,o.output_qty,d.monthly_qty
 FROM costing.joint_process_output o JOIN demand d USING(product_id)
 WHERE o.policy_id=1
), joint_batches AS (
 SELECT max(monthly_qty/output_qty) b FROM member
), stage AS (
 SELECT s.base_step_id,s.common_cycles,s.continuation_cycles,s.continuation_product_id,p.reference_output_qty
 FROM costing.joint_process_stage s JOIN costing.joint_process_policy p ON p.id=s.policy_id
 WHERE s.policy_id=1
), factor AS (
 SELECT base_step_id,max(step_factor/standard_cycle_count) oh_factor
 FROM costing.product_production_overhead_step_snapshot
 WHERE refresh_run_id=136 AND product_id IN(183,184)
 AND base_step_id IN(1389,1390,1391,1392)
 GROUP BY base_step_id
), projection AS (
 SELECT s.base_step_id,m.product_id,
  costing.fn_joint_stage_member_workload(
   s.common_cycles,s.continuation_cycles,m.output_qty,s.reference_output_qty,
   m.product_id=s.continuation_product_id,b.b,f.oh_factor
  ) workload
 FROM stage s JOIN factor f USING(base_step_id) CROSS JOIN member m CROSS JOIN joint_batches b
)
SELECT base_step_id, sum(workload) physical_workload,
 count(*) beneficiary_count
FROM projection GROUP BY base_step_id ORDER BY base_step_id;
-- This uses frozen run136 OH factor as a TEST FIXTURE, not prospective AU9.
-- Prospective function replacement must obtain current stage factors dynamically.
