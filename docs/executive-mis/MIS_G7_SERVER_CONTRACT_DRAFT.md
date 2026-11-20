# MIS-G7 — Server value contract (DRAFT, design and offline validation only)

**Gate:** G7 OPEN — DESIGN ONLY; owner approved G6 method, **not** production SQL, merge, deployment or release.  
**Established:** 20 November 2026 IST.  
**Authority:** `docs/executive-mis/EXECUTIVE_MIS_WORKFLOW.md`; reference approved Costing October run **143**, valuation **2026-10-22**. November run **152 is draft**, never an approved fallback.  
**Status:** NOT INSTALLED / NOT SERVER ACCEPTED / NO CLIENT CONTRACT AUTHORIZED.

## 1. Business contract in plain English

The dashboard reports independently:
- **Planned bulk value (reference estimate):** product planned quantity in its actual bulk base UOM × approved product-specific *bulk-stage* manufacturing cost for that UOM. Plan must have a complete version/as-of snapshot, or be clearly labelled **LIVE INDICATIVE** (never an approved baseline).
- **FG bulk received value (physical receipts):** eligible positive bulk-storage movement events × the same approved product reference bulk-stage rate. This is **not** formal batch completion.
- **Bulk formally completed value:** unique canonical batch-completion events with reconciled completed quantity; **NULL / NOT VERIFIED** until receipt/completion lifecycle and historical timing have passed independent parity. Never simply sum distinct `daily_work_log.status='Done'` rows as completions.
- **FG transferred value:** existing reconciled Tally **book transfer** amount, a separate accounting basis. Never call it comparable manufacturing-COP output or manufacture a cross-basis achievement percentage.

No physically meaningful mixed-UOM sum may be shown. Missing approved cost, mismatched UOM, unproved date, source corrections and missing plan version must be visible as **unvalued, unverified or not comparable**, never zero.

## 2. Draft server shape — not executable migration

Keep private cost/plan/event extraction out of browser. Use an **MIS-owned, versioned reporting adapter** that can be re-pointed from the legacy daily-work-log/FG-bulk ledger to the planned route-step event log.

**Proposed normalized inputs** (schema design only):
- `mis_private.cost_rate_v1`: `product_id, product_base_uom, approved_cost_run_id, approved_valuation_date, cost_component_policy_version, rm_per_base, manufacturing_labour_per_base, production_overhead_per_base, qc_per_base, internal_conversion_per_base, eligible_other_bulk_cost_per_base, bulk_reference_rate_per_base, cost_scope_status, exception_reason`. One unique record per product/run/policy, **never per SKU**. `eligible_other_bulk_cost_per_base` is **NULL unless** materials-stores and other stage scope has been proven and approved; do not treat unknown as zero.
- `mis_private.plan_snapshot_v1`: `snapshot_id, report_month, as_of_at, source_forecast_run_ids, source_override_fingerprint, stock_wip_as_of, product_id, product_base_uom, planned_qty_base, snapshot_status`. Uniqueness on snapshot/product. A historical frozen snapshot is immutable. Live plan, if offered, is a distinct state without approved comparable achievement.
- `mis_private.production_event_v1`: `source_system, source_event_id, source_version, product_id, batch_identity, route_id nullable, route_step_id nullable, event_kind, effective_on, recorded_at, qty_base, product_base_uom, lifecycle_state, reversal_of nullable, lineage_ref`. Unique immutable source identity; reversals/supersession are explicit. `FG_BULK_RECEIPT`, `BATCH_COMPLETED`, `FG_BULK_TRANSFER` are distinct event kinds; only the first increments receipt-based physical output.
- `mis_private.transfer_book_v1`: `transfer_event_id, transfer_date, book_value, tally_value, reconcile_status, exception_status, source_as_of`, preserving accounting provenance and missing-log exceptions.

**Proposed public read API** (names and signatures provisional):
`public.get_mis_production_value_summary_v1(p_report_month date DEFAULT NULL, p_plan_snapshot_id bigint DEFAULT NULL) RETURNS TABLE (...)`
One summary row, `report_month`, `plan_snapshot_id`, `plan_as_of_at`, `plan_status`, `approved_cost_run_id`, `approved_cost_valuation_date`, `actual_event_cutoff`, `planned_reference_value`, `received_reference_value`, `completed_reference_value` (nullable), `tally_fg_transfer_book_value`, `planned_products_total/valued/unvalued`, `receipt_events_total/valued/unvalued`, `receipt_products_total/valued/unvalued`, `completed_event_status`, `plan_achievement_pct` (nullable), `basis_comparable`, `rate_policy_status`, `data_quality_status`, `source_notes`.

