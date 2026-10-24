-- read-only: CI-037 dry-run outputs for every SKU/region of run 143 (same formulas as fn_ci037_fill_pricing_bridge_profit)
select json_agg(t) from (
select pb.sku_id, rg.r,
  case rg.r when 'IK' then pb.mrp_ik else pb.mrp_ok end mrp, sp.gst_percent gst,
  case rg.r when 'IK' then sp.ik_discount_percent else sp.ok_discount_percent end disc,
  sp.contingency_percent cpct, s.paid_qty pq, s.free_qty fq,
  case rg.r when 'IK' then pb.marketing_expense_cost_per_sku_ik else pb.marketing_expense_cost_per_sku_ok end mkt,
  pb.internal_loaded_cost_per_sku ilc,
  case rg.r when 'IK' then sp.ik_basic_price else sp.ok_basic_price end basic,
  case rg.r when 'IK' then sp.ik_selling_price else sp.ok_selling_price end sell,
  case rg.r when 'IK' then sp.ik_contingency_value else sp.ok_contingency_value end cont,
  case rg.r when 'IK' then ps.price_list_ik else ps.price_list_ok end in_pl
from costing.sku_pricing_bridge_snapshot pb
cross join (values ('IK'),('OK')) rg(r)
join costing.sku_selling_price_bridge_snapshot sp on sp.pricing_bridge_snapshot_id=pb.id and sp.refresh_run_id=pb.refresh_run_id
join costing.sku_selected_scheme_policy_context_snapshot s on s.refresh_run_id=pb.refresh_run_id and s.sku_id=pb.sku_id and s.region_code=rg.r
join public.product_skus ps on ps.id=pb.sku_id
where pb.refresh_run_id=143) t
