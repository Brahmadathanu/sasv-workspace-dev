-- Review only. Install after R3_R4_SERVER_CANDIDATE and R3_MIS_ACCESS_CANDIDATE.
BEGIN;
CREATE FUNCTION public.ei_sales_coverage(p_anchor date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE a date; latest date; m date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
 a:=coalesce(p_anchor,latest);
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_MAPPED_DATA'); END IF;
 IF latest IS NULL OR a>latest OR a<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
 m:=date_trunc('month',a)::date;
 WITH raw AS (
 SELECT voucher_date,count(*) AS raw_rows,count(*) FILTER(WHERE billed_amount_value IS NULL) AS missing_amount_rows,max(inserted_at) AS inserted_at
 FROM public.tally_sales_vreg_snapshot WHERE voucher_date BETWEEN m AND a GROUP BY voucher_date
 ), mapped AS (
 SELECT sales_date,count(*) AS mapped_rows,count(DISTINCT source_key) AS distinct_source_keys,max(inserted_at) AS inserted_at
 FROM public.v_sales_daily_normalized WHERE sales_date BETWEEN m AND a GROUP BY sales_date
 ), jobs AS (
 SELECT DISTINCT ON(vreg_date_extracted) vreg_date_extracted,status::text AS status,finished_at
 FROM public.etl_jobs WHERE job_type='UPSERT_VREG_SALES' AND vreg_date_extracted BETWEEN m AND a
 ORDER BY vreg_date_extracted,created_at DESC NULLS LAST,id DESC
 ), days AS (
 SELECT d::date AS transaction_date,r.raw_rows,n.mapped_rows,n.distinct_source_keys,r.missing_amount_rows,r.inserted_at AS raw_inserted_at,n.inserted_at AS mapped_inserted_at,j.status AS latest_job_status,j.finished_at AS latest_job_finished_at,
 CASE WHEN r.raw_rows IS NULL THEN 'NO_RAW_ROWS_NOT_CERTIFIED'
 WHEN n.mapped_rows IS NULL THEN 'NO_MAPPED_ROWS'
 WHEN r.raw_rows<>n.distinct_source_keys OR n.mapped_rows<>n.distinct_source_keys THEN 'MAPPING_COUNT_MISMATCH'
 WHEN r.missing_amount_rows>0 THEN 'MISSING_AMOUNTS'
 ELSE 'OBSERVED_NOT_CERTIFIED' END AS state
 FROM generate_series(m::timestamp,a::timestamp,interval '1 day') d
 LEFT JOIN raw r ON r.voucher_date=d::date LEFT JOIN mapped n ON n.sales_date=d::date LEFT JOIN jobs j ON j.vreg_date_extracted=d::date
 )
 SELECT jsonb_build_object('anchor',a,'latest_mapped_date',latest,'latest_raw_date',(SELECT voucher_date FROM public.tally_sales_vreg_snapshot WHERE voucher_date IS NOT NULL ORDER BY voucher_date DESC LIMIT 1),
 'observed_raw_dates',count(*) FILTER(WHERE raw_rows>0),'observed_mapped_dates',count(*) FILTER(WHERE mapped_rows>0),
 'import_completeness','NOT_CERTIFIED','days',coalesce(jsonb_agg(to_jsonb(days) ORDER BY transaction_date),'[]'::jsonb)) INTO result FROM days;
 RETURN result;
END $$;
CREATE FUNCTION public.ei_sales_window_totals(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 a:=coalesce(p_anchor,(SELECT sales_date FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1));
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_MAPPED_DATA'); END IF;
 WITH periods AS (SELECT n,(date_trunc('month',a)-make_interval(months=>n))::date AS start_date FROM (VALUES(3),(12)) v(n)),
 hist AS (
 SELECT w.n,w.start_date,(date_trunc('month',a)::date-1) AS end_date,
 count(DISTINCT h.month_start) AS observed_months,count(h.month_start) AS source_groups,
 count(*) FILTER(WHERE h.month_start IS NOT NULL AND (h.billed_amount IS NULL OR h.billed_amount=0)) AS ambiguous_amount_groups,
 sum(h.billed_amount) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.qty_units IS NULL)=0 THEN sum(h.qty_units) END AS actual_packages,
 CASE WHEN count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.qty_billed IS NULL)=0 THEN sum(h.qty_billed) END AS billed_packages,
 max(h.source_max_inserted_at) AS source_max_inserted_at
 FROM periods w LEFT JOIN app_private.sales_monthly h ON h.month_start>=w.start_date AND h.month_start<date_trunc('month',a)::date
 AND (p_region IS NULL OR h.region_id=p_region) AND (p_godown IS NULL OR h.godown_id=p_godown) AND (p_product IS NULL OR h.product_id=p_product) AND (p_sku IS NULL OR h.sku_id=p_sku)
 AND (NOT coalesce(p_active_only,false) OR EXISTS(SELECT 1 FROM public.product_skus k WHERE k.id=h.sku_id AND k.is_active IS TRUE))
 GROUP BY w.n,w.start_date
 ), stats AS (
 SELECT *,CASE WHEN observed_months=n AND ambiguous_amount_groups=0 THEN source_reported_amount END AS sales_value FROM hist
 )
 SELECT jsonb_build_object('anchor',a,'basis','PRECEDING_COMPLETE_CALENDAR_MONTHS_EXCLUDING_ANCHOR_MONTH','import_completeness','NOT_CERTIFIED',
 'windows',jsonb_agg(to_jsonb(stats)||jsonb_build_object('average_monthly_sales',sales_value/n,'asp_actual_package',CASE WHEN actual_packages>0 THEN sales_value/actual_packages END,'asp_billed_package',CASE WHEN billed_packages>0 THEN sales_value/billed_packages END) ORDER BY n)) INTO result FROM stats;
 RETURN result;
