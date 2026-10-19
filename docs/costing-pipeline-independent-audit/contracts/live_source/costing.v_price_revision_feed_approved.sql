 WITH appr AS (
         SELECT r.period_start,
            r.refresh_run_id,
            r.valuation_date,
            e.designated_at,
            e.designated_by,
            e.designation_id
           FROM (costing.v_current_successful_costing_refresh_run r
             JOIN costing.v_costing_run_effective_designation e ON (((e.refresh_run_id = r.refresh_run_id) AND (e.designation = 'APPROVED'::text))))
          WHERE (r.selection_basis = 'APPROVED'::text)
        )
 SELECT a.period_start,
    a.valuation_date,
    a.refresh_run_id,
    ('Approved run '::text || a.refresh_run_id) AS run_label,
    a.designated_at AS approved_at,
    a.designated_by AS approved_by,
    a.designation_id,
    (a.period_start = max(a.period_start) OVER ()) AS is_latest_approved_period,
    d.sku_id,
    d.product_id,
    d.product_name,
    d.pack_size,
    d.pack_uom,
    d.mrp_ik,
    d.mrp_ok,
    d.material_cost_per_sku,
    d.direct_labour_cost_per_sku,
    d.manufacturing_cop_per_sku,
    d.internal_loaded_cost_per_sku,
    d.pricing_cost_per_sku,
    d.ik_selling_price,
    d.ok_selling_price,
    d.ik_margin_amount_before_scheme,
    d.ik_margin_percent_before_scheme,
    d.ok_margin_amount_before_scheme,
    d.ok_margin_percent_before_scheme,
    (d.ik_margin_amount_before_scheme < (0)::numeric) AS ik_negative_margin,
    (d.ok_margin_amount_before_scheme < (0)::numeric) AS ok_negative_margin,
    d.cost_sheet_status,
    d.refreshed_at
   FROM (appr a
     JOIN costing.v_sku_detailed_cost_sheet d ON (((d.refresh_run_id = a.refresh_run_id) AND (d.period_start = a.period_start) AND (d.valuation_date = a.valuation_date))));