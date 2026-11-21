# Executive MIS G7 — post-merge bulk evidence and implementation gates

**Evidence checkpoint:** 21 November 2026 IST  
**Authority:** read-only diagnosis + planning; NO migration, source write, client PR, production deploy, merge, installer or Electron release authorized by this file.  
**Canonical continuation:** `EXECUTIVE_MIS_WORKFLOW.md` on docs branch `docs/executive-mis-workflow-20261119`, draft PR #485, **not yet in `main`**.  
**Client:** PR #493 MERGED into `main` at `72a686e805e2c562a53c9435064fb029b3499f41`; PR #486 also appears independently MERGED at `19616ce8af6ffb6d4902c2082680f310218969c1`. Do not rerun/merge either.  
**Current server:** approved bounded `public.get_mis_production_value_summary(date,date)`; no versioned replacement. The known mobile preview passed View-only access, monetary cards, month/day selection, counts and stale-asset resolution; the **post-merge production-host PWA** is not independently checked. Direct web fetch of production Netlify returned inaccessible in the model's web tool; do not claim HTTP 200, live build SHA, PWA cache or actual production-session pass from the merge.

## Gate discipline

Retain G0–G5 formally complete (6/11 ~55%), G6 method conditionally accepted, G7 OPEN, G8 PARKED, G9–G10 pending. G7 has **three independent data tracks**, plus deployment receipt and documentation-governance sync. Execute the server tracks in a single evidence-led bulk read-only package. Do not assign another client build until a server contract and permission model have independent acceptance and owner approves implementation.

### Workstream A — frozen production plan lineage (server-owned)

**Findings from live read-only SQL:** November `sku_forecast_monthly_base` has 1,974 rows in seven run IDs: 122 (1,938 rows), 119 (4), 116 (7), 112 (6), 111 (3), 105 (8), 99 (8). `forecast_run` #122 is `baseline / OK`, as-of 26-Oct-2026, closed 26-Oct-2026 UTC and `frozen_after_day=25`. It is a forecast provenance record; this alone DOES NOT establish a sealed production plan. November `production_qty_overrides` includes **506 active rows across 506 products**. Existing `v_product_bulk_consolidated_effective` is mutable, expensive (prior 6-second bounded timeout) and must not be read directly on the interactive RPC path. Existing forecast/override input rows are not automatically an owner-approved immutable plan.

**Bulk tasks:** map product/month plan expressions and their contributing forecast runs, all active overrides, stock/WIP deductions and effective post-run changes; identify canonical product-base quantity/UOM and ensure no double conversion; identify source IDs, planning as-of/approval authority and mutation lineage; design a narrow sealed one-per-period version + immutable line snapshots, sealed timestamp, input fingerprints/coverage, rate-source cutoff and amendment/cancellation policy. Demonstrate unchanged results for repeated reads after source updates by fixture; preserve approved-history identity. No new plan valuation until bulk-stage cost and product/UOM conversion proofs are independently checked.

**Accept only after:** owner-approved seal authority and frequency, immutable unique plan key, stable product/UOM/quantity identity, reproducible pre/post source changes, full-missing-source disclosure, bounded read latency, two-user permission tests and no circular costing/forecast dependency. Until then return `planned_reference_covered_value = NULL` and `plan_status = UNAVAILABLE_PENDING_FROZEN_PLAN`.

### Workstream B — actual bulk receipt versus verified completion (server-owned)

**Read-only facts:** for 1–21 Nov `fg_bulk_stock_ledger`, `source_table='daily_work_log'`, `reason_code='FG bulk storage'`: **80 positive postings / 61 distinct (product_id,batch_number) pairs**, no zero/negative rows in filtered set. These are **receipt events** and may be incremental postings, not 80 uniquely completed batches. `daily_work_log.completed_on` with `status='Done'` yields 680 rows in the month, but this includes heterogeneous work-log activities and **cannot** be counted as 680 completed production batches. Historical workflow evidence distinguishes `Done` receipts versus `In Storage` pending rows and warns that receipt date != completion date.

**Bulk tasks:** ledger/log ID one-to-one trace by `source_id`, product and batch identity, movement dates, `storage_qty` parity, normalized UOM, multi-receipt handling, correction/repost/void/reversal lineage and final lifecycle; distinguish genuine completion evidence from storage and from packing/internal transfers. Map stage/route-specific completion under planned product-process-route evolution without binding public MIS contract to `daily_work_log` internals. Classify rows as `VERIFIED_COMPLETION`, `RECEIPT_ONLY`, `BLOCKED_CORRECTION`, `UNRESOLVED` with reason and no forced values. Cross-check counts/quantities with independent batch/BMR governance, with scoped date semantics.

