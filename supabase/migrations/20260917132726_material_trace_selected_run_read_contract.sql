-- backfilled from live schema_migrations on 2026-10-24, CI-016
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
