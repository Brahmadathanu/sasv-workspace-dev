-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE FUNCTION public.rpc_get_material_rate_pm_cost_trace(
  p_period_start date,
  p_product_id bigint DEFAULT NULL::bigint,
  p_sku_id bigint DEFAULT NULL::bigint,
  p_stock_item_id bigint DEFAULT NULL::bigint,
  p_review_state text DEFAULT NULL::text,
  p_bom_source text DEFAULT NULL::text,
  p_warning_status text DEFAULT NULL::text,
  p_search_text text DEFAULT NULL::text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_valuation_date date DEFAULT NULL::date,
  p_refresh_run_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
  period_start date,
  valuation_date date,
  refresh_run_id bigint,
  product_id bigint,
  product_name text,
  sku_id bigint,
  sku_column_label text,
  stock_item_id bigint,
  stock_item_code text,
  stock_item_name text,
  pm_source text,
  sku_quantity numeric,
  quantity_uom text,
  selected_rate numeric,
  rate_source text,
  rate_date date,
  pm_line_cost numeric,
  contribution_share_percent numeric,
  warning_code text,
  warning_text text,
  action_required text,
  approval_block_flag boolean,
  review_required_flag boolean,
  review_state text,
  trace_component text,
  snapshot_refreshed_at timestamp with time zone,
  total_row_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
DECLARE
  v_period date := date_trunc('month', p_period_start)::date;
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_review text := upper(nullif(btrim(p_review_state), ''));
  v_warn text := upper(nullif(btrim(p_warning_status), ''));
  v_search text := nullif(btrim(p_search_text), '');
BEGIN
  PERFORM public.require_permission('module:material-cost-manager', false);
  PERFORM public.require_permission('role:material-cost-pm-trace', false);
  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'p_period_start is required';
  END IF;
  IF v_review IS NOT NULL AND v_review NOT IN ('READY', 'REVIEW_REQUIRED', 'BLOCKED') THEN
    RAISE EXCEPTION 'Unsupported p_review_state: %', p_review_state;
  END IF;
  IF v_warn IS NOT NULL AND v_warn NOT IN (
    'HAS_WARNING',
    'STALE_PURCHASE_RATE',
    'STOCK_VALUATION_FALLBACK',
    'MANUAL_RATE_USED',
    'MISSING_MATERIAL_RATE',
    'NO_WARNING'
  ) THEN
    RAISE EXCEPTION 'Unsupported p_warning_status: %', p_warning_status;
  END IF;

  RETURN QUERY
  WITH selected_run AS (
    SELECT sr.period_start, sr.valuation_date, sr.refresh_run_id
    FROM costing.fn_resolve_material_trace_selected_run(
      p_period_start,
      p_valuation_date,
      p_refresh_run_id
    ) sr
  ),
  base AS (
    SELECT
      p.*,
      i.code AS stock_item_code,
      CASE
        WHEN coalesce(p.approval_block_flag, false)
          OR coalesce(p.required_missing_rate_block_flag, false)
          THEN 'BLOCKED'
        WHEN coalesce(p.review_required_flag, false)
          OR coalesce(p.rate_warning_flag, false)
          OR coalesce(p.action_required, 'OK') <> 'OK'
          THEN 'REVIEW_REQUIRED'
        ELSE 'READY'
      END::text AS review_state,
      CASE WHEN p.is_override THEN 'PM_SKU_OVERRIDE' ELSE 'PM_BOM' END::text AS pm_source,
      sum(coalesce(p.pm_cost_per_sku_line, 0)) OVER (PARTITION BY p.sku_id) AS sku_pm_total
    FROM costing.sku_pm_material_cost_line_snapshot p
    JOIN selected_run sr
      ON sr.period_start = p.period_start
     AND sr.valuation_date = p.valuation_date
     AND sr.refresh_run_id = p.refresh_run_id
    LEFT JOIN public.inv_stock_item i ON i.id = p.stock_item_id
  ),
  filtered AS (
    SELECT b.*
    FROM base b
    WHERE (p_product_id IS NULL OR b.product_id = p_product_id)
      AND (p_sku_id IS NULL OR b.sku_id = p_sku_id)
      AND (p_stock_item_id IS NULL OR b.stock_item_id = p_stock_item_id)
      AND (v_review IS NULL OR b.review_state = v_review)
      AND (
        nullif(btrim(p_bom_source), '') IS NULL
        OR upper(b.pm_source) = upper(btrim(p_bom_source))
      )
      AND (
        v_search IS NULL
        OR b.stock_item_code ILIKE '%' || v_search || '%'
        OR b.stock_item_name ILIKE '%' || v_search || '%'
        OR b.product_name ILIKE '%' || v_search || '%'
        OR concat_ws(' ', b.pack_size, b.pack_uom) ILIKE '%' || v_search || '%'
      )
      AND (
        v_warn IS NULL
        OR (
          v_warn = 'HAS_WARNING'
          AND (
            coalesce(b.rate_warning_flag, false)
            OR coalesce(b.approval_block_flag, false)
            OR coalesce(b.review_required_flag, false)
          )
        )
        OR (
          v_warn = 'NO_WARNING'
          AND NOT (
            coalesce(b.rate_warning_flag, false)
            OR coalesce(b.approval_block_flag, false)
            OR coalesce(b.review_required_flag, false)
          )
        )
        OR (
          v_warn IN (
            'STALE_PURCHASE_RATE',
            'STOCK_VALUATION_FALLBACK',
            'MANUAL_RATE_USED',
            'MISSING_MATERIAL_RATE'
          )
          AND upper(coalesce(b.rate_warning_code, '')) = v_warn
        )
      )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_row_count
    FROM filtered f
  )
  SELECT
    c.period_start,
    c.valuation_date,
    c.refresh_run_id,
    c.product_id,
    c.product_name,
    c.sku_id,
    concat_ws(' ', trim(to_char(c.pack_size, 'FM999999999.########')), c.pack_uom),
    c.stock_item_id,
    c.stock_item_code,
    c.stock_item_name,
    c.pm_source,
    c.qty_required_unit_final,
    c.uom_code,
    c.selected_rate,
    c.rate_source,
    c.rate_date,
    c.pm_cost_per_sku_line,
    CASE
      WHEN c.sku_pm_total > 0
        THEN round((coalesce(c.pm_cost_per_sku_line, 0) / c.sku_pm_total) * 100, 6)
      ELSE NULL
    END,
    c.rate_warning_code,
    c.rate_warning_text,
    c.action_required,
    c.approval_block_flag,
    c.review_required_flag,
    c.review_state,
    'PM'::text,
    c.captured_at,
    c.total_row_count
  FROM counted c
  ORDER BY
    c.product_name,
    c.pack_size,
    c.pack_uom,
    c.source_duplicate_ordinal,
    c.stock_item_name,
    c.stock_item_id
  LIMIT v_limit
  OFFSET v_offset;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer, date, bigint) TO authenticated, postgres, service_role;