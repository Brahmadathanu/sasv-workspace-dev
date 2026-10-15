-- MC08 runtime regression for policy-resolved candidate. Read-only.
-- Test must run on isolated database with all MC06/MC08 migrations installed.
with q as (
 select * from costing.fn_preview_mc08_governed_sku_conversion(119)
)
select count(*) total_rows,
 count(distinct sku_id) unique_skus,
 count(*) filter(where consumer_status='REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED') provisional_rows,
 count(*) filter(where consumer_status='BLOCKED_FINANCIAL_GATE') blocked_financial,
 count(*) filter(where consumer_status='BLOCKED_BATCH_OR_CONVERSION') blocked_conversion,
 count(*) filter(where consumer_status='REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED'
 and (labour_per_pack is null or fixed_oh_per_pack is null
 or variable_oh_per_pack is null or total_conversion_per_pack is null
 or abs(total_conversion_per_pack-
 (labour_per_pack+fixed_oh_per_pack+variable_oh_per_pack))>0.00001))
 invalid_provisional,
 count(*) filter(where consumer_status<>'REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED'
 and (labour_per_pack is not null or fixed_oh_per_pack is not null or
 variable_oh_per_pack is not null or total_conversion_per_pack is not null))
 leaked_blocked_cost
from q;
-- Missing rows cannot be accepted as PASS. Compare against independently
-- enumerated active SKU scope. Never infer readiness from provisional rows.
