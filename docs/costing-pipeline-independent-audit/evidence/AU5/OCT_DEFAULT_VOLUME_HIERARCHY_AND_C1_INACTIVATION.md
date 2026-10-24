# Default sales-quantity hierarchy + c1 inactivation (2026-10-17)
## 1. Inactivation (live, user-approved)
Same mechanism as SKU 104: public.rpc_set_product_sku_active(..., false, reason, approval_reference) updates product_skus.is_active and writes product_sku_master_audit (DEACTIVATE). Approval reference USER-DECISION-20261017-C1-INACTIVATE; audit ids 46-50, 13:15 UTC (18:45 IST); exact-5 check passed.
| SKU | product | pack | before | after |
|---|---|---|---|---|
| 1617 | Karingali (1206) | 1000 g | active | inactive |
| 1538 | Thippili (1159) | 1000 g | active | inactive |
| 1481 | Naruneendi (1127) | 1000 g | active | inactive |
| 1401 | Chukku (1083) | 1000 g | active | inactive |
| 1705 | Ramacham (1253) | 750 g | active | inactive |
Each product's only other SKU (100 g: 1616, 1537, 1480, 1400, 1704) was already inactive. None had real sales, so there was nothing to report. The 5 products remain status Active with 0 active SKUs.
Effect: ₹87,935/mo of POH+DL moves to the other products at the next run. No rerun was done.
## 2. Hierarchy (costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint))
0. Overlapping SKU assumptions -> UNRESOLVED (blocked).
1. ACTUAL_MONTHLY_MAX: largest positive cleaned company-wide SKU-month in the 12-month lookback (Oct 2025 to Sep 2026).
2. MANUAL_ASSUMPTION: costing.sku_commercial_sales_assumption, governed with an effective date. 3 rows exist; none are used by these SKUs.
3. Governed default: costing.sales_allocation_default_policy (configurable table; ids 1 and 2, EVP-3I2A, effective 2026-07-01, open-ended). It is 10 packs/month for NEW_SKU_EXISTING_PRODUCT and for NEW_PRODUCT_NO_HISTORY. It replaced the former hard-coded 10-unit fallback.
4. Otherwise UNRESOLVED.
The user is right that 10 is step 3. It counts packs, not size: 10 x 1000 g = 10 kg; 10 x 10 g = 0.1 kg.
Note: the pricing resolver (fn_resolve_sku_commercial_sales_basis_point) ranks manual assumption ABOVE actual. Costing allocation ranks actual first.
Why the 3 land on 10: no sales in the lookback and no assumption.
- Kvatha (1340, 468): 10 x 200 g = 2 kg = batch_size_ref 2 kg -> 1 full batch/month x route factor 3.25 -> ₹3,196 each.
- Abhraka (54): 10 x 1 kg = 10 kg vs batch 100 kg = 0.1 batch, but route factor 203.25 (typical 2-3) -> workload 20.3 -> ₹26,699. The driver is the route factor, not the batch size.
## 3. Recommended alternative (PROPOSED_default_volume_policy_v2.sql)
Step 2b: governed new-product volume plan (batches/year in batch_size_ref units, owner, approval, expiry <= 12 months).
Step 3 v2:
- New product: min(10 packs, one batch_size_ref per 12 months).
- New SKU of an existing product: min(10 packs, 10% of the product's actual monthly base qty).
- Default-driven workload capped at 2% of the pool (pro rata scale-down; full pool still absorbed).
- More than 12 months on default -> BLOCKED until a plan or inactivation.
No time-based spreading. Units remain monthly standard quantities, with batch_size_ref as the reference.
Oct estimate (POH+DL, Rs/mo):
| item | now | v2 | v2 + 2% cap | moved |
|---|---|---|---|---|
| 5 inactivated | 87,935 | 0 | 0 | 87,935 (done) |
| Abhraka + 2 Kvatha | 33,091 | 22,781 | ~19,036 | ~14,055 |
| all other defaults | 24,523 | 10,182 | ~8,507 | ~16,016 |
| remaining defaults total | 57,614 (4.2% of pool) | 32,963 (2.4%) | 27,543 (2.0%) | ~30,071 |
Abhraka stays high under any default because of route factor 203. Recommend a step 2b plan entry, or confirmation of the route factor.
