# MIS-G7 — Frozen plan, cost provenance, event adapter and security design

**20 November 2026 | DESIGN-ONLY | Not a migration | No SQL installation authorized**

## Business interpretation

The dashboard should be able to answer, months later, *"What did we intend to make, what actually entered bulk storage, what was formally completed and how much went to Finished Goods?"* without past numbers shifting when forecasts, stock or work-log entries change. Each is separately dated and described. It must never substitute an unapproved costing run or turn unavailable cost into zero.

The proposed solution is a **sealed management reporting snapshot** with traceable lineage and an independent source-event adapter. It is not a replacement for Costing Suite costing governance or the upcoming product-route work-log system.

## 1. Three independent cutoffs

1. **Plan as-of:** choose and seal the month plan at a governed decision instant, with each product's quantity in its product base unit. Preserve a plan input fingerprint and source run list, including forecast version, overrides, current stock/WIP, batch-sizing and product conversion. A forecast-run ID alone cannot reproduce the derived plan.
2. **Reference cost vintage:** retain the *authoritative approved* costing run ID, valuation date, product-base rate and each component's source/approved policy. October approved 143 is the verified candidate; November draft 152 is not permitted. Do not automatically switch to a newer draft or rewrite the historical frozen rate.
3. **Actual-events as-of:** reporting period [month_start, next_month_start), observed as-of/cutoff, and source-event revision watermark. Receipts are dated by actual FG bulk-storage movement; formal completion needs canonical batch lifecycle evidence. FG Tally book values use the same requested cutoff but maintain separate valuation provenance.

**Data fields recommended**:
- Header: `snapshot_id`, `report_month`, `plan_as_of`, `event_as_of`, `approved_cost_run_id`, `cost_valuation_date`, `source_data_watermarks`, `input_digest`, `policy_version`, `sealed_at`, `sealed_by`, `snapshot_status` (`DRAFT|SEALED|SUPERSEDED`), `supersedes_snapshot_id`, `exception_summary`.
- Product line: `snapshot_id`, `product_id`, `base_uom`, `planned_qty_base`, `approved_bulk_rate` or NULL, `component_scope_status`, `plan_line_fingerprint`, `value_coverage_status`.
- Actual normalized event: `source_system`, `source_pk`, `source_version`, `product_id`, `batch_identity`, optional `route_id`/`route_step_id`, `event_kind`, `movement_date`, `logged_at`, `qty_base`, `base_uom`, `supersedes_event`, `reversal_reference`, `batch_completion_reference`, `event_status`.

**Governance:** Only a privileged, explicitly authorized snapshot process may seal; published sealed rows are append-only. Corrections generate a new superseding snapshot, never overwrite approved history. A downstream cash/cost retention policy must **not delete the only evidence underpinning frozen MIS figures**; preserve enough approved rate components, source identifiers, digests, coverage and revision lineage for independently reproducible historical reports. Design coordinated retention with the Costing programme; **no retention modifications in this workstream**.

## 2. Cutoff and comparison policy

- Report month and as-of must be explicit. Bound latest read to the earlier of requested cutoff+1 day or next month. Never label future records as within the cutoff.
- **Current live plan** may appear as a separate `LIVE_INDICATIVE` mode for operational observation. It is never equivalent to the frozen agreed production target.
- A frozen complete plan + complete accepted bulk-stage reference-cost scope + independently verified completed quantity are prerequisites for any `plan_achievement_pct`. Otherwise `NULL / NOT_COMPARABLE`.
- Receipt value can be a **covered subtotal**, but must display `value_covered_event_count`, `unvalued_event_count`, `unvalued_units_by_uom`, source cutoff and `INCOMPLETE`. Never use it as a total when missing rates exist.
- Tally book transfer value is its own accounting basis with matched/unmatched/valuation exception counts. Display no automatic comparison of the 2 different cost bases.

## 3. Legacy and future product-route logs

**Legacy adapter:** only (source_table='daily_work_log', reason_code='FG bulk storage', positive qty_base) adds physical FG bulk *received* quantity. Source identity = immutable FG bulk ledger ID plus source work-log reference. Internal transfers, SKU bottling, manually forced close, epsilon adjustments and source-row edits must not silently become new production. Receipt recorded on event movement date; `completed_on` from the mutable work log cannot independently prove an immutable batch-completed event. If status changes later, preserve the as-of historical state.

**Future adapter:** the product-route logger supplies separate route step, batch and stage completion event IDs and explicit corrections. The MIS layer consumes these canonical events, not its operational UI tables. During migration, enforce source-priority/cutover windows to prevent a legacy receipt and route event both contributing for the same real-world occurrence. Test source reconciliation before switching.

**Important:** The November read-only evidence had 79 November physical bulk receipt entries (74 Kg, four L, one Nos matching product units), but a bulk receipt is not necessarily formal completion. 18 distinct batch IDs have two positive receipts. Never count two 'Done' rows as two batch completions.

## 4. Materials-stores decision

The approved Oct run 143 has **627/627 SKU rows with a positive SKU materials-stores overhead charge**, which varies by package even within a product. The sparse internal-source materials-stores source-product snapshot is a **different** table and does not justify either including or excluding the universal SKU charge in bulk.

