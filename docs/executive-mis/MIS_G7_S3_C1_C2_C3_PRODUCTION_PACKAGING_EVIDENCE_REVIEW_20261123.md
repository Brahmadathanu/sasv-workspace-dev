# Executive MIS G7-S3 — FG bulk, packaging, forced close and excess-bulk evidence

**Status:** REVIEW-ONLY source evidence, 23 November 2026 IST. G7 OPEN, 6/11 formal gates. This is NOT a declaration of completed monthly production and NOT production installed. All evidence SQL executed under `BEGIN READ ONLY`. Protected Costing Suite Electron release, both draft PRs and unrelated dirty migration files untouched.

## 1. Canonical distinct evidence streams

| Stream | Actual table | Interpretation in S3 |
|---|---|---|
| FG bulk incoming receipt | `public.fg_bulk_stock_ledger` where `source_table='daily_work_log'`, `reason_code='FG bulk storage'`, positive base quantity | Actual stock receipt evidence; NOT complete signed C1 product-route confirmation by itself |
| Bulk used in packing | `public.fg_bulk_stock_ledger` where `source_table='event_skus'` | Stock depletion, not an independent completed-manufacturing or Tally transfer amount |
| Packaging event and pack count | `public.packaging_events` + `public.event_skus`, through event/line IDs | Discrete packaging evidence; count is SKU pack units and cannot be added to mixed-unit bulk quantity |
| FG store transfer activity | `packaging_events.event_type='Transfer to FG store'` | Not a packaging consumption event; must not duplicate Tally FG transfer/book value |
| Manual forced close | `fg_bulk_stock_ledger` `source_table='fn_fg_force_close'` | Adjustment, never positive manufactured bulk or retrospectively signed excess |
| Tiny-balance auto-zero | `fg_bulk_stock_ledger` `source_table='fn_fg_auto_zero'` | Adjustment, never finished production |
| Internal movement | `fg_bulk_stock_ledger` `source_table='fg_bulk_internal_transfer'` | In/out inventory movements, not manufacture |
| Authorized excess bulk | Signed, measured, linked, role-authorized **future** excess event/transaction per approved C2 workflow | **NOT PROVEN from inspected current legacy sources**. Do not reuse force-close or auto-zero as excess. |
| Finished bulk completion | Required product-route FG bulk step and full signed record under approved C1; historical exception C3 only with source-backed correction | Not verified by `daily_work_log.status='Done'`, `completed_on`, or an FG receipt alone |

## 2. November 1–21 IST source evidence

Real `BEGIN READ ONLY` queries using closed interval [2026-11-01 00:00 IST, 2026-11-22 00:00 IST):

**Bulk stock ledger: 226 movements**: 80 incoming FG bulk receipts, 103 packaging-consumption movements, 37 force-close adjustments, 4 auto-zero adjustments, 2 internal transfer legs (one outgoing, one incoming). These are **counts of events**, not additive quantities across distinct products/UOMs.

**Packaging data:** 208 event headers with 260 event-SKU lines; **104 FG-store-transfer headers / 130 SKU lines** and **104 actual packaging-stage headers / 130 SKU lines**. Among 130 packaging-stage SKU lines, **101 link to a same-period FG bulk depletion via `event_skus.id=fg_bulk_stock_ledger.source_id`**, and **29 do not** (26 Bottling/labelling/cartoning, 3 Capsule monocarton packing). These may be route/event semantics, timing or gaps; cannot be pronounced invalid without actual product-route rules. All 208 event headers link to a `daily_work_log` currently marked Done, which is **not** C1 full-route signoff.

**Date boundary:** of 103 ledger packaging-depletion records, all have valid `event_skus` and `packaging_events` references; **two refer to event headers outside the selected packaging event timestamp range**. Thus the 103 ledger movements versus 101 within-period links is explained by event/ledger dates, not an orphan record or count mismatch.

`MIS_G7_S3_FG_BULK_PACKAGING_EXCEPTION_EVIDENCE_READONLY_20261123.sql`, commit `70d84c1f59114d72c3c780ae233577bb76cfc322`, executed PASS. Ledger source SHA-256 `217bb12c85e4d25fe9436f8af5499e3823b406d21d7384fd0966aa989c922297`; packaging source SHA-256 `a6cd6afbe8de59e2d902e937fc9762fba931f0bed25c352605b143c9b28031b7`. These are fixture fingerprints only, not signed snapshots.

