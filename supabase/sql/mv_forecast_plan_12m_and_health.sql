-- Materialized view and helper functions for Forecast dashboard
-- Creates a materialized copy of v_forecast_plan_12m (named with mv_ prefix)
-- and provides RPCs that read counts from the materialized view for fast dashboard queries.

-- 1) Materialized view: snapshot of the combined 12-month plan view
-- NOTE: run this once in the Supabase SQL editor as an admin.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_forecast_plan_12m AS
SELECT * FROM public.v_forecast_plan_12m;

-- 2) Indexes to speed lookups (non-unique). If the underlying data guarantees uniqueness
-- for (sku_id, region_id, godown_id, month_start) you may create a UNIQUE index to
-- allow CONCURRENT refreshing.
CREATE INDEX IF NOT EXISTS mv_fp_month_start_idx ON public.mv_forecast_plan_12m (month_start);
CREATE INDEX IF NOT EXISTS mv_fp_sku_region_godown_idx ON public.mv_forecast_plan_12m (sku_id, region_id, godown_id);

-- 3) Safe refresh helper: tries CONCURRENTLY first, falls back to non-concurrent refresh
-- (CONCURRENTLY requires a unique index on the materialized view).
CREATE OR REPLACE FUNCTION public.refresh_mv_forecast_plan_12m()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    -- try concurrent refresh (minimal lock) if possible
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_forecast_plan_12m';
  EXCEPTION WHEN OTHERS THEN
    -- Fall back to non-concurrent refresh which will take an exclusive lock
    RAISE NOTICE 'Concurrent refresh failed (%), falling back to non-concurrent refresh', SQLERRM;
    EXECUTE 'REFRESH MATERIALIZED VIEW public.mv_forecast_plan_12m';
  END;
END;
$$;

-- 4) RPC: fast counts reading from materialized view
CREATE OR REPLACE FUNCTION public.count_forecast_health_mv(p_start date, p_end date)
RETURNS TABLE(
  pairs_count bigint,
  rows_count bigint,
  missing_llt_relevant bigint,
  missing_seasonal_relevant bigint,
  active_overrides_count bigint
)
LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT count(distinct (v.sku_id, v.region_id, v.godown_id))
     FROM public.mv_forecast_plan_12m v
     WHERE v.month_start >= p_start AND v.month_start < p_end
    ) AS pairs_count,
    (SELECT count(*)
     FROM public.mv_forecast_plan_12m v
     WHERE v.month_start >= p_start AND v.month_start < p_end
    ) AS rows_count,
    (SELECT count(*)
     FROM public.mv_forecast_plan_12m v
     LEFT JOIN public.product_skus ps ON ps.id = v.sku_id
     LEFT JOIN public.products p ON p.id = ps.product_id
     WHERE v.month_start >= p_start AND v.month_start < p_end
       AND v.supply_llt IS NULL
       AND COALESCE(p.is_llt, false) = true
    ) AS missing_llt_relevant,
    (SELECT count(*)
     FROM public.mv_forecast_plan_12m v
     LEFT JOIN public.product_skus ps ON ps.id = v.sku_id
     LEFT JOIN public.products p ON p.id = ps.product_id
     WHERE v.month_start >= p_start AND v.month_start < p_end
       AND v.supply_seasonal IS NULL
       AND COALESCE(p.is_seasonal, false) = true
    ) AS missing_seasonal_relevant,
    (SELECT count(*) FROM public.forecast_demand_overrides WHERE is_active = true) AS active_overrides_count;
$$;

-- 5) Optional RPC for distinct pairs only (reads materialized view)
CREATE OR REPLACE FUNCTION public.count_forecast_pairs_mv(p_start date, p_end date)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT count(distinct (sku_id, region_id, godown_id))
  FROM public.mv_forecast_plan_12m v
  WHERE v.month_start >= p_start AND v.month_start < p_end;
$$;

-- Usage notes:
-- 1) Run this SQL in Supabase SQL editor to create the materialized view & functions.
-- 2) After your upstream forecast/LLT/seasonal jobs complete, call:
--    SELECT public.refresh_mv_forecast_plan_12m();
--    (If refresh concurrently fails, function will fall back to non-concurrent refresh.)
-- 3) Update the dashboard client to call `count_forecast_health_mv` (or keep the existing RPC
--    but have it read from the materialized view).
