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


## 22 November 2026 — independent G7 read-only lineage proof receipt

**Execution scope:** live project `qhmoqtxpeasamtlxaoak`; **SELECT/EXPLAIN only**, bounded 4.5-second local `statement_timeout` for complex reconciliation; no DDL/DML, role changes, RPC replacement, cache bump, client commit, staging deploy, worktree operation or Electron activity. Period is **01–21 Nov 2026** in IST for the bulk receipt movement audit; transfer is voucher-date range 01–21 Nov on Tally snapshot **as_of_date = 2026-11-21**. These date bases are different and the rows may change after this checkpoint.

### A. Plan inputs and freeze: NO SEALED PLAN YET

- Read-only inventory: `sku_forecast_monthly_base` has **1,974** November source rows, all **1,974 unique by (month_start, sku_id, region_id, godown_id)**, no duplicated keys spanning multiple run IDs. This is consistent with its source PK and means the seven contributing runs represent distinct current rows, **not** seven independently recoverable complete plan versions. Seven run IDs: **122=1,938**, 119=4, 116=7, 112=6, 111=3, 105=8, 99=8. Run 122 has `status='OK'`, `module_slot='baseline'`, `as_of_date=2026-10-26`, `closed_at=2026-10-26 02:22:27+00`, `frozen_after_day=25`.
- All **506 active November production quantity overrides** were updated at `2026-10-30 06:59:51.625314+00`, **after** run 122 was closed. Unique active product count 506. The effective plan view explicitly computes `GREATEST(0, adjusted_bulk_to_make + active override_delta)` from a **mutable** `v_product_bulk_consolidated` and current overrides. The 506 rows prove current post-close inputs, **not** whether every individual output amount changed at that time. Never sum raw `delta_units` across unlike product UOMs; no financial value or frozen version may be inferred.
- **Design decision pending owner:** snapshot authoritative effective **product/month/base-UOM quantities and source/input version** *after* all adopted overrides and approved carry/WIP logic, with plan period identity, sealing timestamp, approval actor authority, immutable line IDs and fingerprint, source-run membership and amendments as new version/supersession. Confirm the business event that authorizes a seal and policy for late forecast/override edits before any SQL creation. A simple `forecast_run.status='OK'` or `closed_at` is inadequate.

### B. Storage receipt lineage: ROW TRACE PASS; DISTINCT COMPLETION HOLD

- `fg_bulk_stock_ledger` positive **FG bulk storage** rows from `daily_work_log` during IST Nov 1–21: **80 source postings** / **80 distinct source_id references**, **0 orphan daily-work-log references**, **0 quantities differing between ledger `qty` and `daily_work_log.storage_qty`**, **0 `uom` mismatches with `storage_qty_uom`**, **0 receipt-date vs work-log-date mismatches** under the checked date basis.
- Status at time of query: **61 ledger postings** link to `Done` logs having non-null `completed_on`; **19** link to `In Storage` logs without completion date; **0 other status**. This differs from the earlier 58/21 snapshot, consistent with mutable lifecycle state; never silently rewrite earlier test fixtures.
- **61 distinct (product_id,batch_number) keys**, of which **42 have any Done receipt**, **19 have only pending receipts**, **0 have mixed Done/pending receipt states**, and **19 batch keys have multiple distinct-source postings** (19 extra receipt rows, **17** keys span multiple movement dates). A repeated product/batch key can represent incremental receipt, repeated work activity, or different completion context; neither summing as completed output nor deduping to one completion is yet authorized.
- **A concrete completion-date conflict:** product_id **183**, batch_number **5521**, two source postings with receipt dates **7 and 11 Nov** and respective `completed_on` dates **9 and 12 Nov**. This is a lineage-review fixture, not an assertion that either date is erroneous. It proves that a single unique product/batch does not necessarily yield one unambiguous completion timestamp using current log records.
- **Next strict gate:** evidence from governed BMR/batch lifecycle, product/process route, accepted end-of-bulk quantity and completion event ID; distinguish completed production from incremental storage movements, correction/repost, packing, inventory adjustment and internal transfer; choose clear precedence of different completion dates with audit trail. Until then keep `completed_reference_value=NULL`, `NOT_VERIFIED`, achievement `NOT_COMPARABLE`. The 680 generic `daily_work_log` Done rows in the month do not represent distinct completed production batches.

### C. Tally FG transfer: BOOK AMOUNT ARITHMETIC PARITY PASS; PROCESS RECONCILIATION HOLD

