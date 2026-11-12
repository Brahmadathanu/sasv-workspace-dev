# PEC G0 — Live MRP UOM and Internal-Procurement Corrections: Acceptance Ledger
**Date:** 2026-11-12 IST. **DB:** SASV Supabase `qhmoqtxpeasamtlxaoak`. **Scope:** owner-requested correction only, *not* complete S4 hybrid rollout.

## Changes applied successfully to live database

**Earlier BOM:** 13 exactly guarded `rm_bom_line` transformations Kg→g (quantity ×1000) for Ampar #64, Kasthoori #424, Kumkumapoo #517; existing Gomatha Javvadu #291 24 g unchanged. Readback confirms **all 21 BOM lines across four items are g** and all four `inv_stock_item.default_uom_id=2 (g)`.

**Active MRP quantity view:** `v_mrp_material_gross_requirement_rm` now normalizes same-dimension raw-material demand into the item's default UOM using a new strict helper `mrp_uom_factor_strict(from_id,to_id)`. The helper verifies dimensions, valid positive direct factors or reciprocal factors; throws on absent/ambiguous conversions. Cross-dimension demand is retained in its original source UOM (e.g. internal SG capsule items planned in Nos while their default is Kg), **not** converted to Kg. Demand in several UOMs for the same item is aggregated after normalization, before MRP stock subtraction. The existing gross requirement view's columns are preserved. `v_mrp_material_month_grid` itself was **not changed**; current live preflight finds **0 plan keys with a UOM mismatch AND positive opening stock** after normalization, but future incompatible-stock cases must remain an acceptance guard.

**MRP future monthly rebuild function:** `mrp_rm_plan_rebuild_month_active` was patched to normalize detail quantities by governed conversion before summing into `mrp_rm_plan_monthly`. Cross-dimension internal-only requirements retain original source UOM; mixed dimensions within a given stock item raise an error. Crucially, **no full live plan rebuild occurred**: existing routine hard-deletes old detail and runs and a transaction-only December dry verification produced **2,158 rows versus 5,447 currently stored**. The dry run was rolled back, verified by unchanged December run ID `cfb9913f-5292-4808-bfb5-966df4912c7f` and row count 5,447. A plan reconciliation is required before any full refresh.

**External procurement PR:** Both `create_pr_from_mrp_plan_pec_internal` and `proc_pr_rebuild_from_mrp_pec_internal` now join `v_inv_stock_item_with_class`, require active items and exclude RM `subcategory_code IN ('finished_bulk_material','semifinished_goods')` from automatic generated PR lines. Production/BOM/MRP representation is unchanged for those internal materials.

**PR-to-indent:** `proc_indent_create_from_pr_pec_internal` excludes finished-bulk and semi-finished lines when copying an existing PR (including old active PRs), and rejects a new empty indent if there are no eligible positive PR lines. `proc_indent_resync_from_pr_pec_internal` likewise excludes them from subsequent draft resync. **Manual indent creation flows were not globally altered**; separate workflow review is required if owner wants to block direct manual requests for internal material classes.

**History retained:** no existing active PRs or approved indents were deleted, reset, or rewritten. Seven existing positive-balance internal-category indent lines remain in the live `v_proc_indent_line_balance` view, requiring separate historical lifecycle review rather than automatic cancellation.

## Current live verification (Nov 2026–Jan 2027)

| Material | UOM | Gross three-month requirement | MRP `sum(procure_qty)` |
|---|---|---:|---:|
| Ampar #64 | g | 5.1020408163 | 0 g |
| Gomatha Javvadu #291 | g | 53.3333333333 | 100 g |
| Kasthoori #424 | g | 21.2184297212 | 0 g |
| Kumkumapoo #517 | g | 1290.3158131228 | **1500 g** |

- Previously Kumkumapoo appeared as 0 Kg due to comparing gram-denominated stock against Kg demand.
- Live `mrp_uom_factor_strict(1,2)=1000`, reverse `(2,1)=0.001`, identity `(5,5)=1`.
- **0** ordinary RM plan UOM/default mismatches over the three-month horizon.
- **0** non-g BOM lines among the four policy items.
- Both PR functions and both PR-to-indent functions independently verified to contain the internal-material exclusion; empty-indent guard present in create-from-PR.
- Source current period has 18 positive internal material MRP period rows. This **does not mean** the source MRP itself was filtered; only external PR/indent writers are filtered. Seven older open indent lines survive.

## Source control and unmerged review

Production's live stored procedure/view definitions were captured in `supabase/migrations/20261112114000_pec_uom_and_internal_pr_guard.sql`, commit `8b160a5`, on documentation/correction PR #287 branch. Earlier exact BOM data correction is `docs/procurement-execution/ERP_FOUR_G_ITEMS_GUARDED_BOM_CORRECTION_20261112.sql`, commit `bd67201`. **This branch remains unmerged**, despite the live changes requested by owner; integration review should ensure no duplicate destructive refresh and no drift before merging migrations to main.

## Residual acceptance gates

1. **Full rebuild drift:** reconcile 2,158 fresh December detail rows versus 5,447 existing before any destructive `mrp_rm_plan_rebuild_month_active` publication.
2. **Forward compatibility:** future stock snapshots carrying internal items with incompatible stock and demand dimensions should fail review rather than using physical Kg as units of Nos; the present snapshot preflight has zero positive-stock mismatches.
3. **Writer integration:** source functions are live but no user-interface end-to-end PR/indent creation was performed; test permissions, active PR that contains internal lines, empty-indent error reporting, and existing manual-adjustment protections before formal gate signoff.
4. **Manual indents:** if direct manual internal-material indent creation should be restricted, define governed exception behaviour before changing that function.
5. **S4 hybrid:** active-indent adjustment and historical usage floor remain a separate pending feature; this correction does not activate the hybrid engine.
6. **Migration QA:** capture object dependencies/permissions, isolated PostgreSQL acceptance and exact server source parity; formal G0 gates remain 0/6.

**Note:** Tally purchase orders were not used or introduced.
