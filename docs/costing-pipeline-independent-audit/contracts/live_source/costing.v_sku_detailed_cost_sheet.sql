 SELECT pb.period_start,
    pb.sku_id,
    pb.product_id,
    pb.product_name,
    pb.pack_size,
    pb.pack_uom,
    pb.mrp_ik,
    pb.mrp_ok,
    ilc.material_cost_per_sku,
    ilc.direct_labour_cost_per_sku,
    ilc.prime_cost_per_sku,
    ilc.production_overhead_cost_per_sku,
    ilc.quality_control_overhead_cost_per_sku,
    ilc.materials_stores_overhead_cost_per_sku,
    ilc.manufacturing_cop_per_sku,
    ilc.admin_overhead_cost_per_sku,
    ilc.finance_admin_overhead_cost_per_sku,
    ilc.internal_loaded_cost_per_sku,
    pb.marketing_expense_cost_per_sku,
    pb.pricing_cost_per_sku,
    sp.gst_percent,
    sp.ik_basic_price,
    sp.ok_basic_price,
    sp.ik_discount_percent,
    sp.ok_discount_percent,
    sp.ik_discount_amount,
    sp.ok_discount_amount,
    sp.ik_selling_price,
    sp.ok_selling_price,
    sp.contingency_percent,
    sp.ik_contingency_value,
    sp.ok_contingency_value,
    pb.ik_margin_amount_before_scheme,
    pb.ik_margin_percent_before_scheme,
    pb.ok_margin_amount_before_scheme,
    pb.ok_margin_percent_before_scheme,
    ilc.internal_loaded_cost_status,
    pb.pricing_bridge_status,
    sp.selling_price_bridge_status,
        CASE
            WHEN ((ilc.internal_loaded_cost_status = 'BLOCKED'::text) OR (pb.pricing_bridge_status = 'BLOCKED'::text) OR (sp.selling_price_bridge_status = 'BLOCKED'::text)) THEN 'BLOCKED'::text
            WHEN ((ilc.internal_loaded_cost_status = 'REVIEW_REQUIRED'::text) OR (pb.pricing_bridge_status = 'REVIEW_REQUIRED'::text) OR (sp.selling_price_bridge_status = 'REVIEW_REQUIRED'::text)) THEN 'REVIEW_REQUIRED'::text
            WHEN ((ilc.internal_loaded_cost_status = 'READY'::text) AND (pb.pricing_bridge_status = 'READY'::text) AND (sp.selling_price_bridge_status = 'READY'::text)) THEN 'READY'::text
            ELSE 'BLOCKED'::text
        END AS cost_sheet_status,
        CASE
            WHEN (ilc.internal_loaded_cost_status = 'BLOCKED'::text) THEN COALESCE(ilc.internal_loaded_cost_note, 'Internal loaded cost is blocked.'::text)
            WHEN (pb.pricing_bridge_status = 'BLOCKED'::text) THEN COALESCE(pb.pricing_bridge_note, 'Pricing Bridge is blocked.'::text)
            WHEN (sp.selling_price_bridge_status = 'BLOCKED'::text) THEN COALESCE(sp.selling_price_bridge_note, 'Selling Price Bridge is blocked.'::text)
            WHEN (ilc.internal_loaded_cost_status = 'REVIEW_REQUIRED'::text) THEN COALESCE(ilc.internal_loaded_cost_note, 'Internal loaded cost requires review.'::text)
            WHEN (pb.pricing_bridge_status = 'REVIEW_REQUIRED'::text) THEN COALESCE(pb.pricing_bridge_note, 'Pricing Bridge requires review.'::text)
            WHEN (sp.selling_price_bridge_status = 'REVIEW_REQUIRED'::text) THEN COALESCE(sp.selling_price_bridge_note, 'Selling Price Bridge requires review.'::text)
            WHEN ((ilc.internal_loaded_cost_status = 'READY'::text) AND (pb.pricing_bridge_status = 'READY'::text) AND (sp.selling_price_bridge_status = 'READY'::text)) THEN 'Cost sheet is ready.'::text
            ELSE 'Cost sheet is blocked because one or more exact-tuple source rows or statuses are missing.'::text
        END AS cost_sheet_note,
    GREATEST(COALESCE(ilc.refreshed_at, '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(pb.refreshed_at, '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE(sp.refreshed_at, '1970-01-01 00:00:00+00'::timestamp with time zone)) AS refreshed_at,
    pb.valuation_date,
    pb.refresh_run_id,
    ic.internal_conversion_cost_per_sku AS internal_material_conversion_cost_per_sku
   FROM (((costing.sku_pricing_bridge_snapshot pb
     LEFT JOIN costing.sku_internal_loaded_cost_snapshot ilc ON (((ilc.period_start = pb.period_start) AND (ilc.valuation_date = pb.valuation_date) AND (ilc.refresh_run_id = pb.refresh_run_id) AND (ilc.sku_id = pb.sku_id))))
     LEFT JOIN costing.sku_selling_price_bridge_snapshot sp ON (((sp.period_start = pb.period_start) AND (sp.valuation_date = pb.valuation_date) AND (sp.refresh_run_id = pb.refresh_run_id) AND (sp.sku_id = pb.sku_id))))
     LEFT JOIN costing.sku_internal_material_conversion_snapshot ic ON (((ic.period_start = pb.period_start) AND (ic.valuation_date = pb.valuation_date) AND (ic.refresh_run_id = pb.refresh_run_id) AND (ic.sku_id = pb.sku_id))));