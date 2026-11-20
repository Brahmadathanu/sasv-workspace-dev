# PEC / MRP — Thirteen UOM anomalies: root cause and governed correction plan
**Date:** 2026-11-12 IST. **Source:** live PostgreSQL SELECT-only view/source inspection. **Scope:** material-specific UOM integrity; not yet an approved data/DDL change. Related PEC S4 #305 and programme #284.

## Confirmed upstream chain (not PR/indent conversion)
`mrp_rm_plan_detail.required_uom_id` → `v_mrp_rm_procurement_pre_net_baseline` grouped by item, month and required UOM → `v_mrp_rm_procurement_pre_net_baseline_purchase_form` (RM form conversion by stock-item/factor; retains required UOM) → `v_mrp_rm_procurement_pre_net_purchase_form` → `v_mrp_material_gross_requirement_rm` → `v_mrp_material_month_grid` → `v_mrp_procurement_plan` → `create_pr_from_mrp_plan_pec_internal` → `proc_indent_create_from_pr_pec_internal`.

`v_mrp_opening_stock_snapshot` passes `v_stock_current_by_item.qty_value` **without a UOM dimension**. `v_mrp_material_month_grid` joins that quantity to `(material_kind,stock_item_id)` *without UOM* and `v_mrp_procurement_plan` subtracts it directly from `gross_required_qty` by `(material_kind,item,uom)`. This is a **structural unit-alignment risk** whenever the stock snapshot unit differs from the MRP need unit. If one stock item has demand in multiple UOM, opening stock can also be repeated across separate demand streams. Changing `inv_stock_item.default_uom_id` alone **cannot correct this**.

## Four mass-unit anomalies — stock/source master g, MRP Kg

| Item ID | Material | Default UOM | Source RM issues | Current stock-view numeric | Three-month MRP gross in Kg | MRP procurement |
|---:|---|---|---|---:|---:|---:|
|64|Ampar|g|Gm.|63|0.0051020408163|0|
|291|Gomatha Javvadu|g|Gm.|160|0.0533333333333|0|
|424|Kasthoori|g|Gm.|148|0.0212121212121 **plus** 0.0063085090331 in g in raw MRP detail|0|
|517|Kumkumapoo|g|Gm.|865|1.2903158131228|0|

The four Tally source issue UOMs and master defaults are g; the stock view itself has **no UOM column**, so infer-but-verify raw stock source's native unit before modifying records. If those current stock numerics are g, stock must be converted to Kg only when compared with Kg demand (e.g. Kumkumapoo 865 g→0.865 Kg); zero PR for Kumkumapoo may conceal deficit. **Do not promote illustration to actual approved PR quantity** until BOM and stock date/units reconciled.

**Additional defect candidate:** Kasthoori `mrp_rm_plan_detail` contains both g and Kg lines for the same item in the same planning horizon; each unit stream may inherit the same opening stock. Need normalize demands into one canonical procurement UOM *before* stock netting and MOQ.

`inv_uom_conversion` has directed Kg→g factor 1000 but no direct g→Kg row. A reciprocal conversion can be designed with validated positive same-dimension factor, or an explicit governed reverse conversion row; no unreviewed master update. Avoid confusing this with `inv_rm_form_conversion` (different stock-item forms).

## Nine cross-dimension default/MRP differences

Eight items default Kg / MRP Nos: #1068 Ksheerabala Thailam 101 Avarthi SG Cap (gross 0), #1070 Gandharvahasthadi Erandam SG Cap (30 Nos), #1073 Thanurekshakan SG Cap (24), #1075 Erandasukumaram SG Cap (29), #1121 Nirgundyadi Erandam SG Cap (19), #1150 Chathilinga Thailam SG Cap (30), #1179 Vellaruku Thailam SG Cap (28), #1204 Mahanarayana Thailam SG Cap (30). One item default Nos / MRP Kg: #1167 Rheumorid Balm_5 g (gross 0).

The seven SG capsule items with positive MRP are **currently proposed as whole Nos**, but their master default is Kg; neither `inv_uom_conversion` nor item form conversion may safely map this cross-dimension difference without a product-specific conversion policy. Recommend inspection of item definition, Tally stock/issue aliases, BOM source requirement and actual purchase practice, then independently approve whether the **master default**, BOM UOM or item classification is wrong. Zero-gross items still require integrity correction, not a fabricated current buy quantity.

## Proposed corrective architecture (review before production)

1. Fix **common MRP stock-net alignment**: carry source UOM for opening-stock facts or resolve unit against governed stock-item + stock-source definition; convert and consolidate all same-item demand streams to a selected *purchase* UOM before subtracting stock **once**; fail closed if unit incompatible/missing/ambiguous. Preserve existing default UOM unless truly erroneous. Add regression tests for 865 g vs 1.2903158 Kg demand, mixed g/Kg Kasthoori, positive Nos vs Kg discrepancies, and unchanged same-UOM controls.
2. Review underlying BOM detail for 13 items and determine target procurement unit on traceable evidence. For 4 mass anomalies, verify source issue and stock units and confirm whether BOM expected Kg is right; for 9 cross-dimension anomalies, obtain master-data owner classification/recipe decision and a controlled correction with rollback.
3. Before changes to `mrp_rm_plan_detail`, `inv_stock_item`, BOM/policy, or any MRP SQL view, collect dependencies, impact on 3-month MRP, and historical PR/indent preservation. Existing active indents must never be silently rewritten.
4. Repair S4 UOM-aware consumption only **after** this base MRP discrepancy is governed. S4 must not copy an MRP unit bug and must not default missing MRP item procurement UOM automatically. No Tally purchase-order dependencies.
5. Apply guarded migration/test in isolated PG then owner-approved production update, verify before/after snapshots and permission checks.

## Owner authority and status
Owner explicitly requested that the discrepancies be corrected, authorizing **investigation and correction planning**; exact production changes are not supported yet because master unit truth, BOM semantics, UOM provenance and blast radius are unresolved. No live writes/DDL/merge/deploy occurred in this audit. PEC G0 remains active; 0/6 formal gates verified.
