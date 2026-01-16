-- rpc_procurement_rpcs.sql
-- Parameterized RPC bundle for procurement/overlay/conversion/trace searches
-- NOTE: replace RPC_OWNER with the dedicated DB role you want to own these functions (e.g. rpc_service)
-- You may also want to GRANT EXECUTE to your web role (e.g. web_anon / authenticated).

BEGIN;

-- -----------------------------------------------------------------------------
-- RPC: procurement plan search
-- Returns: rows as JSON and total_count (pagination)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_procurement_plan_search(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_material_kind text DEFAULT NULL,
  p_only_net boolean DEFAULT false,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 100
)
RETURNS TABLE(row_data jsonb, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT *
  FROM public.v_mrp_procurement_plan
  WHERE (p_start IS NULL OR month_start >= p_start)
    AND (p_end IS NULL OR month_start <= p_end)
    AND (p_material_kind IS NULL OR material_kind = p_material_kind)
    AND (NOT p_only_net OR COALESCE(net_need_qty,0) <> 0)
),
filtered AS (
  SELECT * FROM base
  WHERE (p_search IS NULL
    OR (stock_item_id IS NOT NULL AND stock_item_id::text ILIKE '%'||p_search||'%')
    OR (stock_item_name IS NOT NULL AND stock_item_name ILIKE '%'||p_search||'%')
    OR (uom_code IS NOT NULL AND uom_code ILIKE '%'||p_search||'%')
  )
),
numbered AS (
  SELECT row_to_json(filtered.*) AS row_data, count(*) OVER() AS total_count,
         row_number() OVER (ORDER BY month_start, stock_item_id) as rn
  FROM filtered
)
SELECT row_data, total_count
FROM numbered
WHERE rn > (p_page-1)*p_per_page AND rn <= p_page*p_per_page;
$$;

-- ALTER FUNCTION public.rpc_procurement_plan_search(date,date,text,text,boolean,integer,integer) OWNER TO rpc_service; -- commented out: role not found in target DB
GRANT EXECUTE ON FUNCTION public.rpc_procurement_plan_search(date,date,text,text,boolean,integer,integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: overlay monthly search
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_overlay_monthly_search(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_run_id uuid DEFAULT NULL,
  p_only_nonzero boolean DEFAULT false,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 100
)
RETURNS TABLE(row_data jsonb, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT *
  FROM public.v_mrp_rm_overlay_season_monthly_active
  WHERE (p_start IS NULL OR month_start >= p_start)
    AND (p_end IS NULL OR month_start <= p_end)
    AND (p_run_id IS NULL OR overlay_run_id = p_run_id)
    AND (NOT p_only_nonzero OR COALESCE(overlay_procure_qty,0) <> 0)
),
filtered AS (
  SELECT * FROM base
  WHERE (p_search IS NULL
    OR (rm_stock_item_id IS NOT NULL AND rm_stock_item_id::text ILIKE '%'||p_search||'%')
    OR (overlay_run_id IS NOT NULL AND overlay_run_id::text ILIKE '%'||p_search||'%')
  )
),
numbered AS (
  SELECT row_to_json(filtered.*) AS row_data, count(*) OVER() AS total_count,
         row_number() OVER (ORDER BY month_start, rm_stock_item_id) as rn
  FROM filtered
)
SELECT row_data, total_count
FROM numbered
WHERE rn > (p_page-1)*p_per_page AND rn <= p_page*p_per_page;
$$;

-- ALTER FUNCTION public.rpc_overlay_monthly_search(date,date,text,uuid,boolean,integer,integer) OWNER TO rpc_service; -- commented out: role not found in target DB
GRANT EXECUTE ON FUNCTION public.rpc_overlay_monthly_search(date,date,text,uuid,boolean,integer,integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: conversion contribution summary search
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_conversion_summary_search(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 100
)
RETURNS TABLE(row_data jsonb, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT *
  FROM public.v_mrp_rm_conversion_contrib_summary
  WHERE (p_start IS NULL OR month_start >= p_start)
    AND (p_end IS NULL OR month_start <= p_end)
),
filtered AS (
  SELECT * FROM base
  WHERE (p_search IS NULL
    OR (purchase_stock_item_id IS NOT NULL AND purchase_stock_item_id::text ILIKE '%'||p_search||'%')
    OR (purchase_item_name IS NOT NULL AND purchase_item_name ILIKE '%'||p_search||'%')
    OR (uom_code IS NOT NULL AND uom_code ILIKE '%'||p_search||'%')
  )
),
numbered AS (
  SELECT row_to_json(filtered.*) AS row_data, count(*) OVER() AS total_count,
         row_number() OVER (ORDER BY month_start, purchase_stock_item_id) as rn
  FROM filtered
)
SELECT row_data, total_count
FROM numbered
WHERE rn > (p_page-1)*p_per_page AND rn <= p_page*p_per_page;
$$;

-- ALTER FUNCTION public.rpc_conversion_summary_search(date,date,text,integer,integer) OWNER TO rpc_service; -- commented out: role not found in target DB
GRANT EXECUTE ON FUNCTION public.rpc_conversion_summary_search(date,date,text,integer,integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- RPC: trace search (traceability)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_trace_search(
  p_start date DEFAULT NULL,
  p_end date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_per_page integer DEFAULT 100
)
RETURNS TABLE(row_data jsonb, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH base AS (
  SELECT *
  FROM public.v_mrp_rm_trace
  WHERE (p_start IS NULL OR period_start >= p_start)
    AND (p_end IS NULL OR period_start <= p_end)
),
filtered AS (
  SELECT * FROM base
  WHERE (p_search IS NULL
    OR (rm_stock_item_id IS NOT NULL AND rm_stock_item_id::text ILIKE '%'||p_search||'%')
    OR (rm_name IS NOT NULL AND rm_name ILIKE '%'||p_search||'%')
    OR (product_name IS NOT NULL AND product_name ILIKE '%'||p_search||'%')
    OR (batch_number IS NOT NULL AND batch_number ILIKE '%'||p_search||'%')
  )
),
numbered AS (
  SELECT row_to_json(filtered.*) AS row_data, count(*) OVER() AS total_count,
         row_number() OVER (ORDER BY period_start, rm_stock_item_id) as rn
  FROM filtered
)
SELECT row_data, total_count
FROM numbered
WHERE rn > (p_page-1)*p_per_page AND rn <= p_page*p_per_page;
$$;

-- ALTER FUNCTION public.rpc_trace_search(date,date,text,integer,integer) OWNER TO rpc_service; -- commented out: role not found in target DB
GRANT EXECUTE ON FUNCTION public.rpc_trace_search(date,date,text,integer,integer) TO authenticated;

-- -----------------------------------------------------------------------------
-- Optional: GRANT EXECUTE to roles (uncomment/adjust as needed)
-- GRANT EXECUTE ON FUNCTION public.rpc_procurement_plan_search(date,date,text,text,boolean,integer,integer) TO web_anon;
-- GRANT EXECUTE ON FUNCTION public.rpc_overlay_monthly_search(date,date,text,uuid,boolean,integer,integer) TO web_anon;
-- GRANT EXECUTE ON FUNCTION public.rpc_conversion_summary_search(date,date,text,integer,integer) TO web_anon;
-- GRANT EXECUTE ON FUNCTION public.rpc_trace_search(date,date,text,integer,integer) TO web_anon;

COMMIT;
