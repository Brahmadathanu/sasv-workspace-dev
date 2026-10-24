# DVS-1 demand-volume selection: build and isolated test (19 Oct 2026)

Status: **PREPARED AND TESTED IN ISOLATION. NOT APPLIED.** It goes live only in a later approval batch.
Prepared file: `prepared/PREPARED_DVS1_demand_volume_selection.sql` (md5 6a4336232c0e093bdb3024262b55ca76). It is outside `supabase/migrations`.

## What it installs
- **5 new tables:**
  - `product_demand_seasonality`
  - `demand_volume_selection_policy`
  - `demand_event_register`
  - `sku_demand_volume_override`
  - `sku_demand_volume_selection_snapshot` (per-run lineage, guarded by the same approved-run, terminal-run and truncate guards as the basis snapshot)
- **Access:** RLS is on and there is no anon/authenticated access.
- **1 new function:** `costing.fn_dvs1_select`, which holds the rules and computes the candidates.
- **Patched refresh RPC:** `rpc_refresh_sku_sales_allocation_basis_snapshot`, patched from the live definition (md5 09c3d22c...). The install refuses to run if the live definition differs.
- **Widened CHECK:** `monthly_driver_method` gets 5 extra `DVS1_*` labels. No existing row changes. The basis snapshot gets **no new columns**, so the row hashes of runs 122 and 128 cannot change.
- **Seeds:**
  - Policy v1 is seeded as **DRAFT**, which keeps the rules OFF.
  - Kanji (product of SKU 878) is seeded as DEMAND_SEASONAL Jun–Aug, effective 1 Nov 2026.

**Switch.** DVS-1 is ON for a period only when exactly one APPROVED DVS-1 version is effective for it. Activation is a separate approved change: set status APPROVED, effective_from at or after 1 Nov 2026, and an approval reference.

The refresh refuses (fail-closed) when:
- two approved versions overlap;
- DVS-1 is ON while the SALES-01 costing feed is OFF;
- a SKU has overlapping overrides;
- a product has overlapping seasonality rows.

## Rules (in order)
1. An approved override is used (fixed units, plan forecast, 12-month average or max month).
2. A SKU launched within 12 months uses the average since its first sale.
3. Confirmed events:
   - A confirmed supply constraint gives the average of in-stock months.
   - Confirmed demand events give the max month after treatment (exclude units, exclude month, or cap at baseline).
   - PROPOSED, REJECTED and INFORMATION_ONLY events have no effect.
4. A product with an approved DEMAND_SEASONAL pattern uses the 12-month average.
5. Otherwise the SKU uses the max positive month, which is exactly the legacy value, label and note.

**Diagnostic.** When rule 5 applies and the top-3 months are at least 0.6 of the year, the flag `diagnostic_flag` is set (DEMAND_CONCENTRATION_UNEXPLAINED). It is a review flag only, not a blocker.

## Isolated test (local PG17 DB `dvs` built from the live masters, run 128 and the costing sales feed as of 16 Oct)
| Test | Result |
|---|---|
| Legacy RPC replay of run 128 (test run 9128) | 627 rows; all numbers equal to run 128 within 2e-11 (the remaining differences come from JSON transport rounding of the extract, e.g. "0.60" vs "0.6", not from the logic) |
| T0: DVS-1 installed but OFF (DRAFT), run 9129 | **0 row differences** from the legacy replay; 0 lineage rows |
| T1: ON, no events (run 9130) | Methods: MAX_MONTH 554, LAUNCH_AVERAGE 14, DEMAND_SEASONAL 1 (Kanji 878 = 4,943.58/month, same as run 128) |
| T1: rule-5 SKUs that were max-month in run 128 | 468/468 identical (units, label, note) |
| T1: run-128 "seasonal" SKUs (101) | 1 stays seasonal (Kanji), 14 go to launch average, 86 go to max month and all 86 carry the diagnostic flag |
| T2: PROPOSED event | no effect (0 row differences) |
| T3: CONFIRMED exclude-units event | max month 2,177 → 1,847 (event month excluded), labelled DVS1_MAX_MONTH_EXCLUDING_CONFIRMED_EVENTS |
| T3: CONFIRMED supply constraint | in-stock average 764.09 (max month was 1,041) |
| T3: INFORMATION_ONLY event | no effect |
| T3: override 123 units; override on Kanji (beats seasonal) | both win; all other SKUs unchanged |
| T4: overlapping override / two approved versions / feed OFF while ON | all refused |
| T5: lineage insert for APPROVED run 128 | refused (AU2_DESIGNATED_RUN_IMMUTABLE); CONFIRMED event without approval refused |
| T6: runs 122/128 rows | unchanged |

## Effect if switched ON today with no confirmed events (simulation against the run-128 replay)
- **Allocation driver:** changes on 102 SKUs. The median change among those SKUs is +306% and the largest is +1,100%. These are mostly the 86 SKUs moving from the 12-month average back to their peak month.
- **Company allocation units:** +1.15% (251,327 → 254,218).
- **Cost of production:** the earlier AU-9 P5 simulation found median COP -0.44%, worst -3.1%.
- **Pools:** unchanged. Only the allocation shares between SKUs move.

**Recommendation.** Do not activate DVS-1 until the 86 flagged SKUs have been reviewed. For each one, either confirm the demand events behind the concentration or approve the product as DEMAND_SEASONAL. Otherwise those SKUs revert to peak-month allocation.

`evidence/DVS1/DVS1_SEASONAL_RECONCILIATION.csv` (CI-015) is the worksheet. It covers 128 SKUs and shows, per SKU: the declared `products.is_seasonal` flag, the run-128 rule result, the DVS-1 method, the flag and the candidates. Only 8 SKUs are both declared and rule-seasonal. The declared flag looks like manufacture seasonality, not demand.

**Not attached:** the WP04 readiness-epoch trigger on the new lineage table, because it is not a registered readiness source. The TB6 `scoped_table_set_md5` will change once the new `%snapshot%` table exists. This causes no drift for old runs; verify skips tables that have 0 rows for a run.
