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

-- Frozen run119 foundation/sku source contract baseline: 460 ready products, 635 convertible active SKUs.
select foundation_status,count(*) from costing.fn_preview_standard_batch_workload(119) group by foundation_status;
select output_status,count(*) from costing.fn_preview_standard_batch_net_output(119) group by output_status;
select conversion_status,count(*) from public.product_skus s cross join lateral costing.fn_resolve_standard_sku_base_quantity(s.id) c where s.is_active=true group by conversion_status;
-- These read-only source checks should return STANDARD_BATCH_REFERENCE_READY (460), READY_EXPECTED_NET_OUTPUT (460), READY (635).
