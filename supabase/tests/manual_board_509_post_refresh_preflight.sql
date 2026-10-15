-- BOARD 509-SKU post-refresh preflight. READ ONLY. Do not execute refresh here.
-- Run only after user executes the governed client refresh, inserting its actual run id.
-- Replace 119 with new run ID only after the client provides proof.
with base as (
 select sku_id,refresh_run_id,valuation_date,mrp_ok,internal_loaded_cost_per_sku,
 marketing_expense_cost_per_sku_ok,pricing_bridge_status,pricing_bridge_status_ok,
 internal_loaded_cost_status,marketing_expense_allocation_status_ok,
 mrp_resolution_status,allocation_resolution_status
 from costing.sku_pricing_bridge_snapshot
 where refresh_run_id=119
)
select refresh_run_id,count(*) as snapshot_skus,
 count(*) filter(where mrp_ok is null) as missing_ok_mrp,
 count(*) filter(where internal_loaded_cost_per_sku is null) as missing_loaded,
 count(*) filter(where marketing_expense_cost_per_sku_ok is null) as missing_marketing,
 count(*) filter(where internal_loaded_cost_status<>'READY') as loaded_review,
 count(*) filter(where marketing_expense_allocation_status_ok<>'READY') as marketing_review,
 count(*) filter(where pricing_bridge_status_ok<>'READY') as ok_region_review,
 count(*) filter(where mrp_resolution_status<>'READY') as mrp_review,
 count(*) filter(where allocation_resolution_status<>'READY') as allocation_review
from base group by refresh_run_id;
-- This broad 635-active-SKU pool is not identical to the Board 509-SKU membership.
-- After validating Board membership separately, join ONLY confirmed 509 IDs to the new run.
-- Fail closed on any missing/duplicate SKU, status REVIEW_REQUIRED, valuation mismatch,
-- unexpected MRP movement or unapproved manufacturing rate/cutover. Preserve existing
-- price-revision-proposal formulas (Q:AJ) and its 7%-MRP/₹5 rounding assumptions.
