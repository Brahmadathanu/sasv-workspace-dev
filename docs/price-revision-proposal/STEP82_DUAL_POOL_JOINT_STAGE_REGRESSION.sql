-- Step 82. Read-only validation against frozen run136. Safe to execute.
WITH lab AS (
 SELECT effective_step_key, product_id, step_labour_factor / CASE WHEN product_id=183 THEN 101::numeric ELSE 41::numeric END AS per_cycle
 FROM costing.product_direct_labour_step_snapshot
 WHERE refresh_run_id=136 AND product_id IN (183,184)
 AND effective_step_key LIKE 'AVARTHI_%'
), oh AS (
 SELECT effective_step_key,product_id,step_factor / standard_cycle_count AS per_cycle
 FROM costing.product_production_overhead_step_snapshot
 WHERE refresh_run_id=136 AND product_id IN (183,184)
 AND base_step_id IN (1389,1390,1391,1392)
), input AS (
 SELECT l.effective_step_key, count(*) records,
 min(l.per_cycle) labour_min,max(l.per_cycle) labour_max,
 min(o.per_cycle) overhead_min,max(o.per_cycle) overhead_max
 FROM lab l JOIN oh o ON o.product_id=l.product_id AND o.effective_step_key=l.effective_step_key
 GROUP BY l.effective_step_key
), allocated AS (
 SELECT *,
  labour_min*(60::numeric+41*105/110::numeric) labour_101,
  labour_min*(41::numeric*5/110) labour_41,
  overhead_min*(60::numeric+41*105/110::numeric) overhead_101,
  overhead_min*(41::numeric*5/110) overhead_41
 FROM input
)
SELECT effective_step_key,records,labour_min,labour_max,overhead_min,overhead_max,
 labour_101,labour_41,overhead_101,overhead_41,
 labour_101+labour_41-101*labour_min AS labour_delta,
 overhead_101+overhead_41-101*overhead_min AS overhead_delta,
 (records=2 AND labour_min=labour_max AND overhead_min=overhead_max
 AND labour_101+labour_41=101*labour_min
 AND overhead_101+overhead_41=101*overhead_min) AS passed
FROM allocated ORDER BY effective_step_key;
-- Not a monetary-pool test: AU5 monthly batch and AU9 capacity factors
-- must be applied in future governed refresh before approval.
