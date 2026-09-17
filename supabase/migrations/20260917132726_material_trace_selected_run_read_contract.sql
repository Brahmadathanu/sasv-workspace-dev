-- SOURCE-CONTROL PARITY
-- Already applied live as:
--   20260917132726_material_trace_selected_run_read_contract
--   20260917132740_material_trace_selected_run_rpc_contract
--   20260917132804_material_trace_selected_run_rm_list
--   20260917132827_material_trace_selected_run_rm_export
--   20260917132839_material_trace_selected_run_rm_filter_options
--   20260917132859_material_trace_selected_run_pm_list
--   20260917132917_material_trace_selected_run_pm_filter_options
--   20260917132939_material_trace_selected_run_pm_export
--   20260917133023_material_trace_selected_run_restore_grants
-- DO NOT reapply to production.
--
-- Complete forward source of truth for the Material Trace selected-run
-- read contract. Live apply was split only because of migration payload size.
-- This file is the governed complete contract: helper + DROP old signatures +
-- CREATE six extended RPCs + exact grant restoration.
--
-- Material Trace selected-run read contract.
-- Optional exact tuple on all six RM/PM Trace list, filter-options, and export RPCs.
-- Read-only: no snapshot INSERT/UPDATE/DELETE.

CREATE OR REPLACE FUNCTION costing.fn_resolve_material_trace_selected_run(
  p_period_start date,
  p_valuation_date date DEFAULT NULL,
  p_refresh_run_id bigint DEFAULT NULL
)
RETURNS TABLE(
  period_start date,
  valuation_date date,
  refresh_run_id bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
DECLARE
  v_period date;
  v_has_valuation boolean;
  v_has_run boolean;
BEGIN
  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'p_period_start is required';
  END IF;

  v_period := date_trunc('month', p_period_start)::date;
  v_has_valuation := p_valuation_date IS NOT NULL;
  v_has_run := p_refresh_run_id IS NOT NULL;

  IF v_has_valuation <> v_has_run THEN
    RAISE EXCEPTION
      'Material Trace exact-run identity requires both p_valuation_date and p_refresh_run_id';
  END IF;

  IF NOT v_has_valuation THEN
    RETURN QUERY
    SELECT
      r.period_start,
      r.valuation_date,
      r.refresh_run_id
    FROM costing.v_current_successful_costing_refresh_run r
    WHERE r.period_start = v_period
    LIMIT 1;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.period_start,
    r.valuation_date,
    r.id
  FROM costing.costing_refresh_run r
  WHERE r.period_start = v_period
    AND r.valuation_date = p_valuation_date
    AND r.id = p_refresh_run_id
    AND r.overall_status = 'SUCCESS'
    AND r.valuation_context_source = 'CAPTURED_AT_REQUEST';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'No governed successful costing refresh run matches the requested exact-run identity';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION costing.fn_resolve_material_trace_selected_run(date, date, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION costing.fn_resolve_material_trace_selected_run(date, date, bigint) FROM anon, authenticated, service_role;

COMMENT ON FUNCTION costing.fn_resolve_material_trace_selected_run(date, date, bigint) IS
  'Internal Material Trace selected-run resolver. Ordinary period reads use current-successful; explicit SUCCESS CAPTURED_AT_REQUEST tuples are required when both exact-run arguments are supplied. Not a public app API.';

DROP FUNCTION IF EXISTS public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer);
DROP FUNCTION IF EXISTS public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint);
DROP FUNCTION IF EXISTS public.rpc_export_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text);
DROP FUNCTION IF EXISTS public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint);
DROP FUNCTION IF EXISTS public.rpc_export_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text);

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

