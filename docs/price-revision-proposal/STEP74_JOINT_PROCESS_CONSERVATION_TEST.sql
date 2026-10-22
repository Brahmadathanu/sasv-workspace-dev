-- STEP 74 read-only validation: approved allocation and effective route cycles
WITH stage AS (
 SELECT b.id AS base_step_id,b.step_key,
   max(o.standard_cycle_count) FILTER(WHERE r.product_id=183) AS cycles_101,
   max(o.standard_cycle_count) FILTER(WHERE r.product_id=184) AS cycles_41,
   count(*) AS rows_seen
 FROM costing.product_process_route_override o
 JOIN costing.product_process_route r ON r.id=o.product_route_id
 JOIN costing.production_route_family_route_step b ON b.id=o.base_step_id
 WHERE b.id IN (1389,1390,1391,1392)
 AND r.product_id IN (183,184) AND r.status='APPROVED'
 AND r.effective_from<=DATE '2026-10-22'
 AND (r.effective_to IS NULL OR r.effective_to>DATE '2026-10-22')
 GROUP BY b.id,b.step_key
), report AS (
 SELECT *,cycles_41 AS common_cycles,cycles_101-cycles_41 AS continuing_cycles,
 cycles_41*(105::numeric/110)+(cycles_101-cycles_41) AS allocated_101,
 cycles_41*(5::numeric/110) AS allocated_41
 FROM stage
)
SELECT base_step_id,step_key,rows_seen,cycles_101,cycles_41,
 common_cycles,continuing_cycles,allocated_101,allocated_41,
 allocated_101+allocated_41-cycles_101 AS conservation_delta,
 (rows_seen=2 AND cycles_101=101 AND cycles_41=41 AND
  allocated_101+allocated_41=cycles_101) AS pass
FROM report ORDER BY base_step_id;
-- All 4 rows must pass. This checks cycle algebra only, not monetary pool
-- reconciliation, inventory treatment, manual activity suitability or AU9.
