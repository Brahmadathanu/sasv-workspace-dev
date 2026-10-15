-- A3: rounded (charged) vs unrounded (volume-true) batch workload denominators, run119 (SELECT-only)
select round(sum(oh.monthly_batch_equivalents*oh.route_factor),4) oh_wu_unrounded,
       round(sum(oh.monthly_batch_equivalents*dl.direct_labour_route_intensity),4) dl_wu_unrounded,
       round(sum(oh.workload_units),4) oh_wu_rounded, round(sum(dl.direct_labour_workload_units),4) dl_wu_rounded,
       count(*) filter (where oh.rounded_batch_count >= 10*oh.monthly_batch_equivalents and oh.monthly_batch_equivalents>0) products_util_le_10pct
from costing.product_production_overhead_workload_snapshot oh
join costing.product_direct_labour_workload_snapshot dl on dl.refresh_run_id=119 and dl.product_id=oh.product_id
where oh.refresh_run_id=119;
-- POH conservation: pool vs product allocations
select max(production_overhead_pool_amount) pool, (select round(sum(a),2) from (select product_id, max(product_production_overhead_allocation) a from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=119 group by 1) s) allocated
from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=119;
