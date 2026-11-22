# PEC S4 — Existing UOM handling audit before hybrid integration (2026-11-12)

**Scope:** live read-only SQL source/metadata audit of PR creation, draft PR rebuild, PR-to-indent creation, draft indent resync, manual indent-line creation, catalog default UOM, and conversion master. Governance-only: no production writes.

## Core conclusion

**Do not introduce a second UOM conversion rule inside PR→indent generation.** The existing PR/indent functions retain the explicit UOM assigned to the MRP/PR line; `inv_stock_item.default_uom_id` is a catalog reference, **not necessarily the purchasing unit of a particular MRP line**. The hybrid **consumption-floor input** needs a validated conversion into that line's procurement UOM, *before* joining to existing MRP and approved indent balances.

### Direct live function trace

1. `create_pr_from_mrp_plan_pec_internal`: `INSERT proc_pr_line(... uom_id,...)` selects `p.uom_id` from `v_mrp_procurement_plan p`; groups by class/item/`p.uom_id`, sums `p.procure_qty`. Joins `inv_stock_item` only to filter RM procurement mode. Does **not** query `default_uom_id` or invoke a UOM conversion function.
2. `proc_pr_rebuild_from_mrp_pec_internal`: uses the same `p.uom_id` grouping and retains the existing line key `(material_class_id,stock_item_id,uom_id)`. Does **not** replace UOM with catalog default.
3. `proc_indent_create_from_pr_pec_internal`: copies `proc_pr_line.uom_id`, quantity `requested_qty+manual_delta_qty`, only positive final quantities, into new indent lines; PR/indent line maps also key by material class, item and UOM. No conversion/default lookup.
4. `proc_indent_resync_from_pr_pec_internal`: copies positive PR final quantities and their `uom_id` into draft indent lines; matches same three-key tuple. No conversion/default lookup. In reset/safe modes this operation can delete lines absent from PR; separate manual-line protection may be needed, but **no production modification authorized**.
5. `proc_indent_add_line_pec_internal`: accepts explicit `p_uom_id` and records it, without consulting item `default_uom_id` or a conversion table. Enforces lifecycle conditions and a manual reason for editing approved/issued indents.

**Note:** the inspected `v_mrp_procurement_plan` definition contains neither `default_uom_id` nor a direct `inv_uom_conversion` reference. Its upstream dependencies may already apply conversion; do not infer none exists in the whole MRP pipeline. Existing RM form-conversion view `v_mrp_rm_conversion_contrib_detail` explicitly applies `inv_rm_form_conversion.factor` when mapping consume-form to purchase-form items.

### Governed conversion framework already present

`inv_uom` has `id,code,dimension_id,is_base`; `inv_uom_dimension` distinguishes Mass, Volume, Count, Length. `inv_uom_conversion` stores explicit directed conversion factors. Live entries observed:
- Kg → g: **1000**;
- L → mL: **1000**;
- mL → L: **0.001**;
- Box → Nos: **1**.

**There is no currently stored direct g → Kg row**, so a generic one-way lookup will fail for four g-default items planned as Kg unless a governed reciprocal-path rule exists and is verified. `validate_inv_uom_conversion` rejects cross-dimension mappings and checks the dimension ID, as expected. Do not insert conversion data solely to make the trial pass without governance.

`inv_rm_form_conversion` is a different concept: item-level conversion from a consumed stock-item/form to a purchased stock-item/form, with factor and effective dates. Never conflate it with same-item dimensional g↔Kg normalization.

### Concrete exceptions revisited

- Four RM items #64 Ampar, #291 Gomatha Javvadu, #424 Kasthoori, #517 Kumkumapoo: default/source issue UOM g or `Gm.`, MRP procurement UOM Kg. All are within mass dimension; conversion to Kg is mathematically 0.001 but must be supported by a reviewed reciprocal/directed-policy rule rather than assuming direct lookup exists.
- Nine MRP/default mismatches between Nos and Kg: eight SG capsule items and one Rheumorid Balm item. **Do not overwrite MRP `uom_id` with default `uom_id`;** these are separate dimensions and need item-specific governed accounting if ever to convert.
- Missing-MRP item #165 Bulk Stock - Vatharakshasan Gulikai: source issue Nos, default Kg. No dimensionally valid general conversion. Block automatic quantity and show `UOM_CONVERSION_REVIEW`.
- Five absent-MRP RM stock-view misses #736/#888/#935/#999/#2704: source units Kg match default Kg; stock visibility is independently unresolved. Do not assume zero on hand.

## Proposed S4 interface contract (not yet deployed)

For existing MRP tuple `(class,item,procurement_uom)`, **procurement_uom = MRP `uom_id`**, not catalog default. For consumption-only candidate with no MRP tuple, the **catalog default UOM may be a fallback proposal** only after source issue UOM, dimension and actual procurement form are confirmed (and source-stock and category eligibility). Migrate nothing automatically.

Conversion procedure for consumption:
1. Read underlying issue quantity **with source UOM** and stock-item alias; do not aggregate the UOM-less monthly view across incompatible units.
2. Resolve source aliases to governed `inv_uom.id`, obtain source/target dimensions, block dimension mismatch.
3. Apply same-UOM factor 1; otherwise use a governed direct `inv_uom_conversion` factor, or separately reviewed reciprocal factor, never guessed names or cross-dimension factors. Guard uniqueness/zero factor.
4. Where consumption-form and purchasing-form are **different stock items**, apply the existing effective `inv_rm_form_conversion` policy only through a proven lineage-safe model.
5. Aggregate only after canonical UOM normalization. Match existing indent balance on `material_class_id,stock_item_id,uom_id` or proven equivalent conversion; no arbitrary UOM joins.
6. Preserve original MRP/PR/indent UOM throughout writer lifecycle. Zero final PR lines do not become indent lines; existing approved indents remain in Vendor-wise Buying List.
7. No Tally purchase-order dependency (owner instruction); Tally *issue and stock* sources are separate and remain in the consumption evidence path.

**Decision:** reuse existing `default_uom_id` as reference and existing conversion masters; no duplicate UOM policy in S4 and no unsafe replacement of line-level procurement UOM. Further UOM provenance/reciprocal conversion and stock-anchor verification required before implementation.

**PEC:** G0 active, 0/6 formal gates verified.
