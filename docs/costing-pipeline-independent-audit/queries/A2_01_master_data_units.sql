-- A2 master data / UOM / material integrity for run 119 (SELECT-only + STABLE previews)
with m as (select * from costing.sku_material_cost_snapshot where refresh_run_id=119),
c as (select * from costing.sku_manufacturing_cop_snapshot where refresh_run_id=119),
ps as (select ps.*, p.uom_base, p.conversion_to_base, p.status pst, p.is_pto from public.product_skus ps join public.products p on p.id=ps.product_id)
select json_build_object(
'run119_skus',(select count(*) from c),
'active_skus_nonsample',(select count(*) from ps where is_active and not coalesce(is_sample,false)),
'active_skus_not_in_run',(select count(*) from ps where is_active and not coalesce(is_sample,false) and id not in (select sku_id from c)),
'run_skus_inactive_now',(select count(*) from c join ps on ps.id=c.sku_id where not ps.is_active),
'run_skus_product_inactive',(select count(*) from c join ps on ps.id=c.sku_id where ps.pst<>'Active'),
'dup_sku_defs',(select count(*) from (select product_id,pack_size,lower(uom) from ps where is_active group by 1,2,3 having count(*)>1) d),
'uom_pairs',(select json_object_agg(k,n) from (select lower(m.pack_uom)||'->'||lower(m.product_base_uom)||' f='||coalesce(m.conversion_to_base::text,'null') k,count(*) n from m group by 1 order by 2 desc limit 15) u),
'conv_null',(select count(*) from m where conversion_to_base is null),
'mat_status',(select json_object_agg(s,n) from (select material_costing_status s,count(*) n from m group by 1) z),
'rm_status',(select json_object_agg(s,n) from (select rm_costing_status s,count(*) n from m group by 1) z),
'pm_status',(select json_object_agg(s,n) from (select pm_costing_status s,count(*) n from m group by 1) z),
'lines',(select json_build_object('stale_rm',sum(rm_stale_purchase_rate_line_count),'stale_pm',sum(pm_stale_purchase_rate_line_count),'fallback_rm',sum(rm_stock_valuation_fallback_line_count),'fallback_pm',sum(pm_stock_valuation_fallback_line_count),'manual_rm',sum(rm_manual_rate_line_count),'manual_pm',sum(pm_manual_rate_line_count),'unaccepted_review',sum(rm_unaccepted_review_rate_line_count+pm_unaccepted_review_rate_line_count),'accepted_review',sum(rm_accepted_review_rate_line_count+pm_accepted_review_rate_line_count),'skus_with_fallback',count(*) filter (where rm_stock_valuation_fallback_line_count+pm_stock_valuation_fallback_line_count>0),'skus_with_stale',count(*) filter (where rm_stale_purchase_rate_line_count+pm_stale_purchase_rate_line_count>0)) from m),
'zero_or_null_material',(select count(*) from m where coalesce(material_cost_per_sku,0)<=0),
'pm_zero',(select count(*) from m where coalesce(pm_cost_per_sku,0)=0),
'rm_zero',(select count(*) from m where coalesce(rm_cost_per_sku,0)=0),
'products_no_rm_bom',(select count(distinct c.product_id) from c where c.product_id not in (select product_id from public.rm_bom_header)),
'rm_bom_bad_lines',(select json_build_object('null_or_zero_qty',count(*) filter (where coalesce(qty_per_reference_output,0)<=0),'wastage_gt_50',count(*) filter (where wastage_pct>50),'null_uom',count(*) filter (where uom_id is null)) from public.rm_bom_line),
'rm_bom_hdr',(select json_build_object('no_ref_qty',count(*) filter (where coalesce(reference_output_qty,0)<=0),'loss_null',count(*) filter (where process_loss_pct is null),'loss_gt_30',count(*) filter (where process_loss_pct>30)) from public.rm_bom_header where product_id in (select product_id from c)),
'per_base_spread',(select json_agg(x) from (select product_id, count(*) skus, round(min(rm_cost_per_base_unit),4) mn, round(max(rm_cost_per_base_unit),4) mx from m group by 1 having count(*)>1 and max(rm_cost_per_base_unit)>1.001*min(rm_cost_per_base_unit) limit 10) x),
'base_qty_exceptions',(select count(*) from costing.sku_base_quantity_exception),
'conv_gate',(select json_object_agg(s,n) from (select g::text s,count(*) n from costing.fn_preview_current_manufacturing_sku_conversion_gate() g group by 1 limit 0) z),
'count_pack',(select count(*) from costing.fn_preview_count_pack_manufacturing_integrity())
);