CREATE OR REPLACE FUNCTION public.rpc_export_material_rate_rm_cost_trace(
  p_period_start date,
  p_product_id bigint DEFAULT NULL::bigint,
  p_sku_id bigint DEFAULT NULL::bigint,
  p_stock_item_id bigint DEFAULT NULL::bigint,
  p_review_state text DEFAULT NULL::text,
  p_bom_source text DEFAULT NULL::text,
  p_warning_status text DEFAULT NULL::text,
  p_has_semi_process boolean DEFAULT NULL::boolean,
  p_search_text text DEFAULT NULL::text,
  p_valuation_date date DEFAULT NULL::date,
  p_refresh_run_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
  period_start date,
  product_name text,
  sku_column_label text,
  stock_item_code text,
  stock_item_name text,
  sku_quantity numeric,
  quantity_uom text,
  selected_rate numeric,
  rate_source text,
  rate_date date,
  rm_line_cost numeric,
  contribution_share_percent numeric,
  review_state text,
  warning_code text,
  warning_text text,
  semi_process_source text,
  expansion_note text,
  snapshot_refreshed_at timestamp with time zone,
  export_total_row_count bigint,
  valuation_date date,
  refresh_run_id bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
DECLARE
  v_search_text text;
  v_warning_status text;
BEGIN
  PERFORM public.require_permission('module:material-cost-manager', false);
  PERFORM public.require_permission('role:material-cost-rm-trace', false);
  PERFORM public.require_permission('role:material-cost-rm-trace-export', false);

  IF p_period_start IS NULL THEN
    RAISE EXCEPTION 'p_period_start is required';
  END IF;

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
      s.product_name,
      s.sku_column_label,
      i.code AS stock_item_code,
      s.purchase_stock_item_name AS stock_item_name,
      s.sku_qty_purchase_form AS sku_quantity,
      s.purchase_uom_code AS quantity_uom,
      s.selected_rate,
      s.rate_source,
      s.rate_date,
      s.rm_cost_per_sku_line AS rm_line_cost,
      s.rm_cost_share_percent AS contribution_share_percent,
      s.review_state_label AS review_state,
      s.rate_warning_code AS warning_code,
      s.rate_warning_text AS warning_text,
      s.semi_stock_item_names AS semi_process_source,
      s.expansion_note,
      s.snapshot_refreshed_at,
      s.line_sort,
      s.valuation_date,
      s.refresh_run_id,
      count(*) OVER ()::bigint AS export_total_row_count
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
  )
  SELECT
    f.period_start,
    f.product_name,
    f.sku_column_label,
    f.stock_item_code,
    f.stock_item_name,
    f.sku_quantity,
    f.quantity_uom,
    f.selected_rate,
    f.rate_source,
    f.rate_date,
    f.rm_line_cost,
    f.contribution_share_percent,
    f.review_state,
    f.warning_code,
    f.warning_text,
    f.semi_process_source,
    f.expansion_note,
    f.snapshot_refreshed_at,
    f.export_total_row_count,
    f.valuation_date,
    f.refresh_run_id
  FROM filtered f
  ORDER BY
    f.product_name,
    f.sku_column_label,
    f.line_sort,
    f.stock_item_name
  LIMIT 50000;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.rpc_export_material_rate_pm_cost_trace(
  p_period_start date,
  p_product_id bigint DEFAULT NULL::bigint,
  p_sku_id bigint DEFAULT NULL::bigint,
  p_stock_item_id bigint DEFAULT NULL::bigint,
  p_review_state text DEFAULT NULL::text,
  p_bom_source text DEFAULT NULL::text,
  p_warning_status text DEFAULT NULL::text,
  p_search_text text DEFAULT NULL::text,
  p_valuation_date date DEFAULT NULL::date,
  p_refresh_run_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(
  period_start date,
  valuation_date date,
  refresh_run_id bigint,
  product_name text,
  sku_column_label text,
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
  review_state text,
  warning_code text,
  warning_text text,
  snapshot_refreshed_at timestamp with time zone,
  export_total_row_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'costing', 'pg_temp'
AS $function$
DECLARE
  v_period date := date_trunc('month', p_period_start)::date;
  v_review text := upper(nullif(btrim(p_review_state), ''));
  v_warn text := upper(nullif(btrim(p_warning_status), ''));
  v_search text := nullif(btrim(p_search_text), '');
BEGIN
  PERFORM public.require_permission('module:material-cost-manager', false);
  PERFORM public.require_permission('role:material-cost-pm-trace', false);
  PERFORM public.require_permission('role:material-cost-pm-trace-export', false);
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
    SELECT f.*, count(*) OVER ()::bigint AS export_total_row_count
    FROM filtered f
  )
  SELECT
    c.period_start,
    c.valuation_date,
    c.refresh_run_id,
    c.product_name,
    concat_ws(' ', trim(to_char(c.pack_size, 'FM999999999.########')), c.pack_uom),
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
    c.review_state,
    c.rate_warning_code,
    c.rate_warning_text,
    c.captured_at,
    c.export_total_row_count
  FROM counted c
  ORDER BY
    c.product_name,
    c.pack_size,
    c.pack_uom,
    c.source_duplicate_ordinal,
    c.stock_item_name,
    c.stock_item_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_export_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint, date, bigint) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_export_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, date, bigint) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, integer, integer, date, bigint) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_rm_cost_trace_filter_options(date, bigint, date, bigint) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.rpc_export_material_rate_rm_cost_trace(date, bigint, bigint, bigint, text, text, text, boolean, text, date, bigint) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, integer, integer, date, bigint) TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_material_rate_pm_cost_trace_filter_options(date, bigint, date, bigint) TO authenticated, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_export_material_rate_pm_cost_trace(date, bigint, bigint, bigint, text, text, text, text, date, bigint) TO authenticated, postgres, service_role;

NOTIFY pgrst, 'reload schema';
