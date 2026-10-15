# A7 follow-up — Provisional Loaded Cost reproduction, and valuation-date vs effective MRP (2026-10-15)

Read-only. Live queries ran against qhmoqtxpeasamtlxaoak at about 19:05 IST. Evidence: `evidence/A7F/`.

## 1. Does the sheet's "Provisional Loaded Cost" reproduce the documented shadow model? — YES, exactly
**Spec** (BASELINE_2026-10-15.md, lines 7 and 14): provisional loaded = run-119 loaded − run-119 (DL + POH) + batch conversion.
- Batch conversion = (labour workload × 729.55483432 + overhead workload × (342.71507286 + 620.31351052)) ÷ expected net output per standard batch × base quantity per pack.
- Workloads, preferred batch and net output come from the live STABLE simulator `costing.fn_simulate_preferred_batch_manufacturing_cost(119, rates)`.
- Base quantity per pack = `sku_material_cost_snapshot.conversion_to_base` (per mL/g/No) × pack size.

| Population | Match ≤0.1% | Match ≤1% only | Mismatch | Max abs error |
|---|---|---|---|---|
| The 454 that differ from run 119 by >1% | **454** | 0 | **0** | ₹0.0000 |
| All 509 | **509** | 0 | **0** | ₹0.0000 |

Per-SKU proof: `evidence/A7F/A7F_PROVISIONAL_REPRODUCTION.csv`. Check: SKU 193 = 5197.42 − 5156.71 + 504.44 = ₹545.15, and SKU 988 = ₹103.67, both as documented.

**Effect on A7-F1:** the finding "no system lineage" is **withdrawn** and restated as **A7-F1r (P1)**: the values are reproducible, but they rest on non-approved inputs.
1. The rates are illustrative, derived from run 119, and carry SIMULATION_ONLY_NOT_APPROVED_RATE.
2. One standard batch's workload is spread over its net output, regardless of actual batch frequency (batch-true, no normal-capacity approval).
3. The spec lives only in a handover doc. No stored run, view or migration holds it.

The model is a deterministic, re-runnable query. It is still **not an approved cost basis**. The earlier finding came from comparing against stored runs only (the A7 "batch" scenario used the 503.95/640.65 simulator rates and the wrong pack scaling, hence 16/509).

## 2. Board-approved September MRPs: effective-dated, not a defect
Live `costing.sku_mrp_policy` has all 21 register SKUs as APPROVED rows effective 2026-09-05 (1244) or 2026-09-10, open-ended. They were **created 2026-10-15 between 10:26 and 11:25 IST**. Run 119 started **2026-10-14 17:20 IST** (valuation date 2026-09-10).

| Term | Meaning | Value for these SKUs |
|---|---|---|
| **Valuation-date MRP, as known at run time** | The MRP in force on the valuation date, according to the policy table *when the run executed* | Old MRP (e.g. 955 ₹190, 972 ₹175). This is what run 119 froze, and it is correct for its knowledge time |
| **Valuation-date MRP, as known today** | The same effective date, resolved against today's policy table (it now includes the backdated entries) | Board MRP (955 ₹600, 972 ₹400) |
| **Current effective MRP** | The MRP in force today (open interval) | Board MRP; no later revisions |

So A7-F2 is **reclassified**. It is not a resolution defect but an expected bitemporal difference: the policy was entered after the run and backdated. Any re-run of Sep-2026 would now resolve the board MRPs, so run 119 no longer equals a fresh recomputation for these SKUs. Proposed rule (decision for the user): price proposals use the **current effective MRP**. A frozen run keeps its run-time MRP and is labelled with its knowledge time.

**Data-quality note (P3):** SKUs 381, 647 and 955 also have an APPROVED interval from 2026-09-05 to 09-09 at the board price, created 2026-10-15. The register says effective 09-10 for these three. Either the register or those three intervals is wrong. User to confirm; there is no cost impact on run 119.
