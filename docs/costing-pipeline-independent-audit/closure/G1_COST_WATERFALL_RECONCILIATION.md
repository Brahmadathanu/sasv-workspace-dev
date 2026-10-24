# G1: Cost waterfall forensic reconciliation (status: PARTIAL, downstream arithmetic VERIFIED)

Runs 122 (634 SKUs) and 128 (627 SKUs), read-only on frozen snapshots. SQL and results in `evidence/G1/`.

## Executable formulas (from the live writer functions and snapshots)
| Level | Formula | Writer |
|---|---|---|
| Material | RM + PM | material snapshot |
| Direct labour | manufacturing direct labour + packing labour | sku_direct_labour_allocation_snapshot |
| Prime | material + direct labour + internal material conversion (IMC) | costing.rpc_refresh_sku_prime_cost_snapshot (def saved) |
| COP | prime + production OH + QC OH + materials-stores OH | rpc_refresh_sku_manufacturing_cop_snapshot |
| Internal loaded (ILC) | COP + admin OH + finance-admin OH | rpc_refresh_sku_internal_loaded_cost_snapshot |
| Pricing cost IK / OK | ILC + regional marketing IK / OK | rpc_refresh_sku_pricing_bridge_snapshot |
| Margin IK / OK | MRP IK/OK - pricing cost IK/OK | same |
| (pricing_cost_per_sku) | ILC + national marketing; not used for margins | same |

## Results
- Every identity above holds for 634/634 (Sep) and 627/627 (Oct) SKUs at 1e-6; no SKU missing at any level.
- **The "7 vs 9" prime/ILC exceptions are one root cause:** prime includes IMC (internal source-product conversion: labour, OH, QC and stores carried by intermediate products such as Balasarvangam base, product 277/275). 9 SKUs carry IMC (54, 56, 364, 365, 367, 658, 901, 902, 1285; Rs 0.0008-1.29 per SKU). At a Rs 0.01 tolerance 7 exceed (367 and 901 do not) = the "7"; exact comparison = the "9" of the October sheet. Not a defect in cost; a display/lineage gap because the ILC snapshot has no IMC column (CI-002). No plug, no snapshot change.
- **Head-to-pool:** current cost-head ledger totals (EXCLUDED removed) equal the frozen pool expense amounts for all 7 pools in both runs (admin 9,56,469.78; finance admin 1,29,925.46; marketing 29,64,501.01; production OH 6,29,880.04; QC 51,291.67; stores 73,343.53 = stores head 5,618.53 + MATERIAL_LANDED_COST 67,725 (CI-006)). Admin pool Oct adds the Rs 5,00,000 HO provision (total 16,71,359.78; CI-003).
- **Pool-to-SKU conservation (sum of cost per SKU x allocation units):** exact for packing labour, admin, finance admin, national marketing; regional marketing exact across IK+OK (share sum 1). Manufacturing DL, production OH, QC and stores fall short by Rs 76.06 + 63.04 + 35.88 + 0.28 = **Rs 175.26** (Oct) and Rs 1,600.75 (Sep), which equals the IMC recovered (sum IMC x units = 175.2645 / 1,600.752). Allocations neither lost nor duplicated.

## Remaining in G1 (no approval needed)
Upstream lineage (CI-027): Tally purchase/stock -> material rate selection (841 accepted Oct rates, 5 Band C); BOM/UOM/yield; route and machine loads; HR staffing roles; QC per batch; sample traces for the 9 negatives, kit 865, Kanji 878 and the IMC SKUs.
