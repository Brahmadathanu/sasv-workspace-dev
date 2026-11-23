# G7 canonical correction — activity/stage-first batch accounting, NOT location-first stock accounting

**Decision confirmed by SASV programme owner, 23 November 2026 IST.** REVIEW ONLY implementation orientation, no production installation/approval. This explicitly **supersedes the prioritization** in sections §76–§79 and the location-heavy parts of the review-only `MIS_G7_C1_C2_LOCK_AND_SIGNOFF_SCHEMA_REVIEW_ONLY_20261123.sql` and `MIS_G7_C1_C2_SIGNOFF_SHARED_LOCK_ARCHITECTURE_REVIEW_20261123.md`. Prior evidence remains valid, but location attribution is **NOT** a gating prerequisite for Executive MIS G7 or batch-level stock.

## Canonical identities and hierarchy

- **Product and batch**: `product_id + exact batch_number` is the stock-conservation and locking identity. BMR number / `bmr_id` link to the manufacturing batch after uniqueness/effective mapping checks; neither `sku_id` nor location replaces product+batch identity.
- **Versioned product route**: `costing.product_process_route` and `costing.production_route_family_route_step` specify which route stage(s) and ordering apply at execution. A route master is the **plan**, not a batch execution receipt.
- **Stage execution**: an authoritative, signed record of actual batch-stage occurrence, actor, time, source evidence, stage key, route version, measured output and correction lineage. A stage is a governed route step; an activity is the actual operational work event associated with that step. One stage may encompass multiple activities, repeats or approved skips under explicit governing policy.
- **FG bulk stage**: mandatory transition for **every batch** before consumption by packaging. Link signed stage execution and the true positive batch FG bulk receipt/quantity. Historical source-backed repairs are explicit and approved, never constructed automatically from packing count.
- **Packaging**: `event_skus.sku_id` determines pack size and applicable UOM conversion. Calculate needed bulk against batch available amount; pack-stage execution and stock deduction must be idempotently linked to actual source event.
- **Excess**: when necessary and independently permitted, measured genuine extra batch bulk is entered by an authorized user in a compact **in-page modal** at packing time. Server independently authorizes, records source evidence/reason/actor and inserts excess receipt, packaging event and depletion **atomically**. A signed excess entry is an adjustment, not a substitute for FG bulk stage or proof of new manufactured production.
- **Physical location**: supplementary activity and stock movement metadata, retained for future store/plant inventory reporting. It is **not a prerequisite** to stage/quantity completion, MIS valuation, the G7 critical path, or the authorization of otherwise valid batch-level packing. Preserve explicit existing transfer source/destination, and do not erase or invent legacy location.

## Mandatory business invariants

1. Every production batch must pass its required product-route activity/stage checks and the mandatory FG bulk stage **before** packaging. The system cannot infer signing from DWL `Done`, BMR lifecycle or route-master approval alone; it needs a governed execution receipt or accepted historical documentary evidence.
2. Available batch bulk in compatible base UOM = genuine positive FG bulk receipts + authorized measured excess and legitimate corrections + internal transfers' net effect, minus linked packaging depletion and legitimate force-close/auto-zero (signed policy applies). All sums are within **one product+batch+base UOM**, never across products or pack UOMs.
3. Product+batch-level serialization across **ALL** stock writers, including DWL receipt/correction, event SKU consume, force-close, auto-zero, transfer in/out, C3 replay, and signed excess. A protected stock mutation boundary must eliminate or govern direct authenticated ledger DML. The existing negative-stock SUM check alone is not race-safe.
4. Packing that consumes more than available batch bulk must fail unless the actor is allowed to **measure and record real additional bulk**, with that insertion and packaging consuming transaction committed together. No signed bulk stage remains a hard stop even if excess is requested.
5. Historical 29 SKU lines that never got a stock depletion due to legacy silent skip remain **genuine batch accounting exceptions**. Repair only after independent FG batch source evidence and idempotent, approved source replay. The 144 November ledger movements without location fields **are NOT automatically stock quantity errors and do not block G7**.
6. Stage completion, bulk receipt, packaging, Tally FG transfer, book value, approved manufacturing COP reference and sales each have distinct claims. Do not label `completed production` or `snapshot certified` until relevant proof and signed status are established.
7. Historical report versions remain immutable. Corrected source/rate values create a new signed MIS revision with explicit provenance, never silent rewriting.

## Source checks (READ ONLY)

Live `costing.production_route_family_route_step` has `step_key`, `sequence_no`, `activity_id`, `behaviour_code`, `is_mandatory`, `allows_repeat`, `allows_skip_with_approval` and other per-route configuration; `costing.product_process_route` has product, route version, status, effective dates and approval. For the sample 2026-11-01 to 2026-11-21, `daily_work_log.activity='FG bulk storage'` has **80 entries** (61 Done and 19 In Storage), each with positive `storage_qty` in inspected cohort. Neither status proves route-stage signed execution.

Distinct mandatory step keys actually encountered in approved route-master inspection include `OIL_FG_BULK_HOLD`, `PILLS_FG_BULK_STORAGE_BOUNDARY`, `TABLET_CAPSULE_FG_BULK_STORAGE_BOUNDARY`, `OIL_FILLING_LINE_SIDE_FG_BULK_STORAGE`, `FG_TRANSFER_BOUNDARY_GENERAL` and `FG_TRANSFER`; these are **not interchangeable**. Do not hard-code a brittle stage-key LIKE '%FG%' classifier. A governed mapping must specify exactly which versioned step(s) demonstrate the universal FG bulk requirement, with independent event evidence per batch.

## Revised implementation gates

**S0 (this contract):** mark location-related G7 gates as NON-BLOCKING, preserve old investigation purely as optional provenance evidence. Canonical workflow and server review packet updated.

**S1 server source/route mapping:** determine effective product route at actual batch production date and explicit required FG bulk step(s); document route families without FG bulk boundary for owner-approved future normalization. Map BMR/product/batch and work-log activity to stage execution only with authoritative evidence and auditable mapping.

**S2 production stage execution receipt:** build a protected per-batch route-step execution model keyed to (product,batch,route version,step,occurrence), signed actor/evidence/revision. Support repeated activities and exceptions. The C1 signed FG stage uses this same consistent execution model, not a separate location-governed signoff invention.

**S3 shared stock writer:** design a guarded single product/batch lock for all legitimate sources; preserve existing location fields as optional. No forced location-attribution repair. Distinguish controlled batch-wide stock balance from optional warehouse/location reporting.

**S4 atomic C2 pack + measured excess:** server-side permission and exact SKU/base UOM conversion; C1 proof; batch balance; atomic signed excess then actual packaging; idempotent retry and race-safe enforcement. Claude Code client bulk package follows server API acceptance.

**S5 historical C3:** separately approved source-backed import/backfill of missing FG receipts and 29 missing ledger consumption lines, no blind count-to-manufacture conversion.

**S6 acceptance:** real isolated Postgres trigger/function compilation, authenticated role tests, multi-session races, stage sequencing, historical parity and S3 immutable-report proofs. No paid branch required. Owner must separately approve any production DDL/DML/merge/release.

**Gate:** G7 remains OPEN (6/11, ~55%). G8 parked. PR #485 docs and #517 offline draft remain unmerged; nothing in production was mutated. The route-stage and batch-accounting model is authoritative over earlier location-centered recommendations.
