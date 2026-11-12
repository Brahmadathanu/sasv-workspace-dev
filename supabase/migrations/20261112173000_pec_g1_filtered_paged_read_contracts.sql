-- PEC G1 server-filter-before-pagination contracts; additive to the original paged functions.
-- No DML, prior RPC signature change or procurement-record mutation.
-- Each preserves existing JS filter semantics before count(*) OVER and LIMIT/OFFSET.
BEGIN;

CREATE OR REPLACE FUNCTION public.proc_pec_pr_headers_filtered_paged(p_status text DEFAULT NULL::text, p_material_class_id bigint DEFAULT NULL::bigint, p_q text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
 RETURN QUERY SELECT to_jsonb(f) AS row_data,count(*) OVER()::bigint AS total_count
 FROM public.v_proc_pr_header f
 WHERE (p_status IS NULL OR p_status='' OR f.status=p_status)
AND (p_material_class_id IS NULL OR f.material_class_id=p_material_class_id)
AND (NULLIF(p_q,'') IS NULL OR strpos(lower(coalesce(f.pr_number,'')),lower(p_q))>0)
 ORDER BY f.pr_id DESC
 LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_pr_headers_filtered_paged(p_status text, p_material_class_id bigint, p_q text, p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_pr_headers_filtered_paged(p_status text, p_material_class_id bigint, p_q text, p_limit integer, p_offset integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.proc_pec_indent_headers_filtered_paged(p_status text DEFAULT NULL::text, p_material_class_id bigint DEFAULT NULL::bigint, p_q text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
 RETURN QUERY SELECT to_jsonb(f) AS row_data,count(*) OVER()::bigint AS total_count
 FROM public.v_proc_indent_console f
 WHERE (p_status IS NULL OR p_status='' OR f.status=p_status)
AND (p_material_class_id IS NULL OR f.material_class_id=p_material_class_id)
AND (NULLIF(p_q,'') IS NULL OR strpos(lower(coalesce(f.indent_number,'')),lower(p_q))>0)
 ORDER BY f.indent_id DESC
 LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_indent_headers_filtered_paged(p_status text, p_material_class_id bigint, p_q text, p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_indent_headers_filtered_paged(p_status text, p_material_class_id bigint, p_q text, p_limit integer, p_offset integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.proc_pec_purchase_excess_filtered_paged(p_q text DEFAULT NULL::text, p_material_class_code text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_min_qty numeric DEFAULT NULL::numeric, p_vendor_q text DEFAULT NULL::text, p_item_q text DEFAULT NULL::text, p_unmapped_only boolean DEFAULT false, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
 RETURN QUERY SELECT to_jsonb(f) AS row_data,count(*) OVER()::bigint AS total_count
 FROM public.v_proc_purchase_excess_console f
 WHERE (NULLIF(p_q,'') IS NULL OR strpos(lower(coalesce(f.stock_item_name,'')),lower(p_q))>0)
AND (NULLIF(p_material_class_code,'') IS NULL OR
  (CASE WHEN upper(trim(f.material_class_code))='PLM' THEN 'PM' ELSE upper(trim(coalesce(f.material_class_code,''))) END)
  = (CASE WHEN upper(trim(p_material_class_code))='PLM' THEN 'PM' ELSE upper(trim(p_material_class_code)) END))
AND (p_date_from IS NULL OR f.voucher_date>=p_date_from)
AND (p_date_to IS NULL OR f.voucher_date<=p_date_to)
AND (p_min_qty IS NULL OR p_min_qty<=0 OR coalesce(f.net_unallocated_qty,0)>=p_min_qty)
AND (NULLIF(p_vendor_q,'') IS NULL OR strpos(lower(coalesce(f.vendor_display_name,'')),lower(p_vendor_q))>0)
AND (NULLIF(p_item_q,'') IS NULL OR strpos(lower(coalesce(f.stock_item_name,'')),lower(p_item_q))>0 OR strpos(lower(coalesce(f.stock_item_code,'')),lower(p_item_q))>0)
AND (coalesce(p_unmapped_only,false)=false OR f.vendor_display_name IS NULL OR f.vendor_display_name='')
 ORDER BY coalesce(f.net_unallocated_qty,0) DESC,f.voucher_date DESC NULLS LAST,f.purchase_fact_id DESC
 LIMIT p_limit OFFSET p_offset;
END $function$;
REVOKE ALL ON FUNCTION public.proc_pec_purchase_excess_filtered_paged(p_q text, p_material_class_code text, p_date_from date, p_date_to date, p_min_qty numeric, p_vendor_q text, p_item_q text, p_unmapped_only boolean, p_limit integer, p_offset integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_purchase_excess_filtered_paged(p_q text, p_material_class_code text, p_date_from date, p_date_to date, p_min_qty numeric, p_vendor_q text, p_item_q text, p_unmapped_only boolean, p_limit integer, p_offset integer) TO authenticated,service_role;
COMMIT;
