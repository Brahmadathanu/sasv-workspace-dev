# PEC S4 — Consumption UOM provenance and RM stock exceptions (2026-11-12)

**Status:** G0 read-only source investigation, no production writes. Follows `ERP_S4_GENERAL_COHORT_EXECUTION_EVIDENCE_20261112.md`; #305; #284.

## Source-level findings

The live `v_item_consumption_monthly_by_item` view combines:
- `v_item_consumption_rm_pm_monthly`: joins `tally_rm_pm_issues_snapshot` by Tally item alias and sums `material_qty_value`. Source has an explicit `material_uom`, **but the monthly view drops that UOM** before grouping and reporting `rm_pm_issue_qty`.
- `v_item_consumption_consumables_monthly`: sums `tally_consumables_monthly_snapshot.out_qty_value`; consumed amounts are merged by stock item/month through a FULL JOIN.
- Hence a quantity aggregated from `total_consumed_qty` cannot be assumed safe without checking the underlying issue source UOM and whether both sources contributed. Do not silently convert or mix different dimensions.

Read-only traced 231 active RM/PM items with positive historical consumption (Nov 2025–Oct 2026) absent from current three-month RM/PM MRP. Against source `tally_rm_pm_issues_snapshot.material_uom`:
- **PM 91/91** have a single issue UOM matching the master default UOM under explicit aliases;
- **RM 139/140** have a single matching issue UOM;
- **RM 1/140** has a single **mismatching** issue UOM;
- **No** missing issue-UOM provenance or mixed distinct issue UOM within these 231 items in the inspected 12-month slice (subject to the view's original alias mapping and source filters).
- Mismatching item **#165 Bulk Stock - Vatharakshasan Gulikai**: master default UOM **Kg**, Tally issue UOM **Nos**. **BLOCK numeric CCF and automatic PR inclusion** until formally governed conversion/classification; count of 230 matching items is **unit-label consistency**, not proof that all are eligible to procure.

### Five RM missing latest-stock-source entries

All have live active mapped RM Tally aliases and issue records in **Kg.**, matching default **Kg**. They have **no row** in `v_stock_current_by_item` for the latest RM stock snapshot, therefore their on-hand balance is **unknown, not proved zero**:

| ID | Item | Recorded issues Nov 2025–Oct 2026 |
|---|---|---:|
| 736 | Pannal Samoolam (F) | 14 Kg |
| 888 | Thadiyankay (F) | 80 Kg |
| 935 | Thiruneettu Pacha (D) | 0.350 Kg |
| 999 | Veeram Sudhi | 2.452 Kg |
| 2704 | Aadalodakathila with Nallenna | 170 Kg |

Their unit provenance is not the blocker; **latest source-stock coverage/visibility** is. Missing from latest snapshot may mean zero, omitted reporting, or alias/stock-capture edge case; do not infer which without evidence. Use `STOCK_SNAPSHOT_ITEM_ABSENT_REVIEW` and `approved_new_pr_qty=NULL`. Do not patch a false zero stock record.

### Thirteen in-MRP RM planning/default-UOM mismatches

Read-only inspection distinguished:
- **4 g-default items planned in Kg:** #64 Ampar; #291 Gomatha Javvadu; #424 Kasthoori; #517 Kumkumapoo. All four source issues in the lookback are `Gm.`, so converting to plan Kg requires **explicit x/1000** with canonical UOM conversion verification. No direct combination of raw monthly issue numerics with Kg MRP.
- **8 Nos-planned SG Cap items with Kg master default:** #1068 Ksheerabala Thailam 101 Avarthi SG Cap; #1070 Gandharvahasthadi Erandam SG Cap; #1073 Thanurekshakan SG Cap; #1075 Erandasukumaram SG Cap; #1121 Nirgundyadi Erandam SG Cap; #1150 Chathilinga Thailam SG Cap; #1179 Vellaruku Thailam SG Cap; #1204 Mahanarayana Thailam SG Cap. No source issue rows in 12-month lookback for any of these eight; **Nos/Kg is dimensionally incompatible**, no invented factor.
- **1 Kg-planned and Nos-default:** #1167 Rheumorid Balm_5 g, no recent source issue rows; no invented factor.

Totals: 4 same mass dimension with scale conversion; 9 distinct/unsupported dimensions requiring classification or item-specific packaging recipe. **Do not treat all 13 as equivalent UOM mistakes** or automatically modify master data.

## Source-selection and acceptance requirements

1. Prefer a dedicated **UOM-aware consumption CCF** sourcing `tally_rm_pm_issues_snapshot.material_uom`, with explicit source-unit normalization and traceability. Monthly `v_item_consumption_monthly_by_item` is useful for exploratory issue totals, not sufficient alone as a quantity-authoritative multi-UOM PR writer input.
2. Match source unit against governed catalog and MRP plan UOM (including dimension and approved factor); aggregate only *after* conversion. Fail closed for no source UOM, incompatible dimensions, multiple conflicting UOMs, and unverified alias.
3. Determine whether any `consumable_out_qty` contributes to RM/PM item histories before mixing source quantities. Avoid combining duplicate provenance or identical usage facts twice.
4. A canonical `inv_uom` stores `id,code,dimension_id,is_base,notes`, but source-unit factor lookup/conversion must be independently verified; do not derive from labels alone.
5. Stock source absence remains an explicit blocking review state independent of UOM match.
6. Keep existing approved/issued indent commitment deduction and buying-list unchanged. Tally **purchase orders** are excluded (Tally stock/issue evidence is separate and still used). Preserve whole-Nos and MOQ once at final step.
7. No live writer, migration, PR/indent data changes, or merge authorised by this audit.

**Formal PEC gate:** G0 active, 0/6 verified.
