-- CI-037 ROLLBACK (prepared). Restores view, chain and table to the pre-CI-037 state. Apply only with approval.
begin;
do $do$
declare v_def text; v_hook text := E'\n        perform costing.fn_ci037_fill_pricing_bridge_profit(p_refresh_run_id);';
begin
  v_def := pg_get_functiondef('costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)'::regprocedure);
  if position(v_hook in v_def) > 0 then execute replace(v_def, v_hook, ''); end if;
end $do$;
-- View must go back before columns are dropped (CREATE OR REPLACE cannot remove columns).
drop view costing.v_price_revision_current_approved_master;
create view costing.v_price_revision_current_approved_master as
WITH approved_run AS (
         SELECT r.refresh_run_id,
            r.period_start,
            r.valuation_date
           FROM costing.v_current_successful_costing_refresh_run r
             JOIN costing.v_costing_run_effective_designation e ON e.refresh_run_id = r.refresh_run_id AND e.designation = 'APPROVED'::text
          WHERE r.selection_basis = 'APPROVED'::text
          ORDER BY r.period_start DESC, r.valuation_date DESC, r.refresh_run_id DESC
         LIMIT 1
        )
 SELECT a.refresh_run_id,
    a.period_start,
    a.valuation_date,
    d.sku_id,
    d.product_id,
    p.item,
    d.pack_size,
    d.pack_uom,
    pg.id AS product_group_id,
    pg.group_name AS product_group,
    sg.id AS product_subgroup_id,
    sg.sub_group_name AS product_subgroup,
    c.rm_cost_per_sku,
    c.pm_cost_per_sku,
    d.material_cost_per_sku,
    d.direct_labour_cost_per_sku,
    d.internal_material_conversion_cost_per_sku,
    d.prime_cost_per_sku,
    d.production_overhead_cost_per_sku,
    d.quality_control_overhead_cost_per_sku,
    d.materials_stores_overhead_cost_per_sku,
    d.manufacturing_cop_per_sku,
    d.admin_overhead_cost_per_sku,
    d.finance_admin_overhead_cost_per_sku,
    d.internal_loaded_cost_per_sku,
    pb.marketing_expense_cost_per_sku_ik,
    pb.marketing_expense_cost_per_sku_ok,
    pb.pricing_cost_per_sku_ik,
    pb.pricing_cost_per_sku_ok,
    d.mrp_ik,
    d.mrp_ok,
    d.gst_percent,
    d.ik_basic_price,
    d.ok_basic_price,
    d.ik_discount_percent,
    d.ok_discount_percent,
    d.ik_discount_amount,
    d.ok_discount_amount,
    d.ik_selling_price,
    d.ok_selling_price,
    d.contingency_percent,
    d.ik_contingency_value,
    d.ok_contingency_value,
    si.scheme_id AS ik_scheme_id,
    si.scheme_name AS ik_scheme_name,
    si.paid_qty AS ik_scheme_paid_qty,
    si.free_qty AS ik_scheme_free_qty,
    so.scheme_id AS ok_scheme_id,
    so.scheme_name AS ok_scheme_name,
    so.paid_qty AS ok_scheme_paid_qty,
    so.free_qty AS ok_scheme_free_qty,
    d.ik_margin_amount_before_scheme,
    d.ik_margin_percent_before_scheme,
    d.ok_margin_amount_before_scheme,
    d.ok_margin_percent_before_scheme,
    d.cost_sheet_status,
    d.refreshed_at,
    cat.id AS product_category_id,
    cat.category_name AS product_category,
    subcat.id AS product_subcategory_id,
    subcat.subcategory_name AS product_subcategory,
    sku.price_list_ik,
    sku.price_list_ok,
    to_char((d.refreshed_at AT TIME ZONE 'Asia/Kolkata'::text), 'DD Mon YYYY, FMHH12:MI AM'::text) || ' IST'::text AS refreshed_at_ist
   FROM approved_run a
     JOIN costing.v_sku_detailed_cost_sheet d ON d.refresh_run_id = a.refresh_run_id AND d.period_start = a.period_start AND d.valuation_date = a.valuation_date
     JOIN costing.sku_manufacturing_cop_snapshot c ON c.refresh_run_id = a.refresh_run_id AND c.sku_id = d.sku_id
     JOIN costing.sku_pricing_bridge_snapshot pb ON pb.refresh_run_id = a.refresh_run_id AND pb.sku_id = d.sku_id
     JOIN products p ON p.id = d.product_id
     JOIN product_skus sku ON sku.id = d.sku_id AND sku.product_id = d.product_id
     JOIN sub_groups sg ON sg.id = p.sub_group_id
     JOIN product_groups pg ON pg.id = sg.product_group_id
     LEFT JOIN sub_categories subcat ON subcat.id = pg.sub_category_id
     LEFT JOIN categories cat ON cat.id = subcat.category_id
     JOIN costing.sku_selected_scheme_policy_context_snapshot si ON si.refresh_run_id = a.refresh_run_id AND si.sku_id = d.sku_id AND si.region_code = 'IK'::text
     JOIN costing.sku_selected_scheme_policy_context_snapshot so ON so.refresh_run_id = a.refresh_run_id AND so.sku_id = d.sku_id AND so.region_code = 'OK'::text;
-- Re-apply the live ACL captured before apply (expected postgres-only; record relacl in pre-check and restore grants here if different).
revoke all on costing.v_price_revision_current_approved_master from public, anon, authenticated;
drop function if exists costing.fn_ci037_fill_pricing_bridge_profit(bigint);
alter table costing.sku_pricing_bridge_snapshot
  drop column if exists ik_scheme_paid_qty,
  drop column if exists ik_scheme_free_qty,
  drop column if exists ik_scheme_effective_selling_price,
  drop column if exists ik_net_sales_realization_per_sku,
  drop column if exists ik_estimated_profit_per_sku,
  drop column if exists ik_estimated_profit_on_mrp_percent,
  drop column if exists ik_estimated_profit_on_selling_price_percent,
  drop column if exists ik_estimated_profit_on_realization_percent,
  drop column if exists ik_profit_calculation_status,
  drop column if exists ok_scheme_paid_qty,
  drop column if exists ok_scheme_free_qty,
  drop column if exists ok_scheme_effective_selling_price,
  drop column if exists ok_net_sales_realization_per_sku,
  drop column if exists ok_estimated_profit_per_sku,
  drop column if exists ok_estimated_profit_on_mrp_percent,
  drop column if exists ok_estimated_profit_on_selling_price_percent,
  drop column if exists ok_estimated_profit_on_realization_percent,
  drop column if exists ok_profit_calculation_status,
  drop column if exists profit_calculation_basis;
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_amount_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_amount_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ik_margin_percent_before_scheme is null;
comment on column costing.sku_pricing_bridge_snapshot.ok_margin_percent_before_scheme is null;
commit;