END $$;
CREATE FUNCTION public.ei_sales_refresh_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest_month date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 SELECT month_start INTO latest_month FROM app_private.sales_monthly ORDER BY month_start DESC LIMIT 1;
 WITH monthly AS (SELECT sum(billed_amount) AS amount,max(source_max_inserted_at) AS source_at FROM app_private.sales_monthly WHERE month_start=latest_month),
 daily AS (SELECT sum(billed_amount) AS amount,max(sales_date) AS last_date,max(inserted_at) AS source_at FROM public.v_sales_daily_normalized WHERE sales_date>=latest_month AND sales_date<(latest_month+interval '1 month')::date)
 SELECT jsonb_build_object('monthly_latest_month',latest_month,'monthly_source_max_inserted_at',monthly.source_at,'daily_source_max_inserted_at',daily.source_at,'daily_last_date_in_month',daily.last_date,'monthly_reported_amount',monthly.amount,'daily_reported_amount',daily.amount,'amount_difference',daily.amount-monthly.amount,'coverage','NOT_CERTIFIED','refresh_job_status','UNAVAILABLE_TO_THIS_CONTRACT') INTO result FROM monthly CROSS JOIN daily;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ei_management_alerts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) THEN RAISE EXCEPTION 'Executive access denied' USING ERRCODE='42501'; END IF;
 WITH inventory AS (
 SELECT CASE WHEN count(*)=1 THEN max(report_date) END AS report_date,CASE WHEN count(*)=1 THEN max(valuation_gap_item_count) END AS valuation_gap_item_count,CASE WHEN count(*)=1 THEN max(unclassified_item_count) END AS unclassified_item_count,CASE WHEN count(*)=1 THEN max(duplicate_item_row_count) END AS duplicate_item_row_count,CASE WHEN count(*)=1 THEN max(missing_item_id_count) END AS missing_item_id_count FROM public.v_mis_inventory_tab_summary
 ), pipeline AS (
 SELECT CASE WHEN count(*)=1 THEN max(overdue_work_in_process_batch_count) END AS overdue_work_in_process_batch_count FROM public.v_mis_batch_pipeline
 ), fg AS (
 SELECT count(*) AS observed_groups,count(*) FILTER(WHERE recon_status='MISSING_LOG') AS missing_log_groups,max(transfer_date) AS evidence_date
 FROM public.v_fg_transfer_reconciliation WHERE transfer_date>=date_trunc('month',current_date)::date AND transfer_date<=current_date
 ), alerts AS (
 SELECT v.key,v.label,i.report_date AS evidence_date,v.findings FROM inventory i CROSS JOIN LATERAL (VALUES
 ('inventory.valuation_gap','Inventory valuation gaps',i.valuation_gap_item_count),
 ('inventory.unclassified','Unclassified inventory',i.unclassified_item_count),
 ('inventory.duplicate_identity','Duplicate inventory identities',i.duplicate_item_row_count),
 ('inventory.missing_identity','Missing inventory identities',i.missing_item_id_count)) v(key,label,findings)
 UNION ALL SELECT 'production.overdue_wip','Overdue work in process',current_date,overdue_work_in_process_batch_count FROM pipeline
 UNION ALL SELECT 'fg.missing_log','FG transfer groups missing production log',evidence_date,CASE WHEN observed_groups>0 THEN missing_log_groups END FROM fg
 )
 SELECT jsonb_build_object('catalogue','INVENTORY_WIP_FG_INTEGRITY','coverage','PARTIAL_CATALOGUE','rows',coalesce(jsonb_agg(to_jsonb(alerts)||jsonb_build_object('state',CASE WHEN findings IS NULL THEN 'UNAVAILABLE' WHEN findings>0 THEN 'REVIEW' ELSE 'CLEAR' END,'severity','REVIEW_ONLY') ORDER BY key),'[]'::jsonb)) INTO result FROM alerts;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ei_sales_coverage(date),public.ei_sales_window_totals(date,integer,integer,bigint,integer,boolean),public.ei_sales_refresh_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_sales_coverage(date),public.ei_sales_window_totals(date,integer,integer,bigint,integer,boolean),public.ei_sales_refresh_status() TO authenticated;
COMMIT;
