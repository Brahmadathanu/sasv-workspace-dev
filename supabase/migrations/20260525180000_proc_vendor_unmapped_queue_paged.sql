-- supabase/migrations/20260525180000_proc_vendor_unmapped_queue_paged.sql
-- Migration to create paged unmapped vendor alias queue RPC for performance.

CREATE OR REPLACE FUNCTION public.proc_vendor_unmapped_queue_paged(
  p_q text DEFAULT '',
  p_limit integer DEFAULT 75,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  alias_key text,
  alias_text text,
  source_system text,
  status text,
  vendor_id integer,
  total_count bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
WITH filtered AS (
  SELECT 
    v.alias_key,
    v.alias_text,
    v.source_system,
    v.status,
    v.vendor_id
  FROM public.v_proc_vendor_alias_unmapped_queue v
  WHERE p_q = '' OR v.alias_text ILIKE '%' || p_q || '%'
),
total AS (
  SELECT COUNT(*) AS count_val FROM filtered
)
SELECT 
  f.alias_key,
  f.alias_text,
  f.source_system,
  f.status,
  f.vendor_id,
  t.count_val::bigint AS total_count
FROM filtered f
CROSS JOIN total t
ORDER BY f.alias_text ASC
LIMIT p_limit
OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.proc_vendor_unmapped_queue_paged(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.proc_vendor_unmapped_queue_paged(text, integer, integer) TO anon;

-- Notify postgrest to reload schema cache
NOTIFY pgrst, 'reload schema';
