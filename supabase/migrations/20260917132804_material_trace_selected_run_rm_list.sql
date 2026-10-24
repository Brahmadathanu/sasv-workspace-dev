-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE FUNCTION public.rpc_get_material_rate_rm_cost_trace(
  p_period_start date,
  p_product_id bigint DEFAULT NULL::bigint,
  p_sku_id bigint DEFAULT NULL::bigint,
  p_stock_item_id bigint DEFAULT NULL::bigint,
  p_review_state text DEFAULT NULL::text,
  p_bom_source text DEFAULT NULL::text,
  p_warning_status text DEFAULT NULL::text,
  p_has_semi_process boolean DEFAULT NULL::boolean,
  p_search_text text DEFAULT NULL::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_valuation_date date DEFAULT NULL::date,
  p_refresh_run_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
  period_start date,
  product_id bigint,
  product_name text,
  sku_id bigint,
  sku_column_label text,
  stock_item_id bigint,
  stock_item_code text,
  stock_item_name text,
  sku_quantity numeric,
  quantity_uom text,
  selected_rate numeric,
  rate_source text,
  rate_date date,
  rm_line_cost numeric,
  contribution_share_percent numeric,
  warning_code text,
  warning_text text,
  action_required text,
  approval_block_flag boolean,
  calculation_warning_flag boolean,
  calculation_warning_code text,
  review_state text,
  semi_process_source text,
  expansion_note text,
  trace_component text,
  drill_route_module_key text,
  drill_route_lens_id text,
  drill_filter_json jsonb,
  snapshot_refreshed_at timestamp with time zone,
  total_row_count bigint,
  valuation_date date,
  refresh_run_id bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
DECLARE
  v_limit integer;
  v_offset integer;
  v_search_text text;
  v_warning_status text;
BEGIN
  PERFORM public.require_permission('module:material-cost-manager', false);
  PERFORM public.require_permission('role:material-cost-rm-trace', false);

  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'p_period_start is required';
  END IF;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  v_search_text := nullif(btrim(p_search_text), '');
  v_warning_status := upper(nullif(btrim(p_warning_status), ''));

  IF v_warning_status IS NOT NULL
     AND v_warning_status NOT IN (
       'HAS_WARNING',
       'RATE_WARNING',
       'CALCULATION_WARNING',
       'BLOCKED',
       'NO_WARNING'
     )
  THEN
    RAISE EXCEPTION 'Unsupported p_warning_status: %', p_warning_status;
  END IF;

  RETURN QUERY
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
  filtered AS (
    SELECT
      s.period_start,
      s.product_id,
      s.product_name,
      s.sku_id,
      s.sku_column_label,
      s.purchase_stock_item_id AS stock_item_id,
      i.code AS stock_item_code,
      s.purchase_stock_item_name AS stock_item_name,
      s.sku_qty_purchase_form AS sku_quantity,
      s.purchase_uom_code AS quantity_uom,
      s.selected_rate,
      s.rate_source,
      s.rate_date,
      s.rm_cost_per_sku_line AS rm_line_cost,
      s.rm_cost_share_percent AS contribution_share_percent,
      s.rate_warning_code AS warning_code,
      s.rate_warning_text AS warning_text,
      s.action_required,
      s.approval_block_flag,
      s.calculation_warning_flag,
      s.calculation_warning_code,
      s.review_state_label AS review_state,
      s.semi_stock_item_names AS semi_process_source,
      s.expansion_note,
      'RM'::text AS trace_component,
      s.drill_route_module_key,
      s.drill_route_lens_id,
      coalesce(s.drill_filter_json, '{}'::jsonb)
        || jsonb_build_object('trace_component', 'RM') AS drill_filter_json,
      s.snapshot_refreshed_at,
      s.line_sort,
      s.bom_source,
      s.rate_warning_flag,
      s.valuation_date,
      s.refresh_run_id
    FROM costing.cost_sheet_rm_line_traceability_snapshot s
    JOIN selected_run sr
      ON sr.period_start = s.period_start
     AND sr.valuation_date = s.valuation_date
     AND sr.refresh_run_id = s.refresh_run_id
    LEFT JOIN public.inv_stock_item i
      ON i.id = s.purchase_stock_item_id
    WHERE (p_product_id IS NULL OR s.product_id = p_product_id)
      AND (p_sku_id IS NULL OR s.sku_id = p_sku_id)
      AND (p_stock_item_id IS NULL OR s.purchase_stock_item_id = p_stock_item_id)
      AND (
        nullif(btrim(p_review_state), '') IS NULL
        OR lower(s.review_state_label) = lower(btrim(p_review_state))
      )
      AND (
        nullif(btrim(p_bom_source), '') IS NULL
        OR lower(s.bom_source) = lower(btrim(p_bom_source))
      )
      AND (
        p_has_semi_process IS NULL
        OR (p_has_semi_process = true AND s.semi_stock_item_names IS NOT NULL)
        OR (p_has_semi_process = false AND s.semi_stock_item_names IS NULL)
      )
      AND (
        v_search_text IS NULL
        OR i.code ILIKE '%' || v_search_text || '%'
        OR s.purchase_stock_item_name ILIKE '%' || v_search_text || '%'
        OR s.product_name ILIKE '%' || v_search_text || '%'
        OR s.sku_column_label ILIKE '%' || v_search_text || '%'
      )
      AND (
        v_warning_status IS NULL
        OR (
          v_warning_status = 'HAS_WARNING'
          AND (
            coalesce(s.rate_warning_flag, false)
            OR coalesce(s.calculation_warning_flag, false)
            OR coalesce(s.approval_block_flag, false)
          )
        )
        OR (
          v_warning_status = 'RATE_WARNING'
          AND coalesce(s.rate_warning_flag, false)
        )
        OR (
          v_warning_status = 'CALCULATION_WARNING'
          AND coalesce(s.calculation_warning_flag, false)
        )
        OR (
          v_warning_status = 'BLOCKED'
          AND coalesce(s.approval_block_flag, false)
        )
        OR (
          v_warning_status = 'NO_WARNING'
          AND NOT (
            coalesce(s.rate_warning_flag, false)
            OR coalesce(s.calculation_warning_flag, false)
            OR coalesce(s.approval_block_flag, false)
          )
        )
      )
  ),
  counted AS (
    SELECT
      f.*,
      count(*) OVER ()::bigint AS total_row_count
    FROM filtered f
  )
  SELECT
    c.period_start,
    c.product_id,
    c.product_name,
    c.sku_id,
    c.sku_column_label,
    c.stock_item_id,
    c.stock_item_code,
    c.stock_item_name,
    c.sku_quantity,
    c.quantity_uom,
    c.selected_rate,
    c.rate_source,
    c.rate_date,
    c.rm_line_cost,
    c.contribution_share_percent,
    c.warning_code,
    c.warning_text,
    c.action_required,
    c.approval_block_flag,
    c.calculation_warning_flag,
    c.calculation_warning_code,
    c.review_state,
    c.semi_process_source,
    c.expansion_note,
    c.trace_component,
    c.drill_route_module_key,
    c.drill_route_lens_id,
    c.drill_filter_json,
    c.snapshot_refreshed_at,
    c.total_row_count,
    c.valuation_date,
    c.refresh_run_id
  FROM counted c
  ORDER BY
    c.product_name,
    c.sku_column_label,
    c.line_sort,
    c.stock_item_name,
    c.stock_item_id
  LIMIT v_limit
  OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer, date, bigint) TO authenticated, postgres;