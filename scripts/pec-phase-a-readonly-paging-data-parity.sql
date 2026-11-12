-- PEC Phase A: read-only source-data paging and operational-bucket verifier.
-- Execute under authorized read-only administrator connection only; this does
-- NOT impersonate JWT users and is NOT an authenticated PWA/RPC test.
-- Any nonzero duplicate/no-group result is a release investigation gate.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '12000ms';
WITH
 pr AS (SELECT pr_id,row_number() OVER (ORDER BY pr_id DESC) rn
         FROM public.v_proc_pr_header),
 ih AS (SELECT indent_id,row_number() OVER (ORDER BY indent_id DESC) rn
         FROM public.v_proc_indent_console),
 ex AS (SELECT purchase_fact_id,row_number() OVER (
            ORDER BY coalesce(net_unallocated_qty,0) DESC,
                     voucher_date DESC NULLS LAST,purchase_fact_id DESC) rn
         FROM public.v_proc_purchase_excess_console
        WHERE voucher_date>=CURRENT_DATE-30),
 vwl AS (
   SELECT f.stock_item_id,f.material_class_id,f.uom_id,f.vendor_bucket_key,
     CASE WHEN f.vendor_bucket_type='LOCAL_PURCHASE'
             OR f.vendor_bucket_key='LOCAL_PURCHASE' THEN 'bucket:LOCAL_PURCHASE'
          WHEN f.vendor_bucket_type='UNASSIGNED'
             OR f.vendor_bucket_key='UNASSIGNED' THEN 'bucket:UNASSIGNED'
          WHEN f.vendor_id IS NOT NULL AND f.vendor_id>0 THEN 'vendor:'||f.vendor_id::text
          ELSE 'bucket:UNASSIGNED' END AS operational_filter_value,
     row_number() OVER (
        ORDER BY CASE WHEN f.vendor_bucket_key='UNASSIGNED' THEN 1 ELSE 0 END,
        f.vendor_bucket_name ASC NULLS LAST,f.stock_item_name ASC NULLS LAST,
        f.uom_code ASC NULLS LAST,f.vendor_bucket_key ASC NULLS LAST,
        f.material_class_id ASC NULLS LAST,f.stock_item_id,f.uom_id) rn
   FROM public.proc_vendorwise_buylist_filtered_pec_internal(
        NULL,NULL,NULL,NULL,NULL) f
 )
SELECT 'PR' AS lens,count(*) total_rows,
 count(*) FILTER(WHERE rn<=100) first_page,
 count(*) FILTER(WHERE rn>100 AND rn<=200) second_page,
 count(*)-count(DISTINCT pr_id) AS duplicate_identity_count,
 NULL::bigint AS operational_group_count
FROM pr
UNION ALL SELECT 'Indents',count(*),count(*) FILTER(WHERE rn<=100),
 count(*) FILTER(WHERE rn>100 AND rn<=200),
 count(*)-count(DISTINCT indent_id),NULL::bigint FROM ih
UNION ALL SELECT 'Excess (last30)',count(*),count(*) FILTER(WHERE rn<=100),
 count(*) FILTER(WHERE rn>100 AND rn<=200),
 count(*)-count(DISTINCT purchase_fact_id),NULL::bigint FROM ex
UNION ALL SELECT 'Vendor-wise',count(*),count(*) FILTER(WHERE rn<=100),
 count(*) FILTER(WHERE rn>100 AND rn<=200),
 count(*)-count(DISTINCT
   (operational_filter_value,material_class_id,stock_item_id,uom_id)),
 count(DISTINCT operational_filter_value)::bigint FROM vwl;
COMMIT;
