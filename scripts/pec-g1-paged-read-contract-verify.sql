-- PEC G1 five paged-read server contracts: ACL and deterministic source checks.
-- SELECT/metadata only; no JWT impersonation or procurement writes.
DO $verify$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace
 AND p.proname IN ('proc_pec_pr_headers_paged','proc_pec_indent_headers_paged',
 'proc_pec_purchase_excess_paged','proc_pec_excess_acceptance_audit_paged',
 'proc_vendorwise_buylist_filtered_paged')
 AND p.prosecdef
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND position('require_permission(' IN pg_get_functiondef(p.oid))>0
 AND position('p_limit>200' IN pg_get_functiondef(p.oid))>0;
 IF n<>5 THEN RAISE EXCEPTION 'PEC G1 paged RPC ACL contract expected 5 got %',n; END IF;
END $verify$;

SELECT 'pr' dataset,count(*) total,count(DISTINCT pr_id) unique_keys FROM public.v_proc_pr_header
UNION ALL
SELECT 'indents',count(*),count(DISTINCT indent_id) FROM public.v_proc_indent_console
UNION ALL
SELECT 'excess',count(*),count(DISTINCT purchase_fact_id) FROM public.v_proc_purchase_excess_console
UNION ALL
SELECT 'audit',count(*),count(DISTINCT acceptance_id) FROM public.v_proc_excess_acceptance_audit_console
UNION ALL
SELECT 'vendor',count(*),count(DISTINCT (vendor_bucket_key,material_class_id,stock_item_id,uom_id)) FROM public.v_proc_vendorwise_buylist;
-- Every dataset must have a unique stable ordering key.
-- Existing RPCs remain untouched; real signed-in read RPC acceptance remains separate.
