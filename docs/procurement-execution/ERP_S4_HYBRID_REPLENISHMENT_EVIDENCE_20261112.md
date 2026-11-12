# PEC ERP S4 — Hybrid Replenishment: Live Evidence & Preview-Only Contract

**Investigation date:** 2026-11-12 IST. **Status:** G0 read-only research; G1 proposal only, no approved purchasing policy. Parent #284. Supabase project `qhmoqtxpeasamtlxaoak`.

## Critical result: production MRP is a recursive stock-netting model

Read-only definition of `public.v_mrp_procurement_plan` confirms monthly recursive logic:
1. `v_mrp_material_month_grid` enumerates BOM-derived material items and month buckets.
2. For each material/UOM, initial `opening_qty` comes from `v_mrp_opening_stock_snapshot`, itself derived from `v_stock_current_by_item` (source kinds `rm`, `plm`).
3. Gross production requirements are subject to integer ceiling for one UOM dimension; `net_need_qty = greatest(0,gross_required_qty_post_ceiling-opening_qty)`.
4. `procure_qty` rounds positive need to effective `inv_stock_item_moq_policy` MOQ; `closing_qty` carries into the next month. Both surplus from MOQ and stock carry are therefore ALREADY embedded.
5. `create_pr_from_mrp_plan_pec_internal` inserts PR lines grouped by item and UOM from `SUM(p.procure_qty)` across the chosen horizon. Do **not** add another gross stock-replenishment amount to this result. No PR was created or altered.

**Important limitation:** this MRP view does **not** visibly subtract future receipts/open indents or existing draft/active PR commitments inside its recursive calculation; it also does not include consumption-based safety-stock target. These must be reconciled explicitly, at the correct date and unit, in a new planning preview. An active PR is **not** automatically physical inbound stock. Deduplicate commitments across PR → indent lineage and avoid counting the same commitment twice.

## Observed item case: Label - Punarnavasavam 450 ML

`inv_stock_item.id = 1638`, source kind PLM, UOM Nos. Read-only inspections:

| Dimension | Live observed |
|---|---|
| Stock (`v_stock_current_by_item`) | 0 Nos |
| `v_mrp_procurement_plan` | 13 month rows; nonzero gross/need **1666 Nos** in March, May, July 2026, and **zero** in November and December 2026 |
| Current MRP November/December 2026 | 0 units each |
| Latest recorded consumption month | October 2026: 2837 Nos |
| Other recorded months, within Nov 2025–Oct 2026 | December 2025 5300, June 2026 3850, July 2026 600; zero rows not emitted |
| Published `v_proc_item_consumption_rate` | 3m: 2837; 6m: 2429; 12m: 3146.75; nonzero months within 12m: 4 |
| Correctly zero-filled fixed-window averages, through Oct 2026 | 3m: **945.667**, 6m: **1214.500**, 12m: **1048.917** Nos/month (12m total 12587) |
| Lead-time / MOQ for this item | No item-specific rows |
| `proc_indent_line` | 0 lines |
| `proc_pr_line` | 3 historical lines; active PR-2026-03 has `requested_qty 1666 + manual_delta_qty -1666 = 0`; other PR-2026-06/REV01 active has 0 |
 
**Interpretation:** this is NOT an item entirely excluded from MRP. It is present in MRP's packaging plan but its **current production demand is zero despite recent historical consumption**, so a *parallel non-MRP usage requirement* might still be relevant. This is a genuine overlap case and should be classified **MRP-COVERED / USAGE-GAP**, not treated as stock-only automatically.

### Consumption-average warning

`v_proc_item_consumption_rate` computes `avg(case when month_start_date >= ... then consumed_qty else null end)` on `v_item_consumption_monthly_by_item` rows. Missing zero-month rows do not enter the AVG. Consequently the visible 3/6/12-month averages may be **averages per recorded month rather than per calendar month**. The zero-filled 3/6/12-month figures above are based on an independently enumerated monthly calendar. The algorithm must explicitly choose between calendar time averages, episodic/event-driven consumption and recent trend; do not silently use the 2837 '3-month average' as a calendar-month rate.

## Preview-only plan policy (proposal, not yet owner-approved)

