with m as (select * from costing.sku_material_cost_snapshot where refresh_run_id=119)
select json_build_object(
 'skus_with_stale_rate',count(*) filter (where rm_stale_purchase_rate_line_count+pm_stale_purchase_rate_line_count>0),
 'skus_with_fallback',count(*) filter (where rm_stock_valuation_fallback_line_count+pm_stock_valuation_fallback_line_count>0),
 'accepted_review_lines',sum(rm_accepted_review_rate_line_count+pm_accepted_review_rate_line_count),
 'sku879_factor',max(conversion_to_base) filter (where sku_id=879),
 'sku879_rm_per_sku',round(max(rm_cost_per_sku) filter (where sku_id=879),2),
 'sku859_rm_per_base',round(max(rm_cost_per_base_unit) filter (where sku_id=859),4),
 'sku1277_rm_per_base',round(max(rm_cost_per_base_unit) filter (where sku_id=1277),4),
 'density_091_skus',count(*) filter (where lower(pack_uom)='ml' and lower(product_base_uom)='kg' and conversion_to_base=0.00091),
 'density_091_products',count(distinct product_id) filter (where lower(pack_uom)='ml' and lower(product_base_uom)='kg' and conversion_to_base=0.00091)) r from m;
