-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_price_revision_current_approved_master as
with approved_run as (
  select r.refresh_run_id,r.period_start,r.valuation_date
  from costing.v_current_successful_costing_refresh_run r
  join costing.v_costing_run_effective_designation e on e.refresh_run_id=r.refresh_run_id and e.designation='APPROVED'
  where r.selection_basis='APPROVED'
  order by r.period_start desc,r.valuation_date desc,r.refresh_run_id desc
  limit 1
)
select a.refresh_run_id,a.period_start,a.valuation_date,
 d.sku_id,d.product_id,d.product_name,d.pack_size,d.pack_uom,
 pg.id as product_group_id,pg.group_name as product_group,
 sg.id as product_subgroup_id,sg.sub_group_name as product_subgroup,
 c.rm_cost_per_sku,c.pm_cost_per_sku,d.material_cost_per_sku,d.direct_labour_cost_per_sku,
 d.internal_material_conversion_cost_per_sku,d.prime_cost_per_sku,
 d.production_overhead_cost_per_sku,d.quality_control_overhead_cost_per_sku,d.materials_stores_overhead_cost_per_sku,
 d.manufacturing_cop_per_sku,d.admin_overhead_cost_per_sku,d.finance_admin_overhead_cost_per_sku,d.internal_loaded_cost_per_sku,
 pb.marketing_expense_cost_per_sku_ik,pb.marketing_expense_cost_per_sku_ok,
 pb.pricing_cost_per_sku_ik,pb.pricing_cost_per_sku_ok,
 d.mrp_ik,d.mrp_ok,d.gst_percent,d.ik_basic_price,d.ok_basic_price,
 d.ik_discount_percent,d.ok_discount_percent,d.ik_discount_amount,d.ok_discount_amount,
 d.ik_selling_price,d.ok_selling_price,d.contingency_percent,d.ik_contingency_value,d.ok_contingency_value,
 si.scheme_id as ik_scheme_id,si.scheme_name as ik_scheme_name,si.paid_qty as ik_scheme_paid_qty,si.free_qty as ik_scheme_free_qty,
 so.scheme_id as ok_scheme_id,so.scheme_name as ok_scheme_name,so.paid_qty as ok_scheme_paid_qty,so.free_qty as ok_scheme_free_qty,
 d.ik_margin_amount_before_scheme,d.ik_margin_percent_before_scheme,d.ok_margin_amount_before_scheme,d.ok_margin_percent_before_scheme,
 d.cost_sheet_status,d.refreshed_at
from approved_run a
join costing.v_sku_detailed_cost_sheet d on d.refresh_run_id=a.refresh_run_id
  and d.period_start=a.period_start and d.valuation_date=a.valuation_date
join costing.sku_manufacturing_cop_snapshot c on c.refresh_run_id=a.refresh_run_id and c.sku_id=d.sku_id
join costing.sku_pricing_bridge_snapshot pb on pb.refresh_run_id=a.refresh_run_id and pb.sku_id=d.sku_id
join public.products p on p.id=d.product_id
join public.sub_groups sg on sg.id=p.sub_group_id
join public.product_groups pg on pg.id=sg.product_group_id
join costing.sku_selected_scheme_policy_context_snapshot si on si.refresh_run_id=a.refresh_run_id and si.sku_id=d.sku_id and si.region_code='IK'
join costing.sku_selected_scheme_policy_context_snapshot so on so.refresh_run_id=a.refresh_run_id and so.sku_id=d.sku_id and so.region_code='OK';