### Classification

Each `(stock_item_id, canonical_uom_id, planning_period)` becomes one unique plan key, with sources:
- `PRODUCTION_MRP`: directly in active MRP horizon.
- `NONPRODUCTION_USAGE`: consumption not already attributable to production (requires provenance; raw consumption table alone may include production consumption).
- `OPERATING_MINIMUM`: governed item safety/reorder target if one exists.
- `EXISTING_COMMITMENTS`: open PR/indent/PO lineages with state and attributable inbound dates.

**Do not** classify an item as 'outside MRP' simply because `procure_qty=0`; the item may already be represented in the MRP view. Use a separate `COVERAGE=MRP-COVERED` flag and reconcile the source of historical usage. `PLM` is the inbound alias of `PM`.

### Initial proposed calculation per item and horizon

- Derive `production_gross_need` and `production_planned_procure` from existing MRP, retaining its opening/carry/MOQ semantics.
- Derive `other_usage_forecast` **only from independently justified demand**, net of any overlap with BOM production plan. If provenance is missing, mark `REVIEW_REQUIRED` and propose **no automatic extra quantity**.
- Derive on-hand stock once from timestamped `v_stock_current_by_item`; reject stale/unknown stock freshness.
- Derive `firm_inbound` only from verified unreceived commitments with active status, ETA and trustworthy link mapping; do not count a PR and its linked indent as two supplies.
- Compute target coverage using approved `lead_time_days`, `review_period_days`, `safety_days` and eligible demand-rate basis. Missing policy must **not** default silently to arbitrary days.
- **Avoid naive addition:** a candidate generic incremental need is `max(0, forecast_total_demand + approved_safety_target - (on_hand + qualifying_firm_inbound + already_planned_MRP_replenishment))`, subject to timing, expected use of MRP stock and UOM conversion. Where MRP already nets on-hand and carries forward, use a *time-phased ledger* rather than double subtract opening stock or double add supply.
- Round the incremental quantity to MOQ **after** netting, preserving explicit packaging/unit rounding policy. Show pre/post rounding and reason.
- The output is **preview** with `PROPOSED_QTY`, explanatory source components, stock freshness, confidence classification, evidence IDs, excluded overlaps, duplicate-commitment references and blocking reasons. No automatic PR/indent creation, policy write or retroactive adjustments.

### Decision gates (to be resolved by owner after evidence)

**S4-D1:** Whether consumption not yet attributed to production can ever drive an additive requirement for an MRP-covered PM/RM (default: REVIEW, not automatic).

**S4-D2:** Approved replenishment rate model (e.g., zero-filled trailing calendar 3/6/12 months vs seasonal weighted forecasts), default safety/review periods, and treatment of zero/irregular months.

**S4-D3:** Authoritative source of open purchase commitments and receipt date/quantity; PR/indent/PO de-duplication semantics. Until proven, incoming quantities are unknown, not zero.

**S4-D4:** Stock-staleness threshold, UOM conversion/ceil rounding/MOQ ordering, and whether any FG category enters phase 1.

## Proposed acceptance matrix

1. For a BOM-covered PM with no separate usage evidence, preview incremental extra demand must be 0 or BLOCKED, never blindly positive.
2. Non-MRP stock-only consumable with verified demand and stock, approved lead/safety/MOQ: independent oracle validates target and order rounding.
3. Mixed MRP + separately attributable usage: once-only stock, once-only incoming, no duplicated BOM demand, explain difference between baseline and new preview.
4. PR → indent → receipt lineage counted once; PR with final qty zero contributes zero.
5. Zero/no-usage months, seasonal spike, stale stock snapshot, absent UOM conversion, inactive MOQ, missing lead time and no ETA all produce explicit states.
6. Regression: incumbent `v_mrp_procurement_plan` and `create_pr_from_mrp_plan` unchanged. Preview-only with view permission and signed-in role denial evidence.
7. Result consistency over 13 active month buckets, including March/May/July usage mismatch example; no hidden write.
8. No new PR until owner approves both formula/policy and live implementation gate.

**Gate status:** G0 active; 0/6 programme gates independently accepted. This document records read-only evidence and proposal only. 
