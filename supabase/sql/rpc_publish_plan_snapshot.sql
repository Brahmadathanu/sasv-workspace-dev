-- RPC to publish a plan snapshot transactionally: insert header and insert lines
-- Usage: SELECT public.publish_plan_snapshot('Plan 2025-10 (R1)', '2025-10-01'::date, 'notes', '2025-10-01'::date, '2026-09-01'::date, '{"sku_id":123}'::json);
CREATE OR REPLACE FUNCTION public.publish_plan_snapshot(
  p_plan_key text,
  p_as_of_date date,
  p_notes text,
  p_from date,
  p_to date,
  p_filters json DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id bigint;
  v_rows int := 0;
BEGIN
  -- Insert header
  INSERT INTO public.plan_publish_headers (plan_key, as_of_date, notes, created_by)
  VALUES (p_plan_key, p_as_of_date, p_notes, NULL)
  RETURNING id INTO v_plan_id;

  -- Insert lines in one shot using the view and optional filters
  WITH rows_to_insert AS (
    SELECT sku_id, region_id, godown_id, month_start,
           demand_baseline, supply_llt, supply_seasonal, supply_final
    FROM public.v_forecast_plan_12m
    WHERE month_start >= p_from AND month_start <= p_to
      AND (
        p_filters IS NULL
        OR (
          (p_filters->>'sku_id' IS NULL OR sku_id = (p_filters->>'sku_id')::bigint)
          AND (p_filters->>'region_id' IS NULL OR region_id = (p_filters->>'region_id')::int)
          AND (p_filters->>'godown_id' IS NULL OR godown_id = (p_filters->>'godown_id')::int)
        )
      )
  )
  INSERT INTO public.plan_publish_lines(plan_id, sku_id, region_id, godown_id, month_start, demand_baseline, supply_llt, supply_seasonal, supply_final)
  SELECT v_plan_id, sku_id, region_id, godown_id, month_start, demand_baseline, supply_llt, supply_seasonal, supply_final
  FROM rows_to_insert;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object('plan_id', v_plan_id, 'rows', v_rows);
EXCEPTION WHEN OTHERS THEN
  -- Let the error bubble up; transaction will be rolled back automatically.
  RAISE;
END;
$$;

-- RPC to delete a publish header (and cascade delete lines)
CREATE OR REPLACE FUNCTION public.delete_publish(p_plan_id bigint) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted int := 0;
BEGIN
  DELETE FROM public.plan_publish_headers WHERE id = p_plan_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN jsonb_build_object('deleted_headers', v_deleted);
END;
$$;

-- Grant execute to the anon/web role as needed. Replace 'anon' below with your web role if different.
-- GRANT EXECUTE ON FUNCTION public.publish_plan_snapshot(text,date,text,date,date,json) TO anon;
-- GRANT EXECUTE ON FUNCTION public.delete_publish(bigint) TO anon;

COMMENT ON FUNCTION public.publish_plan_snapshot(text,date,text,date,date,json) IS 'Create a snapshot (header + lines) transactionally from v_forecast_plan_12m with optional filters in JSON (sku_id, region_id, godown_id). Returns {plan_id, rows}.';
COMMENT ON FUNCTION public.delete_publish(bigint) IS 'Delete a publish header (cascade deletes lines). Returns counts.';
