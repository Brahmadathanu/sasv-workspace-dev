-- Fix for v_product_batches_plan: ensure we pick the latest active production_batch_size_ref
-- that is effective on or before the month_start for each product+month.
--
-- Problem: the original view used DISTINCT ON (r.product_id, s.month_start)
-- which could be ambiguous or incorrect because the DISTINCT ON should be
-- applied on the selection key coming from src (s.product_id, s.month_start)
-- while ordering must prefer the latest r.effective_from. The corrected
-- approach uses DISTINCT ON (s.product_id, s.month_start) and ORDER BY
-- s.product_id, s.month_start, r.effective_from DESC, r.id DESC.
--
-- WARNING: run this as a privileged user against the target database. Test
-- on a dev copy first. If this view is materialized, consider REFRESH MATERIALIZED VIEW
-- after applying.

DROP VIEW IF EXISTS public.v_product_batches_plan;

CREATE VIEW public.v_product_batches_plan AS
WITH
  src AS (
    SELECT
      c.product_id,
      c.month_start,
      c.final_make_qty::numeric(18,6) AS final_make_qty
    FROM v_product_bulk_consolidated_effective c
  ),
  pick_ref AS (
    SELECT DISTINCT ON (s.product_id, s.month_start)
      s.product_id,
      s.month_start,
      r.preferred_batch_size,
      r.min_batch_size,
      r.max_batch_size
    FROM src s
    LEFT JOIN production_batch_size_ref r
      ON r.product_id = s.product_id
      AND r.is_active = true
      AND r.effective_from <= s.month_start
    ORDER BY s.product_id, s.month_start, r.effective_from DESC, r.id DESC
  ),
  prep AS (
    SELECT
      s.product_id,
      s.month_start,
      s.final_make_qty,
      p.preferred_batch_size,
      p.min_batch_size,
      p.max_batch_size,
      p.preferred_batch_size IS NULL AS needs_batch_size,
      CASE
        WHEN p.preferred_batch_size IS NULL THEN 0::bigint
        WHEN p.preferred_batch_size > 0::numeric THEN floor(s.final_make_qty / p.preferred_batch_size)::bigint
        ELSE 0::bigint
      END AS n_full,
      CASE
        WHEN p.preferred_batch_size IS NULL THEN 0::numeric
        WHEN p.preferred_batch_size > 0::numeric THEN mod(s.final_make_qty, p.preferred_batch_size)
        ELSE 0::numeric
      END AS remainder
    FROM src s
    LEFT JOIN pick_ref p ON p.product_id = s.product_id AND p.month_start = s.month_start
  ),
  full_batches AS (
    SELECT
      prep.product_id,
      prep.month_start,
      prep.final_make_qty,
      prep.preferred_batch_size,
      prep.min_batch_size,
      prep.max_batch_size,
      prep.needs_batch_size,
      gs.gs AS batch_no,
      prep.preferred_batch_size AS batch_qty,
      false AS is_remainder
    FROM prep
    JOIN LATERAL generate_series(1::bigint, GREATEST(prep.n_full, 0::bigint)) gs (gs) ON true
    WHERE prep.preferred_batch_size IS NOT NULL
  ),
  remainder_batch AS (
    SELECT
      prep.product_id,
      prep.month_start,
      prep.final_make_qty,
      prep.preferred_batch_size,
      prep.min_batch_size,
      prep.max_batch_size,
      prep.needs_batch_size,
      prep.n_full + 1 AS batch_no,
      prep.remainder AS batch_qty,
      true AS is_remainder
    FROM prep
    WHERE prep.preferred_batch_size IS NOT NULL
      AND prep.remainder > 0::numeric
  ),
  no_ref_single AS (
    SELECT
      prep.product_id,
      prep.month_start,
      prep.final_make_qty,
      NULL::numeric(18,6) AS preferred_batch_size,
      NULL::numeric(18,6) AS min_batch_size,
      NULL::numeric(18,6) AS max_batch_size,
      true AS needs_batch_size,
      1 AS batch_no,
      prep.final_make_qty AS batch_qty,
      false AS is_remainder
    FROM prep
    WHERE prep.preferred_batch_size IS NULL
  )
SELECT
  full_batches.product_id,
  full_batches.month_start,
  full_batches.final_make_qty,
  full_batches.preferred_batch_size,
  full_batches.min_batch_size,
  full_batches.max_batch_size,
  full_batches.needs_batch_size,
  full_batches.batch_no,
  full_batches.batch_qty,
  full_batches.is_remainder
FROM full_batches
UNION ALL
SELECT
  remainder_batch.product_id,
  remainder_batch.month_start,
  remainder_batch.final_make_qty,
  remainder_batch.preferred_batch_size,
  remainder_batch.min_batch_size,
  remainder_batch.max_batch_size,
  remainder_batch.needs_batch_size,
  remainder_batch.batch_no,
  remainder_batch.batch_qty,
  remainder_batch.is_remainder
FROM remainder_batch
UNION ALL
SELECT
  no_ref_single.product_id,
  no_ref_single.month_start,
  no_ref_single.final_make_qty,
  no_ref_single.preferred_batch_size,
  no_ref_single.min_batch_size,
  no_ref_single.max_batch_size,
  no_ref_single.needs_batch_size,
  no_ref_single.batch_no,
  no_ref_single.batch_qty,
  no_ref_single.is_remainder
FROM no_ref_single
ORDER BY 1,2,8;

-- End of file