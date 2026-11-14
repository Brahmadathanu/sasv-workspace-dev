# PEC / MRP correction checkpoint — owner-approved BOM normalization executed
**12 Nov 2026 IST · live changes verified · PR/indent exclusion proposal staged, not deployed.**

## Implemented on production: 13 BOM corrections

The exact committed guarded statement `ERP_FOUR_G_ITEMS_GUARDED_BOM_CORRECTION_20261112.sql` (commit `bd67201`) was executed successfully on live Supabase. It checked UOM IDs/dimensions and the pre-existing Kg→g factor **1000**, checked the complete 13-ID expected old-quantity tuple set, and updated each `rm_bom_line` with `uom_id=2 (g)`, multiplying numeric quantity by **1000**. The transaction failed closed on any mismatched precondition or non-13 row update. Follow-up SELECT independently confirmed:
- Ampar #64: 1/1 BOM lines in g;
- Gomatha Javvadu #291: 1/1 g (unchanged 24g);
- Kasthoori #424: 8/8 g;
- Kumkumapoo #517: 11/11 g.
- All four `inv_stock_item.default_uom_id=2` unchanged; **0 remaining non-g BOM lines** for these items.
- Examples read back: #5394 10g, #9717 75g, #3769 50g, #9183 1g.
- No PR, indent or historical plan detail directly modified by this correction.

## Crucial MRP rebuild warning

Investigated `mrp_rm_plan_rebuild_month_active` source. It **hard deletes** the month's `mrp_rm_plan_detail`, `mrp_rm_plan_monthly`, and `mrp_rm_plan_month_runs` and rebuilds them. Its monthly aggregate sets `rm_uom_id = inv_stock_item.default_uom_id` while calculating `sum(t.required_qty)` **without converting each detail row's `required_uom_id`**. This is an independent latent unit error if mixed-UOM material requirements exist. Since this view supports production planning, do not execute blindly. Need isolated corrected rebuild+stock-netting verifier, snapshot before/after, and owner acceptance of active-horizon rebuild. Future MRP detail remains stale until that work.

## Owner policy: internal materials must not be externally requisitioned

Classification source: `v_inv_stock_item_with_class.subcategory_code IN ('finished_bulk_material','semifinished_goods')`. Inventory includes **86 finished bulk + 186 semi-finished = 272 RM stock items**, and the current Nov 2026–Jan 2027 `v_mrp_procurement_plan` has **18 positive period rows** for these groups. `create_pr_from_mrp_plan_pec_internal` and `proc_pr_rebuild_from_mrp_pec_internal` currently do **not** filter these classes. Existing historical active PRs and approved indents include such materials, and must **not** be silently deleted or rewritten.

**Target behaviour:** these items remain in internal production/BOM/MRP calculations but are excluded as automatically generated *external purchasing* PR lines. `proc_indent_create_from_pr_pec_internal` should continue copying valid positive PR lines without reimplementing category logic; enforce writer-side eligibility for newly generated PR lines. Draft PR rebuild must apply the same filter and respect manual-change protections; do not change existing active PRs or old approved indents. The S4 consumption-only candidate union must apply the same exclusion, unlike initial broad exploratory population.

**Not yet executed:** PR writer exclusion, MRP rebuild/stock UOM fix, full hybrid feature. Require isolated regression tests + deployment review; current code would still generate some internal-material external PR lines. No claim that merely editing the four BOMs solved this.

PEC G0, formal gates 0/6.
