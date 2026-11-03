# CS-R3 — Costing Live Operational Status, Read-Only Evidence (3 Nov 2026)

**Audit category:** READ ONLY — no approval, refresh request, finalisation, rate correction, cache change, feature activation, migration or production write authorised or performed.

**Authoritative sources queried:** Supabase project `qhmoqtxpeasamtlxaoak`; `public.v_costing_pricing_period_run_status`, `costing.costing_refresh_run`, `public.v_costing_pricing_sku_control_status_by_run`, `public.v_costing_pricing_review_workbench_summary_snapshot`, `cron.job`, `cron.job_run_details`. Snapshot time: 3 Nov 2026 (IST). Repository `main` at start: `4bbadf8802b1f7a6df02d207b1a8e3cca117ca09` (docs #140 merged).

## 1. Governed run and period state

| Period | Period status | Approved for pricing | Latest draft | Context |
|---|---|---|---|---|
| 2026-09 | LOCKED | Run 122, valuation 2026-09-10 | none newer | Run 122 finished successfully |
| 2026-10 | OPEN | Run 143, valuation 2026-10-22 | Run 148, valuation 2026-10-31 | Run 148 **not approved**, not for pricing |
| 2026-11 | OPEN | None | Run 149, valuation 2026-11-02 | Draft 149, not for pricing |
| 2026-08 | OPEN | None | historical run 82 | Fixed historical PRM evidence; not current pricing |
| 2026-07 | OPEN | None | historical run 80 | Fixed historical PRM evidence; not current pricing |

Run 143, 148 and 149 all have `overall_status='SUCCESS'`, and material, build, sheet, control and final snapshot stage statuses `SUCCESS`. Success is an execution status, **not approval**.

## 2. Distinct SKU control counts by run

| Run | READY | REVIEW_REQUIRED | BLOCKED | Total |
|---|---:|---:|---:|---:|
| 143 (approved October) | 627 | 0 | 0 | 627 |
| 148 (draft October) | 514 | 113 | 1 | 628 |
| 149 (draft November) | 121 | 506 | 1 | 628 |

These are `costing.costing_refresh_run.final_*` totals independently matched against group counts from `public.v_costing_pricing_sku_control_status_by_run`.

### Draft 148 review-first classification

- PRIME_COST_REVIEW_REQUIRED: **110 SKUs** — the loaded cost is computable, but one or more components require review.
- MATERIAL_REVIEW_REQUIRED: **2 SKUs** — material-cost confidence issues (fallback, stale, manual or optional-missing rates).
- PRICING_BRIDGE_REVIEW_REQUIRED: **1 SKU** — flagged pricing-bridge status; requires a separate diagnostic read before any remediation.
- MATERIAL_COST_BLOCKED: **1 SKU** — SKU **105, Kolakulathadi Choornam 1000 g**; `pm_blocking_line_count=1`, `rm_blocking_line_count=0`. Control note: required PM rate is missing or blocked; route to PM rate correction.

### Draft 149 classification

- MATERIAL_REVIEW_REQUIRED: **460 SKUs**
- PRIME_COST_REVIEW_REQUIRED: **29 SKUs**
- PRICING_BRIDGE_REVIEW_REQUIRED: **17 SKUs**
- MATERIAL_COST_BLOCKED: **1 SKU** — the same SKU 105 / missing required PM-rate cause.

**Interpretation warning:** these are per-run snapshots and may predate subsequent SKU/BOM master edits (including SKU 105). They do not independently prove that a *current* BOM or rate remains defective; no new refresh or other write is authorised from this read.

## 2A. Draft 148 six-stage evidence and interpretation

All six `costing.costing_refresh_run_stage` stages succeeded:
1. `01_ENSURE_PERIOD`: period ensured.
2. `02_MATERIAL_SNAPSHOT`: **625 ready / 2 review / 1 blocked** out of 628 SKUs.
3. `03_COST_BUILD_TO_SCHEME`: **3,084 ready / 678 review / 6 blocked** out of 3,768 stage rows. **These are cost-build/scheme stage rows, not distinct SKUs**, and cannot be compared directly with the SKU control totals.
4. `04_COST_SHEET_SNAPSHOT`: 27,632 cost-sheet traceability snapshot rows inserted; other trace details in its output.
5. `05_CONTROL_MAINTENANCE`: 628 SKU control snapshot rows, 913 review-action rows, 853 material queue rows, 3,361 material drilldown rows.
6. `06_FINAL_STATUS_CHECK`: **514 ready / 113 review / 1 blocked** at SKU control level, with `overall_control_status='BLOCKED'` because a hard blocker remains.

**Diagnostic implication:** a large portion of October's 113 final review SKUs emerges **after** the material stage (only 2 material-review SKUs there). The prime-cost and later control layers need targeted examination before deciding that all 110 prime-cost review SKUs reflect missing raw-material prices. This does not justify automatic acceptance or a refreshed approved run.

## 2B. Component-level root-cause split for the 110 prime-cost reviews (3 Nov additional live query)

Joined run-148 `PRIME_COST_REVIEW_REQUIRED` SKU ids from `public.v_costing_pricing_sku_control_status_by_run` to `costing.sku_prime_cost_snapshot` by `refresh_run_id=148` and `sku_id`. **Exactly 110 matching SKU rows**:

| Direct labour | Allocation resolution | Internal conversion | Material costing | SKUs |
|---|---|---|---|---:|
| REVIEW_REQUIRED | REVIEW_REQUIRED | READY | READY | 56 |
| REVIEW_REQUIRED | READY | READY | READY | 51 |
| READY | READY | REVIEW_REQUIRED | READY | 1 |
| REVIEW_REQUIRED | READY | REVIEW_REQUIRED | READY | 1 |
| REVIEW_REQUIRED | REVIEW_REQUIRED | REVIEW_REQUIRED | READY | 1 |
| **Total** | | | | **110** |

**109/110 have direct-labour review; 57/110 have allocation resolution review; 3/110 have internal conversion review; all 110 material costing statuses are READY.** Component conditions overlap, so they are not additive. The `prime_costing_note` confirms the composite cost is calculated but one or more components require review.

`allocation_resolution_note` among the 110 contains evidence of **SALES-01** historical sales allocation basis and **Smart default v2 / NEW_PRODUCT_NO_HISTORY / policy 6** assumptions. These notes indicate distinct provenance/review concerns rather than a single missing material rate. Further analysis of the *governed direct-labour allocation status* and upstream acceptance/policy is required before prescribing any change. A new `prime acceptance` RPC is **not** justified by these findings.

## 2C. Pricing bridge exception is specifically OK regional Marketing allocation

Read `costing.sku_pricing_bridge_snapshot` for run 148 joined to the one `PRICING_BRIDGE_REVIEW_REQUIRED` SKU:

- SKU **41**, **Dhanyamlam**.
- `pricing_bridge_status_ik=READY`; `marketing_expense_allocation_status_ik=READY`.
- `pricing_bridge_status_ok=REVIEW_REQUIRED`; `marketing_expense_allocation_status_ok=REVIEW_REQUIRED`.
- The OK note states pricing is calculable but needs review because one or more regional cost components need review. Thus the pricing bridge inherits **OK Marketing allocation** review, not an unidentified global approval anomaly.

**Follow-up:** examine approved regional Marketing allocation policy/evidence and existing PPM client remedy path; do **not** invent a `pricing_bridge_accept` RPC or approve it blindly.

## 2D. WP08/09 server-driven launcher inputs are available read-only

`public.app_nav_sections` has **11 active sections** (Work Log; Planning Workspace; MRP & Procurement; Inventory & Sales Analytics; Product & Reference Master; Plant & Assets; QA/QC; BMR & Production Records; SOPs; System & Integrations; Administration). `public.v_app_module_registry` returns **115 navigation-enabled and active module rows**, including 22 Product & Reference Master, 23 Inventory & Sales, 16 MRP & Procurement and 17 QA/QC. These are **module rows, not necessarily 115 different destination URLs**. IA08/09 should map `module_key`, `section_key`, `label`, `route_path`, role/access conditions and actual client routing before proposing launcher consolidation; no server change or module deactivation authorised.

## 3. Material issue lines are not SKU counts

A separate review-workbench snapshot for November 149 reports review issues including stale RM purchase rate 1,596 lines, RM stock valuation fallback 729, stale PM purchase rate 371, PM stock valuation fallback 243, and **one blocked missing-required-PM rate line**. Issue categories overlap and must not be summed as distinct SKU totals. October material snapshot results returned run 143, not 148; no assumption made about draft 148 from that view.

## 4. Scheduler and stage processor

`cron.job` reports all three enabled:
- Job 66 `costing_weekly_draft_0200_IST`, schedule `30 20 * * 0`, 1 succeeded recorded execution in last seven days.
- Job 67 `costing_monthend_draft_0200_IST`, schedule `30 20 28-31 * *`, 4 succeeded recorded executions in last seven days.
- Job 68 `costing_stage_processor_5min_governed`, schedule `*/5 * * * *`, 2,014 succeeded recorded executions in last seven days (as observed in `cron.job_run_details`), latest around 2026-11-03 14:40 UTC.

This checks scheduler execution records, **not** complete end-to-end approval or every individual stage's business integrity beyond run statuses.

## 5. Gate disposition and next narrow checks

**CS-R3 = IN PROGRESS, PARTIALLY EVIDENCED; not passed.** Do not approve or finalise run 148, change 143's pricing designation, refresh the run or alter SKU 105's rates based on these data alone.

Next read-only inquiries, in recommended order:

1. Identify root causes of the 110 PRIME_COST_REVIEW_REQUIRED SKUs and whether the review is due to changing allocation/period context or unresolved component governance.
2. Trace SKU 105's *as-of-run* PM BOM item/rate in run 148 and compare with its current governed PM-rate state. Differentiate a historical snapshot blocker from a current master defect before suggesting corrections.
3. Investigate the two material reviews and one pricing-bridge review against row-level evidence; do not collapse into a blanket fix.
4. Confirm operational needs for closing October run 148 and whether acceptance of remaining reviews is even required for the owner's chosen pricing approach.
5. Check readiness snapshot freshness, CI-048/049 gate/status, intended official valuation/finalisation semantics, and published pricing-view run designation; document decisions but do not write.
6. Preserve the separate signed-in feature-flag acceptance and Windows Electron release gates CS-R5–R9.

No server or application state was changed. This document is supporting evidence for [COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md](COSTING_SUITE_COMPLETION_TO_RELEASE_2026-11-03.md) and does not amend its gate statuses until a separately reviewed documentation merge.
