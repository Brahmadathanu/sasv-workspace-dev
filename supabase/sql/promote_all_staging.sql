-- promote_all_staging.sql
-- Promote staged overrides into active overrides in a single DB-side function.
-- Usage: SELECT public.promote_all_staging('2025-01-01'::date, '2025-12-01'::date);

CREATE OR REPLACE FUNCTION public.promote_all_staging(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated int := 0;
  v_inserted int := 0;
  v_deleted int := 0;
BEGIN
  -- Update existing rows that match staging keys
  WITH src AS (
    SELECT sku_id, region_id, godown_id, month_start, delta_units, COALESCE(note, 'Promoted from staging (bulk)') AS reason
    FROM public.marketing_overrides_staging
    WHERE month_start >= p_from AND month_start <= p_to
  ), upd AS (
    UPDATE public.forecast_demand_overrides tgt
    SET delta_units = s.delta_units,
        reason = s.reason,
        is_active = true,
        updated_at = now()
    FROM src s
    WHERE tgt.sku_id = s.sku_id
      AND tgt.region_id = s.region_id
      AND tgt.godown_id = s.godown_id
      AND tgt.month_start = s.month_start
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_updated FROM upd;

  -- Insert rows that do not exist yet
  WITH src AS (
    SELECT sku_id, region_id, godown_id, month_start, delta_units, COALESCE(note, 'Promoted from staging (bulk)') AS reason
    FROM public.marketing_overrides_staging
    WHERE month_start >= p_from AND month_start <= p_to
  ), ins AS (
    INSERT INTO public.forecast_demand_overrides (sku_id, region_id, godown_id, month_start, delta_units, reason, is_active, updated_at)
    SELECT s.sku_id, s.region_id, s.godown_id, s.month_start, s.delta_units, s.reason, true, now()
    FROM src s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.forecast_demand_overrides t
      WHERE t.sku_id = s.sku_id
        AND t.region_id = s.region_id
        AND t.godown_id = s.godown_id
        AND t.month_start = s.month_start
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  -- Delete promoted staging rows (best-effort cleanup)
  DELETE FROM public.marketing_overrides_staging
  WHERE month_start >= p_from AND month_start <= p_to;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('inserted_count', v_inserted, 'updated_count', v_updated, 'deleted_staging_count', v_deleted);
END;
$$;

COMMENT ON FUNCTION public.promote_all_staging(date, date) IS 'Promote staged marketing overrides into forecast_demand_overrides for the given month window. Returns JSON with inserted_count, updated_count and deleted_staging_count.';