- Selected Tally FG transfer voucher-line snapshot `as_of_date=2026-11-21` and voucher_date Nov 1–21: **226 lines** with **226 distinct (voucher_guid, inventory_line_no, batch_line_no)** within this filtered set, **0** null voucher GUIDs, **0** missing batch code, **0** cancelled/optional flags, aggregate `transfer_amount` **₹37,11,850.56**. This total is a **book snapshot amount**, not manufacturing COP.
- Separately `v_fg_transfer_reconciliation` restricted by `transfer_date` Nov 1–21 completed within **4.5-second bounded timeout**. It produces **110 transfer-date/product/batch groups**: **103 MATCHED and valuation OK**, **1 MATCHED but NOT_VALUED**, **6 MISSING_LOG and valuation OK**. No `EXTRA_LOG` or `MISMATCH` was returned in this scoped query. Matched-not-valued group book amount **₹9,422.10**; missing-log groups sum **₹64,100.27**; normal matched/valued groups **₹36,38,328.19**.
- Reconciliation `sum(book_transfer_value)=sum(tally_total_amount)=₹37,11,850.56`, numerically identical to the 226 voucher-line amount at this source cutoff. **This is amount parity, not transfer-log reconciliation PASS.** Six missing-log groups occur on **Nov 7 (2; ₹16,437.72), Nov 11 (1; ₹21,080.07), Nov 12 (1; ₹5,978.00), Nov 21 (2; ₹20,604.48)**. The `MATCHED/NOT_VALUED` flag needs separate valuation-basis review, even though the book amount is present.
- The reconciler is a `FULL JOIN` on `transfer_date + product_id + batch_code` between `v_tally_fg_transfer_event` and `v_dwl_fg_transfer_event`, classifying MATCHED, MISMATCH, MISSING_LOG, EXTRA_LOG and LEGACY_PRE_LOGGING. Its `security_invoker=true` view has `authenticated SELECT`, `anon SELECT` denied. **This does not itself establish a module-specific Executive MIS View gate.** Do not expose low-level event/ledger rows via the new client or use this entire view directly on the interactive RPC path without load, security and cutoff proofs.
- **Next strict gate:** independently audit the six missing-log groups (late entry vs genuinely missing), one NOT_VALUED group, voucher-source-to-batch mapping, corrections/reversals, and matched-group quality; pin both Tally snapshot and work-log provenance to same governed cutoff before returning a non-`NOT_CHECKED_BY_BOOK_TOTAL` status.

### D. Security, freshness and implementation constraints

- Current source access `GRANT SELECT` for `authenticated` on `v_fg_transfer_reconciliation`, `fg_bulk_stock_ledger`, `sku_forecast_monthly_base`, `production_qty_overrides`, `tally_fg_transfer_voucher_lines`; base `daily_work_log` also has anon SELECT from pre-existing policy. **Grant presence is not effective row visibility**—RLS and underlying invoker-view permissions were not fully audited here. Treat existing source grants as pre-existing facts only; do not widen them, and enforce `auth.uid()` + canonical MIS View on any new MIS-only aggregate gateway.
- The executive materialized view was read at `mv_refreshed_at=2026-11-21 03:00:00.061435+00`, with active=317, WIP=90, overdue WIP=74 and book value ₹36,91,246.08; an earlier live pipeline observation was 314/90/69. These are **different freshness contracts**. Provenance/refresh schedules remain to be reconciled; do not merge them into one timestamp or silently rewrite executive KPIs.
- `public.get_mis_production_value_summary(date,date)` remains the only accepted monetary RPC, with signed-in View/no-view/anon acceptance from earlier gate. Do not add a preview/v2 RPC, raise global timeout, change period costing, or invent plan/completion percentages. Existing user-facing mixed-UOM quantities remain excluded.

### Proposed design review (not authorization)

1. A sealed plan header/line concept needs period, status, version/supersession and owner approval; immutable lines with product/UOM, quantity and input lineage; efficient materialized/read-model consumption, not per-request mutable CTE scans. **Choose sealing authority and amendment policy before writing schema.**
2. An independently audited normalized production-event read model needs event/source IDs, product and batch, event type, process route/version, timestamp, quantity and base UOM, correction/supersession status and completion evidence; entries with conflicting completion dates must remain REVIEW instead of arbitrary MAX or MIN.
3. A bounded transfer reconciliation snapshot should retain original voucher keys and batch matching, exception counts, source dates and cutoffs, never equate Tally book amount with manufacturing reference cost.
4. Independent role tests (actual MIS View, different signed-in no-view, anonymous) and EXPLAIN (<8s authenticated budget with safety margin) are mandatory before any new MIS aggregate becomes production accepted.

**Current outcome:** A plan freeze **BLOCKED on source/version/business policy**, B completed-value **BLOCKED on unique completion evidence**, C book amount parity **PASS but exception reconciliation OPEN**. The G7 server data evidence is **advanced**, not gate-closed. No production write made.
