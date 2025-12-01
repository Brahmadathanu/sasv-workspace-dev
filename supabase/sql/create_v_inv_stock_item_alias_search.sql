-- Flattened view to simplify searching and paging from the client
-- Run this in your Supabase SQL editor (or include in migrations).
CREATE OR REPLACE VIEW public.v_inv_stock_item_alias_search AS
SELECT
  a.id,
  a.tally_item_name,
  a.source_kind,
  a.source_system,
  a.alias_key,
  a.inv_stock_item_id,
  a.status,
  a.note,
  a.first_seen,
  a.last_seen,
  a.created_at,
  a.last_updated_at,
  i.code    AS inv_code,
  i.name    AS inv_name,
  i.default_uom_id AS inv_default_uom_id,
  i.active  AS inv_active,
  i.hsn_code AS inv_hsn_code
FROM public.inv_stock_item_alias a
LEFT JOIN public.inv_stock_item i ON i.id = a.inv_stock_item_id;

-- Optional: grant select to anon role if your RLS requires it (adjust role as needed)
-- GRANT SELECT ON public.v_inv_stock_item_alias_search TO anon;