Policy:
- **No approved reference cost run:** fail closed, value NULL and status `NO_APPROVED_COST`. Do not substitute November draft 152.
- **Unvalued receipt:** retain physical UOM/quantity as diagnostic; monetary covered-subtotal may be reported as `received_reference_covered_value`, with completeness flag `PARTIAL`, never as complete total.
- **Achievement percentage:** produce only if frozen plan, verified formal completion, same approved reference cost vintage/scope, and complete eligible coverage. Otherwise NULL and reason `NOT_COMPARABLE`.
- **Plan snapshot:** default must be explicitly governed (not arbitrary latest plan mutation); old snapshots not silently rewritten.
- **Cost runs:** explicit declared reference run and provenance from authoritative costing period-run governance; never accept arbitrary user-selected cost-run ID in client-facing RPC.
- **Joint-process:** respect approved effective joint policy from the costing run, including 183/184 Ksheerabala allocations; do not derive a second co-product receipt or reallocate shared cost in MIS.

## 3. Cost decomposition and acceptance identity

Approved run **143** reconciles **627/627** SKU manufactured COP records exactly:
`SKU COP = RM + PM + manufacturing direct labour + packing direct labour + production overhead + QC overhead + materials-stores overhead + applicable internal conversion`.
Proved with live read-only aggregate queries: 627/627 exact including conversion; 7 fail if conversion is omitted. Manufacturing labour/packing labour split and product-base manufacturing labour parity: 627/627 pass; production overhead SKU/base parity: 627/627 pass. RM base, overhead base and QC base are consistent across approved multi-SKU product variants.

**Draft bulk-stage rate**:
`product RM cost/base + product manufacturing-only direct labour/base + product route production overhead/base + product QC/base + applicable product internal conversion/base + any separately verified other *bulk-stage* cost/base`.

**Not yet established:** Whether any specific materials-stores overhead belongs to bulk vs downstream handling; direct beneficiary mapping from `product_internal_source_materials_stores_allocation_snapshot` (five source products, not a general product-level addend). Do NOT blindly insert SKU `materials_stores_overhead_cost_per_sku` into bulk rates. Cross-check potential other overhead categories before the final migration.

**Numerical dry-runs only** on mutable data (2026-11-20 IST):
- 100 current positive planned products; provisional **₹64,04,326.16**, not an approved, reproducible plan KPI.
- 79 November FG bulk-storage receipts / 52 products; 77 receipts / 50 products covered by Oct approved rate, provisional **₹32,04,140.56** *covered receipt subtotal*. Two missing-rate receipts: Kayyonyadi Enna 30 Kg and Anulomana Sookshma Choornam 3.4 Kg. Must not present as complete produced value or as a comparable percentage.
- 58 source work-log rows `Done` / 21 `In Storage`; repeat receipts across 18 batch keys. A repeat receipt is not necessarily a repeated completion.

## 4. Database security — design rules / unsatisfied acceptance

Existing source `costing.*` snapshot tables **deny authenticated SELECT**; do NOT grant direct read as a shortcut. Existing MIS read RPCs are **SECURITY INVOKER** and executable by authenticated, not anon. The effective module permission target is `executive-mis-dashboard` in the client; confirm canonical server target grants before installation.

**Preferred implementation:** private internal reporting tables or materialized outputs, populated only under a vetted privileged job; expose a narrow aggregation RPC, with runtime `auth.uid()` and `public.app_has_permission('executive-mis-dashboard','view')` checks **before** returning any data, deny anonymous/no-view. Where a controlled `SECURITY DEFINER` read API is unavoidable to access private tables, require a trusted owner, fixed safe `search_path`, schema-qualified references, no dynamic SQL, explicit `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon` then `GRANT EXECUTE ... TO authenticated` with transactional installation, and negative-access tests. Alternative invoker path is acceptable only if the private read model has safe RLS and minimal grants; do not use invoker against ungranted `costing` tables and assume it will work.

No raw staff/personnel, salary, customer, BOM details or row-level confidential costing data returned. Avoid arbitrary batch/SKU IDs as security-authority bypass. Existing upstream grants and policies should not be changed to accommodate this MIS.

## 5. Performance, validation and release gates

Stage A — **offline**: mock contract tests for missing approved rates, UOM mismatches, repeated receipts, ledger cutoffs, in-storage versus completed, source reversals, plan/version fallback, joint-process and denied access; no production SQL. These fixtures do not establish production SQL execution or authenticated permission acceptance.

Stage B — **proposed SQL review, still no installation**: write a separate bounded SQL draft with exact object names/types and calculation lineage; get independent owner authorization **before** applying any SQL. Use `EXPLAIN` only as separately permitted read-only evidence, estimate data costs/refresh cadence and avoid heavyweight live scans; enforce bounded report-month parameters.

Stage C — **authorized installation only after fresh owner approval**: explicit migration + grants, rollback plan; smoke with privileged/read-only/no-access authenticated roles, 1:1 event keys, 627/627 accounting identity preserved, permission negatives, parity and source cutoff; record SERVER ACCEPTED signature.

Stage D — **client after SERVER ACCEPTED**: one Claude bulk package on its own draft PR using stable API, ERP token styling, mobile responsive tests; independently review and merge only by owner authority. Client PR #486 is separately draft, not merge-approved. Alerts G8 parked.

**Hold points:** source-to-beneficiary materials-stores classification; actual completion lifecycle; frozen plan design; source route migration adapter; the baseline permission enforcement test; independent EXPLAIN and parity. **No G7 SQL installed, no PR merged, no Costing Suite release file touched.**
