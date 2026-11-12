-- PEC G1: deterministic operational vendor filter parity fixture.
-- Runs only reads and function-source metadata; does not forge auth/JWT.
DO $verify$
DECLARE passed integer; source_rows bigint; options_total bigint; choices integer;
BEGIN
 SELECT count(*) INTO passed
 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
 AND p.proname IN ('proc_vendorwise_buylist_operational_paged',
                  'proc_vendorwise_buylist_operational_options')
 AND p.prosecdef
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND position('require_permission(' IN pg_get_functiondef(p.oid))>0;
 IF passed<>2 THEN RAISE EXCEPTION 'PEC VWL operational ACL: %/2',passed; END IF;

 WITH classified AS (
  SELECT f.vendor_bucket_key,f.vendor_bucket_type,f.vendor_id,
    f.material_class_id,f.stock_item_id,f.uom_id,
    CASE WHEN f.vendor_bucket_type='LOCAL_PURCHASE'
            OR f.vendor_bucket_key='LOCAL_PURCHASE' THEN 'bucket:LOCAL_PURCHASE'
         WHEN f.vendor_bucket_type='UNASSIGNED'
            OR f.vendor_bucket_key='UNASSIGNED' THEN 'bucket:UNASSIGNED'
         WHEN f.vendor_id IS NOT NULL AND f.vendor_id>0
            THEN 'vendor:'||f.vendor_id::text
         ELSE 'bucket:UNASSIGNED' END AS filter_value
  FROM public.proc_vendorwise_buylist_filtered_pec_internal(NULL,NULL,NULL,NULL,NULL) f
 ), grouped AS (
  SELECT filter_value,count(*) n,
    count(distinct (vendor_bucket_key,material_class_id,stock_item_id,uom_id)) uniq
  FROM classified GROUP BY filter_value
 )
 SELECT sum(n),sum(uniq),count(*) INTO source_rows,options_total,choices FROM grouped;
 IF source_rows<>options_total OR choices<3 THEN
  RAISE EXCEPTION 'Operational vendor mapping loses rows or choices: %/%/%',
    source_rows,options_total,choices;
 END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE
   p.oid='public.proc_vendorwise_buylist_operational_paged(bigint,text,text,text,text,text,integer,integer)'::regprocedure
   AND position('t.operational_filter_value=trim(p_operational_filter)' IN pg_get_functiondef(p.oid))>0
   AND position('count(*) OVER()' IN pg_get_functiondef(p.oid))>0
   AND position('LIMIT p_limit OFFSET p_offset' IN pg_get_functiondef(p.oid))>0)
 THEN RAISE EXCEPTION 'Operational filter not before count/page'; END IF;
END $verify$;

WITH source AS (
 SELECT f.*, CASE
    WHEN f.vendor_bucket_type='LOCAL_PURCHASE' OR f.vendor_bucket_key='LOCAL_PURCHASE' THEN 'bucket:LOCAL_PURCHASE'
    WHEN f.vendor_bucket_type='UNASSIGNED' OR f.vendor_bucket_key='UNASSIGNED' THEN 'bucket:UNASSIGNED'
    WHEN f.vendor_id IS NOT NULL AND f.vendor_id>0 THEN 'vendor:'||f.vendor_id::text
    ELSE 'bucket:UNASSIGNED' END operational_filter_value
 FROM public.proc_vendorwise_buylist_filtered_pec_internal(NULL,NULL,NULL,NULL,NULL) f
)
SELECT operational_filter_value, count(*) full_group_count,
 count(distinct (vendor_bucket_key,material_class_id,stock_item_id,uom_id)) unique_group_count
FROM source WHERE operational_filter_value IN ('bucket:UNASSIGNED','bucket:LOCAL_PURCHASE','vendor:75')
GROUP BY 1 ORDER BY 1;
SELECT 'PEC_G1_OPERATIONAL_VENDOR_FILTER_CONTRACT_PASS' AS result;
