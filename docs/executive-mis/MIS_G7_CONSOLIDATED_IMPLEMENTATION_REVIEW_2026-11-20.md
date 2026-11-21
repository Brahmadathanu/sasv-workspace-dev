# Executive MIS G7 — Consolidated server implementation review

**Date:** 20 November 2026 IST  
**Status:** READY FOR OWNER REVIEW OF DESIGN ONLY — **NOT READY FOR LIVE INSTALLATION**  
**Authority:** G6 valuation methodology conditionally approved; subsequent G7 actions explicitly restricted to design and offline validation. No live SQL, migration, grant, merge, deployment, client release or Costing Suite release authorized.  
**Canonical programme ledger:** `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md`.  
**Source artifacts:** `MIS_G7_SERVER_CONTRACT_DRAFT.md`, `MIS_G7_READONLY_SQL_DESIGN.sql`, `MIS_G7_FREEZE_AND_SECURITY_DESIGN.md` and `scripts/mis-g7/` synthetic tests.

## A. Executive decision summary

Use the last **approved** costing run as a reproducible reference, **not** a draft. For November 2026 the verified prior-month reference run is **143** (October 22 valuation); run **152** is draft. Product bulk-reference cost uses approved product/base-unit raw materials + manufacturing-only direct labour + production-route overhead + product QC + applicable internal conversion + the **RM-handling share** of Materials-Stores. The **PM-handling share** stays with packaging. The latter split is derived directly from the approved `MATERIALS_STORES_STANDARD_RM_PM_V1` workload model, not an arbitrary proportional allocation.

The G7 management value measures are **planned bulk reference value** (frozen plan only for formal comparison), **actual bulk received reference value** (physical storage ledger), **completed production reference value** (blocked pending canonical batch completion parity), and **Tally FG book transferred value** (distinct accounting basis). Do not show any achievement percentage when formal completion, plan freeze or coverage is unverified.

At the present gate, **a live indicative covered subtotal** could be computed, but must not be marketed as complete bulk COP or actual expenditure. No live reporting change yet.

## B. Approvals already possessed vs not possessed

**Approved in principle:** G6 reference-cost basis and owner direction to include the manufacturing-attributable Materials-Stores component. The approved costing workload policy contains both RM and PM, so stage-appropriate RM-only stores attribution is the proposed interpretation.

**Not approved:** treating synthetic mock results as SQL acceptance, deploying live SQL or a function, creating tables, granting access, freezing management production plans, reclassifying Costing Suite accounting policy, editing Electron/service worker assets, merging #485 or #486, publishing installers, or releasing MIS.

**Single remaining accounting sign-off needed for server implementation:** confirm that the existing approved RM workload share of Materials-Stores is included in bulk manufacturing and PM share remains packaging, leaving the underlying Costing Suite allocation unchanged. No cross-stage total charge is duplicated.

## C. Read-only evidence and independent design review

- Approved run 143: **627/627** SKU manufacturing COP components reconcile exactly once internal conversion is included; 627/627 SKU manufacturing labour split and product-unit labour rate parity; 627/627 production OH rate parity.
- Materials-Stores: 627 READY SKU allocation + workload records, unique on (run,sku); all 453 products have valid product quantity denominators. `RM workload + PM workload = unified workload` on every SKU. Sum ₹260,508.25 decomposes into **RM ₹2,713.94**, **PM ₹257,794.31**, residual ₹0.00. These are frozen *model allocation amounts*, **not November incurred costs**.
- Rate formula for product p: `RM_stores_per_base[p] = SUM_s(allocation_amount[s] * rm_workload[s]/unified_workload[s]) / SUM_s(monthly_sku_base_qty[s])`, over SKUs belonging to p in the *same approved run*. 453/453 nonnegative product rates; 100/100 November positive-planned products covered.
- Five internal-source products have different labour and stores denominators: intentionally use each governed component's own denominator, never a hybrid.
- 79 positive November storage receipts: 74 Kg / 4 L / 1 Nos; all match their respective product base UOM in the read-only sample. 52 products, two with no approved rate (Kayyonyadi Enna 30 Kg, Anulomana Sookshma Choornam 3.4 Kg). These remain **unvalued**, not zero. Do not infer unique completion from recurring Done rows.
- Separate Tally transfer view changed during discovery, underscoring the need for an explicit common local-date report cutoff and recorded snapshot watermark. SQL draft now applies an explicit Asia/Kolkata date for timestamptz storage movements and the same requested inclusive cutoff to the `transfer_date` date column, bounded to one report month.
- Source schema checked: ledger `id`, `qty_base`, `uom`, `movement_date`, `source_table`, `reason_code`; Tally `book_transfer_value`, `transfer_date`, `recon_status`, `valuation_status`; costing snapshot keys, rates and workload columns. Key uniqueness checked for 627/627 RM and materials stores SKU records, and 453 QC product records.
- Existing `costing.*` SELECT **denied** to `authenticated`. Existing MIS paged RPCs execute for `authenticated` but not `anon` and run as invoker. `public.app_has_permission` is an established permission checker. **Actual positive and negative logged-in user tests NOT TESTED.**

## D. Strict boundaries on the SQL draft

`MIS_G7_READONLY_SQL_DESIGN.sql` is a **SELECT-only calculation proposal** for analysis. It is **not** the final, callable production server function. Its hardcoded month/run are fixtures, not a policy for all time. Do not run it on production under this authorization.

