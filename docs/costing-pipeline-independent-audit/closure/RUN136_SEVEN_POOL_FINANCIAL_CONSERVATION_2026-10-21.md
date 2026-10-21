# Run 136 — Independent seven-pool financial conservation, 21 October 2026

Scope: **read-only** financial reconciliation of frozen October-2026 run136, valuation 2026-10-20, initiated after user instruction to finish numerical proof, then plan Google Sheets. No database migration, approval, run, pricing designation, Google Sheets export or edits in this gate.

## Exact snapshot-to-recipient reconciliations

Run136 `costing.cost_pool_monthly_snapshot`: all 7 sources READY.

| Pool | Frozen source INR | Actual recipients / method | Independently summed INR | Resolution |
| --- | ---: | --- | ---: | --- |
| DIRECT_LABOUR | 1,369,652.00 | product manufacturing labour + SKU packing labour | 706,203.00 + 663,449.00 | PASS |
| PRODUCTION_OVERHEAD | 670,935.04 | one product allocation per product ID from `sku_production_overhead_allocation_snapshot` (453 product groups, zero conflicting repeats) | 670,935.04 | PASS |
| QUALITY_CONTROL_OVERHEAD | 142,241.67 | `product_qc_allocation_snapshot.product_qc_allocation_amount` | 142,241.67 | PASS |
| MATERIALS_STORES_OVERHEAD | 260,508.53 | `sku_materials_stores_allocation_snapshot.monthly_sku_allocation_amount` + `product_internal_source_materials_stores_allocation_snapshot.allocation_amount` | 260,508.246680292663 + 0.283319707337 = 260,508.53 | PASS |
| ADMIN_OVERHEAD | 1,671,359.783333333333 | `sku_admin_finance_overhead_allocation_snapshot.admin_overhead_cost_per_sku * resolved_sales_units` | 1,671,359.783333333333 (sub-nanorupee calculation precision) | PASS |
| FINANCE_ADMIN_OVERHEAD | 205,450.46 | `sku_admin_finance_overhead_allocation_snapshot.finance_admin_overhead_cost_per_sku * resolved_sales_units` | 205,450.46 | PASS |
| MARKETING_EXPENSE | 2,964,501.01 | 906 distinct (product_id,region_code) frozen regional allocation rows; do **not** sum same group on multiple SKU rows | 2,964,501.01 | PASS |

## Important distinction about apparent recipient residuals

The manufacturing direct labour pool is **706,203** and `product_direct_labour_workload_snapshot.product_direct_labour_allocation` sums to exactly **706,203** across 453 products. Saleable-SKU `sku_direct_labour_allocation_snapshot.manufacturing_direct_labour_allocation` sums to **706,117.105913332178...**: the apparent **85.89408666782** difference is a recipient-boundary comparison, not missing labour. Internal-source products are valid product-level manufacturing recipients and their costs pass through internally consumed intermediates. Packing SKU allocations sum to **663,449**, exactly the packing component. Do not sum product and SKU views together (double-counting).

Similarly, materials-stores saleable SKU view alone is short **0.283319707337...**, exactly matched by distinct internal-product source allocation. QC full product sum and production overhead full 453-product sum have no monetary residual. The previous run131 internal-source reconciliation document independently tracked recursive demand and these same residual categories.

Numeric results may contain non-significant PostgreSQL NUMERIC tails at far beyond currency precision; all differences are zero to INR 0.01 and require no plug, smoothing or balancing row.

## Run stability / controls

Run136 all six stages SUCCESS; 627 SKU rows (626 final READY, 1 regional pricing review SKU1771 Brihat Chagaladi Ghritham IK); 627 material READY. All 17 exact queue/integrity audits PASS. Run135->136 627/627 paired SKU material, internal loaded, IK marketing, OK marketing unit cost values identical. Marketing sales denominator stable at 197456655.83857142857 despite later source cutoff; run134->135 denominator differed based on 181 product-region changed billed values. No price publication.

## Google Sheets publication boundary

This completes the **numerical pool-conservation gate** for run136. It does not alone approve run136 as a period's official costing or resolve separate G2 route attestation, negative/provenance/permission/concurrency regressions, merge state or the governed SKU1771 review. `IMPLEMENTATION_RULES.md` expressly blocks all database-to-Google-Sheets integration until costing implementation and independent acceptance pass; a successful refresh and monetary conservation do not independently release that block.

Google Drive read-only discovery finds multiple legacy files (including CS - PRODUCT PRICING DATABASE, SBN and SFS counterparts), none should be treated as authoritative SASV costing publication without repository mapping/explicit target verification. Before any Sheet write: obtain/check exact destination ID/tab/range, column SKU IDs, run136 immutable approval/designation, write dry-run row counts and expected numbers, idempotency/rollback plan, owner signoff. No Sheet writes authorized/performed.

## Reproducible SQL templates (read-only)

```sql
-- Labour components, separate levels
SELECT component_code,component_pool_amount FROM costing.direct_labour_component_pool_snapshot WHERE refresh_run_id=136;
SELECT count(*),sum(product_direct_labour_allocation) FROM costing.product_direct_labour_workload_snapshot WHERE refresh_run_id=136;
SELECT sum(packing_labour_allocation),sum(manufacturing_direct_labour_allocation) FROM costing.sku_direct_labour_allocation_snapshot WHERE refresh_run_id=136;
-- QC / stores
SELECT sum(product_qc_allocation_amount) FROM costing.product_qc_allocation_snapshot WHERE refresh_run_id=136;
SELECT sum(monthly_sku_allocation_amount) FROM costing.sku_materials_stores_allocation_snapshot WHERE refresh_run_id=136;
SELECT sum(allocation_amount) FROM costing.product_internal_source_materials_stores_allocation_snapshot WHERE refresh_run_id=136;
-- Administrative
SELECT sum(admin_overhead_cost_per_sku*resolved_sales_units),sum(finance_admin_overhead_cost_per_sku*resolved_sales_units) FROM costing.sku_admin_finance_overhead_allocation_snapshot WHERE refresh_run_id=136;
-- Production: exclude repeated SKU-group product allocations
WITH p AS (SELECT product_id,max(product_production_overhead_allocation) amt,count(distinct product_production_overhead_allocation) variants FROM costing.sku_production_overhead_allocation_snapshot WHERE refresh_run_id=136 GROUP BY product_id) SELECT count(*),sum(amt),count(*) FILTER(WHERE variants>1) FROM p;
-- Marketing: exclude repeated SKU-group product/region allocation
WITH p AS (SELECT product_id,region_code,max(product_region_marketing_allocation) amt,count(distinct product_region_marketing_allocation) variants FROM costing.sku_regional_marketing_expense_allocation_snapshot WHERE refresh_run_id=136 GROUP BY product_id,region_code) SELECT count(*),sum(amt),count(*) FILTER(WHERE variants>1) FROM p;
```
