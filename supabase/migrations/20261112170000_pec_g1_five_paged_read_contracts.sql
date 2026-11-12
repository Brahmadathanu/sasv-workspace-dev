-- PEC G1 read-side contract. Additive RPCs, no existing API replacement and no data DML.
-- Five stable deterministic ordered paged reads, maximum 200 per call.
-- Credentials: existing module VIEW permission; anon and PUBLIC cannot EXECUTE.
-- row_data preserves the legacy view columns, total_count counts filtered results.
-- Empty page returns zero rows; client must interpret total=0 at offset=0.
-- Offset paging can shift if source data changes concurrently; client must reset on filters.
BEGIN;
-- proc_pec_pr_headers_paged
CREATE OR REPLACE FUNCTION public.proc_pec_pr_headers_paged(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
    RAISE EXCEPTION 'PEC paging requires limit 1..200 and offset 0..100000';
  END IF;
  RETURN QUERY
    SELECT to_jsonb(f) AS row_data, count(*) OVER()::bigint AS total_count
    FROM public.v_proc_pr_header f
    ORDER BY f.updated_at DESC NULLS LAST, f.pr_id DESC
    LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_pr_headers_paged(p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_pr_headers_paged(p_limit integer, p_offset integer) TO authenticated,service_role;

-- proc_pec_indent_headers_paged
CREATE OR REPLACE FUNCTION public.proc_pec_indent_headers_paged(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
    RAISE EXCEPTION 'PEC paging requires limit 1..200 and offset 0..100000';
  END IF;
  RETURN QUERY
    SELECT to_jsonb(f) AS row_data, count(*) OVER()::bigint AS total_count
    FROM public.v_proc_indent_console f
    ORDER BY f.updated_at DESC NULLS LAST, f.indent_id DESC
    LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_indent_headers_paged(p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_indent_headers_paged(p_limit integer, p_offset integer) TO authenticated,service_role;

-- proc_pec_purchase_excess_paged
CREATE OR REPLACE FUNCTION public.proc_pec_purchase_excess_paged(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
    RAISE EXCEPTION 'PEC paging requires limit 1..200 and offset 0..100000';
  END IF;
  RETURN QUERY
    SELECT to_jsonb(f) AS row_data, count(*) OVER()::bigint AS total_count
    FROM public.v_proc_purchase_excess_console f
    ORDER BY f.voucher_date DESC NULLS LAST, f.purchase_fact_id DESC
    LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_purchase_excess_paged(p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_purchase_excess_paged(p_limit integer, p_offset integer) TO authenticated,service_role;

-- proc_pec_excess_acceptance_audit_paged
CREATE OR REPLACE FUNCTION public.proc_pec_excess_acceptance_audit_paged(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
    RAISE EXCEPTION 'PEC paging requires limit 1..200 and offset 0..100000';
  END IF;
  RETURN QUERY
    SELECT to_jsonb(f) AS row_data, count(*) OVER()::bigint AS total_count
    FROM public.v_proc_excess_acceptance_audit_console f
    ORDER BY f.accepted_at DESC NULLS LAST, f.acceptance_id DESC
    LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_excess_acceptance_audit_paged(p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_excess_acceptance_audit_paged(p_limit integer, p_offset integer) TO authenticated,service_role;

-- proc_vendorwise_buylist_filtered_paged
CREATE OR REPLACE FUNCTION public.proc_vendorwise_buylist_filtered_paged(p_material_class_id bigint DEFAULT NULL::bigint, p_rm_scope text DEFAULT NULL::text, p_rate_status text DEFAULT NULL::text, p_assignment_status text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS TABLE(row_data jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  IF p_limit IS NULL OR p_limit<1 OR p_limit>200 OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN
    RAISE EXCEPTION 'PEC paging requires limit 1..200 and offset 0..100000';
  END IF;
  RETURN QUERY
    SELECT to_jsonb(f) AS row_data, count(*) OVER()::bigint AS total_count
    FROM public.proc_vendorwise_buylist_filtered_pec_internal(p_material_class_id,p_rm_scope,p_rate_status,p_assignment_status,p_q) f
    ORDER BY CASE WHEN f.vendor_bucket_key='UNASSIGNED' THEN 1 ELSE 0 END,
      f.vendor_bucket_name ASC NULLS LAST,
      f.stock_item_name ASC NULLS LAST,
      f.uom_code ASC NULLS LAST,
      f.vendor_bucket_key ASC NULLS LAST,
      f.material_class_id ASC NULLS LAST,
      f.stock_item_id ASC,
      f.uom_id ASC
    LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_vendorwise_buylist_filtered_paged(p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text, p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_vendorwise_buylist_filtered_paged(p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text, p_limit integer, p_offset integer) TO authenticated,service_role;

COMMIT;
