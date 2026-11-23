# Executive MIS G7 — S1 implementation evidence: stage-first route/BMR source resolver

**23 November 2026 IST | READ ONLY implementation evidence, no production stage event installed.** This report supersedes the earlier location-attribution blocker. Formal G7 OPEN 6/11 (~55%), G8 parked. Preserve existing production DWL, FG ledger and v6.4.2 Electron release; #485/#517 remain draft/unmerged.

## Why stage mapping is the actual implementation gate

The governing stock identity is `product_id + exact batch_number`, with `bmr_id` as linked manufacturing evidence and `sku_id` as conversion of packaging units to batch-base UOM. The versioned product route is the required process plan, but it does not prove actual activity execution. Stage status requires independently source-verified, signed batch-specific evidence; do not equate `Done`/`In Storage` with signing.

**Live schema confirmed:** `costing.product_process_route` has approved versions with effective_from/effective_to; `costing.production_route_family_route_step` has unique step identity, step_key, activity_id, sequence_no, mandatory/repeat/skipping metadata; `public.activities` contains activity_name; `public.daily_work_log` contains actual activity, batch, status, storage quantity and execution date; `public.bmr_details` links product_id+bn to BMR id.

**Executable server S1 resolver fixture:** `MIS_G7_STAGE_BATCH_ROUTE_COVERAGE_READONLY_20261123.sql` committed `5495d966c3f55cf9a17761fc201be8164623dd60` and executed on live PostgreSQL inside `BEGIN READ ONLY`. For FG bulk-storage daily work logs in Nov1–21, BMR coverage is **80/80 exactly unique**. Detailed evidence classifications:

| Source disposition | Work logs | Done | In Storage | What this actually means |
|---|---:|---:|---:|---|
| ROUTE_COVERAGE_MISSING | 52 | 39 | 13 | No effective approved route on the FG activity's log_date |
| FG_STAGE_MAPPING_REVIEW | 17 | 14 | 3 | Exactly one effective approved route but no single recognized FG bulk step key |
| ROUTE_VERSION_OVERLAP | 1 | 1 | 0 | Multiple simultaneously effective approved routes; must not pick arbitrary version |
| SOURCE_CORRELATION_ONLY_NOT_SIGNED | 10 | 7 | 3 | Unique BMR, one effective approved route and one explicitly recognized FG boundary step, but stage execution NOT signed |
| **TOTAL** | **80** | **61** | **19** | Zero are automatically authorized as signed merely by this query |

**Other sample across all Nov activity-batch combinations:** 146 distinct product/batch work-log groups: 90 no approved route effective at first observed activity, 53 single effective approved route, 3 overlapping approved routes. Overlaps observed for product 262 (batch 0038 and 6998, route versions 1 and 2) and product 753 (batch 5355, route versions 1 and 2). This does **not** prove all missing master coverage means defective manufacturing; route migration historical policies/effective dates may differ, and the batch production start date (BMR) can be earlier than the specific activity log date.

**Explicit known FG boundary step mapping (initial reviewed source only):** `OIL_FG_BULK_HOLD`, `PILLS_FG_BULK_STORAGE_BOUNDARY`, `TABLET_CAPSULE_FG_BULK_STORAGE_BOUNDARY`, `OIL_FILLING_LINE_SIDE_FG_BULK_STORAGE`. The associated `public.activities.activity_name` is `FG bulk storage`. These four are a **partial candidate allowlist**, not a universal definition for all route families. FG_TRANSFER and FG_TRANSFER_BOUNDARY are not synonyms for the FG bulk receipt. Do not authorize automated signoff using a keyword LIKE match.

## Concrete S1–S4 server requirements

**S1: resolve effective route at actual production batch date.** Prefer governed BMR batch execution/start date where available, fall back to audited log_date only under an explicit policy. A unique product route is required for automatic mapping. If zero routes, return `ROUTE_COVERAGE_MISSING`, not fabricated compliance. If multiple, return `ROUTE_VERSION_OVERLAP`, never silently MAX(route_version). Select required boundary step through an approved mapping for the route family, including where new FG bulk boundaries have to be added, without modifying historic approved route records automatically.

**S2: separate staged execution from source correlation.** One signed stage-execution receipt per governed route-step occurrence with product/batch, BMR, versioned route and step IDs, original DWL and/or physical BMR evidence, measured base quantity/UOM, signature actor/authority/timestamp, source fingerprint and correction predecessor. Multiple activities can contribute to one stage; repeated stages remain separately identified. The `MIS_G7_STAGE_FIRST_EXECUTION_STORAGE_REVIEW_ONLY_20261123.sql` schema is a model, **not installed**; it requires real signing/grants and append-only correction implementation.

**S3: batch-wide conserved stock.** One product/batch transaction lock shared by all stock-changing writers; batch receipts, force-close/auto-zero, internal transfers, packing depletion and signed excess must be reconciled in compatible base UOM. Physical location is optional metadata, not a blocker. Direct ledger DML currently available to authenticated must be governed through a coordinated privilege/writer migration.

**S4: actual C2 in-page excess then pack.** Check signed C1 FG stage and approved quantity. Calculate required base quantity from SKU and its applicable pack policy. When requested quantity exceeds available batch bulk, only a genuinely authorized actor can record measured extra bulk with evidence in in-page modal; the server inserts signed excess and pack/depletion **atomically** and idempotently. No signed FG stage remains a hard stop, including if extra bulk is requested.

## Bounded delivery status and next work

**Produced:** executable READ ONLY route/BMR classification for 80 FG bulk work logs; source status distribution independently verified; reviewed candidate FG boundary mapping; no stage signing or tally money inferred.

**Not produced:** a real signed stage writer, safe all-writer batch lock, RLS/JWT enforcement, C2 atomic excess, source-backed C3 repair for 29 omitted pack lines, immutable S3 financial receipt or full isolated PG compile/concurrency tests. These must precede owner installation authorization. Do not install a narrow packaging trigger alone or modify source ledger as a test.

**Next bounded engineering action:** derive explicit route-family-to-FG-stage map with source-backed coverage/collision checks; then implement complete stage execution writer and shared stock serialization in free isolated PostgreSQL, with role/concurrency acceptance. No paid Supabase branch and no production DDL/DML.
