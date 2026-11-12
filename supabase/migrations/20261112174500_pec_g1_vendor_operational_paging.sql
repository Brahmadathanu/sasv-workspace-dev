-- PEC G1: operator vendor bucket filter must execute BEFORE paging.
-- Two additive read-only functions; existing filtered and paged RPCs untouched.
-- Decisions from shared client getVwlOperationalFilterValue().
BEGIN;
CREATE OR REPLACE FUNCTION public.proc_vendorwise_buylist_operational_paged(p_material_class_id bigint DEFAULT NULL::bigint, p_rm_scope text DEFAULT NULL::text, p_rate_status text DEFAULT NULL::text, p_assignment_status text DEFAULT NULL::text, p_q text DEFAULT NULL::text, p_operational_filter text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
 SELECT to_jsonb(t) AS row_data,count(*) OVER()::bigint AS total_count
 FROM (
  SELECT f.*,
    CASE
 WHEN f.vendor_bucket_type='LOCAL_PURCHASE' OR f.vendor_bucket_key='LOCAL_PURCHASE' THEN 'bucket:LOCAL_PURCHASE'
 WHEN f.vendor_bucket_type='UNASSIGNED' OR f.vendor_bucket_key='UNASSIGNED' THEN 'bucket:UNASSIGNED'
 WHEN f.vendor_id IS NOT NULL AND f.vendor_id>0 THEN 'vendor:'||f.vendor_id::text
 ELSE 'bucket:UNASSIGNED'
 END AS operational_filter_value
  FROM public.proc_vendorwise_buylist_filtered_pec_internal(
    p_material_class_id,p_rm_scope,p_rate_status,p_assignment_status,p_q) f
 ) t
 WHERE NULLIF(trim(p_operational_filter),'') IS NULL
    OR t.operational_filter_value=trim(p_operational_filter)
 ORDER BY CASE WHEN t.vendor_bucket_key='UNASSIGNED' THEN 1 ELSE 0 END,
 t.vendor_bucket_name ASC NULLS LAST,t.stock_item_name ASC NULLS LAST,t.uom_code ASC NULLS LAST,
 t.vendor_bucket_key ASC NULLS LAST,t.material_class_id ASC NULLS LAST,
 t.stock_item_id ASC,t.uom_id ASC
 LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_vendorwise_buylist_operational_paged(p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text, p_operational_filter text, p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_vendorwise_buylist_operational_paged(p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text, p_operational_filter text, p_limit integer, p_offset integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.proc_vendorwise_buylist_operational_options(p_material_class_id bigint DEFAULT NULL::bigint, p_rm_scope text DEFAULT NULL::text, p_rate_status text DEFAULT NULL::text, p_assignment_status text DEFAULT NULL::text, p_q text DEFAULT NULL::text)
 RETURNS TABLE(filter_value text, filter_label text, filter_type text, group_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',false);
 RETURN QUERY
 WITH base AS (
 SELECT CASE
 WHEN f.vendor_bucket_type='LOCAL_PURCHASE' OR f.vendor_bucket_key='LOCAL_PURCHASE' THEN 'bucket:LOCAL_PURCHASE'
 WHEN f.vendor_bucket_type='UNASSIGNED' OR f.vendor_bucket_key='UNASSIGNED' THEN 'bucket:UNASSIGNED'
 WHEN f.vendor_id IS NOT NULL AND f.vendor_id>0 THEN 'vendor:'||f.vendor_id::text
 ELSE 'bucket:UNASSIGNED'
 END AS operational_filter_value,
        f.vendor_bucket_name, f.vendor_bucket_type, f.vendor_bucket_key
 FROM public.proc_vendorwise_buylist_filtered_pec_internal(
 p_material_class_id,p_rm_scope,p_rate_status,p_assignment_status,p_q) f
 ) SELECT b.operational_filter_value,
 max(b.vendor_bucket_name)::text,
 CASE WHEN b.operational_filter_value='bucket:LOCAL_PURCHASE' THEN 'LOCAL_PURCHASE'
      WHEN b.operational_filter_value='bucket:UNASSIGNED' THEN 'UNASSIGNED'
      ELSE 'ACTUAL_VENDOR' END::text,
 count(*)::bigint
 FROM base b
 GROUP BY b.operational_filter_value
 ORDER BY CASE WHEN b.operational_filter_value='bucket:LOCAL_PURCHASE' THEN 0
               WHEN b.operational_filter_value='bucket:UNASSIGNED' THEN 2 ELSE 1 END,
 max(b.vendor_bucket_name);
END $function$;
REVOKE ALL ON FUNCTION public.proc_vendorwise_buylist_operational_options(p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_vendorwise_buylist_operational_options(p_material_class_id bigint, p_rm_scope text, p_rate_status text, p_assignment_status text, p_q text) TO authenticated,service_role;
COMMIT;
