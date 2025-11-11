-- SECURITY DEFINER RPC to return paged publish lines with optional server-side enrichment
-- Returns: sku_id, item, pack_size, uom, month_start, region_id, region_code, godown_id, godown_code, demand_baseline, supply_llt, supply_seasonal, supply_final
CREATE OR REPLACE FUNCTION public.get_publish_lines(
  p_plan_id bigint,
  p_page int DEFAULT 0,
  p_page_size int DEFAULT 1000
) RETURNS TABLE(
  sku_id bigint,
  item text,
  pack_size text,
  uom text,
  month_start date,
  region_id int,
  region_code text,
  godown_id int,
  godown_code text,
  demand_baseline numeric,
  supply_llt numeric,
  supply_seasonal numeric,
  supply_final numeric
) LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    l.sku_id,
    s.item,
    s.pack_size,
    s.uom,
    l.month_start,
    l.region_id,
    gregion.region_code,
    l.godown_id,
    ggodown.godown_code,
    l.demand_baseline,
    l.supply_llt,
    l.supply_seasonal,
    l.supply_final
  FROM public.plan_publish_lines l
  LEFT JOIN public.v_sku_catalog_enriched s ON s.sku_id = l.sku_id
  LEFT JOIN public.v_sdv_dim_godown_region gregion ON gregion.region_id = l.region_id
  LEFT JOIN public.v_sdv_dim_godown_region ggodown ON ggodown.godown_id = l.godown_id
  WHERE l.plan_id = p_plan_id
  ORDER BY l.sku_id, l.region_id, l.godown_id, l.month_start
  OFFSET (p_page * p_page_size)
  LIMIT p_page_size;
$$;

-- Grant execute example (run in Supabase SQL editor as appropriate):
-- GRANT EXECUTE ON FUNCTION public.get_publish_lines(bigint,int,int) TO anon;

COMMENT ON FUNCTION public.get_publish_lines(bigint,int,int) IS 'Return paged publish lines for a publish header with SKU and region/godown enrichment (SECURITY DEFINER)';
