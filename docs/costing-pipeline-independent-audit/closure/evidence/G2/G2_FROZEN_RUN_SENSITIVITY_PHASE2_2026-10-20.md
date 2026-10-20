# G2 frozen-run workload sensitivity — phase 2, 20 October 2026

**Status:** VERIFIED frozen inputs and algebra; sensitivity ONLY, NOT a proposed rate or validated replacement. Read-only Supabase source, project qhmoqtxpeasamtlxaoak, approved run 128. NO live mutation.

## Writer-source verification
Actual live `costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)` definition md5 `653f851c52e840d2431cf523775a68c8`; `costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint)` md5 `9a87d9275b36b81602a4ba7c5833c9d2`; `fn_route_step_loads` md5 `4ce19661b2e40ccf136617f97e6a2b9d`.

The labour writer calculates product share as eligible `direct_labour_workload_units / company_eligible_workload_units`, and allocated rupees as manufacturing labour pool × share. Current AU-6L route intensity is multiplied by equipment loads per step when applicable; workforce source is separate from packing-labour pool. OH writer analogously uses route-factor × governed batch equivalents, subsequently subject to a default-volume cap. **Existing eligible workloads reflect cap behaviour; simple factors are not a complete model of the new pathway**.

Importantly, run128 preserved frozen manufacturing labour pool ₹706,203 and aggregate eligible workload 3861.78032032831564 across 453 product workload rows. 5,789 step snapshot rows across these products. Sum of line allocations is ₹706,203 to floating decimal precision. This is the existing-pool conservation baseline, NOT an approval of driver quality.

## Representative frozen evidence
Query: `SELECT product_id,product_name,direct_labour_route_intensity,direct_labour_workload_units,product_workload_share,product_direct_labour_allocation FROM costing.product_direct_labour_workload_snapshot WHERE refresh_run_id=128 AND product_id IN (51,695,957)`.
Second query: `SELECT product_id,sum(step_labour_factor) unscaled,count(*) steps FROM costing.product_direct_labour_step_snapshot WHERE refresh_run_id=128 AND product_id IN (51,695,957) GROUP BY product_id`.

| Product | Frozen scaled route intensity | Frozen unscaled step-factor sum | Scaled/unscaled | Frozen eligible workload | Frozen labour allocation | Frozen pool share |
|--|--:|--:|--:|--:|--:|--:|
| 51 Dhanyamlam | 511.6 | 174.8 (9 steps) | 2.93× | 511.15705628 | ₹93,475.19 | 13.2363% |
| 695 Karkkidaka Kanji | 2600 | 5.2 (10 steps) | 500× | 257.06633333 | ₹47,009.67 | 6.6567% |
| 957 Thippili Rasayanam | 109.6 | 7.6 (13 steps) | 14.42× | 379.36545455 | ₹69,374.49 | 9.8236% |

The `unscaled` comparison holds recorded per-step labour factors and standard-route governance but deliberately removes the equipment charge multipliers. It is **not** physical truth or an approval to remove them. In particular, 695 shows 500× route scaling and thus warrants true-activity evidence before allocation continues on a future run.

At unchanged batch equivalents and with no volume-cap effect, individual numerator factors relative to existing are respectively `174.8/511.6 ≈ 0.34167`, `5.2/2600=0.002`, and `7.6/109.6≈0.06934`. These are **not revised company shares**: every eligible product numerator and all governing caps must be recomputed to generate new denominator and pool-conserving allocations. Do not multiply the old rupees by these ratios and call them new cost.

## Reproducible conservation invariant for an isolated simulation
Given a validated positive workload `w_i` for each eligible product, define `W = sum(w_i)`, assert W>0, `share_i=w_i/W`, and `allocation_i=pool*share_i`. Assert `abs(sum(share_i)-1) <= 1e-12` and `abs(sum(allocation_i)-pool)<=1e-6` before display rounding. Exclusions and internal-product transfers must match existing G1 conservation semantics; never add a balancing plug. Independently calculate POH with its own permitted scopes/factors.

## Professional adequacy / minimisation conclusion
A minimal future route driver could use approved standard-batch equivalents, effective route step scopes/factors, occurrence/cycle evidence, and **only separately validated repeated charge multipliers where the physical operation genuinely demands them**. Throughput-only machines must not set cost charges. The data shows large sensitivity and argues against universal class-level 50 kg lot fallback. HOWEVER the correctness and minimum field set remain OPEN pending whole-population simulation, charge evidence, unchanged behaviour for normal products, cap handling and independent regression.

**Safety:** no changes to run 122/128, their rows or approved fingerprints; no activation, deployment, cron or DVS change. G2 remains OPEN and CI-032 HIGH remains OPEN.

## Next work
1. Derive exact eligible-population prospective shares in an isolated fixture without modifying frozen approved runs, exercising both pool writers and the cap.
2. Trace `fn_preview_direct_labour_shadow_workload`, actual provenance and standard batch evidence for all major drivers.
3. Complete pg_depend, grants, cron, ETL, client and trigger inventory; prepare tested old-to-new and future hard-retirement plan.
