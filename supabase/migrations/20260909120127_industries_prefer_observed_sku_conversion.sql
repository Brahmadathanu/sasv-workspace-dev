-- backfilled from live schema_migrations on 2026-10-24, CI-016
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_viewdef('public.v_industries_sku_canonical_rate'::regclass, true) INTO def;
  def := replace(def,
    'COALESCE(m.base_qty_per_sku_unit, h.base_qty_per_sku_unit)',
    'COALESCE(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit)');
  def := replace(def,
    'COALESCE(m.base_qty_per_sku_unit, h.base_qty_per_sku_unit,',
    'COALESCE(h.base_qty_per_sku_unit, m.base_qty_per_sku_unit,');
  EXECUTE 'CREATE OR REPLACE VIEW public.v_industries_sku_canonical_rate AS ' || def;
END $$;