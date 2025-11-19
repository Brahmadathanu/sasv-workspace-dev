-- Rebuild Batch Plan RPC
-- Recomputes batch_plan_lines and batch_plan_batches for a given header
-- using compute_batches() and the effective consolidated view.
--
-- Usage:
--   SELECT * FROM rebuild_batch_plan(p_header_id := 7);
-- Returns: (lines_inserted, lines_updated, batches_replaced)
--
-- Assumptions:
--   - batch_plan_headers has window_from/window_to defining inclusive date range.
--   - v_product_bulk_consolidated_effective_with_batches provides final_make_qty
--     and batch sizing references (preferred/min/max) PLUS we recompute batches again to ensure freshness.
--   - compute_batches(final_make_qty, min, pref, max) is deployed (from batch_logic.sql).
--   - Overrides already applied in final_make_qty; we do not re-add them.
--
-- Idempotency:
--   Lines are upserted on (header_id, product_id, month_start).
--   Batches for affected lines are deleted and re-inserted each run.
-- Concurrency:
--   Function runs in a single transaction; callers should avoid parallel runs for same header.
--
-- Error Handling:
--   Raises exception if header_id not found or has no window dates.
--
CREATE OR REPLACE FUNCTION public.rebuild_batch_plan(p_header_id bigint)
RETURNS TABLE (lines_inserted int, lines_updated int, batches_replaced int) LANGUAGE plpgsql AS $$
DECLARE
  v_from date;
  v_to   date;
  v_i    int := 0;
  v_u    int := 0;
  v_br   int := 0;
