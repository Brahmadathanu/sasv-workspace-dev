-- backfilled from live schema_migrations on 2026-10-24, CI-016
DROP VIEW costing.v_price_revision_current_approved_master;
CREATE VIEW costing.v_price_revision_current_approved_master AS
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
    p.item AS item,
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
    subcat.subcategory_name AS product_subcategory
   FROM approved_run a
     JOIN costing.v_sku_detailed_cost_sheet d ON d.refresh_run_id = a.refresh_run_id AND d.period_start = a.period_start AND d.valuation_date = a.valuation_date
     JOIN costing.sku_manufacturing_cop_snapshot c ON c.refresh_run_id = a.refresh_run_id AND c.sku_id = d.sku_id
     JOIN costing.sku_pricing_bridge_snapshot pb ON pb.refresh_run_id = a.refresh_run_id AND pb.sku_id = d.sku_id
     JOIN products p ON p.id = d.product_id
     JOIN sub_groups sg ON sg.id = p.sub_group_id
     JOIN product_groups pg ON pg.id = sg.product_group_id
     LEFT JOIN sub_categories subcat ON subcat.id = pg.sub_category_id
     LEFT JOIN categories cat ON cat.id = subcat.category_id
     JOIN costing.sku_selected_scheme_policy_context_snapshot si ON si.refresh_run_id = a.refresh_run_id AND si.sku_id = d.sku_id AND si.region_code = 'IK'::text
     JOIN costing.sku_selected_scheme_policy_context_snapshot so ON so.refresh_run_id = a.refresh_run_id AND so.sku_id = d.sku_id AND so.region_code = 'OK'::text;

-- Canonical finance-facing documentation attached to derived columns of the price-revision master.
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.material_cost_per_sku IS 'Material Cost = RM Cost + PM Cost; approved per-SKU values.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.internal_material_conversion_cost_per_sku IS 'Additional conversion expenses of approved internally manufactured source materials: upstream direct labour, production overhead, QC overhead and incremental stores overhead (including recursive earlier stages), scaled by BOM consumption per finished SKU. Zero if no eligible source lineage. Source-material RM value is already in RM Cost.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.prime_cost_per_sku IS 'Prime Cost = Material Cost + Direct Labour + Internal Material Conversion Cost.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.manufacturing_cop_per_sku IS 'Manufacturing COP = Prime Cost + Production Overhead + QC Overhead + Materials/Stores Overhead.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.internal_loaded_cost_per_sku IS 'Internal Loaded Cost = Manufacturing COP + Administration Overhead + Finance Administration Overhead.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.pricing_cost_per_sku_ik IS 'IK Pricing Cost = Internal Loaded Cost + canonical IK Marketing Expense.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.pricing_cost_per_sku_ok IS 'OK Pricing Cost = Internal Loaded Cost + canonical OK Marketing Expense.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ik_basic_price IS 'IK Basic Price = IK MRP / (1 + GST % / 100).';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ok_basic_price IS 'OK Basic Price = OK MRP / (1 + GST % / 100).';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ik_discount_amount IS 'IK Discount Amount = governed IK discount adjustment from approved selling-price policy.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ok_discount_amount IS 'OK Discount Amount = governed OK discount adjustment from approved selling-price policy.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ik_selling_price IS 'IK Selling Price = IK Basic Price - IK Discount Amount (before scheme/contingency).';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ok_selling_price IS 'OK Selling Price = OK Basic Price - OK Discount Amount (before scheme/contingency).';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ik_contingency_value IS 'IK Contingency Value = IK Basic Price × Contingency % / 100 under frozen pricing snapshot.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ok_contingency_value IS 'OK Contingency Value = OK Basic Price × Contingency % / 100 under frozen pricing snapshot.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ik_margin_amount_before_scheme IS 'IK Margin Before Scheme = IK MRP - IK Pricing Cost (approved pre-scheme pricing bridge; not net-realisation profit).';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ik_margin_percent_before_scheme IS 'IK Margin Before Scheme % = 100 × IK Margin Before Scheme / IK MRP. Not equivalent to proposed after-scheme Profit on MRP.';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ok_margin_amount_before_scheme IS 'OK Margin Before Scheme = OK MRP - OK Pricing Cost (approved pre-scheme pricing bridge; not net-realisation profit).';
COMMENT ON COLUMN costing.v_price_revision_current_approved_master.ok_margin_percent_before_scheme IS 'OK Margin Before Scheme % = 100 × OK Margin Before Scheme / OK MRP. Not equivalent to proposed after-scheme Profit on MRP.';
