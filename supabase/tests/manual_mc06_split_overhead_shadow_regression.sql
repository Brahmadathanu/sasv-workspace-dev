-- MC06 regression SQL to be executed only in disposable/staging database after migration deployment.
-- Inspect each result; script does NOT approve, update or refresh.
select * from costing.fn_preview_mc06_split_overhead_gate(119);
select shadow_status,count(*) sku_count
from costing.fn_preview_mc06_split_overhead_sku_shadow(
 119,706203::numeric/(10939.4::numeric/12),
 361578.68166667::numeric/(11897::numeric/12),
 654456.6::numeric/(11897::numeric/12))
group by shadow_status order by shadow_status;
select sku_id,product_id,labour_cost_per_pack,fixed_oh_cost_per_pack,
 variable_oh_cost_per_pack,conversion_cost_per_pack,shadow_status
from costing.fn_preview_mc06_split_overhead_sku_shadow(
 119,706203::numeric/(10939.4::numeric/12),
 361578.68166667::numeric/(11897::numeric/12),
 654456.6::numeric/(11897::numeric/12))
where sku_id in (207,208,209,1798) order by sku_id;
-- Exact per-SKU arithmetic conservation for all calculable rows.
with s as (
select * from costing.fn_preview_mc06_split_overhead_sku_shadow(
 119,706203::numeric/(10939.4::numeric/12),
 361578.68166667::numeric/(11897::numeric/12),
 654456.6::numeric/(11897::numeric/12)))
select count(*) filter(where shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 and abs(conversion_cost_per_pack-labour_cost_per_pack-
 fixed_oh_cost_per_pack-variable_oh_cost_per_pack)>0.000001) as failing_rows,
 count(*) filter(where shadow_status<>'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH') as blocked_rows
from s;
-- Shadow rate values are hypothetical and unapproved. Even zero failing_rows is NOT cutover clearance.
