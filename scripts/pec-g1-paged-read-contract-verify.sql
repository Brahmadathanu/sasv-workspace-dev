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

-- Read-only two-page no-overlap assertions on live source keys.
-- These verify deterministic static ordering; not snapshot stability during writes.
DO $pages$
DECLARE first_n integer;second_n integer;overlap_n integer;
BEGIN
 WITH ordered AS (
  SELECT purchase_fact_id, row_number() OVER (
    ORDER BY voucher_date DESC NULLS LAST,purchase_fact_id DESC) rn
  FROM public.v_proc_purchase_excess_console
 ), a AS (SELECT purchase_fact_id FROM ordered WHERE rn BETWEEN 1 AND 200),
 b AS (SELECT purchase_fact_id FROM ordered WHERE rn BETWEEN 201 AND 400)
 SELECT (SELECT count(*) FROM a),(SELECT count(*) FROM b),
 (SELECT count(*) FROM a JOIN b USING(purchase_fact_id))
 INTO first_n,second_n,overlap_n;
 IF first_n<>200 OR second_n<>200 OR overlap_n<>0 THEN
   RAISE EXCEPTION 'PEC Excess source page contract failed: %,%,%',first_n,second_n,overlap_n;
 END IF;

 WITH ordered AS (
  SELECT vendor_bucket_key,material_class_id,stock_item_id,uom_id,
  row_number() OVER (
    ORDER BY vendor_bucket_key ASC NULLS LAST,
             material_class_id ASC NULLS LAST,stock_item_id ASC,uom_id ASC) rn
  FROM public.v_proc_vendorwise_buylist
 ), a AS (SELECT * FROM ordered WHERE rn BETWEEN 1 AND 200),
 b AS (SELECT * FROM ordered WHERE rn BETWEEN 201 AND 400)
 SELECT (SELECT count(*) FROM a),(SELECT count(*) FROM b),
 (SELECT count(*) FROM a JOIN b USING(vendor_bucket_key,material_class_id,stock_item_id,uom_id))
 INTO first_n,second_n,overlap_n;
 IF first_n<>200 OR second_n<>200 OR overlap_n<>0 THEN
   RAISE EXCEPTION 'PEC vendor source page contract failed: %,%,%',first_n,second_n,overlap_n;
 END IF;
END $pages$;
SELECT 'PEC_G1_FIRST_TWO_SOURCE_PAGES_PASS' AS result;

-- The new VWL paged order must EXACTLY preserve legacy filtered-list ordering.
-- WITH ORDINALITY observes the old function's complete result order; the new
-- order uses the same business sort with unique keys only as tie-breakers.
DO $vendor_order$
DECLARE n integer; mismatches integer; first_unassigned integer; last_assigned integer;
BEGIN
WITH legacy AS (
 SELECT f.vendor_bucket_key,f.material_class_id,f.stock_item_id,f.uom_id,
        f.ordinality AS legacy_pos
 FROM public.proc_vendorwise_buylist_filtered_pec_internal(NULL,NULL,NULL,NULL,NULL)
 WITH ORDINALITY AS f
), paged_equivalent AS (
 SELECT f.vendor_bucket_key,f.material_class_id,f.stock_item_id,f.uom_id,
 row_number() OVER (
 ORDER BY CASE WHEN f.vendor_bucket_key='UNASSIGNED' THEN 1 ELSE 0 END,
 f.vendor_bucket_name NULLS LAST,f.stock_item_name NULLS LAST,f.uom_code NULLS LAST,
 f.vendor_bucket_key NULLS LAST,f.material_class_id NULLS LAST,
 f.stock_item_id,f.uom_id) AS paged_pos
 FROM public.proc_vendorwise_buylist_filtered_pec_internal(NULL,NULL,NULL,NULL,NULL) f
)
SELECT count(*),count(*) FILTER(WHERE a.legacy_pos<>b.paged_pos),
min(a.legacy_pos) FILTER(WHERE a.vendor_bucket_key='UNASSIGNED'),
max(a.legacy_pos) FILTER(WHERE a.vendor_bucket_key<>'UNASSIGNED')
INTO n,mismatches,first_unassigned,last_assigned
FROM legacy a JOIN paged_equivalent b USING
(vendor_bucket_key,material_class_id,stock_item_id,uom_id);
IF n<>834 OR mismatches<>0 OR first_unassigned<>636 OR last_assigned<>635 THEN
 RAISE EXCEPTION 'PEC vendor business sort parity changed: count %, mismatches %, first-unassigned %, last-assigned %', n,mismatches,first_unassigned,last_assigned;
END IF;
END $vendor_order$;
SELECT 'PEC_G1_VENDOR_LEGACY_ORDER_834_OF_834_PASS' AS result;
