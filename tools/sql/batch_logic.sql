-- Batch sizing logic implementation
-- Provides a function to compute batch_count, batch_sizes array, and residual
-- given a total make quantity and min/preferred/max batch size references.
--
-- Strategy:
-- 1. Prefer a single batch when total within [min,max].
-- 2. Otherwise choose the minimal feasible number of batches k such that total/k ∈ [min,max].
--    If multiple k satisfy, pick the one whose per-batch size is closest to preferred.
-- 3. If no k yields a per-batch size in [min,max], fall back to k_min = ceil(total/max)
--    and clamp per-batch size within [min,max]; distribute remainder without violating max.
-- 4. Return exact batch sizes (numeric[]) and residual (total - sum(batch_sizes)).
--
-- NOTE: This function is deterministic and side-effect free; integrate via
-- CROSS JOIN LATERAL in views (e.g. v_product_bulk_consolidated_effective_with_batches).
--
-- Safety: Null or zero sizes collapse to treating total as one batch.

CREATE OR REPLACE FUNCTION public.compute_batches(
  p_total numeric,
  p_min   numeric,
  p_pref  numeric,
  p_max   numeric
)
RETURNS TABLE (
  batch_count int,
  batch_sizes numeric[],
  residual_qty numeric
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_total numeric := COALESCE(p_total,0);
  v_min   numeric := NULLIF(p_min,0);
  v_pref  numeric := NULLIF(p_pref,0);
  v_max   numeric := NULLIF(p_max,0);
  v_k_min int;
  v_candidate RECORD;
  v_sizes numeric[] := ARRAY[]::numeric[];
  v_base numeric;
  v_remainder numeric;
  v_k int;
BEGIN
  -- Normalize ordering: ensure min <= pref <= max when all present.
  IF v_min IS NOT NULL AND v_max IS NOT NULL AND v_min > v_max THEN
    -- swap if user provided inverted bounds
    v_min := p_max; v_max := p_min;
  END IF;
  IF v_pref IS NOT NULL THEN
    IF v_min IS NOT NULL AND v_pref < v_min THEN v_pref := v_min; END IF;
    IF v_max IS NOT NULL AND v_pref > v_max THEN v_pref := v_max; END IF;
  END IF;

  IF v_total <= 0 THEN
    batch_count := 0; batch_sizes := ARRAY[]::numeric[]; residual_qty := 0; RETURN NEXT; RETURN;
  END IF;

  -- If no constraints, single batch.
  IF v_min IS NULL AND v_pref IS NULL AND v_max IS NULL THEN
    batch_count := 1; batch_sizes := ARRAY[v_total]; residual_qty := 0; RETURN NEXT; RETURN;
  END IF;

  -- Prefer single batch when total within [min,max]
  IF (v_min IS NULL OR v_total >= v_min) AND (v_max IS NULL OR v_total <= v_max) THEN
    batch_count := 1; batch_sizes := ARRAY[v_total]; residual_qty := 0; RETURN NEXT; RETURN;
  END IF;

  -- If total below minimum constraint, treat as residual (no forced oversize batch)
  IF v_min IS NOT NULL AND v_total < v_min THEN
    batch_count := 0; batch_sizes := ARRAY[]::numeric[]; residual_qty := v_total; RETURN NEXT; RETURN;
  END IF;

  -- Establish max bound for capacity check
  IF v_max IS NULL THEN
    -- Use preferred, else min, else total to avoid division by null
    v_max := COALESCE(v_pref, v_min, v_total);
  END IF;
  IF v_max <= 0 THEN
    batch_count := 1; batch_sizes := ARRAY[v_total]; residual_qty := 0; RETURN NEXT; RETURN;
  END IF;

  v_k_min := CEIL(v_total / v_max); IF v_k_min < 1 THEN v_k_min := 1; END IF;

  -- Search candidate k producing per-batch size within [min,max]
  FOR v_k IN v_k_min .. CEIL(GREATEST(v_total / COALESCE(v_min,1), v_k_min)) LOOP
    v_base := v_total / v_k;
    IF (v_min IS NULL OR v_base >= v_min) AND (v_base <= v_max) THEN
      -- Acceptable candidate; record best by minimal k then closeness to preferred.
      IF v_candidate IS NULL THEN
        v_candidate := (v_k, v_base, ABS(COALESCE(v_pref, v_base) - v_base));
      ELSE
        IF v_k < v_candidate.f1 THEN
          v_candidate := (v_k, v_base, ABS(COALESCE(v_pref, v_base) - v_base));
        ELSIF v_k = v_candidate.f1 THEN
          IF ABS(COALESCE(v_pref, v_base) - v_base) < v_candidate.f3 THEN
            v_candidate := (v_k, v_base, ABS(COALESCE(v_pref, v_base) - v_base));
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_candidate IS NOT NULL THEN
    batch_count := v_candidate.f1;
    v_base := v_candidate.f2;
    -- Distribute total across batch_count batches, preserving total exactly.
    v_remainder := v_total;
    FOR v_k IN 1 .. batch_count LOOP
      -- Assign base size; last batch absorbs floating residual due to numeric division.
      IF v_k < batch_count THEN
        v_sizes := v_sizes || v_base;
        v_remainder := v_remainder - v_base;
      ELSE
        v_sizes := v_sizes || v_remainder; -- exact closure
      END IF;
    END LOOP;
    batch_sizes := v_sizes;
    residual_qty := v_total - COALESCE((SELECT SUM(x) FROM UNNEST(v_sizes) x),0);
    RETURN NEXT; RETURN;
  END IF;

  -- Fallback: no feasible per-batch size inside bounds. Use v_k_min with clamped sizes.
  batch_count := v_k_min;
  v_base := v_total / batch_count;
  v_remainder := v_total;
  FOR v_k IN 1 .. batch_count LOOP
    DECLARE v_s numeric := v_base; BEGIN END;
    IF v_min IS NOT NULL THEN v_base := GREATEST(v_base, v_min); END IF;
    IF v_max IS NOT NULL THEN v_base := LEAST(v_base, v_max); END IF;
    IF v_k = batch_count THEN
      v_base := v_remainder; -- absorb remainder, may exceed max slightly; clamp again
      IF v_min IS NOT NULL THEN v_base := GREATEST(v_base, v_min); END IF;
      IF v_max IS NOT NULL THEN v_base := LEAST(v_base, v_max); END IF;
    END IF;
    v_sizes := v_sizes || v_base;
    v_remainder := v_remainder - v_base;
  END LOOP;
  batch_sizes := v_sizes;
  residual_qty := v_total - COALESCE((SELECT SUM(x) FROM UNNEST(v_sizes) x),0);
  RETURN NEXT; RETURN;
END;
$$;

-- View augmenting v_product_bulk_consolidated_effective with batching info.
-- Requires existing v_product_bulk_consolidated_effective.
CREATE OR REPLACE VIEW public.v_product_bulk_consolidated_effective_with_batches AS
SELECT
  e.product_id,
  e.month_start,
  e.need_qty,
  e.preferred_batch_size,
  e.min_batch_size,
  e.max_batch_size,
  e.need_after_carry,
  e.planned_make_qty,
  e.override_delta,
  e.final_make_qty,
  e.carry_to_next,
  e.needs_base_qty,
  e.source_rule,
  b.batch_count,
  b.batch_sizes,
  b.residual_qty
FROM public.v_product_bulk_consolidated_effective e
LEFT JOIN LATERAL public.compute_batches(
  e.final_make_qty,
  e.min_batch_size,
  e.preferred_batch_size,
  e.max_batch_size
) b ON TRUE
ORDER BY e.product_id, e.month_start;

-- Usage example:
-- SELECT * FROM public.v_product_bulk_consolidated_effective_with_batches
-- WHERE product_id = 153 ORDER BY month_start;
