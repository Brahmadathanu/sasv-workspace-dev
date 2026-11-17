-- CANDIDATE ONLY - NOT APPLIED - NOT A MIGRATION - NOT FOR PRODUCTION (WP12 keyset-first Cost Comparison, offline, 17 Nov 2026).
-- Lives under scripts/ on purpose: no tooling applies it. It is installed ONLY into the throwaway local PostgreSQL fixture
-- cluster of scripts/csr-comparison-verifier/. A NEW function name is used so the installed
-- rpc_get_cost_sheet_sku_monthly_comparison_scoped is untouched; rollback of any future apply is DROP FUNCTION of this name only.
-- Contract preserved: same signature/RETURNS SETOF governed view (63 columns, types, order), same guards, SECURITY DEFINER,
-- search_path = pg_catalog, pg_temp, same run join, same GROUP BY, same ORDER BY (product_name, sku_column_label, sku_id), same LIMIT.
-- Shape: (1) pivot ONLY the requested period; (2) keep the first p_limit current groups in final sort order (cur_keys, MATERIALIZED);
-- (3) pivot the previous-month / previous-year periods ONLY for sku_id IN (those keys); (4) LEFT JOIN as before; final ORDER/LIMIT.
-- Why bag semantics are preserved: every current group yields >= 1 output row (LEFT JOIN) and all fan-out rows of one current group
-- share its sort keys, so the first p_limit output rows are always drawn from the first p_limit current groups. Historical groups of
-- a keyed sku_id are pivoted whole (name-change duplicates fan out exactly as before). NULL sku_id never joins history in either shape.
-- Boundary caveat (identical to the installed function): rows tied on (product_name, sku_column_label, sku_id) at exactly the LIMIT
-- boundary may be chosen differently by any plan; parity tests therefore do not assert strict equality for cuts inside a tie group.
-- No performance claim: planner/synthetic-fixture evidence only; production speed is UNPROVEN.
CREATE FUNCTION public.rpc_get_cost_sheet_sku_monthly_comparison_scoped_keyset_v1(
    p_period_start date,
    p_limit integer DEFAULT 2000
)
RETURNS SETOF costing.v_cost_sheet_snapshot_sku_monthly_comparison_governed
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $csr$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM public.require_permission('module:costing-control-center', false);
  IF p_period_start IS NULL OR p_period_start <> date_trunc('month', p_period_start::timestamp)::date THEN
    RAISE EXCEPTION 'Period must be first day of month';
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 2000 THEN
    RAISE EXCEPTION 'Invalid limit';
  END IF;

  RETURN QUERY
