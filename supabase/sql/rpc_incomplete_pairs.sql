-- RPC: paginated list of SKU/Region/Godown pairs that do not have full month coverage in the given window
-- Returns JSON: { total_count, page, page_size, rows: [...] }

CREATE OR REPLACE FUNCTION public.rpc_incomplete_pairs(
  p_start date,
  p_end date,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  offset_val integer := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
  months_expected integer;
  _total bigint;
  _rows jsonb;
BEGIN
  -- compute expected months between p_start (inclusive) and p_end (exclusive)
  months_expected := ((DATE_PART('year', p_end) - DATE_PART('year', p_start)) * 12 + (DATE_PART('month', p_end) - DATE_PART('month', p_start)))::integer;

  -- pair counts (compute total using the filtered set)
  WITH pair_counts AS (
    SELECT
      sku_id,
      region_id,
      godown_id,
      count(*) AS months_present,
      array_agg(
        DISTINCT to_char(month_start, 'YYYY-MM-01')
        ORDER BY to_char(month_start, 'YYYY-MM-01')
      ) AS present_months
    FROM public.mv_forecast_plan_12m v
    WHERE v.month_start >= p_start
      AND v.month_start < p_end
    GROUP BY sku_id, region_id, godown_id
  ),
  filtered AS (
    SELECT
      pc.sku_id,
      pc.region_id,
      pc.godown_id,
      pc.months_present,
      GREATEST(0, months_expected - pc.months_present) AS missing_months_count,
      pc.present_months
    FROM pair_counts pc
    WHERE pc.months_present < months_expected
  )
  SELECT count(*)
  INTO _total
  FROM filtered;

  WITH pair_counts AS (
    SELECT
      sku_id,
      region_id,
      godown_id,
      count(*) AS months_present,
      array_agg(
        DISTINCT to_char(month_start, 'YYYY-MM-01')
        ORDER BY to_char(month_start, 'YYYY-MM-01')
      ) AS present_months
    FROM public.mv_forecast_plan_12m v
    WHERE v.month_start >= p_start
      AND v.month_start < p_end
    GROUP BY sku_id, region_id, godown_id
  ),
  filtered AS (
    SELECT
      pc.sku_id,
      pc.region_id,
      pc.godown_id,
      pc.months_present,
      GREATEST(0, months_expected - pc.months_present) AS missing_months_count,
      pc.present_months
    FROM pair_counts pc
    WHERE pc.months_present < months_expected
  ),
  paged AS (
    SELECT
      f.sku_id,
      f.region_id,
      f.godown_id,
      f.months_present,
      f.missing_months_count,
      f.present_months
    FROM filtered f
    ORDER BY f.months_present ASC, f.sku_id, f.region_id, f.godown_id
    LIMIT GREATEST(p_page_size,1) OFFSET offset_val
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      p.sku_id,
      p.region_id,
      p.godown_id,
      p.months_present,
      p.missing_months_count,
      p.present_months
    FROM paged p
  ) r;

  RETURN jsonb_build_object(
    'total_count', _total,
    'page', GREATEST(p_page,1),
    'page_size', GREATEST(p_page_size,1),
    'rows', _rows
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_incomplete_pairs(date,date,integer,integer) IS 'Paged report of pairs missing months in a window. Returns sku_id,region_id,godown_id,months_present,missing_months_count,present_months.';
