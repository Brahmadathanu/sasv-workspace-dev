# G2 full-population simplified workload sensitivity — phase 3 (20 October 2026)

**Status: READ-ONLY SIMULATION; VERIFIED query outputs, candidate architecture UNAPPROVED.** Supabase qhmoqtxpeasamtlxaoak; immutable approved October run 128 untouched.

## Method
For each product from `costing.product_direct_labour_workload_snapshot` at run 128, join the per-product `sum(step_labour_factor)` from `product_direct_labour_step_snapshot`. Define hypothetical driver `candidate_workload = existing_workload * unscaled_step_factor_sum / existing_scaled_route_intensity` only for positive values, otherwise zero. Aggregate all candidate workloads; distribute the unchanged pool proportional to candidate workload. This is a **diagnostic counterfactual** that inherits existing quantity driver/caps and is NOT a correctly recomputed future run. It intentionally does not claim to preserve physical charge evidence.

## Read-only evidence
- Product records: 453. Positive candidate records: 445 (8 zero/non-comparable); candidate total workload = 1178.6416909099943343; frozen old total workload = 3861.7803203283156409.
- Frozen labour pool = 706202.999999999999999999999999999999... rupees (₹706,203).
- Product 51 Dhanyamlam: old share 13.236%, counterfactual 14.818%, delta +1.581 percentage points; old ₹93,475.19 vs simulation ₹104,643.68.
- Product 695 Karkkidaka Kanji: old share 6.657%, counterfactual 0.044%, delta −6.613 percentage points; old ₹47,009.67 vs simulation ₹308.05.
- Product 957 Thippili Rasayanam: old share 9.824%, counterfactual 2.232%, delta −7.592 percentage points; old ₹69,374.49 vs simulation ₹15,761.90.

## SQL reproduction
```sql
WITH s AS (
 SELECT product_id,sum(step_labour_factor) raw
 FROM costing.product_direct_labour_step_snapshot
 WHERE refresh_run_id=128 GROUP BY product_id
), a AS (
 SELECT w.product_id,w.product_name,w.product_workload_share old_share,
        w.direct_labour_workload_units old_workload,
        w.product_direct_labour_allocation old_amount,
        CASE WHEN w.direct_labour_route_intensity>0
                   AND w.direct_labour_workload_units>0 AND s.raw>0
             THEN w.direct_labour_workload_units*s.raw/w.direct_labour_route_intensity
             ELSE 0 END candidate
 FROM costing.product_direct_labour_workload_snapshot w
 LEFT JOIN s USING(product_id)
 WHERE w.refresh_run_id=128
), b AS (
 SELECT *,candidate/nullif(sum(candidate) OVER(),0) candidate_share FROM a
)
SELECT product_id,product_name,round(old_share*100,3) old_pct,
       round(candidate_share*100,3) candidate_pct,
       round((candidate_share-old_share)*100,3) pp_change,
       round(old_amount,2) old_rupees,
       round(candidate_share*706203,2) simulated_rupees
FROM b WHERE product_id IN (51,695,957) ORDER BY product_id;
```

## Safety and caveats
Algebra conserves the frozen pool exactly in unrounded numeric arithmetic, conditional upon the positive candidate denominator. It is not a separately verified end-to-end scenario-run conservation test (the aggregate query for that test was blocked by tool safety checks). Allocation to eight non-positive/noncomparable product records is zero; verify their current statuses and financial effect before any acceptability claim. Existing `fn_default_volume_cap`, actual route occurrences/cycles, process-stage quantities and physical charges have NOT been recomputed from first principles. Production overhead has NOT yet been run through a companion candidate simulation. No data changed.

**Interpretation:** the enormous share shifts demonstrate sensitivity and make blanket deletion of machine loads professionally unacceptable without physical process validation. A lean future architecture should retain only justified charge-dependent operations, all defensible fixed work and necessary scope/behaviour factors; reject unvalidated universal class fallbacks. Exact design and retirement classification remain open.

G2 IN PROGRESS, CI-032 HIGH OPEN. No live migrations, drops, switches, cron changes, run creation or deployment.