**Accept only after:** event uniqueness/idempotence, no double count across storage and completion, evidence of actual completed output quantity per batch in correct UOM, explicit completion timestamp, historical corrections, approved bulk-stage rate coverage, and negative/access tests. Until then `completed_reference_value=NULL` and `completed_status=NOT_VERIFIED`. Keep receipt covered subtotal separate, with excluded rows visible.

### Workstream C — Tally FG books versus transfer log (server-owned)

**Current client contract:** `tally_fg_transfer_book_value` is book-basis subtotal at its own snapshot and date; `transfer_reconciliation_status=NOT_CHECKED_BY_BOOK_TOTAL`. Screenshot for 15-Oct cutoff showed ₹34,62,764.90 / 192 book lines; 31-Oct cutoff ₹86,33,344.18 / 406 lines. Values are not comparable to bulk reference cost by assumption.

**Bulk tasks:** map voucher-line keys/snapshot selection and source precedence to `v_fg_transfer_reconciliation`, identify missing-log, not-valued, reversal, duplicate, late-arriving, multi-location and valuation differences; classify exceptions by source cutoff and controlled monetary identity. Investigate month and as-of truncation; no unbounded live reconciliation join in the signed-in 8-second RPC. Prepare a small bounded, permission-restricted reconciliation read model with explicit snapshots and exception counts, or defer. Do not change current book total until parity proofs succeed.

**Accept only after:** source-to-voucher coverage, stable ids, mismatch handling, same cutoff on both sides (or explicit mismatch), latency, role-isolated view, tested no-view and anonymous denial, and no hidden cost-basis equivalence. Until then retain `NOT_CHECKED_BY_BOOK_TOTAL`.

### Workstream D — executive snapshot freshness discrepancy (server-led, minimal client later)

Owner's genuine preview showed top-level active=317 and overdue WIP=74 while current live Production pipeline was active=314, overdue=69. Read-only `mv_mis_executive_summary` shows `mv_refreshed_at=2026-11-21 03:00:00.061435+00`, active=317, WIP=90, overdue=74 and transfer value ₹36,91,246.08. This is a **snapshot versus live cutoff** distinction, not proven arithmetic corruption. Preserve both and trace refresh/refresh scheduling/aggregation; optionally clarify KPI labels/freshness in a separate client-only acceptance package after source semantics are documented. No force-refresh without approval.

## Deployment verification subgate

- PR #493 merge to main **confirmed** with merge SHA `72a686e805e2c562a53c9435064fb029b3499f41`. PR #486 also shows MERGED; its separate merge requires only historical record, not another merge.
- Post-merge production PWA is **NOT TESTED** here: obtain the normal production host's served HTML+JS/worker hashes or an authenticated owner screenshot, not a deploy-preview screenshot. Verify source module/asset freshness, versioned MIS JS URL, View-only tile, four cards, six pipeline counts and month-scoped As-of day selector. Do not change service-worker cache version casually, and do not route this into Costing Suite installer acceptance.
- One positive session is sufficient for unchanged functionality; authorization tests stand unless a new reporting access boundary is introduced. Do not expose JWT or raw proprietary figures in logs.

## Bulk sequence and exact stop gates

1. **Read-only inventory and source map:** catalogue object schemas, provenance, source keys/indexes, existing security; record precise SQL/EXPLAIN with bounded timeouts. Use existing canonical data, no speculative parallel APIs.
2. **Independent fixture/contract proof:** build offline scenarios for frozen plan mutation, incremental receipts, same-batch duplicated postings, corrections/reversals, UOM, multiple plan runs, late Tally entries and permission failures. Mark evidence/data gaps explicitly. Keep plan and completion values NULL where unproven.
3. **One coherent reviewed server package:** only after data proofs, author a canonical schema/migration **proposal**, rollback, security matrix, query plan and regression harness on the MIS docs branch; do NOT apply production SQL until fresh explicit owner approval. Prefer extending sole MIS RPC over a second conflicting report.
4. **Client handoff only after server acceptance:** one context-rich Claude assignment for all accepted reporting fields, error/coverage states, fresh token-based UI and responsive test matrix. Draft PR only; independent review; owner browser test; then separate merge authorization.
5. **Closure:** update main canonical doc status *after* governed docs branch reconciliation, independent acceptance and approved deployment. G8 alerts remains parked. Release hold unchanged.

### Scope locks / exclusions

No edits to Costing Suite; no WP12/installer work; no payroll/individual-level cost disclosure; no global statement-timeout increases; no permission broadening; no silent mutation of forecast, planning overrides, storage ledger, BMR, Tally or costing; no plan achievement until both a frozen plan and verified completion share the exact approved cost basis. No fabricated or blended Kg/L/Nos quantities.

**Current next action:** complete A/B/C bounded source lineage evidence and prepare a single evidence/decision packet. Do not interpret this document as consent for production installation or release.
