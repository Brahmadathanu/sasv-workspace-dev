-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(
  p_period_start date,
  p_product_id bigint DEFAULT NULL::bigint,
  p_valuation_date date DEFAULT NULL::date,
  p_refresh_run_id bigint DEFAULT NULL::bigint
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
DECLARE
  v_period date := date_trunc('month', p_period_start)::date;
  v_result jsonb;
BEGIN
  PERFORM public.require_permission('module:material-cost-manager', false);
  PERFORM public.require_permission('role:material-cost-pm-trace', false);
  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'p_period_start is required';
  END IF;

  WITH selected_run AS (
    SELECT sr.period_start, sr.valuation_date, sr.refresh_run_id
    FROM costing.fn_resolve_material_trace_selected_run(
      p_period_start,
      p_valuation_date,
      p_refresh_run_id
    ) sr
  ),
  b AS (
    SELECT
      p.*,
      CASE WHEN p.is_override THEN 'PM_SKU_OVERRIDE' ELSE 'PM_BOM' END AS pm_source
    FROM costing.sku_pm_material_cost_line_snapshot p
    JOIN selected_run sr
      ON sr.period_start = p.period_start
     AND sr.valuation_date = p.valuation_date
     AND sr.refresh_run_id = p.refresh_run_id
  )
  SELECT jsonb_build_object(
    'period_start', v_period,
    'products', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object('product_id', x.product_id, 'product_name', x.product_name)
        ORDER BY x.product_name
      )
      FROM (SELECT DISTINCT product_id, product_name FROM b) x
    ), '[]'::jsonb),
    'skus', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sku_id', x.sku_id,
          'product_id', x.product_id,
          'sku_column_label', concat_ws(' ', trim(to_char(x.pack_size, 'FM999999999.########')), x.pack_uom)
        )
        ORDER BY x.product_id, x.pack_size, x.pack_uom, x.sku_id
      )
      FROM (
        SELECT DISTINCT sku_id, product_id, pack_size, pack_uom
        FROM b
        WHERE p_product_id IS NULL OR product_id = p_product_id
      ) x
    ), '[]'::jsonb),
    'bom_sources', jsonb_build_array('PM_BOM', 'PM_SKU_OVERRIDE'),
    'review_states', jsonb_build_array('READY', 'REVIEW_REQUIRED', 'BLOCKED'),
    'warning_statuses', jsonb_build_array(
      'HAS_WARNING',
      'STALE_PURCHASE_RATE',
      'STOCK_VALUATION_FALLBACK',
      'MANUAL_RATE_USED',
      'MISSING_MATERIAL_RATE',
      'NO_WARNING'
    ),
    'trace_component', 'PM',
    'valuation_date', (SELECT sr.valuation_date FROM selected_run sr),
    'refresh_run_id', (SELECT sr.refresh_run_id FROM selected_run sr),
    'snapshot_refreshed_at', (SELECT max(captured_at) FROM b)
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint, date, bigint) TO authenticated, postgres, service_role;