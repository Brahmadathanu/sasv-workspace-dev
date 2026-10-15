-- MC06 read-only forecast lot-sizing sensitivity, no changes to costing or forecast.
-- Source already recursively nets bottled SOH by SKU; DO NOT net it again.
-- Additional excess from whole product batches is carried forward across months.
-- Conversion across SKUs into one product base assumes feasible bulk-to-pack flexibility:
-- NOT an approved packaging / bulk stock allocation.
with sku as (
 select f.month_start,s.product_id,f.net_production_qty*c.base_quantity_per_pack as base_qty
 from public.v_forecast_production_plan_net_sku f
 join public.product_skus s on s.id=f.sku_id and s.is_active=true
 cross join lateral costing.fn_resolve_standard_sku_base_quantity(s.id) c
 where c.conversion_status='READY' and c.base_quantity_per_pack>0
), month_demand as (
 select product_id,month_start,sum(base_qty) as required_base_qty
 from sku group by product_id,month_start
), source as (
 select d.*,w.min_batch_size,w.preferred_batch_size,w.max_batch_size,
 w.manufacturing_labour_units_per_standard_batch as labour_per_batch,
 w.overhead_units_per_standard_batch as overhead_per_batch,
 sum(d.required_base_qty) over(partition by d.product_id order by d.month_start) as cumulative_base_qty
 from month_demand d
 join costing.fn_preview_standard_batch_workload(119) w using(product_id)
), cumulative_batches as (
 select *,ceil(cumulative_base_qty/nullif(preferred_batch_size,0)) as total_batches_through_month
 from source
), monthly_batches as (
 select *,
 total_batches_through_month -
 coalesce(lag(total_batches_through_month) over(partition by product_id order by month_start),0)
 as batches_this_month
 from cumulative_batches
)
select count(*) as product_months,sum(batches_this_month) as annual_batches,
 sum(batches_this_month*labour_per_batch) as annual_labour_units,
 sum(batches_this_month*overhead_per_batch) as annual_oh_units,
 count(*) filter(where batches_this_month<0) as invalid_negative_batches,
 count(*) filter(where preferred_batch_size<min_batch_size or preferred_batch_size>max_batch_size)
 as invalid_batch_range
from monthly_batches;
-- Expected run119 reference as-of 2026-10-15: 5160,1501,12287.30,13328.75,0,0.
-- No assertion of certified capacity; 30 forecast-uncovered model products unresolved.
-- Compare period to historical first-transfer proxy separately, NOT to September spend
-- without matching budget and workload period plus actual manufacture evidence.
