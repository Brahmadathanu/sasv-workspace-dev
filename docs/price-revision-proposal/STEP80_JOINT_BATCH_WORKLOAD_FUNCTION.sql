-- STEP 80: functional SQL integration primitive; source-controlled, NOT DEPLOYED.
-- Requires approved, validated joint_process_policy/output/stage tables from STEP77.
-- Gives proportional, NON-monetary cycle-workload per co-product and stage.
-- Not a replacement for labour/overhead refreshes; consumers must apply their
-- own scoped attendance, behaviour, resource and machine load factors.
CREATE OR REPLACE FUNCTION costing.fn_joint_stage_monthly_workload(
 p_policy_id bigint, p_monthly_demands jsonb
) RETURNS TABLE(
 base_step_id bigint, product_id integer, joint_batch_equivalents numeric,
 common_equivalent_cycles numeric, continuation_equivalent_cycles numeric,
 total_equivalent_cycles numeric
)
LANGUAGE sql STABLE SET search_path TO 'costing','pg_temp'
AS $fn$
 WITH policy AS (
   SELECT id,reference_output_qty
   FROM costing.joint_process_policy
   WHERE id=p_policy_id AND allocation_method='OUTPUT_MASS'
 ), outputs AS (
   SELECT o.product_id,o.output_qty,
     (p_monthly_demands->>o.product_id::text)::numeric AS demand_qty
   FROM costing.joint_process_output o JOIN policy p ON p.id=o.policy_id
 ), valid AS (
   SELECT p.id,p.reference_output_qty,
     max(o.demand_qty/o.output_qty) AS joint_batches
   FROM policy p CROSS JOIN outputs o
   GROUP BY p.id,p.reference_output_qty
   HAVING count(*)>=2
    AND count(*)=count(o.demand_qty)
    AND min(o.demand_qty)>=0
    AND sum(o.output_qty)=p.reference_output_qty
 ), stages AS (
   SELECT s.base_step_id,s.common_cycles,s.continuation_cycles,
          s.continuation_product_id,v.reference_output_qty,v.joint_batches
   FROM valid v JOIN costing.joint_process_stage s ON s.policy_id=v.id
 )
 SELECT s.base_step_id,o.product_id,s.joint_batches,
        s.joint_batches*s.common_cycles*o.output_qty/s.reference_output_qty,
        CASE WHEN o.product_id=s.continuation_product_id
             THEN s.joint_batches*s.continuation_cycles ELSE 0::numeric END,
        s.joint_batches*(s.common_cycles*o.output_qty/s.reference_output_qty
          + CASE WHEN o.product_id=s.continuation_product_id
                 THEN s.continuation_cycles ELSE 0::numeric END)
 FROM stages s CROSS JOIN outputs o
$fn$;
-- IMPORTANT: This candidate yields no rows on missing demand, not a
-- fail-closed exception. The eventual governed caller MUST assert exactly
-- 4 stages x 2 beneficiaries, validated effective policy, and raise on zero
-- rows rather than silently fall back. Test equipment-specific actual cost
-- factors and independent output attribution before producing monetary costs.