It joins each SKU snapshot only inside product-level aggregation CTEs, then joins **one row per product** to the plan and ledger. It rejects missing/negative components and UOM mismatches. The common period cutoff is expressed in **India-local date** for a timestamp-with-time-zone ledger and in date form for Tally book transfer. It intentionally returns `NULL` for completion and achievement.

Important correction before final migration: the draft's `rate_status` and covered totals are not adequate as a public API by themselves, and the role has no underlying source access. An authorized implementation must use a separately reviewed privileged private rate/snapshot builder and narrowly permission-checked summary response. Preview performance must be independently checked; converting timestamp to local date within a predicate may inhibit an ordinary index unless bounds are rewritten to sargable UTC/offset intervals.

## E. Proposed production architecture (future authorization only)

**Private extraction / snapshot:** private MIS namespace with **append-only sealed header**, product plan lines, product approved-run component rates, normalized physical receipt events and optional transfer-reference rows. Store `approved_cost_run_id`, approval timestamp, approved valuation date, plan source forecast/overrides/stock/WIP fingerprints, report and event as-of, source identity, batch identity, correction/supersession chain, base units, policy version, value-coverage reasons. Keep source identifiers/digests required for reproducible prior-month reports despite Costing programme retention; do not alter retention policy here.

**Security gateway:** server-only `public.get_mis_production_value_summary_v1(p_report_month date, p_plan_snapshot_id bigint)`, permissions checked on the server with `auth.uid()` plus canonical `app_has_permission('executive-mis-dashboard','view')`. Return aggregates and coverage, not raw source records, BOM, personnel or costing traces. Private source tables must never be made SELECT-readable by every authenticated user. Prefer a small invoker RPC over an RLS-protected precomputed read model; if a constrained definer gateway is required, independent review of owner, safe search_path, fully qualified names, no dynamic SQL, revoke default PUBLIC/anon execute, grant authenticated only, and explicit negative-access tests. Must also verify that the chosen RPC approach can read its data *after* permissions are applied; an invoker cannot silently access ungranted private sources.

**Completion:** do not call `daily_work_log.status='Done'` a verified monthly completion event. Use an event adapter that can later receive immutable product-route step/batch-completion records, account for movement corrections and prevent dual source identity at cutover. Until proved, `completed_reference_value=NULL` and `achievement_pct=NULL`.

**Planning:** source `v_product_bulk_consolidated_effective` is mutable; a forecast-run ID alone does not pin overrides and stock/WIP. Formal plan requires an immutable snapshot with source input digests. LIVE_INDICATIVE remains visually separate and may have a date-specific covered subtotal but no formal achievement.

## F. Consolidated acceptance matrix and next sequence

| Gate | Required acceptance | Status now |
|---|---|---|
| A1 accounting | RM/PM stores allocation reconciles and no double charging | **READ-ONLY DATA PASS**, owner stage-scope confirmation for implementation pending |
| A2 approved rates | Approved run pinned, rate coverage, exceptions and UOM | **READ-ONLY DATA PASS** on inspected November scope |
| A3 executable SQL | Full SQL prepared with schema, frozen snapshots, RPC, grants, revoke and rollback | **NOT PREPARED / NOT AUTHORIZED** |
| A4 SQL static checks | Offline parser/syntax, CTE cardinality and proper safe time predicate | **PARTIAL**: catalog columns and keys checked; exact SQL not executed or parser-certified |
| A5 security | No-view and anon deny, privileged read, restricted data non-disclosure | **DESIGN ONLY**; live negative tests not run |
| A6 performance | EXPLAIN indexes, bounded query, refresh cadence without production load | **NOT TESTED** |
| A7 plan & events | Sealed immutable plan, one verified physical event per key, separate completion | **DESIGN ONLY** |
| A8 rollback | One independently reviewed reversible installation plan, restoring grants and retaining baseline | **STRATEGY ONLY** |
| A9 client | Claude package after `SERVER ACCEPTED`; PR #486 separate draft | **NOT AUTHORIZED** |
| A10 integration | G9 data/security/freshness/browser acceptance and independent G10 release | **NOT STARTED** |

**Next bounded action, without wandering:** prepare a separately reviewable, exact SQL migration draft only **after** the scope and privilege pattern is approved; perform local/static verification first. Then request a narrow **separate authorization** to apply SQL and run authenticated checks. Do not combine this authorization with merge, client deployment or Electron release.

## G. Rollback requirements for future production implementation

1. Pre-install pin: current `main` SHA, existing function signatures and grants, table/view definitions, current run approval, before/after source fingerprints, existing MIS G0–G5 source responses. Keep the Costing Suite release checkout untouched.
2. Make G7 additive/versioned, no `CREATE OR REPLACE` of existing MIS G0–G5 objects; no writes to Costing, operational logs, Tally or forecast sources.
3. Install only with explicit reviewed migration transaction and a fresh owner authorization; apply restrictive grants in the same authorized transaction and validate role behavior before client publication.
4. Rollback only the newly introduced G7 objects/grants and scheduled refresh work if any; do not erase source data or existing MIS G0–G5 objects. If historical sealed snapshots already exist, preserve them by policy and disable access before any cleanup.
5. If parity/access/performance fails, G7 remains HOLD and no client merge or release. Record failure evidence in the workflow.

**Final hold:** design is advanced, *not* safe to label `SERVER ACCEPTED` or install. No user approval for production SQL exists in this G7 design session.
