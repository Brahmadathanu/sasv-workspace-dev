# Executive MIS G7 — stage-first S1 normalization register and deployment scope

**23 November 2026, IST. Status: REAL READ-ONLY SQL ACCEPTED AS SOURCE EVIDENCE; G7 REMAINS OPEN.**
User-approved governing principle: product, BMR/batch, route stage and actual activity outrank location. No historic route, stage event, FG ledger or production permissions have been changed. PRs #485/#517 remain draft/unmerged.

## S1 verified working register

Executed checked-in SQL `MIS_G7_S1_ROUTE_NORMALIZATION_REGISTER_READONLY_20261123.sql`, final test-corrected commit **`6acc61c1f7f994a4adedb40ba64bb4e6ab0df831`**, via live PostgreSQL `BEGIN READ ONLY` for Nov1–21 FG bulk activities. Earlier draft alias errors were corrected on the same review branch before successful execution.

| Review queue | FG bulk activity records | Products | Product/batches | Done | In Storage | Unique BMR |
|---|---:|---:|---:|---:|---:|---:|
| PRODUCT_ROUTE_COVERAGE | 52 | 34 | 39 | 39 | 13 | 52 |
| MANDATORY_FG_STAGE_GAP | 17 | 11 | 13 | 14 | 3 | 17 |
| APPROVED_ROUTE_OVERLAP | 1 | 1 | 1 | 1 | 0 | 1 |
| ACTIVITY_ROUTE_CORRELATED_NOT_SIGNED | 10 | 6 | 8 | 7 | 3 | 10 |
| **TOTAL** | **80** | | | **61** | **19** | **80** |

All 80 FG bulk work-log records contain positive storage quantities in the observed cohort. No FG source has been signed by this query. Route review is per actual source record; multiple work logs can reference the same batch. There are 34 products with no APPROVED route anywhere in the inspected master, 11 with a uniquely effective route but no mandatory FG bulk activity-mapped step and one overlapping route. Do not equate 52 records with 52 missing product routes.

## Minimal implementation scope, preserving historical truth

**Historic source projection:** Do not block old batch-ledger balances, MIS evidence views, historical approved costing COP references, or traceability merely because the new route/stage master is not yet complete. Expose `ROUTE_COVERAGE_MISSING`, `FG_STAGE_MAPPING_MISSING`, `ROUTE_VERSION_AMBIGUOUS`, or `STAGE_EXECUTION_NOT_SIGNED` with original BMR/work-log IDs and positive FG bulk evidence. Do not fill zero, auto-create signatures or claim financially certified completed production.

**Future governed production route:** For each new batch, require exactly one resolved effective APPROVED product route (route version selected through explicit nonoverlapping effective dates) and a governed mandatory FG bulk stage mapped by activity ID/step. If no route or missing required step, stop **new stage-signoff attempt** with a readable route-readiness error before packaging. Do not change old route history in place; route normalization must be versioned and owner-approved as part of ordinary route-master governance.

**Batch-stage signoff:** Protected append-only source-backed per-batch route-step occurrence with actor evidence, signature authority, execution timestamp, original BMR ID, activity/work log pointers and source-hash/correction lineage. Note `daily_work_log.status='Done'` or `In Storage` is not proof of signed per-batch stage completion.

**Batch stock:** `product_id + exact batch_number` governs available bulk in compatible base UOM, with SKU pack-size conversion. One transaction lock must be used by *all* FG writers; direct authenticated FG ledger mutation currently bypasses that and must be governed in coordinated migration. Location metadata may remain NULL for historical entries without becoming G7 gate.

**C2 atomic excess:** In-page modal for authorized packing actor to enter genuine measured excess with evidence and reason; server verifies independent excess permission and existing signed FG stage, then inserts signed excess and packaging/depletion atomically under the batch lock with idempotent retry and rollback on failure.

**C3 legacy repair:** 29 omitted consumption SKU lines due to old trigger silent skip remain an independent evidence-based repair; never create FG bulk quantity from aggregate pack units. The existing 144 movements missing location remain nonblocking.

## Acceptance order and stop conditions

1. S1 review register *already executed*. Versioned route coverage normalization proposal for 34 products and missing mandatory FG step normalization for 11, plus overlap for one inspected FG activity record; preserve existing approved route versions.
2. S2 signoff table, server permission contract and append-only correction behavior.
3. S3 batch-wide stock writer/guard spanning DWL receipt, packing SKU, auto-zero, force close, internal transfer and historical replay; close authenticated direct DML bypass.
4. S4 authorized signed measured excess + pack, shared commit, idempotent retries, permissions.
5. S5 isolated source-backed C3 replay of 29 lines only after appropriate original FG receipts and unit conversions are verified.
6. S6 real isolated PostgreSQL create/compile, two-session race and signed-in authorization/rollback tests; only thereafter request explicit owner production installation and later client/Electron release authorization.

**Delivery is not complete at S1**. Full writer, signing policy, concurrency and audit tests remain unimplemented; formal G7 stays **OPEN (6/11 programme gates, ~55%)**, G8 parked. No paid branch, live DDL/DML, signed production receipt, client release, costing deletion or checkout cleanup was performed.
