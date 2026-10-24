# CI-037 — Google Sheets reconciliation spec (for ChatGPT, Sheets owner). SPEC ONLY — no Sheets edits made or authorised.

Workbook: SASV - PRICING & PROMOTIONAL VIABILITY. Owner policy (24 Oct 2026): contingency = 2% × post-discount, GST-exclusive selling price.

## 1. Change required (both regions)
| Tab | Current | Target |
|---|---|---|
| PROMOTIONAL VIABILITY - IK | Contingency = 2% × Basic Price (pre-discount) | Contingency = 2% × Basic Price × (1 − Discount%) |
| PROMOTIONAL VIABILITY - OK | same | same, OK basic and OK discount |
Keep everything else in the chain: Realization = Basic × (1 − Disc) × Paid/(Paid+Free) − Contingency − Regional Marketing; Profit = Realization − Internal Loaded Cost.
Contingency is applied before the scheme adjustment (not on scheme-adjusted revenue).

## 2. Expected effect
- Only discounted SKUs change (run 143: 23 SKUs, discounts 32/33/40%, same IK and OK). Zero-discount SKUs unchanged.
- Profit rises by 2% × Basic × Disc%. Examples (run 143, IK): Pramehakalpam Capsule 4 Nos +₹0.19; M3 Capsule 100 Nos +₹2.51; Karkkidaka Kanji 500 g +₹1.90 per pack.

## 3. Recommended-MRP (profit objective) formulas
Where a tab solves for the MRP that achieves a target profit/margin, the contingency term inside the solve must also use the post-discount basis:
MRP_req = (1+GST) × (ILC + Marketing + Target) / ((1 − Disc) × (Paid/(Paid+Free) − 0.02)).
(Previously effectively (1 − Disc) × Paid/Total − 0.02.) Recommended MRPs for discounted SKUs will fall slightly.

## 4. Marketing review tabs (4 regional tabs)
They read from the viability tabs; no formula change expected, but re-check any hard-coded contingency or copied values.

## 5. Reconciliation tests (before switching Sheets to the database feed)
1. For approved run 143 rows, Sheets (after change) vs database dry run (closure/prepared/CI-037_dryrun_run143.sql): selling price, contingency, realization, profit must match to ±₹0.01 for SKUs 45, 51, 878, 975, 1264, IK and OK.
2. Scheme case: with 5+1 on SKU 51 IK, realization ₹203.70, profit ₹71.75 (also equals live sku_scheme_viability_snapshot).
3. All 23 discounted SKUs: Sheets contingency = DB `ik_/ok_contingency_value`.
4. Proposed (scenario) MRPs/discounts/schemes stay scenario-only and are never written back to the approved feed.
5. MASTER DATA: legacy `*_margin_*_before_scheme` columns must be labelled "Legacy MRP-based cost difference — not profit" and not used as profit. After CI-037 goes live (future runs only), map the new `ik_/ok_estimated_profit_per_sku` and `*_profit_calculation_status` columns; show only rows with status CALCULATED / CALCULATED_UPSTREAM_REVIEW.
