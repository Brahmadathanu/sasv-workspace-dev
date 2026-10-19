select refresh_run_id, count(*) rows, count(distinct region_code) regions, max(marketing_pool_amount) pool, count(distinct marketing_pool_amount) pool_distinct,
 sum(marketing_expense_cost_per_sku_region*resolved_regional_units) alloc_by_units,
 (select sum(a) from (select distinct product_id, region_code, product_region_marketing_allocation a from costing.sku_regional_marketing_expense_allocation_snapshot y where y.refresh_run_id=x.refresh_run_id) z) alloc_product_region,
 (select sum(s) from (select distinct product_id, region_code, product_region_monetary_allocation_share s from costing.sku_regional_marketing_expense_allocation_snapshot y where y.refresh_run_id=x.refresh_run_id) z) share_sum,
 count(*) filter (where marketing_expense_allocation_status<>'READY') not_ready
from costing.sku_regional_marketing_expense_allocation_snapshot x where refresh_run_id in (122,128) group by refresh_run_id order by 1;
