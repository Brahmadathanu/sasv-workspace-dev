-- PEC-ERP-S3-E — REVIEW-ONLY SQL CANDIDATE, NOT A PRODUCTION MIGRATION.
-- Does not replace proc_pec_purchase_excess(). No tables/grants altered.
-- STOP until isolated PostgreSQL 17.4 runtime, permission, count and ordering
-- parity tests plus owner-approved migration. Explicitly read-only.
--
-- One JSON object is returned even when zero records match. A page of zero rows
-- still includes total_count, permitting out-of-range page correction.
CREATE OR REPLACE FUNCTION public.proc_pec_purchase_excess_paged(
    p_search text DEFAULT NULL,
    p_material_class_code text DEFAULT NULL,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL,
    p_min_qty numeric DEFAULT NULL,
    p_vendor_q text DEFAULT NULL,
    p_item_q text DEFAULT NULL,
    p_unmapped_only boolean DEFAULT false,
    p_limit integer DEFAULT 30,
    p_offset integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $pec_s3_e$
DECLARE
    v_result jsonb;
    v_class text := upper(btrim(coalesce(p_material_class_code, '')));
    v_search text := lower(btrim(coalesce(p_search, '')));
    v_vendor text := lower(btrim(coalesce(p_vendor_q, '')));
    v_item text := lower(btrim(coalesce(p_item_q, '')));
BEGIN
    PERFORM public.require_permission('module:procurement-execution-console', false);
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 200 THEN
        RAISE EXCEPTION 'p_limit must be between 1 and 200';
    END IF;
    IF p_offset IS NULL OR p_offset < 0 THEN
        RAISE EXCEPTION 'p_offset must be nonnegative';
    END IF;
    IF p_date_from IS NOT NULL AND p_date_to IS NOT NULL AND p_date_from > p_date_to THEN
        RAISE EXCEPTION 'Invalid date range';
    END IF;
    IF p_min_qty IS NOT NULL AND (p_min_qty = 'NaN'::numeric OR p_min_qty = 'Infinity'::numeric OR p_min_qty = '-Infinity'::numeric) THEN
        RAISE EXCEPTION 'p_min_qty must be finite';
    END IF;
    IF v_class = 'PLM' THEN v_class := 'PM'; END IF;

    WITH filtered AS MATERIALIZED (
        SELECT x.*
        FROM public.v_proc_purchase_excess_console x
        WHERE (v_search = '' OR strpos(lower(coalesce(x.stock_item_name, '')), v_search) > 0)
          AND (v_class = '' OR
               (CASE WHEN upper(btrim(coalesce(x.material_class_code, ''))) = 'PLM'
                  THEN 'PM' ELSE upper(btrim(coalesce(x.material_class_code, ''))) END) = v_class)
          AND (p_min_qty IS NULL OR p_min_qty <= 0 OR coalesce(x.net_unallocated_qty, 0) >= p_min_qty)
          AND (p_date_from IS NULL OR x.voucher_date >= p_date_from)
          AND (p_date_to IS NULL OR x.voucher_date <= p_date_to)
          AND (v_vendor = '' OR strpos(lower(coalesce(x.vendor_display_name, '')), v_vendor) > 0)
          AND (v_item = '' OR strpos(lower(coalesce(x.stock_item_name, '')), v_item) > 0
                              OR strpos(lower(coalesce(x.stock_item_code, '')), v_item) > 0)
          AND (NOT coalesce(p_unmapped_only, false)
               OR x.vendor_display_name IS NULL OR x.vendor_display_name = '')
    ), page_rows AS (
        SELECT *
        FROM filtered
        ORDER BY net_unallocated_qty DESC NULLS LAST,
                 voucher_date DESC NULLS LAST,
                 purchase_fact_id DESC
        LIMIT p_limit OFFSET p_offset
    ), page_json AS (
        SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY
             r.net_unallocated_qty DESC NULLS LAST,
             r.voucher_date DESC NULLS LAST,
             r.purchase_fact_id DESC), '[]'::jsonb) AS rows
        FROM page_rows r
    )
    SELECT jsonb_build_object(
        'rows', j.rows,
        'total_count', (SELECT count(*) FROM filtered),
        'limit', p_limit,
        'offset', p_offset
    )
    INTO v_result FROM page_json j;
    RETURN v_result;
END;
$pec_s3_e$;

REVOKE ALL ON FUNCTION public.proc_pec_purchase_excess_paged(
    text,text,date,date,numeric,text,text,boolean,integer,integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_purchase_excess_paged(
    text,text,date,date,numeric,text,text,boolean,integer,integer
) TO authenticated, service_role;

-- REQUIRES before any promotion:
-- 1. Exact PG17.4 installation on isolated fixture (not production).
-- 2. Denied anonymous and view-less; allowed view-only + editor.
-- 3. Filter parity: PM/PLM, literal '%'/'_', NULL and '' vendor,
--    mixed-case partial item name/code, zero and negative min qty,
--    inclusive dates, invalid date and non-finite numeric rejection.
-- 4. Page 1..N concatenated IDs and count match filtered oracle. Equal
--    qty/date rows verify purchase_fact_id deterministic tie-break.
-- 5. Empty, offset beyond end, size=1,30,200, invalid caps.
-- 6. Existing audit, export/full rows, action queue RPC unaffected.
-- 7. Explicit read-only signed-in performance and actual PWA freshness.
