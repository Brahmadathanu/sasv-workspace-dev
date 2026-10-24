-- STEP 70: READ-ONLY physical-cycle and beneficiary allocation SIMULATION
-- NOT a financial policy and NOT an approved cost redistribution.
-- One joint 110kg reference process; product 183 output105kg, product184 output5kg.
-- Assumes all four repeated stages are common for 41 cycles then continue for 60.
WITH stages(base_step_id, common_cycles, continuation_cycles) AS (
 VALUES (1389,41::numeric,60::numeric),(1390,41::numeric,60::numeric),
        (1391,41::numeric,60::numeric),(1392,41::numeric,60::numeric)
), shares(product_id, output_kg, common_share) AS (
 VALUES (183,105::numeric,105::numeric/110),(184,5::numeric,5::numeric/110)
), allocation AS (
 SELECT s.base_step_id,b.product_id,s.common_cycles,s.continuation_cycles,
        b.output_kg,b.common_share,
        s.common_cycles*b.common_share+
          CASE WHEN b.product_id=183 THEN s.continuation_cycles ELSE 0 END
            AS allocated_equivalent_cycles
 FROM stages s CROSS JOIN shares b
)
SELECT base_step_id,
 sum(allocated_equivalent_cycles) AS allocated_total_cycles,
 max(common_cycles+continuation_cycles) AS physical_total_cycles,
 sum(allocated_equivalent_cycles)-max(common_cycles+continuation_cycles)
 AS conservation_difference,
 max(allocated_equivalent_cycles) FILTER (WHERE product_id=183) AS product_101_equivalent_cycles,
 max(allocated_equivalent_cycles) FILTER (WHERE product_id=184) AS product_41_equivalent_cycles
FROM allocation GROUP BY base_step_id ORDER BY base_step_id;
-- Expected each stage: total101, difference0; 101 share99.13636...,
-- 41 share1.86363...; cycle equivalents are NOT hours/charges/rupees.
-- The *per-stage* labour, overhead and AU9 resource factors must be
-- calculated on the actual common/continuation operation and then apportioned.
-- Confirm whether the 41 output's finishing/QA remains independent.
-- No cost scheme may go live until allocation approval + monetary/pool regression.
