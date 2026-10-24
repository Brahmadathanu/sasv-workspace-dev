-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(
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
  v_result jsonb;
BEGIN
  PERFORM public.require_permission('module:material-cost-manager', false);
  PERFORM public.require_permission('role:material-cost-rm-trace', false);

  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'p_period_start is required';
  END IF;

  WITH selected_run AS (
    SELECT
      sr.period_start,
      sr.valuation_date,
      sr.refresh_run_id
    FROM costing.fn_resolve_material_trace_selected_run(
      p_period_start,
      p_valuation_date,
      p_refresh_run_id
    ) sr
  ),
  scoped AS (
    SELECT s.*
    FROM costing.cost_sheet_rm_line_traceability_snapshot s
    JOIN selected_run sr
      ON sr.period_start = s.period_start
     AND sr.valuation_date = s.valuation_date
     AND sr.refresh_run_id = s.refresh_run_id
  )
  SELECT jsonb_build_object(
    'period_start', p_period_start,
    'products', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'product_id', x.product_id,
          'product_name', x.product_name
        )
        ORDER BY x.product_name
      )
      FROM (
        SELECT DISTINCT s.product_id, s.product_name
        FROM scoped s
      ) x
    ), '[]'::jsonb),
    'skus', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sku_id', x.sku_id,
          'product_id', x.product_id,
          'sku_column_label', x.sku_column_label
        )
        ORDER BY x.product_id, x.sku_column_label, x.sku_id
      )
      FROM (
        SELECT DISTINCT s.sku_id, s.product_id, s.sku_column_label
        FROM scoped s
        WHERE p_product_id IS NULL OR s.product_id = p_product_id
      ) x
    ), '[]'::jsonb),
    'bom_sources', coalesce((
      SELECT jsonb_agg(x.bom_source ORDER BY x.bom_source)
      FROM (
        SELECT DISTINCT s.bom_source
        FROM scoped s
        WHERE s.bom_source IS NOT NULL
      ) x
    ), '[]'::jsonb),
    'review_states', coalesce((
      SELECT jsonb_agg(x.review_state_label ORDER BY x.review_state_label)
      FROM (
        SELECT DISTINCT s.review_state_label
        FROM scoped s
        WHERE s.review_state_label IS NOT NULL
      ) x
    ), '[]'::jsonb),
    'warning_statuses', jsonb_build_array(
      'HAS_WARNING',
      'RATE_WARNING',
      'CALCULATION_WARNING',
      'BLOCKED',
      'NO_WARNING'
    ),
    'trace_component', 'RM',
    'valuation_date', (SELECT sr.valuation_date FROM selected_run sr),
    'refresh_run_id', (SELECT sr.refresh_run_id FROM selected_run sr),
    'snapshot_refreshed_at', (
      SELECT max(s.snapshot_refreshed_at)
      FROM scoped s
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint, date, bigint) TO authenticated, postgres;