BEGIN
  -- Extend timeout for large rebuilds (60s instead of default REST 10-15s)
  PERFORM set_config('statement_timeout','60000', true);
  -- Resolve header window.
  SELECT window_from, window_to INTO v_from, v_to
  FROM batch_plan_headers WHERE id = p_header_id;
  IF v_from IS NULL OR v_to IS NULL THEN
    RAISE EXCEPTION 'Header % not found or missing window_from/window_to', p_header_id;
  END IF;

  -- Materialize calculation with professional fallback when compute_batches is NULL/empty.
  -- Drop any stale temp from prior invocation to avoid duplicate rows leading to (line_id,batch_no_seq) conflicts.
  DROP TABLE IF EXISTS tmp_rebuild_calc;
  CREATE TEMP TABLE tmp_rebuild_calc ON COMMIT DROP AS
  SELECT DISTINCT ON (e.product_id, e.month_start)
    e.product_id,
    e.month_start,
    e.final_make_qty,
    e.preferred_batch_size,
    e.min_batch_size,
    e.max_batch_size,
    COALESCE(b.batch_count, fb.batch_count) AS batch_count,
    COALESCE(b.batch_sizes, fb.batch_sizes) AS batch_sizes,
    COALESCE(b.residual_qty, fb.residual_qty) AS residual_qty
  FROM public.v_product_bulk_consolidated_effective e
  LEFT JOIN LATERAL public.compute_batches(
    e.final_make_qty,
    e.min_batch_size,
    e.preferred_batch_size,
    e.max_batch_size
  ) b ON TRUE
  LEFT JOIN LATERAL (
    -- Fallback derives batches ONLY when compute_batches returned NULL or empty.
    -- Ensures batch_count and batch_sizes remain consistent (no batches emitted when count=0).
    WITH parts AS (
      SELECT
        e.final_make_qty AS total,
        e.preferred_batch_size AS pref,
        e.min_batch_size AS min_sz,
        e.max_batch_size AS max_sz,
        CASE
          WHEN e.preferred_batch_size IS NOT NULL AND e.preferred_batch_size > 0 THEN FLOOR(e.final_make_qty / e.preferred_batch_size)
          ELSE NULL
        END AS full_batches,
        CASE
          WHEN e.preferred_batch_size IS NOT NULL AND e.preferred_batch_size > 0 THEN (e.final_make_qty % e.preferred_batch_size)
          ELSE NULL
        END AS remainder
    )
    SELECT
      CASE
        WHEN e.final_make_qty IS NULL OR e.final_make_qty <= 0 THEN 0
        WHEN (e.min_batch_size IS NULL OR e.final_make_qty >= e.min_batch_size)
         AND (e.max_batch_size IS NULL OR e.final_make_qty <= e.max_batch_size) THEN 1
        WHEN e.preferred_batch_size IS NOT NULL AND e.preferred_batch_size > 0 THEN (
          SELECT full_batches
                 + CASE
                     WHEN remainder IS NOT NULL
                          AND remainder BETWEEN COALESCE(min_sz,0) AND COALESCE(max_sz, total) THEN 1
                     ELSE 0
                   END
          FROM parts
        )
        ELSE 1
      END AS batch_count,
      CASE
        WHEN e.final_make_qty IS NULL OR e.final_make_qty <= 0 THEN ARRAY[]::numeric[]
        WHEN (e.min_batch_size IS NULL OR e.final_make_qty >= e.min_batch_size)
         AND (e.max_batch_size IS NULL OR e.final_make_qty <= e.max_batch_size) THEN ARRAY[e.final_make_qty]
        WHEN e.preferred_batch_size IS NOT NULL AND e.preferred_batch_size > 0 THEN (
          SELECT CASE
            WHEN full_batches IS NULL THEN ARRAY[e.final_make_qty]  -- no preferred sizing usable
            WHEN full_batches = 0 THEN
              CASE
                WHEN remainder BETWEEN COALESCE(min_sz,0) AND COALESCE(max_sz, total) THEN ARRAY[remainder]
                ELSE ARRAY[]::numeric[]  -- below min -> no batches
              END
            ELSE array_cat(
              CASE WHEN full_batches > 0 THEN array_fill(pref::numeric, ARRAY[full_batches::int]) ELSE ARRAY[]::numeric[] END,
              CASE WHEN remainder BETWEEN COALESCE(min_sz,0) AND COALESCE(max_sz, total) THEN ARRAY[remainder] ELSE ARRAY[]::numeric[] END
            )
          END FROM parts
        )
        ELSE ARRAY[e.final_make_qty]
      END AS batch_sizes,
      CASE
        WHEN e.final_make_qty IS NULL OR e.final_make_qty <= 0 THEN 0
        WHEN (e.min_batch_size IS NULL OR e.final_make_qty >= e.min_batch_size)
         AND (e.max_batch_size IS NULL OR e.final_make_qty <= e.max_batch_size) THEN 0
        WHEN e.preferred_batch_size IS NOT NULL AND e.preferred_batch_size > 0 THEN (
          SELECT CASE
            WHEN remainder IS NULL THEN 0
            WHEN remainder = 0 THEN 0
            WHEN remainder BETWEEN COALESCE(min_sz,0) AND COALESCE(max_sz, total) THEN 0
            ELSE remainder
          END FROM parts
        )
        ELSE 0
      END AS residual_qty
  ) fb ON TRUE
  WHERE e.month_start BETWEEN v_from AND v_to
    AND e.final_make_qty IS NOT NULL
    AND e.final_make_qty > 0
  ORDER BY e.product_id, e.month_start; -- ensure deterministic DISTINCT ON selection

  WITH upsert AS (
    INSERT INTO batch_plan_lines AS l (
      header_id, product_id, month_start,
      final_make_qty,
      preferred_batch_size, min_batch_size, max_batch_size,
      batch_count, residual_qty, notes
    )
    SELECT
      p_header_id,
      t.product_id,
      t.month_start,
      t.final_make_qty,
      t.preferred_batch_size,
      t.min_batch_size,
      t.max_batch_size,
      COALESCE(t.batch_count,0),
      COALESCE(t.residual_qty,0),
      NULL
    FROM tmp_rebuild_calc t
    ON CONFLICT (header_id, product_id, month_start)
    DO UPDATE SET
      final_make_qty = EXCLUDED.final_make_qty,
      preferred_batch_size = EXCLUDED.preferred_batch_size,
      min_batch_size = EXCLUDED.min_batch_size,
      max_batch_size = EXCLUDED.max_batch_size,
      batch_count = EXCLUDED.batch_count,
      residual_qty = EXCLUDED.residual_qty,
      updated_at = NOW()
    RETURNING (xmax = 0) AS inserted, id AS line_id, product_id, month_start, batch_count, final_make_qty
  )
  SELECT
    COALESCE(SUM(CASE WHEN inserted THEN 1 ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN inserted THEN 0 ELSE 1 END),0)
  INTO v_i, v_u
  FROM upsert;

  -- Replace batches using materialized calc (delete then fresh insert for determinism)
  WITH line_ids AS (
    SELECT l.id, l.product_id, l.month_start
    FROM batch_plan_lines l
    WHERE l.header_id = p_header_id AND l.month_start BETWEEN v_from AND v_to
  ), del AS (
    DELETE FROM batch_plan_batches b USING line_ids li
    WHERE b.line_id = li.id RETURNING 1
  ), ins AS (
    SELECT li.id AS line_id, t.product_id, t.month_start, t.batch_sizes
    FROM line_ids li JOIN tmp_rebuild_calc t USING (product_id, month_start)
  ), written AS (
    INSERT INTO batch_plan_batches (
      header_id, line_id, product_id, month_start,
      batch_no_seq, batch_size, source_rule, notes
    )
    SELECT
      p_header_id,
      i.line_id,
      i.product_id,
      i.month_start,
      u.ordinality AS batch_no_seq,
      u.val AS batch_size,
      'auto',
      NULL
    FROM ins i
    JOIN LATERAL UNNEST(i.batch_sizes) WITH ORDINALITY AS u(val, ordinality) ON TRUE
    ON CONFLICT (line_id, batch_no_seq)
    DO UPDATE SET batch_size = EXCLUDED.batch_size,
                  source_rule = EXCLUDED.source_rule,
                  notes = EXCLUDED.notes
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_br FROM written;

  -- Emit single summary row
  RETURN QUERY SELECT v_i, v_u, v_br;
END;
$$;

-- Grant execute to application role if needed:
-- GRANT EXECUTE ON FUNCTION public.rebuild_batch_plan(bigint) TO app_role;
