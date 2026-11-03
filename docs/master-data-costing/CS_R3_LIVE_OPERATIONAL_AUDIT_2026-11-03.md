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
