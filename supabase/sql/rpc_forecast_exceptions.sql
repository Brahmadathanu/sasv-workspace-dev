-- RPC: paginated exceptions with configurable rules

CREATE OR REPLACE FUNCTION public.rpc_forecast_exceptions(
  p_start date,
  p_end date,
  p_sku_id integer DEFAULT NULL,
  p_region_id integer DEFAULT NULL,
  p_godown_id integer DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_treat_zero_missing boolean DEFAULT false,
  p_include_unknown_mappings boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  offset_val integer := (GREATEST(p_page,1)-1) * GREATEST(p_page_size,1);
  _total bigint;
  _rows jsonb;
BEGIN
  -- Build a source subquery that computes raw_missing flags per row
  -- We'll reuse the same source twice (for count and for page) to avoid CTE-scope issues.
  -- Note: keep the selected columns minimal to keep payload small.

  -- compute total first
  SELECT count(*) INTO _total
  FROM (
    SELECT
      v.sku_id,
      v.region_id,
      v.godown_id,
      v.month_start,
      v.demand_baseline,
      v.supply_llt,
      v.supply_seasonal,
      v.supply_final,
      v.product_id,
      v.is_llt,
      v.is_seasonal,
      ((v.supply_llt IS NULL) OR (p_treat_zero_missing AND v.supply_llt = 0)) AS raw_missing_llt,
      ((v.supply_seasonal IS NULL) OR (p_treat_zero_missing AND v.supply_seasonal = 0)) AS raw_missing_seasonal
    FROM public.v_forecast_exceptions v
    WHERE v.month_start >= p_start
      AND v.month_start < p_end
      AND (p_sku_id IS NULL OR v.sku_id = p_sku_id)
      AND (p_region_id IS NULL OR v.region_id = p_region_id)
      AND (p_godown_id IS NULL OR v.godown_id = p_godown_id)
  ) s
  WHERE (
    (raw_missing_llt AND COALESCE(is_llt, false))
    OR (raw_missing_seasonal AND COALESCE(is_seasonal, false))
    OR (p_include_unknown_mappings AND product_id IS NULL AND (raw_missing_llt OR raw_missing_seasonal))
  );

  -- then fetch paged rows
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.month_start, r.sku_id, r.region_id, r.godown_id), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT
      sku_id,
      sku_label,
      item,
      product_id,
      region_id,
      region_code,
      godown_id,
      godown_code,
      month_start,
      demand_baseline,
      supply_llt,
      supply_seasonal,
      supply_final,
      is_llt,
      is_seasonal,
      -- derived relevance flags
      ( ((supply_llt IS NULL) OR (p_treat_zero_missing AND supply_llt = 0)) AND COALESCE(is_llt,false) ) AS missing_llt_relevant,
      ( ((supply_seasonal IS NULL) OR (p_treat_zero_missing AND supply_seasonal = 0)) AND COALESCE(is_seasonal,false) ) AS missing_seasonal_relevant
    FROM (
      SELECT
        v.sku_id,
        v.region_id,
        v.godown_id,
        v.month_start,
        v.demand_baseline,
        v.supply_llt,
        v.supply_seasonal,
        v.supply_final,
        v.product_id,
        v.is_llt,
        v.is_seasonal,
        v.sku_label,
        v.item,
        v.region_code,
        v.godown_code
      FROM public.v_forecast_exceptions v
      WHERE v.month_start >= p_start
        AND v.month_start < p_end
        AND (p_sku_id IS NULL OR v.sku_id = p_sku_id)
        AND (p_region_id IS NULL OR v.region_id = p_region_id)
        AND (p_godown_id IS NULL OR v.godown_id = p_godown_id)
    ) src
    WHERE (
      ( ((src.supply_llt IS NULL) OR (p_treat_zero_missing AND src.supply_llt = 0)) AND COALESCE(src.is_llt, false) )
      OR ( ((src.supply_seasonal IS NULL) OR (p_treat_zero_missing AND src.supply_seasonal = 0)) AND COALESCE(src.is_seasonal, false) )
      OR (p_include_unknown_mappings AND src.product_id IS NULL AND ( ((src.supply_llt IS NULL) OR (p_treat_zero_missing AND src.supply_llt = 0)) OR ((src.supply_seasonal IS NULL) OR (p_treat_zero_missing AND src.supply_seasonal = 0)) ) )
    )
    ORDER BY month_start, sku_id, region_id, godown_id
    LIMIT GREATEST(p_page_size,1) OFFSET offset_val
  ) r;

  RETURN jsonb_build_object(
    'total_count', _total,
    'page', GREATEST(p_page,1),
    'page_size', GREATEST(p_page_size,1),
    'rows', _rows
  );
END;
$$;

-- Lightweight summary helper for dashboard tiles.
-- Provides aggregate counts without transferring row-level data.
CREATE OR REPLACE FUNCTION public.count_forecast_exceptions_summary(
  p_start date,
  p_end date,
  p_treat_zero_missing boolean DEFAULT false,
  p_include_unknown_mappings boolean DEFAULT false
)
RETURNS TABLE(
  missing_month_rows bigint,
  missing_llt_relevant bigint,
  missing_seasonal_relevant bigint
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      v.product_id,
      v.is_llt,
      v.is_seasonal,
      ((v.supply_llt IS NULL) OR (p_treat_zero_missing AND v.supply_llt = 0)) AS raw_missing_llt,
      ((v.supply_seasonal IS NULL) OR (p_treat_zero_missing AND v.supply_seasonal = 0)) AS raw_missing_seasonal
    FROM public.v_forecast_exceptions v
    WHERE v.month_start >= p_start
      AND v.month_start < p_end
  )
  SELECT
    count(*)
      FILTER (
        WHERE
          (raw_missing_llt AND COALESCE(is_llt, false))
          OR (raw_missing_seasonal AND COALESCE(is_seasonal, false))
          OR (
            p_include_unknown_mappings
            AND product_id IS NULL
            AND (raw_missing_llt OR raw_missing_seasonal)
          )
      ) AS missing_month_rows,
    count(*) FILTER (WHERE raw_missing_llt AND COALESCE(is_llt,false)) AS missing_llt_relevant,
    count(*) FILTER (WHERE raw_missing_seasonal AND COALESCE(is_seasonal,false)) AS missing_seasonal_relevant
  FROM base;
$$;
