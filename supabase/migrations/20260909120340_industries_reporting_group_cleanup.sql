-- backfilled from live schema_migrations on 2026-10-24, CI-016
CREATE OR REPLACE VIEW public.v_industries_monthly_product AS
SELECT
  s.month_start,
  s.product_id,
  d.product_name,
  CASE WHEN d.group_name='XX' THEN d.category_name ELSE d.group_name END AS product_group,
  CASE WHEN s.product_id=695 THEN 'Kg' ELSE s.uom_base END AS uom_base,
  CASE WHEN s.product_id=695 THEN sum(s.quantity_base)/1000.0 ELSE sum(s.quantity_base) END AS aggregated_quantity,
  CASE WHEN count(*) FILTER (WHERE s.canonical_rate_per_base IS NULL)=0 THEN sum(s.production_value) ELSE NULL::numeric END AS aggregated_value,
  count(DISTINCT s.sku_id) AS sku_count,
  count(DISTINCT s.sku_id) FILTER (WHERE s.canonical_rate_per_base IS NULL) AS unresolved_sku_count,
  CASE
    WHEN count(*) FILTER (WHERE s.canonical_rate_per_base IS NULL)>0 THEN 'INCOMPLETE_RATE_COVERAGE'
    WHEN count(*) FILTER (WHERE s.rate_basis='GOOGLE_ALL_COST_SHEETS_COST_OF_PROD')>0 THEN 'COMPLETE_WITH_GOOGLE_COST_OF_PROD'
    WHEN count(*) FILTER (WHERE s.rate_basis='INTERNAL_LOADED_COST_REVIEW_REQUIRED')>0 THEN 'COMPLETE_WITH_INTERNAL_LOADED_COST'
    WHEN count(*) FILTER (WHERE s.rate_basis='SIBLING_SKU_TRANSFER_SCALED')>0 THEN 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'
    ELSE 'COMPLETE'
  END AS valuation_status
FROM public.v_industries_monthly_sku_valued s
JOIN public.v_product_details d ON d.product_id=s.product_id
WHERE d.category_name IS DISTINCT FROM 'RM Sales'
GROUP BY s.month_start,s.product_id,d.product_name,
         CASE WHEN d.group_name='XX' THEN d.category_name ELSE d.group_name END,
         CASE WHEN s.product_id=695 THEN 'Kg' ELSE s.uom_base END;

CREATE OR REPLACE VIEW public.v_industries_monthly_product_group AS
SELECT
  month_start,
  product_group,
  uom_base,
  sum(aggregated_quantity) AS aggregated_quantity,
  CASE WHEN count(*) FILTER (WHERE valuation_status='INCOMPLETE_RATE_COVERAGE')=0 THEN sum(aggregated_value) ELSE NULL::numeric END AS aggregated_value,
  count(DISTINCT product_id) AS product_count,
  sum(sku_count) AS sku_count,
  sum(unresolved_sku_count) AS unresolved_sku_count,
  CASE
    WHEN count(*) FILTER (WHERE valuation_status='INCOMPLETE_RATE_COVERAGE')>0 THEN 'INCOMPLETE_RATE_COVERAGE'
    WHEN count(*) FILTER (WHERE valuation_status='COMPLETE_WITH_GOOGLE_COST_OF_PROD')>0 THEN 'COMPLETE_WITH_GOOGLE_COST_OF_PROD'
    WHEN count(*) FILTER (WHERE valuation_status='COMPLETE_WITH_INTERNAL_LOADED_COST')>0 THEN 'COMPLETE_WITH_INTERNAL_LOADED_COST'
    WHEN count(*) FILTER (WHERE valuation_status='COMPLETE_WITH_SIBLING_TRANSFER_RATE')>0 THEN 'COMPLETE_WITH_SIBLING_TRANSFER_RATE'
    ELSE 'COMPLETE'
  END AS valuation_status
FROM public.v_industries_monthly_product
GROUP BY month_start,product_group,uom_base;