WITH cur_pivot AS (
         SELECT cost_sheet_line_monthly_snapshot.snapshot_period_start,
            cost_sheet_line_monthly_snapshot.product_id,
            cost_sheet_line_monthly_snapshot.product_name,
            cost_sheet_line_monthly_snapshot.category_name,
            cost_sheet_line_monthly_snapshot.subcategory_name,
            cost_sheet_line_monthly_snapshot.group_name,
            cost_sheet_line_monthly_snapshot.sub_group_name,
            cost_sheet_line_monthly_snapshot.sku_id,
            cost_sheet_line_monthly_snapshot.sku_column_label,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Raw Material Cost (RM)'::text)) AS rm_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Packing & Labelling Material Cost (PM)'::text)) AS pm_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Total Material Cost'::text)) AS total_material_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Direct Labour (DL)'::text)) AS direct_labour_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Manufacturing COP'::text)) AS manufacturing_cop,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Internal Loaded Cost'::text)) AS internal_loaded_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'MRP: Inside Kerala (MRP IK)'::text)) AS mrp_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'MRP: Outside Kerala (MRP OK)'::text)) AS mrp_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Selling Price: IK'::text)) AS selling_price_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Selling Price: OK'::text)) AS selling_price_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Sales Realisation: IK'::text)) AS sales_realisation_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Sales Realisation: OK'::text)) AS sales_realisation_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit Value: IK'::text)) AS profit_value_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit Value: OK'::text)) AS profit_value_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit on Sales Realisation: IK (%)'::text)) AS profit_percent_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit on Sales Realisation: OK (%)'::text)) AS profit_percent_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'COP Percentage on MRP IK'::text)) AS cop_percent_mrp_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'COP Percentage on MRP OK'::text)) AS cop_percent_mrp_ok,
            max(cost_sheet_line_monthly_snapshot.value_text) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Cost Sheet Status'::text)) AS cost_sheet_status,
            max(cost_sheet_line_monthly_snapshot.value_text) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Cost Sheet Note'::text)) AS cost_sheet_note,
            max(cost_sheet_line_monthly_snapshot.snapshot_refreshed_at) AS snapshot_refreshed_at,
            gr.refresh_run_id AS snapshot_refresh_run_id,
            gr.selection_basis AS snapshot_selection_basis
           FROM ((SELECT *
                    FROM costing.cost_sheet_line_monthly_snapshot
                    WHERE snapshot_period_start = p_period_start) cost_sheet_line_monthly_snapshot
             JOIN costing.v_current_successful_costing_refresh_run gr ON (((gr.refresh_run_id = cost_sheet_line_monthly_snapshot.refresh_run_id) AND (gr.period_start = cost_sheet_line_monthly_snapshot.snapshot_period_start))))
          GROUP BY gr.refresh_run_id, gr.selection_basis, cost_sheet_line_monthly_snapshot.snapshot_period_start, cost_sheet_line_monthly_snapshot.product_id, cost_sheet_line_monthly_snapshot.product_name, cost_sheet_line_monthly_snapshot.category_name, cost_sheet_line_monthly_snapshot.subcategory_name, cost_sheet_line_monthly_snapshot.group_name, cost_sheet_line_monthly_snapshot.sub_group_name, cost_sheet_line_monthly_snapshot.sku_id, cost_sheet_line_monthly_snapshot.sku_column_label
        ), cur_keys AS MATERIALIZED (
         SELECT *
           FROM cur_pivot
          ORDER BY product_name, sku_column_label, sku_id
          LIMIT p_limit
        ), hist_pivot AS (
         SELECT cost_sheet_line_monthly_snapshot.snapshot_period_start,
            cost_sheet_line_monthly_snapshot.product_id,
            cost_sheet_line_monthly_snapshot.product_name,
            cost_sheet_line_monthly_snapshot.category_name,
            cost_sheet_line_monthly_snapshot.subcategory_name,
            cost_sheet_line_monthly_snapshot.group_name,
            cost_sheet_line_monthly_snapshot.sub_group_name,
            cost_sheet_line_monthly_snapshot.sku_id,
            cost_sheet_line_monthly_snapshot.sku_column_label,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Raw Material Cost (RM)'::text)) AS rm_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Packing & Labelling Material Cost (PM)'::text)) AS pm_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Total Material Cost'::text)) AS total_material_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Direct Labour (DL)'::text)) AS direct_labour_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Manufacturing COP'::text)) AS manufacturing_cop,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Internal Loaded Cost'::text)) AS internal_loaded_cost,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'MRP: Inside Kerala (MRP IK)'::text)) AS mrp_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'MRP: Outside Kerala (MRP OK)'::text)) AS mrp_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Selling Price: IK'::text)) AS selling_price_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Selling Price: OK'::text)) AS selling_price_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Sales Realisation: IK'::text)) AS sales_realisation_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Sales Realisation: OK'::text)) AS sales_realisation_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit Value: IK'::text)) AS profit_value_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit Value: OK'::text)) AS profit_value_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit on Sales Realisation: IK (%)'::text)) AS profit_percent_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Profit on Sales Realisation: OK (%)'::text)) AS profit_percent_ok,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'COP Percentage on MRP IK'::text)) AS cop_percent_mrp_ik,
            max(cost_sheet_line_monthly_snapshot.value_numeric) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'COP Percentage on MRP OK'::text)) AS cop_percent_mrp_ok,
            max(cost_sheet_line_monthly_snapshot.value_text) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Cost Sheet Status'::text)) AS cost_sheet_status,
            max(cost_sheet_line_monthly_snapshot.value_text) FILTER (WHERE (cost_sheet_line_monthly_snapshot.line_label = 'Cost Sheet Note'::text)) AS cost_sheet_note,
            max(cost_sheet_line_monthly_snapshot.snapshot_refreshed_at) AS snapshot_refreshed_at,
            gr.refresh_run_id AS snapshot_refresh_run_id,
            gr.selection_basis AS snapshot_selection_basis
           FROM ((SELECT *
                    FROM costing.cost_sheet_line_monthly_snapshot
                    WHERE snapshot_period_start IN (
                      (p_period_start - INTERVAL '1 month')::date,
                      (p_period_start - INTERVAL '1 year')::date
                    )
                    AND sku_id IN (SELECT k.sku_id FROM cur_keys k)) cost_sheet_line_monthly_snapshot
             JOIN costing.v_current_successful_costing_refresh_run gr ON (((gr.refresh_run_id = cost_sheet_line_monthly_snapshot.refresh_run_id) AND (gr.period_start = cost_sheet_line_monthly_snapshot.snapshot_period_start))))
          GROUP BY gr.refresh_run_id, gr.selection_basis, cost_sheet_line_monthly_snapshot.snapshot_period_start, cost_sheet_line_monthly_snapshot.product_id, cost_sheet_line_monthly_snapshot.product_name, cost_sheet_line_monthly_snapshot.category_name, cost_sheet_line_monthly_snapshot.subcategory_name, cost_sheet_line_monthly_snapshot.group_name, cost_sheet_line_monthly_snapshot.sub_group_name, cost_sheet_line_monthly_snapshot.sku_id, cost_sheet_line_monthly_snapshot.sku_column_label
        ), comparison AS (
         SELECT cur.snapshot_period_start,
            cur.product_id,
            cur.product_name,
            cur.category_name,
            cur.subcategory_name,
            cur.group_name,
            cur.sub_group_name,
            cur.sku_id,
            cur.sku_column_label,
            cur.rm_cost,
            cur.pm_cost,
            cur.total_material_cost,
            cur.direct_labour_cost,
            cur.manufacturing_cop,
            cur.internal_loaded_cost,
            cur.mrp_ik,
            cur.mrp_ok,
            cur.selling_price_ik,
            cur.selling_price_ok,
            cur.sales_realisation_ik,
            cur.sales_realisation_ok,
            cur.profit_value_ik,
            cur.profit_value_ok,
            cur.profit_percent_ik,
            cur.profit_percent_ok,
            cur.cop_percent_mrp_ik,
            cur.cop_percent_mrp_ok,
            cur.cost_sheet_status,
            cur.cost_sheet_note,
            cur.snapshot_refreshed_at,
            prev.snapshot_period_start AS previous_month_period_start,
            prev.manufacturing_cop AS previous_month_manufacturing_cop,
            prev.internal_loaded_cost AS previous_month_internal_loaded_cost,
            prev.selling_price_ik AS previous_month_selling_price_ik,
            prev.selling_price_ok AS previous_month_selling_price_ok,
            prev.profit_value_ik AS previous_month_profit_value_ik,
            prev.profit_value_ok AS previous_month_profit_value_ok,
            yoy.snapshot_period_start AS previous_year_period_start,
            yoy.manufacturing_cop AS previous_year_manufacturing_cop,
            yoy.internal_loaded_cost AS previous_year_internal_loaded_cost,
            yoy.selling_price_ik AS previous_year_selling_price_ik,
            yoy.selling_price_ok AS previous_year_selling_price_ok,
            yoy.profit_value_ik AS previous_year_profit_value_ik,
            yoy.profit_value_ok AS previous_year_profit_value_ok,
            cur.snapshot_refresh_run_id,
            cur.snapshot_selection_basis,
            prev.snapshot_refresh_run_id AS previous_month_refresh_run_id,
            prev.snapshot_selection_basis AS previous_month_selection_basis,
            yoy.snapshot_refresh_run_id AS previous_year_refresh_run_id,
            yoy.snapshot_selection_basis AS previous_year_selection_basis
           FROM ((cur_keys cur
             LEFT JOIN hist_pivot prev ON (((prev.sku_id = cur.sku_id) AND (prev.snapshot_period_start = ((cur.snapshot_period_start - '1 mon'::interval))::date))))
             LEFT JOIN hist_pivot yoy ON (((yoy.sku_id = cur.sku_id) AND (yoy.snapshot_period_start = ((cur.snapshot_period_start - '1 year'::interval))::date))))
        )
 SELECT snapshot_period_start,
    product_id,
    product_name,
    category_name,
    subcategory_name,
    group_name,
    sub_group_name,
    sku_id,
    sku_column_label,
    rm_cost,
    pm_cost,
    total_material_cost,
    direct_labour_cost,
    manufacturing_cop,
    internal_loaded_cost,
    mrp_ik,
    mrp_ok,
    selling_price_ik,
    selling_price_ok,
    sales_realisation_ik,
    sales_realisation_ok,
    profit_value_ik,
    profit_value_ok,
    profit_percent_ik,
    profit_percent_ok,
    cop_percent_mrp_ik,
    cop_percent_mrp_ok,
    cost_sheet_status,
    cost_sheet_note,
    snapshot_refreshed_at,
    previous_month_period_start,
    previous_month_manufacturing_cop,
    previous_month_internal_loaded_cost,
    previous_month_selling_price_ik,
    previous_month_selling_price_ok,
    previous_month_profit_value_ik,
    previous_month_profit_value_ok,
    previous_year_period_start,
    previous_year_manufacturing_cop,
    previous_year_internal_loaded_cost,
    previous_year_selling_price_ik,
    previous_year_selling_price_ok,
    previous_year_profit_value_ik,
    previous_year_profit_value_ok,
    (manufacturing_cop - previous_month_manufacturing_cop) AS manufacturing_cop_mom_change,
        CASE
            WHEN ((previous_month_manufacturing_cop IS NULL) OR (previous_month_manufacturing_cop = (0)::numeric)) THEN NULL::numeric
            ELSE (((manufacturing_cop - previous_month_manufacturing_cop) / previous_month_manufacturing_cop) * (100)::numeric)
        END AS manufacturing_cop_mom_change_percent,
    (internal_loaded_cost - previous_month_internal_loaded_cost) AS internal_loaded_cost_mom_change,
        CASE
            WHEN ((previous_month_internal_loaded_cost IS NULL) OR (previous_month_internal_loaded_cost = (0)::numeric)) THEN NULL::numeric
            ELSE (((internal_loaded_cost - previous_month_internal_loaded_cost) / previous_month_internal_loaded_cost) * (100)::numeric)
        END AS internal_loaded_cost_mom_change_percent,
    (profit_value_ik - previous_month_profit_value_ik) AS profit_value_ik_mom_change,
    (profit_value_ok - previous_month_profit_value_ok) AS profit_value_ok_mom_change,
    (manufacturing_cop - previous_year_manufacturing_cop) AS manufacturing_cop_yoy_change,
        CASE
            WHEN ((previous_year_manufacturing_cop IS NULL) OR (previous_year_manufacturing_cop = (0)::numeric)) THEN NULL::numeric
            ELSE (((manufacturing_cop - previous_year_manufacturing_cop) / previous_year_manufacturing_cop) * (100)::numeric)
        END AS manufacturing_cop_yoy_change_percent,
    (internal_loaded_cost - previous_year_internal_loaded_cost) AS internal_loaded_cost_yoy_change,
        CASE
            WHEN ((previous_year_internal_loaded_cost IS NULL) OR (previous_year_internal_loaded_cost = (0)::numeric)) THEN NULL::numeric
            ELSE (((internal_loaded_cost - previous_year_internal_loaded_cost) / previous_year_internal_loaded_cost) * (100)::numeric)
        END AS internal_loaded_cost_yoy_change_percent,
    (profit_value_ik - previous_year_profit_value_ik) AS profit_value_ik_yoy_change,
    (profit_value_ok - previous_year_profit_value_ok) AS profit_value_ok_yoy_change,
    snapshot_refresh_run_id,
    snapshot_selection_basis,
    CASE snapshot_selection_basis WHEN 'APPROVED'::text THEN ('Approved run '::text || snapshot_refresh_run_id) ELSE (('DRAFT run '::text || snapshot_refresh_run_id) || ' - not approved'::text) END AS snapshot_run_label,
    previous_month_refresh_run_id,
    previous_month_selection_basis,
    previous_year_refresh_run_id,
    previous_year_selection_basis
   FROM comparison
   ORDER BY product_name, sku_column_label, sku_id
   LIMIT p_limit;
END;
$csr$;
