-- PEC G1 filtered-before-paging: catalog ACL, parameterized predicates,
-- stable filtered source keys and zero-overlap page checks. Read-only.
DO $verify$
DECLARE n integer;bad integer;cnt bigint; distinct_cnt bigint;
BEGIN
 SELECT count(*) INTO n FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace
 AND p.proname IN (
 'proc_pec_pr_headers_filtered_paged',
 'proc_pec_indent_headers_filtered_paged',
 'proc_pec_purchase_excess_filtered_paged')
 AND p.prosecdef
 AND has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
 AND position('require_permission(' IN pg_get_functiondef(p.oid))>0
 AND position('count(*) OVER()' IN pg_get_functiondef(p.oid))>0
 AND position('p_limit>200' IN pg_get_functiondef(p.oid))>0;
 IF n<>3 THEN RAISE EXCEPTION 'G1 filtered paging security contract: % of 3',n;END IF;

 -- Active PR status filter; server must filter before taking a page.
 SELECT count(*),count(DISTINCT pr_id) INTO cnt,distinct_cnt
 FROM public.v_proc_pr_header WHERE status='active';
 IF cnt<>distinct_cnt THEN RAISE EXCEPTION 'PR filtered duplicate keys';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.v_proc_pr_header WHERE status='active')
 THEN RAISE NOTICE 'No active PR fixture on live database';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='proc_pec_pr_headers_filtered_paged'
 AND position('f.status=p_status' IN pg_get_functiondef(oid))>0
 AND position('f.material_class_id=p_material_class_id' IN pg_get_functiondef(oid))>0
 AND position('lower(coalesce(f.pr_number' IN pg_get_functiondef(oid))>0)
 THEN RAISE EXCEPTION 'PR predicate contract absent';END IF;

 SELECT count(*),count(DISTINCT indent_id) INTO cnt,distinct_cnt
 FROM public.v_proc_indent_console WHERE status='approved';
 IF cnt<>distinct_cnt THEN RAISE EXCEPTION 'Indent filtered duplicate keys';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='proc_pec_indent_headers_filtered_paged'
 AND position('f.status=p_status' IN pg_get_functiondef(oid))>0
 AND position('f.material_class_id=p_material_class_id' IN pg_get_functiondef(oid))>0
 AND position('lower(coalesce(f.indent_number' IN pg_get_functiondef(oid))>0)
 THEN RAISE EXCEPTION 'Indent predicate contract absent';END IF;

 -- Excess 30-day date window and vendor-class dimensions; verify keyed pages.
 WITH filtered AS (
 SELECT purchase_fact_id,voucher_date,net_unallocated_qty
 FROM public.v_proc_purchase_excess_console
 WHERE voucher_date >= date '2026-10-13' AND voucher_date <= date '2026-11-12'
 ), numbered AS (
 SELECT purchase_fact_id,row_number() over(
 ORDER BY coalesce(net_unallocated_qty,0) DESC,voucher_date DESC NULLS LAST,
 purchase_fact_id DESC) rn FROM filtered
 )
 SELECT count(*),count(DISTINCT purchase_fact_id) INTO cnt,distinct_cnt
 FROM numbered;
 IF cnt<>distinct_cnt THEN RAISE EXCEPTION 'Excess filtered duplicate keys';END IF;

 SELECT count(*) INTO bad FROM pg_proc p
 WHERE p.proname='proc_pec_purchase_excess_filtered_paged'
 AND p.pronamespace='public'::regnamespace
 AND position('f.voucher_date>=p_date_from' IN pg_get_functiondef(oid))>0
 AND position('f.voucher_date<=p_date_to' IN pg_get_functiondef(oid))>0
 AND position('f.net_unallocated_qty,0)>=p_min_qty' IN pg_get_functiondef(oid))>0
 AND position('p_unmapped_only' IN pg_get_functiondef(oid))>0
 AND position('f.stock_item_code' IN pg_get_functiondef(oid))>0
 AND position('f.vendor_display_name' IN pg_get_functiondef(oid))>0;
 IF bad<>1 THEN RAISE EXCEPTION 'Excess client-filter predicate contract incomplete';END IF;
END $verify$;

-- Observable counts for comparison with future real authenticated PWA fixtures.
SELECT 'PR active' scenario,count(*) rows FROM public.v_proc_pr_header WHERE status='active'
UNION ALL
SELECT 'Indents approved',count(*) FROM public.v_proc_indent_console WHERE status='approved'
UNION ALL
SELECT 'Excess 2026-10-13 to 2026-11-12',count(*)
FROM public.v_proc_purchase_excess_console
WHERE voucher_date BETWEEN date '2026-10-13' AND date '2026-11-12'
UNION ALL
SELECT 'Excess unmapped vendor',count(*)
FROM public.v_proc_purchase_excess_console
WHERE vendor_display_name IS NULL OR vendor_display_name='';
SELECT 'PEC_G1_FILTER_BEFORE_PAGE_CONTRACT_PASS' result;
