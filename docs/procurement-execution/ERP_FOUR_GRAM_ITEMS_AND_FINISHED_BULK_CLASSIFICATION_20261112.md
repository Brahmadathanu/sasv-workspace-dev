# PEC / Master Data — Four gram-standard materials and finished-bulk classification
**Read-only verification on 2026-11-12 · Owner-confirmed UOM policy · Source-control correction manifest, NOT an executed mutation.** Tracking #284/#305.

## Owner authoritative decision

Tally and SASV operational UOM **must be grams** for:
- Ampar, `inv_stock_item.id=64`;
- Gomatha Javvadu, `id=291`;
- Kasthoori, `id=424`;
- Kumkumapoo, `id=517`.

Do not blindly rewrite quantity figures when changing a UOM: preserve physical magnitude (1 Kg → 1,000 g). Protect historical approved PRs and indents and recorded financial/purchase facts.

## Live verification

All four `inv_stock_item.default_uom_id` currently resolve to **g**, and raw Tally RM/PM issue `material_uom` for their 12-month issues is `Gm.`. Live `v_stock_current_by_item` numerical quantities: Ampar 63, Javvadu 160, Kasthoori 148, Kumkumapoo 865; underlying stock snapshot view does not expose its own UOM, so do not rescale snapshot numerics without verifying underlying Tally unit convention. Stock master and Tally issue evidence already support g.

Gomatha Javvadu **previous-day governed correction is visibly present in the base tables**:
- `rm_bom_line.id=5802`, BOM #2297: **24 g**;
- `inv_stock_item_moq_policy`: active **100 g**;
- `proc_indent_line.indent_line_id=136` under approved indent #84: **1,000 g**.
- **Propagation gap:** `mrp_rm_plan_detail` for future Dec 2026 and Jan 2027 still shows **0.0266666667 Kg per month**, where corrected BOM is 24 g/reference-output. This appears stale relative to the corrected BOM; do **not** overwrite materialised MRP detail directly. Identify the source MRP plan runs and schedule a governed, verified refresh/rebuild with before/after snapshots; preserve already approved indents. A 24g BOM with parent multiplier 1.111111... implies 26.6667 g per month, physically matching 0.0266667 Kg, so numerical quantity is equivalent yet metadata/unit are stale.

## Executed SELECT-only current-BOM inventory

`docs/procurement-execution/ERP_GOVERNED_G_UOM_BOM_LINE_READBACK_20261112.sql` (commit `32e3e8d`) returned **21 BOM lines** touching the four items:
- **13 Kg-valued lines need unit-normalized, value-preserving transformations:** Ampar 1, Kasthoori 1, Kumkumapoo 11.
- **8 lines already g:** Gomatha Javvadu 1, Kasthoori 7.
- Example proposals: Ampar BOM line #5394: 0.010 Kg → **10 g**; Kasthoori #9717: 0.075 Kg → **75 g**; Kumkumapoo #3769: 0.050 Kg → **50 g**. All 13 exact proposed transformations are in the read-only query. These are **proposed dimensional conversions, not owner-validated formulation quantities**, and BOM revision approval/versioning must be respected.
- Existing approved indent #84 Javvadu 1000 g, Kasthoori 0.100 g, Kumkumapoo 1.000 g; indent #118 Kasthoori 0.100 g. Their historical quantities should not be rewritten merely to unify a future planning basis. Other PR/MRP snapshots, cost sheets, re-order rates and quote rate UOM must be inspected as downstream consumers before finalizing.

## Finished-bulk classification resolves nine misleading comparisons

All **nine** other previously flagged UOM mismatches are **RM category with `v_inv_stock_item_with_class.subcategory_code='finished_bulk_material'`**:
- eight soft-gel capsule materials #1068, #1070, #1073, #1075, #1121, #1150, #1179, #1204 (master default Kg, MRP Nos);
- Rheumorid Balm 5 g #1167 (master default Nos, MRP Kg).

This is not evidence that their master default values are wrong. They have different production-stage/item form semantics: examine **finished bulk vs semi-finished production and internal transfer** before deciding whether they belong in **external procurement PR at all**. Do not issue a blind Nos↔Kg conversion. Keep separate from four verified gram-standard **ordinary RM** corrections. `Bulk Stock - Vatharakshasan Gulikai` #165 is also classified `finished_bulk_material`, providing a plausible explanation of its Nos issue / Kg default mismatch found during S4 exploratory screening. Revisit S4 eligibility to exclude or separately govern this classification rather than credit it as ordinary external RM consumption.

## Important upstream MRP integrity issue

`v_mrp_material_month_grid` joins `v_mrp_opening_stock_snapshot` by stock item/material kind **without UOM**, then `v_mrp_procurement_plan` compares this opening number to UOM-specific gross requirements. Kasthoori already has **both g and Kg demand streams**, so stock could be credited twice or in incompatible units. The four-item BOM correction should be coupled with unit-aligned stock netting and regression tests; don't fix defaults (already g) and claim solved.

## Controlled execution order — production writes still gated

1. Pin snapshots/fingerprints of 13 BOM lines, all four stock defaults, MOQ, current indent/PR lines, MRP detail, approved costing dependencies and source stock-unit provenance. Check BOM revision governance and any pending stock/cost refreshes (including Gomatha correction).
2. Generate **guarded BOM revision/correction package** for exactly 13 Kg→g line conversions preserving magnitude; do not mutate unrelated BOM quantities or 8 already-g lines. Existing historical approved BOMs must follow system's governed correction/revision mechanism.
3. Fix/verify common MRP stock-vs-gross UOM netting so opening stock is applied once in consistent units; test direct/reciprocal conversion and mixed-UOM Kasthoori; don't alter physical inventory values.
4. Trigger a governed refresh of materialized MRP plan detail after BOM effective state is confirmed, validate Gomatha 26.6667 g/month and four item UOM outputs; evaluate resultant candidate PR quantities but do **not** automatically rewrite approved indents.
5. Preserve the nine finished-bulk classifications; review hybrid model's category/subcategory filter and procurement-eligibility policy as a separate gate.
6. Final owner approval for each live migration, MRP refresh and user-facing deployment remains required.

**Status:** classification and exact live BOM discrepancies confirmed, proposed conversions enumerated, Gomatha corrected base tables verified with stale MRP detail. No live mutation, PR generation, snapshot refresh, or merge in this work item. PEC G0 active, 0/6 formal gates verified.