**No accepted product-level allocation exists for this component in G7.** Until a bounded costing owner policy or authoritative product bulk-stage rate is established:
- keep provisional RM + manufacturing-only labour + production route overhead + QC + eligible internal conversion **labelled partial component reference estimate**, not full manufacturing cost;
- `other_bulk_stage_cost_per_base=NULL`, `cost_scope_status='PENDING_STORES_ALLOCATION'`, with separate coverage, never silently `0`;
- do not use the multi-SKU mean, minimum or any chosen SKU's stores cost to fabricate a bulk rate;
- do not change Costing Suite allocation policies or its history to resolve an MIS display issue.

This is an explicit remaining **accounting acceptance barrier**, not a reason to block safe offline contract refinement.

## 5. Authorization and private read model

The costing snapshot tables are not available for direct `authenticated` SELECT, and must stay private. The proposed safest read architecture:

1. Privileged *internal* reconciler, governed by approved scheduled/snapshot procedure, computes a minimal MIS management summary and frozen per-product components in a non-exposed `mis_private` schema with documented job permissions.
2. User-facing `public.get_mis_production_value_summary_v1` is a narrow **read-only, server-authorized** function. Reject no-session/anonymous and users without `public.app_has_permission('executive-mis-dashboard','view')`. Only expose totals, count/coverage exceptions, dates and provenance; no salary, private costing line detail, batch identities or personal data.
3. Prefer `SECURITY INVOKER` over limited, RLS-protected read-model tables where feasible. If a narrowly scoped definer gateway is necessary, fix `search_path`, schema-qualify every access, avoid dynamic SQL, revoke default PUBLIC/anon EXECUTE and then explicitly grant to authenticated; independent privilege review and negative-access tests mandatory.
4. Do not grant `authenticated` any SELECT on source `costing` tables for G7, nor modify current source policies, cron, service worker, installer or Costing release.

**Not proven:** canonical MIS permission target across roles, user-specific negative/positive execution in live sessions, throughput/EXPLAIN on a proposed physical shape. Design is NOT SERVER ACCEPTED.

## 6. Release decision ladder

- **Now authorized:** source discovery SELECTs, design documents, deterministic synthetic tests, isolated SQL draft refinement.
- **Not authorized:** production SQL (including creating private tables or permission functions), schedules/jobs, migration execution, merge/PR promotion, deployments, client adoption or Costing Suite release changes.
- **Next after offline design:** independent SQL syntax/security/performance review, owner accepts specific cost scope and snapshot lifecycle, then fresh explicit SQL application authorization. Client Claude bulk implementation only against a SERVER ACCEPTED stable response signature.

**G7 status:** OPEN / DESIGN-ONLY. G8 parked. G9/G10 remain future. G0–G5 owner-reported PASS (6/11); G6 methodology conditionally approved but not an extra closed gate.


## 7. Accelerated RM/PM materials-stores attribution

**Owner direction (20 Nov):** Manufacturing-support materials-stores overhead should count toward production. Independent G7 read-only source inspection established that the existing `MATERIALS_STORES_STANDARD_RM_PM_V1` policy explicitly derives each SKU's unified stores workload from **both RM and PM**; charging the entire SKU stores overhead to bulk would capture packaging workload. The appropriate interpretation is **RM-related workload share included at bulk stage; PM-related share stays with packaging**. No Costing Suite policy change authorized.

**Exact approved-run 143 evidence:**
- `costing.sku_materials_stores_workload_snapshot` contains `rm_workload_units`, `pm_workload_units`, `unified_workload_units`, `monthly_sku_base_qty`. All **627** rows have nonnull nonnegative components and positive unified workloads; **627/627** satisfy `RM + PM = unified`.
- `costing.sku_materials_stores_allocation_snapshot` has 627 READY allocations across 453 products; total **₹2,60,508.25**, decomposing into **RM ₹2,713.94** and **PM ₹2,57,794.31**, residual **₹0.00** at reported precision. These are **approved model allocations for October** (not actual November incurred expenditure). All 453 products have valid positive base drivers.
- Per product, recombine allocation amounts at SKU level by the **existing workload mix**: `RM handling allocation = SUM(sku_allocation_amount * rm_workload_units/unified_workload_units)`; `PM handling allocation = SUM(sku_allocation_amount * pm_workload_units/unified_workload_units)`. Then `RM handling cost per product base UOM = RM handling allocation / SUM(monthly_sku_base_qty)`. Never average per-SKU rates and never add the whole RM+PM SKU stores cost.
- All **100** planned November products have the approved model's stores coverage. The RM share is small relative to the PM share under the governing model; this is a **model result, not evidence that actual RM-store effort is negligible**. The workforce driver is an ideal-case standard RM/PM model, not actual-issue data.
- Five internal source products show a difference between the stores SKU base volume and the separate manufacturing labour model's monthly product base quantity. **Do not interchange denominators.** Keep the approved stores workload's own `monthly_sku_base_qty`, and flag exceptions if the model version changes.
- Example product reference rates (RM stores per base): Murivenna ₹0.034671/Kg, Jumbolene Capsule ₹0.000064/Nos, Thippili Rasayanam ₹0.008753/Kg. Do not use these examples as current approved November prices.

**SQL design updated** in `MIS_G7_READONLY_SQL_DESIGN.sql` to include only the RM allocation split in the bulk component reference rate, with source model status/driver guards. PM handling remains explicitly outside bulk. The implementation remains a **review-only unexecuted SELECT** and must not be exposed directly to authenticated clients.

**Decision boundary:** This resolves the prior ambiguity at the **design-method level** under the owner's direction, pending acceptance of the RM/PM attribution semantics and official server reconciliation. Do not mark G7 SERVER ACCEPTED, close cost-scope review without independent proof, run production SQL, merge, deploy or modify Costing Suite policy.