## 3. C1–C3 negative semantic acceptance

`MIS_G7_S3_C1_C2_C3_SEMANTICS_NEGATIVE_READONLY_20261123.sql`, commit `d1c9cd06a4eb1a8b892ad9769010706efbe18c6b`, executed PostgreSQL READ ONLY: **10/10 synthetic policy assertions PASS** for signed receipt classification, unsiged legacy bulk, packaging depletion, FG store transfer, force close, auto-zero, internal transfer in/out, unsigned excess denied, and authorized signed excess recorded separately. An authorized excess quantity allows packaging only through the separately approved atomic in-page workflow; it never becomes manufactured output automatically. Synthetic fixtures are NOT evidence this feature exists live.

## 4. Integrated review-only S3 envelope

`MIS_G7_S3_INTEGRATED_EVIDENCE_ENVELOPE_READONLY_20261123.sql`, commit `3fbce699f339cfc001119aaf102a03e8b3380341`, combines source-backed original Tally latest-alteration valuation, packaged/bulk event evidence and operational finalizer job IDs using a single live READ ONLY PostgreSQL SELECT.

**Verified result**:
- Transfer latest-active 226 original/226 distinct/226 eligible voucher rows; 224 approved COP covered, two missing; **₹37,11,850.56 Tally book amount**, **₹39,84,998.88 partial manufacturing COP reference**. Snapshot source as-of **Nov 23**, reporting voucher cutoff **Nov 21**; two different provenance fields.
- FG bulk 226 ledger movements; 80 receipt events, 103 pack-depletion, 37 force-close, 4 auto-zero, 2 internal transfer legs.
- Packaging 208 events; 260 SKU lines (130 FG transfer lines, 130 packaging-stage lines); 101 within-period linked pack depletion, 29 currently unlinked.
- Existing finalizer job IDs at Nov23: IK `964d03f6-a75f-425f-86a7-770639a531f6`; OK `069384a3-4d70-4e51-869b-51b20f96f20a`. Declared source files eight per store. This is operational provenance, not immutable certified ingestion.
- Source hashes: Tally `7e1982f37a51450328bd7362565af66ec0b5a92aaeb2eb40eb7da4b56b4532f1` (differs from §72 projection because of a different versioned field ordering/projection); ledger `217bb12c85e4d25fe9436f8af5499e3823b406d21d7384fd0966aa989c922297`; packaging `a6cd6afbe8de59e2d902e937fc9762fba931f0bed25c352605b143c9b28031b7`.
- Integrated **TEST-only** envelope SHA-256 `ffb55faf392054f05c12a4b838de913bb18e6c83f2e59d7ec3451aa82758ed8b`. Exact field set/format and encoding must be versioned before a production financial signature.
- `monetary_completed_production_value=NULL`; `signed_excess_base_qty=NULL`; source status `NOT_CERTIFIED`, completed production `NOT_VERIFIED`, packing/bulk parity `NOT_VERIFIED`, financial report `NOT_FINALIZED`.

**Important:** This envelope currently returns rollups and hashes, not a complete compact persisted reconstructible projection of all source-rate lines. It is **not a signed immutable report writer**. The final writer must freeze the essential numeric source/rate projections, verified signoff, approved cost state, correction lineage, signed exception quantities, source job IDs and history to remain reproducible after historical costing snapshots are pruned.

## 5. Remaining exact blockers

1. Final approved C1 route-signed full FG bulk completion per batch, not generic work-log Done or a positive FG receipt. Historical C3 corrections require explicit source-backed evidence.
2. C2 approved atomic excess-bulk adjustment before packaging (signed, measured, authorized and recorded), with corresponding protected server/client paths and backfill governance. Existing force-close is not that event.
3. Product-route-aware packaging semantics: explain/resolve the 29 currently unlinked pack SKU records, classify multi-stage packing and transfers correctly; compare per compatible product, batch and base UOM, never sum unrelated unit quantities.
4. Frozen full report writer security, separate MIS signing authority, immutable source/rate values (not only SHA), idempotent versions/concurrency, real role/JWT and performance tests, isolated free PostgreSQL compile and explicit owner installation authorization.

**Single workflow:** G7 OPEN formal **6/11 (~55%)**, G8 parked; #485 docs and #517 offline tests both draft/unmerged. No new ETL tracking table, no paid branch, live DDL/DML, Client/Electron release, migration cleanup or run pruning.
