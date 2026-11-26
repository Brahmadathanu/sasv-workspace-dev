-- OWNER-GATED. NOT APPLIED. Generated from pinned reviewed candidate blobs.
-- One atomic transaction; no R1 replay or historical SKU alias insertions.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(20261126,540);
DO $preflight$
BEGIN
 IF to_regclass('public.sales_item_scope') IS NOT NULL OR to_regclass('public.v_sales_item_classification') IS NOT NULL OR to_regprocedure('public.ei_sales_access()') IS NOT NULL OR EXISTS(SELECT 1 FROM public.permission_targets WHERE key='module:sales-item-classification') THEN
 RAISE EXCEPTION 'EI candidate already installed or conflicting catalog; stop'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobid=17 AND username='postgres' AND command='select public.refresh_sales_monthly();' AND active) THEN RAISE EXCEPTION 'Sales refresh identity drift'; END IF;
END $preflight$;

-- SOURCE: R3_R4_SERVER_CANDIDATE.sql git blob dfc0229f226e4c52ce4965dba0ebac0c1e0af32a
-- EI R3/R4 review candidate. NOT an installed migration. No changes to existing objects.
-- Invoke with authenticated JWT; explicit module permission; no new definer or source grants.

CREATE FUNCTION public.ei_sales_access() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE executive boolean; sales boolean;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  executive := coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false);
  sales := executive OR coalesce(public.app_has_permission('module:sales-data-viewer','view'),false);
  IF NOT sales THEN RAISE EXCEPTION 'Sales access denied' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('executive',executive,'sales',sales);
END $$;
CREATE FUNCTION public.ei_sales_dimensions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.ei_sales_access();
  RETURN jsonb_build_object(
    'regions',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM (SELECT id,code,name FROM public.regions) r),
    'godowns',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.id),'[]'::jsonb) FROM (SELECT id,code,name,region_id FROM public.godowns) g),
    'first_mapped_date',(SELECT sales_date FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date LIMIT 1),
    'last_mapped_date',(SELECT sales_date FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1));
END $$;
-- Anchor defaults to latest mapped day. Compare through same elapsed calendar day, capped by month end.
CREATE FUNCTION public.ei_sales_comparison(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; anchor_date date; m date; elapsed integer; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  anchor_date := coalesce(p_anchor,latest);
  IF anchor_date IS NULL THEN RETURN jsonb_build_object('coverage','NO_MAPPED_DATA','periods','[]'::jsonb); END IF;
  IF latest IS NULL OR anchor_date>latest OR anchor_date<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  m:=date_trunc('month',anchor_date)::date; elapsed:=anchor_date-m;
  WITH periods AS (
    SELECT label, start_date, least(start_date+elapsed,(start_date+interval '1 month')::date-1) end_date
    FROM (VALUES ('CURRENT',m),('PREVIOUS_MONTH',(m-interval '1 month')::date),('PREVIOUS_YEAR',(m-interval '1 year')::date)) v(label,start_date)
  ), stats AS (
    SELECT p.label,p.start_date,p.end_date,x.*
    FROM periods p CROSS JOIN LATERAL (
      SELECT count(*) AS row_count,count(DISTINCT s.sales_date) AS observed_dates,max(s.sales_date) AS last_observed_date,
        max(s.inserted_at) AS source_max_inserted_at,
        count(*) FILTER(WHERE s.billed_amount IS NULL) AS missing_amount_rows,
        count(*) FILTER(WHERE s.qty_units IS NULL) AS missing_actual_rows,
        count(*) FILTER(WHERE s.qty_billed IS NULL) AS missing_billed_rows,
        CASE WHEN count(*) FILTER(WHERE s.billed_amount IS NULL)=0 THEN sum(s.billed_amount) END AS sales_value,
        CASE WHEN count(*) FILTER(WHERE s.qty_units IS NULL)=0 THEN sum(s.qty_units) END AS actual_packages,
        CASE WHEN count(*) FILTER(WHERE s.qty_billed IS NULL)=0 THEN sum(s.qty_billed) END AS billed_packages,
        count(*) FILTER(WHERE s.qty_billed>0 OR s.qty_units>0 OR s.billed_amount>0) AS positive_rows,
        count(*) FILTER(WHERE s.qty_billed<0 OR s.qty_units<0 OR s.billed_amount<0) AS negative_rows
      FROM public.v_sales_daily_normalized s
      JOIN public.product_skus k ON k.id=s.sku_id
      WHERE s.sales_date BETWEEN p.start_date AND p.end_date
        AND (p_region IS NULL OR s.region_id=p_region) AND (p_godown IS NULL OR s.godown_id=p_godown)
        AND (p_product IS NULL OR s.product_id=p_product) AND (p_sku IS NULL OR s.sku_id=p_sku)
        AND (NOT coalesce(p_active_only,false) OR k.is_active IS TRUE)
    ) x
  ), metrics AS (
    SELECT *,CASE WHEN actual_packages>0 THEN sales_value/actual_packages END AS asp_actual_package,
      CASE WHEN billed_packages>0 THEN sales_value/billed_packages END AS asp_billed_package,
      CASE WHEN row_count=0 THEN 'NO_RECORDED_ROWS' WHEN missing_amount_rows+missing_actual_rows+missing_billed_rows>0 THEN 'MISSING_MEASURES' ELSE 'OBSERVED_NOT_CERTIFIED' END AS coverage
    FROM stats
  )
  SELECT jsonb_build_object('anchor',anchor_date,'latest_mapped_date',latest,'comparison_basis','MATCHED_CALENDAR_DAY_CAPPED_AT_MONTH_END',
    'quantity_basis','NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY','periods',jsonb_agg(to_jsonb(metrics) ORDER BY start_date),
    'mom_pct',(SELECT 100*(c.sales_value/p.sales_value-1) FROM metrics c CROSS JOIN metrics p WHERE c.label='CURRENT' AND p.label='PREVIOUS_MONTH' AND p.sales_value>0),
    'yoy_pct',(SELECT 100*(c.sales_value/p.sales_value-1) FROM metrics c CROSS JOIN metrics p WHERE c.label='CURRENT' AND p.label='PREVIOUS_YEAR' AND p.sales_value>0),
    'import_completeness','NOT_CERTIFIED','active_filter_basis','CURRENT_MASTER') INTO result FROM metrics;
  RETURN result;
END $$;
-- Historical grouped pages: closed months use shared monthly aggregate; anchor month uses daily.
-- Monthly amount zero is ambiguous because shared source coalesces NULL to zero. Do not certify totals.
CREATE FUNCTION public.ei_sales_history(p_anchor date DEFAULT NULL,p_months integer DEFAULT 12,p_group text DEFAULT 'month',p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false,p_search text DEFAULT NULL,p_sort text DEFAULT 'value_desc',p_limit integer DEFAULT 50,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; anchor_date date; anchor_month date; from_date date; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 12 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000
    OR p_group IS NULL OR p_group NOT IN ('month','region','godown','product','sku','category','subcategory','group','subgroup','region_month','godown_month','product_month','sku_month','category_month','subcategory_month')
    OR p_sort IS NULL OR p_sort NOT IN ('value_desc','value_asc','key') OR length(coalesce(p_search,''))>120
  THEN RAISE EXCEPTION 'Invalid history bounds or grouping' USING ERRCODE='22023'; END IF;
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  anchor_date:=coalesce(p_anchor,latest);
  IF anchor_date IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'coverage','NO_MAPPED_DATA'); END IF;
  IF latest IS NULL OR anchor_date>latest OR anchor_date<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  anchor_month:=date_trunc('month',anchor_date)::date;
  from_date:=(anchor_month-make_interval(months=>p_months-1))::date;
  WITH source AS (
    SELECT h.month_start,h.sku_id,h.product_id,h.region_id,h.godown_id,h.qty_units,h.qty_billed,h.billed_amount,h.source_max_inserted_at AS inserted_at,
      true AS monthly_source,(h.billed_amount IS NULL OR h.billed_amount=0) AS amount_ambiguous
    FROM app_private.sales_monthly h
    WHERE h.month_start>=from_date AND h.month_start<anchor_month
      AND (p_region IS NULL OR h.region_id=p_region) AND (p_godown IS NULL OR h.godown_id=p_godown)
      AND (p_product IS NULL OR h.product_id=p_product) AND (p_sku IS NULL OR h.sku_id=p_sku)
    UNION ALL
    SELECT anchor_month,d.sku_id,d.product_id,d.region_id,d.godown_id,d.qty_units,d.qty_billed,d.billed_amount,d.inserted_at,false,d.billed_amount IS NULL
    FROM public.v_sales_daily_normalized d
    WHERE d.sales_date BETWEEN anchor_month AND anchor_date
      AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown)
      AND (p_product IS NULL OR d.product_id=p_product) AND (p_sku IS NULL OR d.sku_id=p_sku)
  ), enriched AS (
    SELECT s.*,k.pack_size,k.uom,
      CASE split_part(p_group,'_month',1)
        WHEN 'month' THEN 'ALL' WHEN 'region' THEN s.region_id::text WHEN 'godown' THEN s.godown_id::text
        WHEN 'product' THEN s.product_id::text WHEN 'sku' THEN s.sku_id::text WHEN 'category' THEN c.id::text
        WHEN 'subcategory' THEN sc.id::text WHEN 'group' THEN pg.id::text WHEN 'subgroup' THEN sg.id::text END AS dimension_id,
      CASE split_part(p_group,'_month',1)
        WHEN 'month' THEN 'All sales' WHEN 'region' THEN r.name WHEN 'godown' THEN g.name WHEN 'product' THEN p.item
        WHEN 'sku' THEN concat(p.item,' · ',k.pack_size,' ',k.uom) WHEN 'category' THEN c.category_name
        WHEN 'subcategory' THEN sc.subcategory_name WHEN 'group' THEN pg.group_name WHEN 'subgroup' THEN sg.sub_group_name END AS dimension_name
    FROM source s LEFT JOIN public.product_skus k ON k.id=s.sku_id LEFT JOIN public.products p ON p.id=s.product_id
      LEFT JOIN public.sub_groups sg ON sg.id=p.sub_group_id LEFT JOIN public.product_groups pg ON pg.id=sg.product_group_id
      LEFT JOIN public.sub_categories sc ON sc.id=pg.sub_category_id LEFT JOIN public.categories c ON c.id=sc.category_id
      LEFT JOIN public.regions r ON r.id=s.region_id LEFT JOIN public.godowns g ON g.id=s.godown_id
    WHERE NOT coalesce(p_active_only,false) OR k.is_active IS TRUE
  ), grouped AS (
    SELECT dimension_id,coalesce(dimension_name,'Unmapped') AS dimension_name,
      CASE WHEN p_group='month' OR right(p_group,6)='_month' THEN month_start END AS month,
      count(*) AS source_groups,count(*) FILTER(WHERE monthly_source) AS historical_groups,
      count(*) FILTER(WHERE amount_ambiguous) AS ambiguous_amount_groups,
      count(*) FILTER(WHERE qty_units IS NULL) AS missing_actual_groups,
      count(*) FILTER(WHERE qty_billed IS NULL) AS missing_billed_groups,
      CASE WHEN count(*) FILTER(WHERE amount_ambiguous)=0 THEN sum(billed_amount) END AS sales_value,
      sum(billed_amount) AS source_reported_amount,
      CASE WHEN count(*) FILTER(WHERE qty_units IS NULL)=0 THEN sum(qty_units) END AS actual_packages,
      CASE WHEN count(*) FILTER(WHERE qty_billed IS NULL)=0 THEN sum(qty_billed) END AS billed_packages,
      max(inserted_at) AS source_max_inserted_at
    FROM enriched
    WHERE nullif(trim(p_search),'') IS NULL OR strpos(lower(coalesce(dimension_name,'')),lower(trim(p_search)))>0 OR strpos(lower(coalesce(dimension_id,'')),lower(trim(p_search)))>0
    GROUP BY dimension_id,dimension_name,CASE WHEN p_group='month' OR right(p_group,6)='_month' THEN month_start END
  ), metrics AS (
    SELECT *,CASE WHEN actual_packages>0 THEN sales_value/actual_packages END AS asp_actual_package,
      CASE WHEN billed_packages>0 THEN sales_value/billed_packages END AS asp_billed_package,
      CASE WHEN ambiguous_amount_groups+missing_actual_groups+missing_billed_groups>0 THEN 'MISSING_OR_AMBIGUOUS_MEASURES' ELSE 'OBSERVED_NOT_CERTIFIED' END AS coverage
    FROM grouped
  ), ranked AS (
    SELECT *,row_number() OVER(ORDER BY CASE WHEN p_sort='value_desc' THEN sales_value END DESC NULLS LAST,
      CASE WHEN p_sort='value_asc' THEN sales_value END ASC NULLS LAST,month NULLS LAST,dimension_id NULLS LAST,dimension_name) AS ordinal
    FROM metrics
  )
  SELECT jsonb_build_object('anchor',anchor_date,'start_date',from_date,'latest_mapped_date',latest,'total',(SELECT count(*) FROM ranked),
    'limit',p_limit,'offset',p_offset,'quantity_basis','NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY',
    'import_completeness','NOT_CERTIFIED','historical_measure_basis','SHARED_MONTHLY_AGGREGATE_NULL_LIMITATIONS',
    'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY ordinal),'[]'::jsonb))
  INTO result FROM (SELECT * FROM ranked WHERE ordinal>p_offset AND ordinal<=p_offset+p_limit) page;
  RETURN result;
END $$;
-- Zero seller / returns classification. Current eligibility is NOT historical eligibility.
-- An absent SKU cannot be certified as a zero seller without proven import coverage.
CREATE FUNCTION public.ei_sales_exceptions(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_search text DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; a date; m date; region_code text; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000 OR length(coalesce(p_search,''))>120 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  a:=coalesce(p_anchor,latest);
  IF a IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'coverage','NO_MAPPED_DATA'); END IF;
  IF latest IS NULL OR a>latest THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  m:=date_trunc('month',a)::date;
  IF p_godown IS NOT NULL THEN
    SELECT r.code INTO region_code FROM public.godowns g JOIN public.regions r ON r.id=g.region_id WHERE g.id=p_godown AND (p_region IS NULL OR g.region_id=p_region);
    IF region_code IS NULL THEN RAISE EXCEPTION 'Unknown or conflicting godown/region' USING ERRCODE='22023'; END IF;
  ELSIF p_region IS NOT NULL THEN
    SELECT code INTO region_code FROM public.regions WHERE id=p_region;
    IF region_code IS NULL THEN RAISE EXCEPTION 'Unknown region' USING ERRCODE='22023'; END IF;
  END IF;
  WITH activity AS (
    SELECT d.sku_id,count(*) AS recorded_rows,sum(d.qty_billed) AS net_billed,
      count(*) FILTER(WHERE d.qty_billed>0) AS positive_rows,count(*) FILTER(WHERE d.qty_billed<0) AS return_rows,
      count(*) FILTER(WHERE d.qty_billed IS NULL OR d.qty_units IS NULL OR d.billed_amount IS NULL) AS missing_rows
    FROM public.v_sales_daily_normalized d WHERE d.sales_date BETWEEN m AND a
      AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown) GROUP BY d.sku_id
  ), classified AS (
    SELECT k.id AS sku_id,k.product_id,p.item AS product_name,k.pack_size,k.uom,k.is_active,k.price_list_ik,k.price_list_ok,
      x.recorded_rows,x.net_billed,x.positive_rows,x.return_rows,x.missing_rows,
      CASE WHEN k.is_active IS NOT TRUE THEN 'INACTIVE_CURRENT_MASTER'
        WHEN region_code='IK' AND k.price_list_ik IS TRUE THEN 'CURRENT_ELIGIBLE'
        WHEN region_code='OK' AND k.price_list_ok IS TRUE THEN 'CURRENT_ELIGIBLE'
        WHEN region_code IS NULL AND (k.price_list_ik IS TRUE OR k.price_list_ok IS TRUE) THEN 'CURRENT_ELIGIBLE'
        WHEN region_code IS NULL OR region_code IN ('IK','OK') THEN 'NOT_CURRENTLY_LISTED'
        ELSE 'ELIGIBILITY_UNKNOWN' END AS eligibility,
      CASE WHEN x.recorded_rows IS NULL THEN 'NO_RECORDED_SALES_COVERAGE_UNCERTIFIED'
        WHEN x.missing_rows>0 THEN 'MISSING_MEASURES'
        WHEN x.net_billed=0 AND x.positive_rows>0 AND x.return_rows>0 THEN 'BILLED_SALES_OFFSET_BY_RETURNS'
        WHEN x.net_billed=0 THEN 'ZERO_NET_BILLED_OTHER_ACTIVITY'
        WHEN x.net_billed<0 THEN 'NET_RETURNS' ELSE 'NET_POSITIVE_BILLED' END AS activity_state
    FROM public.product_skus k JOIN public.products p ON p.id=k.product_id LEFT JOIN activity x ON x.sku_id=k.id
    WHERE nullif(trim(p_search),'') IS NULL OR strpos(lower(p.item),lower(trim(p_search)))>0 OR strpos(k.id::text,trim(p_search))>0
  ), ranked AS (
    SELECT *,row_number() OVER(ORDER BY product_name,sku_id) AS ordinal FROM classified
    WHERE activity_state<>'NET_POSITIVE_BILLED'
  )
  SELECT jsonb_build_object('anchor',a,'start_date',m,'import_completeness','NOT_CERTIFIED','eligibility_basis','CURRENT_MASTER_ONLY',
    'total',(SELECT count(*) FROM ranked),'limit',p_limit,'offset',p_offset,'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY ordinal),'[]'::jsonb))
    INTO result FROM (SELECT * FROM ranked WHERE ordinal>p_offset AND ordinal<=p_offset+p_limit) page;
  RETURN result;
END $$;
-- R4 initial catalogue. No thresholds invented, no mutations, no historical NOT_VERIFIED urgency.
CREATE FUNCTION public.ei_management_alerts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false)
  THEN RAISE EXCEPTION 'Executive access denied' USING ERRCODE='42501'; END IF;
  WITH inventory AS (
    SELECT report_date,valuation_gap_item_count,unclassified_item_count,duplicate_item_row_count,missing_item_id_count
    FROM public.v_mis_inventory_tab_summary
  ), alerts AS (
    SELECT v.key,v.label,i.report_date AS evidence_date,v.findings,
      CASE WHEN v.findings IS NULL THEN 'UNAVAILABLE' WHEN v.findings>0 THEN 'REVIEW' ELSE 'CLEAR' END AS state
    FROM inventory i CROSS JOIN LATERAL (VALUES
      ('inventory.valuation_gap','Inventory valuation gaps',i.valuation_gap_item_count),
      ('inventory.unclassified','Unclassified inventory',i.unclassified_item_count),
      ('inventory.duplicate_identity','Duplicate inventory identities',i.duplicate_item_row_count),
      ('inventory.missing_identity','Missing inventory identities',i.missing_item_id_count)
    ) v(key,label,findings)
  )
  SELECT jsonb_build_object('catalogue','INVENTORY_INTEGRITY_INITIAL','coverage','PARTIAL_CATALOGUE','rows',coalesce(jsonb_agg(to_jsonb(alerts) ORDER BY key),'[]'::jsonb))
    INTO result FROM alerts;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ei_sales_access(),public.ei_sales_dimensions(),public.ei_sales_comparison(date,integer,integer,bigint,integer,boolean),
public.ei_sales_history(date,integer,text,integer,integer,bigint,integer,boolean,text,text,integer,integer),
public.ei_sales_exceptions(date,integer,integer,text,integer,integer),public.ei_management_alerts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_sales_access(),public.ei_sales_dimensions(),public.ei_sales_comparison(date,integer,integer,bigint,integer,boolean),
public.ei_sales_history(date,integer,text,integer,integer,bigint,integer,boolean,text,text,integer,integer),
public.ei_sales_exceptions(date,integer,integer,text,integer,integer),public.ei_management_alerts() TO authenticated;

-- SOURCE: R3_MIS_ACCESS_INSTALL_GUARD.sql git blob c54545527248994c51c98038a19ef792161a4c09
-- Read-only catalog guard. Run in same transaction as authorized installation, immediately before mutation.
-- Pinned live catalog at 2026-11-25; not proof that candidate matches original body or is executable.
DO $guard$
DECLARE mismatches text;
BEGIN
WITH expected(kind,identity,fingerprint) AS (VALUES
 ('function','public.get_mis_finance_party_page(text, text, integer, integer)','176ae611778ec33d5102b36afa5e2b8aa715c7227a25282a9803f9c7234636e6'),
 ('function','public.get_mis_finished_goods_sku_page(text, text, integer, integer)','c428b034f4afaa1ff11dc36d4cb7a6d778261d5d8f7055bac252da3208676c0c'),
 ('function','public.get_mis_inventory_item_page(text, text, integer, integer)','52b0748871bde298806d7fced39799cbb6bb90ab65379ca4867a3aec603befd3'),
 ('function','public.get_mis_sales_product_page(text, integer, integer)','a0f73b1e83f88754852f2d2c43a2107cdd00ca9c1449d51d5821ea295ee507d1'),
 ('relation','app_private.mv_mis_executive_summary','f9b24a26b470a7eacee6cad4a5d2972670cb6de130f171610748b5f59f24907e'),
 ('relation','public.mv_mis_executive_summary','0eff56c419540217851f5fe14ffb16356d4c43bce59f8a309eeaae670384c078'),
 ('relation','public.v_mis_batch_pipeline','a4fa589a3bca5efa29765f80a352f8ee8778d97b9177e51df6245de42a602a20'),
 ('relation','public.v_mis_expense_position','363bf500d696dbf3128fdfb2e1502dfb50f7d44cef1ba53ced4f0f5ff2be1c65'),
 ('relation','public.v_mis_fg_inventory_position','f316b2226b884f849060192ec2c52f3401001aff3c48dfabe0379bfd859842bb'),
 ('relation','public.v_mis_finance_outstanding_detail','943e4c01a9f64c39226f2ae6b7b3d56b7602ea6742561bdf1b8f766afed0eabd'),
 ('relation','public.v_mis_finance_outstanding_party_summary','fe39017a5c64aa1e9025ed9bdef79f5bf0a8e4866d751ee477e36c7e9b846b8d'),
 ('relation','public.v_mis_finance_tab_summary','8dbd1e8a20e39e874fc8d3c6fdd0357d573cb87a5901380f6ef3e875d1584c32'),
 ('relation','public.v_mis_financial_position','0cfcd0aae9613245b9c322d0cbc7fb9593a9ffc028dcfbaa8fd937d884dbc0cd'),
 ('relation','public.v_mis_finished_goods_tab_summary','29b10e54b959234ce350e948e0a8ebdd399283cad9e841a1e25da9526fad69ea'),
 ('relation','public.v_mis_inventory_position','4aa17c6082477608372e0b4fc50c97d6d65c06fc60480ff1585987afd14fa130'),
 ('relation','public.v_mis_inventory_tab_summary','b7f4f120b903a5ea51936b96de46698b8dd6fedc1172ce26d674f95f6d034cd7'),
 ('relation','public.v_mis_production_position','2dbe4ce27bcfc8fbd53b981a35975c44a203e590f3f931c496b4dd4a1f944547'),
 ('relation','public.v_mis_production_tab_summary','24b0f076456d7abb954d671ef408afcd4aaa003a8137950024fefbb920afad3a'),
 ('relation','public.v_mis_sales_position','3ce63939726a9219f49224a5e2ef03becf3fced53a2cf2c436a23dd595a78a4d'),
 ('relation','public.v_mis_sales_tab_summary','e66938441032ed391ceb033e1ae1ada3ed0e1d75e7565b088e84f08edb2e8587')
), actual AS (SELECT 'relation' kind,n.nspname||'.'||c.relname identity,encode(sha256(convert_to(jsonb_build_array(pg_get_viewdef(c.oid,true),c.reloptions,c.relacl::text,pg_get_userbyid(c.relowner))::text,'UTF8')),'hex') fingerprint FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname IN ('v_mis_finance_tab_summary','v_mis_production_position','v_mis_finance_outstanding_party_summary','v_mis_financial_position','v_mis_fg_inventory_position','v_mis_production_tab_summary','v_mis_inventory_position','v_mis_sales_tab_summary','v_mis_finance_outstanding_detail','v_mis_sales_position','v_mis_batch_pipeline','v_mis_finished_goods_tab_summary','v_mis_expense_position','v_mis_inventory_tab_summary','mv_mis_executive_summary')) OR (n.nspname='app_private' AND c.relname='mv_mis_executive_summary') UNION ALL SELECT 'function',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')',encode(sha256(convert_to(jsonb_build_array(pg_get_functiondef(p.oid),p.proacl::text,pg_get_userbyid(p.proowner))::text,'UTF8')),'hex') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_mis_finance_party_page','get_mis_finished_goods_sku_page','get_mis_inventory_item_page','get_mis_sales_product_page'))
SELECT string_agg(coalesce(e.identity,a.identity),', ' ORDER BY coalesce(e.identity,a.identity)) INTO mismatches
FROM expected e FULL JOIN actual a USING(kind,identity)
WHERE e.fingerprint IS DISTINCT FROM a.fingerprint;
IF mismatches IS NOT NULL THEN RAISE EXCEPTION 'MIS access catalog drift: %',mismatches; END IF;
END $guard$;

-- SOURCE: R3_MIS_ACCESS_CANDIDATE.sql git blob d917139a83d3a4d6e042472bd2a97906d79036af
-- REVIEW ONLY. Apply after R3 candidate, never replay R1. Exact current catalog bodies pinned below.

CREATE FUNCTION public.ei_can_read_executive() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$ SELECT CASE WHEN current_user IN ('postgres','service_role') THEN true ELSE auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' AND coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) END $$;
REVOKE ALL ON FUNCTION public.ei_can_read_executive() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_can_read_executive() TO authenticated,service_role;
CREATE OR REPLACE VIEW public.v_mis_finance_tab_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH grouped AS (
         SELECT v_mis_finance_outstanding_party_summary.report_date,
            v_mis_finance_outstanding_party_summary.mis_group_name,
            sum(v_mis_finance_outstanding_party_summary.signed_outstanding_tally_value) AS signed_total,
            count(*) AS party_count,
            sum(v_mis_finance_outstanding_party_summary.bill_count) AS bill_count
           FROM v_mis_finance_outstanding_party_summary
          GROUP BY v_mis_finance_outstanding_party_summary.report_date, v_mis_finance_outstanding_party_summary.mis_group_name
        )
 SELECT report_date,
    abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric)) AS payables_sundry_creditors,
    abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric)) AS receivables_sundry_debtors,
    abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric)) - abs(COALESCE(sum(signed_total) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric)) AS net_sundry_position,
    COALESCE(sum(party_count) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric) AS payable_party_count,
    COALESCE(sum(party_count) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric) AS receivable_party_count,
    COALESCE(sum(bill_count) FILTER (WHERE mis_group_name = 'Payables — Sundry Creditors'::text), 0::numeric) AS payable_bill_count,
    COALESCE(sum(bill_count) FILTER (WHERE mis_group_name = 'Receivables — Sundry Debtors'::text), 0::numeric) AS receivable_bill_count,
    'Finance tab summary covers only Sundry Creditors and Sundry Debtors, not all liabilities or assets of the manufacturing unit. Values are calculated from signed Tally balances and presented as MIS-positive figures.'::text AS finance_scope_note
   FROM grouped
  GROUP BY report_date) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_production_position WITH (security_barrier=true) AS SELECT ei_row.* FROM (WITH report_period AS (
         SELECT CURRENT_DATE AS report_date,
            date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date AS report_month_start,
            (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon -1 days'::interval)::date AS report_month_end
        ), available_plan_month AS (
         SELECT min(v_product_bulk_consolidated_effective.month_start) AS planning_month_start
           FROM v_product_bulk_consolidated_effective
          WHERE v_product_bulk_consolidated_effective.month_start >= (( SELECT report_period.report_month_start
                   FROM report_period))
        ), planned AS (
         SELECT ap.planning_month_start,
            round(sum(COALESCE(p_1.final_make_qty, 0::numeric)), 2) AS planned_production_base_qty
           FROM available_plan_month ap
             LEFT JOIN v_product_bulk_consolidated_effective p_1 ON p_1.month_start = ap.planning_month_start
          GROUP BY ap.planning_month_start
        ), bulk_produced AS (
         SELECT rp_1.report_month_start,
            round(sum(COALESCE(b.expected_output_base_qty, 0::numeric)), 2) AS bulk_produced_base_qty
           FROM report_period rp_1
             LEFT JOIN v_batch_canonical_in_process_keyed b ON b.last_fg_bulk_updated >= rp_1.report_month_start AND b.last_fg_bulk_updated <= rp_1.report_month_end AND (b.primary_state = ANY (ARRAY['FG_BULK'::text, 'BOTTLED'::text, 'TRANSFERRED_ONLY'::text]))
          GROUP BY rp_1.report_month_start
        ), fg_transferred AS (
         SELECT rp_1.report_month_start,
            round(sum(COALESCE(f.tally_total_in_base, 0::numeric)), 2) AS transferred_to_finished_goods_base_qty,
            round(sum(COALESCE(f.tally_total_amount, 0::numeric)), 2) AS transferred_to_finished_goods_value
           FROM report_period rp_1
             LEFT JOIN v_fg_transfer_reconciliation f ON f.transfer_date >= rp_1.report_month_start AND f.transfer_date <= rp_1.report_month_end AND f.exists_in_tally = true
          GROUP BY rp_1.report_month_start
        )
 SELECT rp.report_date,
    rp.report_month_start,
    rp.report_month_end,
    p.planning_month_start,
        CASE
            WHEN p.planning_month_start = rp.report_month_start THEN 'CURRENT_MONTH_PLAN_AVAILABLE'::text
            WHEN p.planning_month_start > rp.report_month_start THEN 'CURRENT_MONTH_PLAN_NOT_AVAILABLE_USING_NEXT_AVAILABLE_PLAN_MONTH'::text
            WHEN p.planning_month_start IS NULL THEN 'NO_PLAN_AVAILABLE'::text
            ELSE 'UNKNOWN'::text
        END AS planning_period_status,
    COALESCE(p.planned_production_base_qty, 0::numeric) AS planned_production_base_qty,
    COALESCE(bp.bulk_produced_base_qty, 0::numeric) AS bulk_produced_base_qty,
    COALESCE(ft.transferred_to_finished_goods_base_qty, 0::numeric) AS transferred_to_finished_goods_base_qty,
    COALESCE(ft.transferred_to_finished_goods_value, 0::numeric) AS transferred_to_finished_goods_value,
        CASE
            WHEN p.planning_month_start = rp.report_month_start THEN round(COALESCE(bp.bulk_produced_base_qty, 0::numeric) - COALESCE(p.planned_production_base_qty, 0::numeric), 2)
            ELSE NULL::numeric
        END AS bulk_production_variance_base_qty,
        CASE
            WHEN p.planning_month_start = rp.report_month_start THEN round(COALESCE(ft.transferred_to_finished_goods_base_qty, 0::numeric) - COALESCE(p.planned_production_base_qty, 0::numeric), 2)
            ELSE NULL::numeric
        END AS fg_transfer_variance_base_qty,
        CASE
            WHEN p.planning_month_start = rp.report_month_start AND COALESCE(p.planned_production_base_qty, 0::numeric) > 0::numeric THEN round(COALESCE(bp.bulk_produced_base_qty, 0::numeric) / p.planned_production_base_qty * 100::numeric, 2)
            ELSE NULL::numeric
        END AS bulk_production_achievement_pct,
        CASE
            WHEN p.planning_month_start = rp.report_month_start AND COALESCE(p.planned_production_base_qty, 0::numeric) > 0::numeric THEN round(COALESCE(ft.transferred_to_finished_goods_base_qty, 0::numeric) / p.planned_production_base_qty * 100::numeric, 2)
            ELSE NULL::numeric
        END AS fg_transfer_achievement_pct,
    'Planned Production = Sum of final_make_qty from v_product_bulk_consolidated_effective for the available planning month. If current month plan is not available, achievement percentage is intentionally not calculated.'::text AS planned_production_note,
    'Planning Period Status explains whether the production plan belongs to the current report month or only to the next available planning month.'::text AS planning_period_status_note,
    'Bulk Produced = Sum of expected_output_base_qty from batches whose last_fg_bulk_updated falls within the current report month and whose state is FG_BULK, BOTTLED, or TRANSFERRED_ONLY.'::text AS bulk_produced_note,
    'Transferred to Finished Goods = Sum of tally_total_in_base from v_fg_transfer_reconciliation where transfer_date falls within the current report month and the transfer exists in Tally.'::text AS transferred_to_finished_goods_note,
    'Bulk Production Achievement % is calculated only when current-month production plan is available.'::text AS bulk_production_achievement_note,
    'Finished Goods Transfer Achievement % is calculated only when current-month production plan is available.'::text AS fg_transfer_achievement_note
   FROM report_period rp
     LEFT JOIN planned p ON true
     LEFT JOIN bulk_produced bp ON bp.report_month_start = rp.report_month_start
     LEFT JOIN fg_transferred ft ON ft.report_month_start = rp.report_month_start) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_finance_outstanding_party_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (SELECT report_date,
    group_name,
    mis_group_name,
    party_name,
    count(*) AS bill_count,
    sum(outstanding_amount_tally_value) AS signed_outstanding_tally_value,
    abs(sum(outstanding_amount_tally_value)) AS outstanding_amount_mis_value,
    sum(outstanding_amount_abs_line_value) AS absolute_bill_line_total,
    min(bill_date_text) AS earliest_bill_date_text,
    max(bill_date_text) AS latest_bill_date_text
   FROM v_mis_finance_outstanding_detail
  GROUP BY report_date, group_name, mis_group_name, party_name) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_financial_position WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_snapshot AS (
         SELECT max(tally_group_outstanding_snapshot.as_of_date) AS report_date
           FROM tally_group_outstanding_snapshot
        ), base AS (
         SELECT t.as_of_date,
            t.group_name,
            COALESCE(t.outstanding_amount_value, 0::numeric) AS outstanding_amount_value
           FROM tally_group_outstanding_snapshot t
             JOIN latest_snapshot l ON l.report_date = t.as_of_date
          WHERE t.group_name = ANY (ARRAY['Sundry Creditors'::text, 'Sundry Debtors'::text])
        ), summary AS (
         SELECT base.as_of_date AS report_date,
            abs(sum(base.outstanding_amount_value) FILTER (WHERE base.group_name = 'Sundry Creditors'::text)) AS payables_sundry_creditors,
            abs(sum(base.outstanding_amount_value) FILTER (WHERE base.group_name = 'Sundry Debtors'::text)) AS receivables_sundry_debtors
           FROM base
          GROUP BY base.as_of_date
        )
 SELECT report_date,
    COALESCE(payables_sundry_creditors, 0::numeric) AS payables_sundry_creditors,
    COALESCE(receivables_sundry_debtors, 0::numeric) AS receivables_sundry_debtors,
    COALESCE(receivables_sundry_debtors, 0::numeric) - COALESCE(payables_sundry_creditors, 0::numeric) AS net_sundry_position,
    'Payables — Sundry Creditors = Absolute value of total outstanding_amount_value where group_name is Sundry Creditors for the latest available snapshot date.'::text AS payables_sundry_creditors_note,
    'Receivables — Sundry Debtors = Absolute value of total outstanding_amount_value where group_name is Sundry Debtors for the latest available snapshot date.'::text AS receivables_sundry_debtors_note,
    'Net Sundry Position = Receivables — Sundry Debtors minus Payables — Sundry Creditors. Positive means receivables exceed payables; negative means payables exceed receivables.'::text AS net_sundry_position_note
   FROM summary) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_fg_inventory_position WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH base AS (
         SELECT COALESCE(v_stock_checker.stock_ik, 0::numeric) AS stock_ik,
            COALESCE(v_stock_checker.stock_kkd, 0::numeric) AS stock_kkd,
            COALESCE(v_stock_checker.stock_ok, 0::numeric) AS stock_ok,
            COALESCE(v_stock_checker.stock_value_ik, 0::numeric) AS stock_value_ik,
            COALESCE(v_stock_checker.stock_value_kkd, 0::numeric) AS stock_value_kkd,
            COALESCE(v_stock_checker.stock_value_ok, 0::numeric) AS stock_value_ok,
            COALESCE(v_stock_checker.stock_value_overall, 0::numeric) AS stock_value_overall,
            v_stock_checker.mos_overall
           FROM v_stock_checker
        ), summary AS (
         SELECT sum(base.stock_ik) AS fg_stock_units_ik,
            sum(base.stock_kkd) AS fg_stock_units_kkd,
            sum(base.stock_ok) AS fg_stock_units_ok,
            sum(base.stock_ik + base.stock_kkd + base.stock_ok) AS fg_stock_units_overall,
            sum(base.stock_value_ik) AS fg_inventory_value_ik,
            sum(base.stock_value_kkd) AS fg_inventory_value_kkd,
            sum(base.stock_value_ok) AS fg_inventory_value_ok,
            sum(base.stock_value_overall) AS fg_inventory_value_overall,
            count(*) FILTER (WHERE base.mos_overall IS NOT NULL AND base.mos_overall < 1::numeric) AS fg_items_below_1_month_cover,
            count(*) FILTER (WHERE base.mos_overall IS NOT NULL AND base.mos_overall >= 1::numeric AND base.mos_overall <= 3::numeric) AS fg_items_1_to_3_month_cover,
            count(*) FILTER (WHERE base.mos_overall IS NOT NULL AND base.mos_overall > 6::numeric) AS fg_items_above_6_month_cover,
            count(*) AS fg_sku_count
           FROM base
        )
 SELECT round(COALESCE(fg_stock_units_ik, 0::numeric), 2) AS fg_stock_units_ik,
    round(COALESCE(fg_stock_units_kkd, 0::numeric), 2) AS fg_stock_units_kkd,
    round(COALESCE(fg_stock_units_ok, 0::numeric), 2) AS fg_stock_units_ok,
    round(COALESCE(fg_stock_units_overall, 0::numeric), 2) AS fg_stock_units_overall,
    round(COALESCE(fg_inventory_value_ik, 0::numeric), 2) AS fg_inventory_value_ik,
    round(COALESCE(fg_inventory_value_kkd, 0::numeric), 2) AS fg_inventory_value_kkd,
    round(COALESCE(fg_inventory_value_ok, 0::numeric), 2) AS fg_inventory_value_ok,
    round(COALESCE(fg_inventory_value_overall, 0::numeric), 2) AS fg_inventory_value_overall,
    COALESCE(fg_items_below_1_month_cover, 0::bigint) AS fg_items_below_1_month_cover,
    COALESCE(fg_items_1_to_3_month_cover, 0::bigint) AS fg_items_1_to_3_month_cover,
    COALESCE(fg_items_above_6_month_cover, 0::bigint) AS fg_items_above_6_month_cover,
    COALESCE(fg_sku_count, 0::bigint) AS fg_sku_count,
    'Finished Goods Inventory Value = Sum of stock_value_overall from v_stock_checker.'::text AS fg_inventory_value_overall_note,
    'Finished Goods Months of Stock Cover = Current finished goods stock divided by monthly forecasted sales. Items below 1 month cover may require production attention.'::text AS fg_months_of_stock_cover_note,
    'Finished Goods units include available stock from Inside Kerala, Kozhikode Depot, and Outside Kerala godowns as available in v_stock_checker.'::text AS fg_stock_units_note
   FROM summary) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_production_tab_summary WITH (security_barrier=true) AS SELECT ei_row.* FROM (SELECT pp.report_date,
    pp.report_month_start,
    pp.report_month_end,
    pp.planning_month_start,
    pp.planning_period_status,
    pp.planned_production_base_qty,
    pp.bulk_produced_base_qty,
    pp.transferred_to_finished_goods_base_qty,
    pp.transferred_to_finished_goods_value,
    pp.bulk_production_variance_base_qty,
    pp.fg_transfer_variance_base_qty,
    pp.bulk_production_achievement_pct,
    pp.fg_transfer_achievement_pct,
    bp.not_initiated_batch_count,
    bp.work_in_process_batch_count,
    bp.finished_goods_bulk_batch_count,
    bp.bottled_stock_batch_count,
    bp.transferred_only_batch_count,
    bp.active_pipeline_batch_count,
    bp.total_canonical_batch_count,
    bp.overdue_work_in_process_batch_count,
    bp.not_initiated_expected_output_base_qty,
    bp.work_in_process_expected_output_base_qty,
    bp.finished_goods_bulk_on_hand_base_qty,
    bp.bottled_stock_on_hand_base_qty,
    bp.transferred_only_base_qty,
    pp.planned_production_note,
    pp.planning_period_status_note,
    pp.bulk_produced_note,
    pp.transferred_to_finished_goods_note,
    pp.bulk_production_achievement_note,
    pp.fg_transfer_achievement_note,
    bp.active_pipeline_batch_count_note,
    bp.total_canonical_batch_count_note,
    bp.not_initiated_note,
    bp.work_in_process_note,
    bp.finished_goods_bulk_note,
    bp.bottled_stock_note,
    bp.transferred_only_note,
    'Production tab covers current-month production plan achievement and operational batch pipeline status. Active Pipeline includes Not Initiated, Work in Process, Finished Goods Bulk, and Bottled Stock. Transferred-only batches are historical/completed transfer records and are excluded from active pipeline.'::text AS production_scope_note
   FROM v_mis_production_position pp
     CROSS JOIN v_mis_batch_pipeline bp) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_inventory_position WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH base AS (
         SELECT v_stock_current_by_item.source_kind,
            v_stock_current_by_item.category_label,
            COALESCE(v_stock_current_by_item.qty_value, 0::numeric) AS qty_value,
            COALESCE(v_stock_current_by_item.avg_rate_value, 0::numeric) AS avg_rate_value,
            COALESCE(v_stock_current_by_item.qty_value, 0::numeric) * COALESCE(v_stock_current_by_item.avg_rate_value, 0::numeric) AS stock_value
           FROM v_stock_current_by_item
        ), summary AS (
         SELECT sum(base.stock_value) FILTER (WHERE base.source_kind = 'rm'::text) AS raw_material_inventory_value,
            sum(base.stock_value) FILTER (WHERE base.source_kind = 'plm'::text) AS packing_material_inventory_value,
            sum(base.stock_value) FILTER (WHERE base.source_kind = 'consumable'::text) AS consumables_inventory_value,
            sum(base.stock_value) FILTER (WHERE base.source_kind = 'fuel'::text) AS fuel_inventory_value,
            sum(base.stock_value) AS manufacturing_inventory_value,
            count(*) FILTER (WHERE base.source_kind = 'rm'::text) AS raw_material_item_count,
            count(*) FILTER (WHERE base.source_kind = 'plm'::text) AS packing_material_item_count,
            count(*) FILTER (WHERE base.source_kind = 'consumable'::text) AS consumables_item_count,
            count(*) FILTER (WHERE base.source_kind = 'fuel'::text) AS fuel_item_count,
            count(*) AS manufacturing_inventory_item_count
           FROM base
        )
 SELECT COALESCE(raw_material_inventory_value, 0::numeric) AS raw_material_inventory_value,
    COALESCE(packing_material_inventory_value, 0::numeric) AS packing_material_inventory_value,
    COALESCE(consumables_inventory_value, 0::numeric) AS consumables_inventory_value,
    COALESCE(fuel_inventory_value, 0::numeric) AS fuel_inventory_value,
    COALESCE(manufacturing_inventory_value, 0::numeric) AS manufacturing_inventory_value,
    COALESCE(raw_material_item_count, 0::bigint) AS raw_material_item_count,
    COALESCE(packing_material_item_count, 0::bigint) AS packing_material_item_count,
    COALESCE(consumables_item_count, 0::bigint) AS consumables_item_count,
    COALESCE(fuel_item_count, 0::bigint) AS fuel_item_count,
    COALESCE(manufacturing_inventory_item_count, 0::bigint) AS manufacturing_inventory_item_count,
    'Manufacturing Inventory Value = Sum of Quantity × Average Rate from v_stock_current_by_item for raw material, packing material, consumables, and fuel.'::text AS manufacturing_inventory_value_note,
    'Raw Material Inventory Value = Sum of Quantity × Average Rate where source_kind is rm.'::text AS raw_material_inventory_value_note,
    'Packing Material Inventory Value = Sum of Quantity × Average Rate where source_kind is plm.'::text AS packing_material_inventory_value_note,
    'Consumables Inventory Value = Sum of Quantity × Average Rate where source_kind is consumable.'::text AS consumables_inventory_value_note,
    'Fuel Inventory Value = Sum of Quantity × Average Rate where source_kind is fuel.'::text AS fuel_inventory_value_note
   FROM summary) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_sales_tab_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_sales AS (
         SELECT ( SELECT v_sales_daily_normalized.sales_date
                   FROM v_sales_daily_normalized
                  WHERE v_sales_daily_normalized.sales_date IS NOT NULL
                  ORDER BY v_sales_daily_normalized.sales_date DESC
                 LIMIT 1) AS report_date
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            latest_sales.report_date AS month_upto_date
           FROM latest_sales
        ), sales_base AS (
         SELECT s_1.sales_date,
            s_1.sku_id,
            s_1.product_id,
            s_1.godown_id,
            s_1.region_id,
            s_1.qty_units,
            s_1.qty_billed,
            s_1.billed_amount,
            s_1.source_key,
            s_1.inserted_at
           FROM v_sales_daily_normalized s_1
             CROSS JOIN periods p_1
          WHERE s_1.sales_date >= p_1.month_start AND s_1.sales_date <= p_1.month_upto_date
        )
 SELECT p.report_date,
    p.month_start,
    p.month_upto_date,
    sum(s.billed_amount) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_value,
    sum(s.qty_units) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_units,
    sum(s.qty_billed) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_billed_units,
    sum(s.billed_amount) AS month_to_date_sales_value,
    sum(s.qty_units) AS month_to_date_sales_units,
    sum(s.qty_billed) AS month_to_date_billed_units,
    count(DISTINCT s.sales_date) AS sales_days_available_in_month,
    count(DISTINCT s.product_id) AS products_sold_month_to_date,
    count(DISTINCT s.sku_id) AS skus_sold_month_to_date,
        CASE
            WHEN count(DISTINCT s.sales_date) > 0 THEN sum(s.billed_amount) / count(DISTINCT s.sales_date)::numeric
            ELSE NULL::numeric
        END AS average_daily_sales_value,
    'Sales tab summary is based on the latest available sales month from v_sales_daily_normalized. Month-to-date values cover sales from month start up to the latest available sales date.'::text AS sales_scope_note
   FROM periods p
     LEFT JOIN sales_base s ON true
  GROUP BY p.report_date, p.month_start, p.month_upto_date) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_finance_outstanding_detail WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_snapshot AS (
         SELECT max(tally_group_outstanding_snapshot.as_of_date) AS report_date
           FROM tally_group_outstanding_snapshot
        ), base AS (
         SELECT t.as_of_date AS report_date,
            t.group_name,
                CASE
                    WHEN t.group_name = 'Sundry Creditors'::text THEN 'Payables — Sundry Creditors'::text
                    WHEN t.group_name = 'Sundry Debtors'::text THEN 'Receivables — Sundry Debtors'::text
                    ELSE t.group_name
                END AS mis_group_name,
            t.bill_date_text,
            t.bill_ref,
            t.vendor_name AS party_name,
            COALESCE(t.opening_amount_value, 0::numeric) AS opening_amount_tally_value,
            COALESCE(t.outstanding_amount_value, 0::numeric) AS outstanding_amount_tally_value,
            abs(COALESCE(t.opening_amount_value, 0::numeric)) AS opening_amount_abs_line_value,
            abs(COALESCE(t.outstanding_amount_value, 0::numeric)) AS outstanding_amount_abs_line_value,
            t.source_key,
            t.inserted_at
           FROM tally_group_outstanding_snapshot t
             JOIN latest_snapshot l ON l.report_date = t.as_of_date
          WHERE t.group_name = ANY (ARRAY['Sundry Creditors'::text, 'Sundry Debtors'::text])
        )
 SELECT report_date,
    group_name,
    mis_group_name,
    bill_date_text,
    bill_ref,
    party_name,
    opening_amount_tally_value,
    outstanding_amount_tally_value,
    opening_amount_abs_line_value,
    outstanding_amount_abs_line_value,
    source_key,
    inserted_at
   FROM base) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_sales_position WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_sales AS (
         SELECT max(v_sales_daily_normalized.sales_date) AS report_date
           FROM v_sales_daily_normalized
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            (date_trunc('month'::text, latest_sales.report_date::timestamp with time zone) + '1 mon -1 days'::interval)::date AS month_end
           FROM latest_sales
        ), base AS (
         SELECT s.sales_date,
            COALESCE(s.qty_units, 0::numeric) AS qty_units,
            COALESCE(s.qty_billed, 0::numeric) AS qty_billed,
            COALESCE(s.billed_amount, 0::numeric) AS billed_amount
           FROM v_sales_daily_normalized s
             CROSS JOIN periods p
          WHERE s.sales_date >= p.month_start AND s.sales_date <= p.report_date
        ), summary AS (
         SELECT p.report_date,
            p.month_start,
            p.month_end,
            sum(b.billed_amount) FILTER (WHERE b.sales_date = p.report_date) AS sales_value_latest_day,
            sum(b.qty_units) FILTER (WHERE b.sales_date = p.report_date) AS sales_units_latest_day,
            sum(b.qty_billed) FILTER (WHERE b.sales_date = p.report_date) AS sales_billed_units_latest_day,
            sum(b.billed_amount) AS sales_value_month_to_date,
            sum(b.qty_units) AS sales_units_month_to_date,
            sum(b.qty_billed) AS sales_billed_units_month_to_date,
            count(DISTINCT b.sales_date) AS sales_days_available_in_month
           FROM periods p
             LEFT JOIN base b ON true
          GROUP BY p.report_date, p.month_start, p.month_end
        )
 SELECT report_date,
    month_start,
    month_end,
    round(COALESCE(sales_value_latest_day, 0::numeric), 2) AS sales_value_latest_day,
    round(COALESCE(sales_units_latest_day, 0::numeric), 2) AS sales_units_latest_day,
    round(COALESCE(sales_billed_units_latest_day, 0::numeric), 2) AS sales_billed_units_latest_day,
    round(COALESCE(sales_value_month_to_date, 0::numeric), 2) AS sales_value_month_to_date,
    round(COALESCE(sales_units_month_to_date, 0::numeric), 2) AS sales_units_month_to_date,
    round(COALESCE(sales_billed_units_month_to_date, 0::numeric), 2) AS sales_billed_units_month_to_date,
    COALESCE(sales_days_available_in_month, 0::bigint) AS sales_days_available_in_month,
    'Latest Day Sales Value = Sum of billed_amount from v_sales_daily_normalized for the latest available sales date.'::text AS sales_value_latest_day_note,
    'Month-to-Date Sales Value = Sum of billed_amount from v_sales_daily_normalized from the first day of the month up to the latest available sales date.'::text AS sales_value_month_to_date_note,
    'Sales units are reported from qty_units and billed units from qty_billed. These may differ depending on billing and actual quantity representation in Tally.'::text AS sales_units_note
   FROM summary) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_batch_pipeline WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH base AS (
         SELECT v_batch_canonical_in_process_keyed.product_id,
            v_batch_canonical_in_process_keyed.product_name,
            v_batch_canonical_in_process_keyed.batch_number,
            v_batch_canonical_in_process_keyed.primary_state,
            COALESCE(v_batch_canonical_in_process_keyed.expected_output_base_qty, 0::numeric) AS expected_output_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.fg_bulk_on_hand_base_qty, 0::numeric) AS fg_bulk_on_hand_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.bottled_on_hand_base_qty, 0::numeric) AS bottled_on_hand_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.transferred_out_base_qty, 0::numeric) AS transferred_out_base_qty,
            COALESCE(v_batch_canonical_in_process_keyed.transferred_out_amount, 0::numeric) AS transferred_out_amount,
            v_batch_canonical_in_process_keyed.wip_started_on,
            v_batch_canonical_in_process_keyed.wip_due_date
           FROM v_batch_canonical_in_process_keyed
        ), summary AS (
         SELECT count(*) FILTER (WHERE base.primary_state = 'NOT_INITIATED'::text) AS not_initiated_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'WIP'::text) AS work_in_process_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'FG_BULK'::text) AS finished_goods_bulk_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'BOTTLED'::text) AS bottled_stock_batch_count,
            count(*) FILTER (WHERE base.primary_state = 'TRANSFERRED_ONLY'::text) AS transferred_only_batch_count,
            count(*) FILTER (WHERE base.primary_state = ANY (ARRAY['NOT_INITIATED'::text, 'WIP'::text, 'FG_BULK'::text, 'BOTTLED'::text])) AS active_pipeline_batch_count,
            count(*) AS total_canonical_batch_count,
            round(sum(base.expected_output_base_qty) FILTER (WHERE base.primary_state = 'NOT_INITIATED'::text), 2) AS not_initiated_expected_output_base_qty,
            round(sum(base.expected_output_base_qty) FILTER (WHERE base.primary_state = 'WIP'::text), 2) AS work_in_process_expected_output_base_qty,
            round(sum(base.fg_bulk_on_hand_base_qty) FILTER (WHERE base.primary_state = 'FG_BULK'::text), 2) AS finished_goods_bulk_on_hand_base_qty,
            round(sum(base.bottled_on_hand_base_qty) FILTER (WHERE base.primary_state = 'BOTTLED'::text), 2) AS bottled_stock_on_hand_base_qty,
            round(sum(base.transferred_out_base_qty) FILTER (WHERE base.primary_state = 'TRANSFERRED_ONLY'::text), 2) AS transferred_only_base_qty,
            count(*) FILTER (WHERE base.primary_state = 'WIP'::text AND base.wip_due_date IS NOT NULL AND base.wip_due_date < CURRENT_DATE) AS overdue_work_in_process_batch_count
           FROM base
        )
 SELECT COALESCE(not_initiated_batch_count, 0::bigint) AS not_initiated_batch_count,
    COALESCE(work_in_process_batch_count, 0::bigint) AS work_in_process_batch_count,
    COALESCE(finished_goods_bulk_batch_count, 0::bigint) AS finished_goods_bulk_batch_count,
    COALESCE(bottled_stock_batch_count, 0::bigint) AS bottled_stock_batch_count,
    COALESCE(transferred_only_batch_count, 0::bigint) AS transferred_only_batch_count,
    COALESCE(active_pipeline_batch_count, 0::bigint) AS active_pipeline_batch_count,
    COALESCE(total_canonical_batch_count, 0::bigint) AS total_canonical_batch_count,
    COALESCE(not_initiated_expected_output_base_qty, 0::numeric) AS not_initiated_expected_output_base_qty,
    COALESCE(work_in_process_expected_output_base_qty, 0::numeric) AS work_in_process_expected_output_base_qty,
    COALESCE(finished_goods_bulk_on_hand_base_qty, 0::numeric) AS finished_goods_bulk_on_hand_base_qty,
    COALESCE(bottled_stock_on_hand_base_qty, 0::numeric) AS bottled_stock_on_hand_base_qty,
    COALESCE(transferred_only_base_qty, 0::numeric) AS transferred_only_base_qty,
    COALESCE(overdue_work_in_process_batch_count, 0::bigint) AS overdue_work_in_process_batch_count,
    'Active Pipeline Batches = Count of batches currently in Not Initiated, Work in Process, Finished Goods Bulk, or Bottled Stock stages. Transferred-only batches are excluded from active pipeline.'::text AS active_pipeline_batch_count_note,
    'Total Canonical Batch Count = All batches visible in v_batch_canonical_in_process_keyed, including transferred-only historical batches.'::text AS total_canonical_batch_count_note,
    'Not Initiated = Batch/BMR created or planned but production issue/process has not started.'::text AS not_initiated_note,
    'Work in Process = Batch where raw material issue or production process has started but bulk output is not yet completed.'::text AS work_in_process_note,
    'Finished Goods Bulk = Production completed in bulk form but not fully packed/transferred as saleable finished goods.'::text AS finished_goods_bulk_note,
    'Bottled Stock = Packed or partially packed goods available before final finished goods transfer.'::text AS bottled_stock_note,
    'Transferred Only = Batches identified from finished goods transfer records, generally already transferred to saleable finished goods stock and not part of active pipeline.'::text AS transferred_only_note
   FROM summary) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_finished_goods_tab_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (SELECT CURRENT_DATE AS report_date,
    count(*) AS sku_count,
    sum(stock_ik) AS stock_units_ik,
    sum(stock_kkd) AS stock_units_kkd,
    sum(stock_ok) AS stock_units_ok,
    sum(COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) AS stock_units_overall,
    sum(stock_value_ik) AS stock_value_ik,
    sum(stock_value_kkd) AS stock_value_kkd,
    sum(stock_value_ok) AS stock_value_ok,
    sum(stock_value_overall) AS stock_value_overall,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) = 0::numeric) AS zero_stock_sku_count,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) > 0::numeric AND mos_overall < 1::numeric) AS below_1_month_cover_count,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric)) > 0::numeric AND mos_overall >= 1::numeric AND mos_overall <= 3::numeric) AS one_to_three_month_cover_count,
    count(*) FILTER (WHERE (COALESCE(stock_ik, 0::numeric) + COALESCE(stock_kkd, 0::numeric) + COALESCE(stock_ok, 0::numeric)) > 0::numeric AND mos_overall > 6::numeric) AS above_6_month_cover_count,
    count(*) FILTER (WHERE shade_flag IS TRUE) AS same_ik_ok_mrp_sku_count,
    'Finished Goods tab covers SKU-level stock, value, forecast, and Months of Stock cover. Filter logic: Zero Stock = no stock in any FG location; Below 1 Month = non-zero stock with MOS below 1; 1 to 3 Months = MOS from 1 to 3; Above 6 Months = MOS above 6; Normal = non-zero stock outside these alert buckets; Same IK/OK MRP = SKUs where Inside Kerala and Outside Kerala MRP are equal. Manufacturing inventory is handled separately.'::text AS finished_goods_scope_note
   FROM v_stock_checker) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_expense_position WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_snapshot AS (
         SELECT max(tally_expenses_snapshot.as_of_date) AS report_date
           FROM tally_expenses_snapshot
        ), fy AS (
         SELECT latest_snapshot.report_date,
                CASE
                    WHEN EXTRACT(month FROM latest_snapshot.report_date) >= 4::numeric THEN make_date(EXTRACT(year FROM latest_snapshot.report_date)::integer, 4, 1)
                    ELSE make_date(EXTRACT(year FROM latest_snapshot.report_date)::integer - 1, 4, 1)
                END AS financial_year_start
           FROM latest_snapshot
        ), base AS (
         SELECT t.as_of_date,
            t.expense_group,
            t.head_name,
            COALESCE(t.net_cb_value, 0::numeric) AS net_cb_value
           FROM tally_expenses_snapshot t
             JOIN latest_snapshot l ON l.report_date = t.as_of_date
          WHERE t.expense_group = ANY (ARRAY['Direct Expenses'::text, 'Indirect Expenses'::text])
        ), summary AS (
         SELECT l.report_date,
            f.financial_year_start,
            sum(b.net_cb_value) FILTER (WHERE b.expense_group = 'Direct Expenses'::text) AS direct_expenses_fy_position,
            sum(b.net_cb_value) FILTER (WHERE b.expense_group = 'Indirect Expenses'::text) AS indirect_expenses_fy_position,
            sum(b.net_cb_value) AS total_expenses_fy_position
           FROM latest_snapshot l
             JOIN fy f ON f.report_date = l.report_date
             LEFT JOIN base b ON b.as_of_date = l.report_date
          GROUP BY l.report_date, f.financial_year_start
        )
 SELECT report_date,
    financial_year_start,
    COALESCE(direct_expenses_fy_position, 0::numeric) AS direct_expenses_fy_position,
    COALESCE(indirect_expenses_fy_position, 0::numeric) AS indirect_expenses_fy_position,
    COALESCE(total_expenses_fy_position, 0::numeric) AS total_expenses_fy_position,
    'Financial Year Expense Position = Expense ledger closing balance as available in Tally expense snapshot for the latest available date in the current financial year.'::text AS total_expenses_fy_position_note,
    'Direct Expenses = Sum of net_cb_value where expense_group is Direct Expenses for the latest available Tally expense snapshot.'::text AS direct_expenses_fy_position_note,
    'Indirect Expenses = Sum of net_cb_value where expense_group is Indirect Expenses for the latest available Tally expense snapshot.'::text AS indirect_expenses_fy_position_note
   FROM summary) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.v_mis_inventory_tab_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (SELECT CURRENT_DATE AS report_date,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'rm'::text) AS raw_material_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'plm'::text) AS packing_material_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'consumable'::text) AS consumables_inventory_value,
    sum(qty_value * avg_rate_value) FILTER (WHERE source_kind = 'fuel'::text) AS fuel_inventory_value,
    sum(qty_value * avg_rate_value) AS manufacturing_inventory_value,
    count(*) FILTER (WHERE source_kind = 'rm'::text) AS raw_material_item_count,
    count(*) FILTER (WHERE source_kind = 'plm'::text) AS packing_material_item_count,
    count(*) FILTER (WHERE source_kind = 'consumable'::text) AS consumables_item_count,
    count(*) FILTER (WHERE source_kind = 'fuel'::text) AS fuel_item_count,
    count(*) AS total_inventory_item_count,
    'Inventory tab covers manufacturing inventory only: Raw Material, Packing Material, Consumables, and Fuel. Finished Goods inventory is handled separately in the Finished Goods tab.'::text AS inventory_scope_note,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code = 'RM'::text) AS canonical_rm_known_value,
    count(*) FILTER (WHERE category_code = 'RM'::text) AS canonical_rm_item_count,
    count(*) FILTER (WHERE category_code = 'RM'::text AND (qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric))) AS canonical_rm_valuation_gap_count,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code = 'PM'::text) AS canonical_pm_known_value,
    count(*) FILTER (WHERE category_code = 'PM'::text) AS canonical_pm_item_count,
    count(*) FILTER (WHERE category_code = 'PM'::text AND (qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric))) AS canonical_pm_valuation_gap_count,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code = 'IND'::text) AS canonical_ind_known_value,
    count(*) FILTER (WHERE category_code = 'IND'::text) AS canonical_ind_item_count,
    count(*) FILTER (WHERE category_code = 'IND'::text AND (qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric))) AS canonical_ind_valuation_gap_count,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) AS inventory_known_value,
    sum(
        CASE
            WHEN qty_value = 0::numeric THEN 0::numeric
            WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0::numeric THEN NULL::numeric
            ELSE qty_value * avg_rate_value
        END) FILTER (WHERE category_code IS NULL OR (category_code <> ALL (ARRAY['RM'::text, 'PM'::text, 'IND'::text]))) AS unclassified_known_value,
    count(*) FILTER (WHERE category_code IS NULL OR (category_code <> ALL (ARRAY['RM'::text, 'PM'::text, 'IND'::text]))) AS unclassified_item_count,
    count(*) FILTER (WHERE qty_value IS NULL OR qty_value <> 0::numeric AND (avg_rate_value IS NULL OR avg_rate_value <= 0::numeric)) AS valuation_gap_item_count,
    count(*) FILTER (WHERE qty_value = 0::numeric) AS zero_quantity_item_count,
    count(inv_stock_item_id) - count(DISTINCT inv_stock_item_id) AS duplicate_item_row_count,
    count(*) FILTER (WHERE inv_stock_item_id IS NULL) AS missing_item_id_count,
    'Manufacturing inventory: RM Raw Material, PM Packing Material, IND Indirect Materials & Utilities; known values exclude valuation gaps; Finished Goods reported separately.'::text AS canonical_inventory_scope_note
   FROM v_stock_current_by_item) ei_row WHERE (SELECT public.ei_can_read_executive());
CREATE OR REPLACE VIEW public.mv_mis_executive_summary WITH (security_invoker=false,security_barrier=true) AS SELECT ei_row.* FROM (SELECT mis_summary_id,
    report_generated_date,
    financial_position_date,
    payables_sundry_creditors,
    receivables_sundry_debtors,
    net_sundry_position,
    expense_position_date,
    financial_year_start,
    direct_expenses_fy_position,
    indirect_expenses_fy_position,
    total_expenses_fy_position,
    sales_position_date,
    sales_month_start,
    sales_month_end,
    sales_value_latest_day,
    sales_value_month_to_date,
    sales_units_latest_day,
    sales_units_month_to_date,
    raw_material_inventory_value,
    packing_material_inventory_value,
    consumables_inventory_value,
    fuel_inventory_value,
    manufacturing_inventory_value,
    fg_inventory_value_overall,
    fg_stock_units_overall,
    fg_items_below_1_month_cover,
    fg_items_above_6_month_cover,
    active_pipeline_batch_count,
    not_initiated_batch_count,
    work_in_process_batch_count,
    finished_goods_bulk_batch_count,
    bottled_stock_batch_count,
    overdue_work_in_process_batch_count,
    production_report_month_start,
    production_report_month_end,
    planning_month_start,
    planning_period_status,
    planned_production_base_qty,
    bulk_produced_base_qty,
    transferred_to_finished_goods_base_qty,
    transferred_to_finished_goods_value,
    bulk_production_achievement_pct,
    fg_transfer_achievement_pct,
    mv_refreshed_at,
    executive_summary_note
   FROM app_private.mv_mis_executive_summary) ei_row WHERE (SELECT public.ei_can_read_executive());
REVOKE ALL ON app_private.mv_mis_executive_summary FROM authenticated,anon,PUBLIC;
CREATE OR REPLACE FUNCTION public.get_mis_finance_party_page(p_group_filter text DEFAULT 'payables'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, mis_group_name text, party_name text, bill_count bigint, signed_outstanding_tally_value numeric, outstanding_amount_mis_value numeric, absolute_bill_line_total numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with filtered as (
    select
      report_date,
      mis_group_name,
      party_name,
      bill_count,
      signed_outstanding_tally_value,
      outstanding_amount_mis_value,
      absolute_bill_line_total
    from public.v_mis_finance_outstanding_party_summary
    where
      (
        p_group_filter = 'all'
        or (p_group_filter = 'payables' and mis_group_name = 'Payables — Sundry Creditors')
        or (p_group_filter = 'receivables' and mis_group_name = 'Receivables — Sundry Debtors')
      )
      and (
        coalesce(trim(p_search), '') = ''
        or party_name ilike '%' || trim(p_search) || '%'
        or mis_group_name ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.mis_group_name,
    f.party_name,
    f.bill_count,
    f.signed_outstanding_tally_value,
    f.outstanding_amount_mis_value,
    f.absolute_bill_line_total,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_executive())
  order by f.outstanding_amount_mis_value desc, f.party_name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

CREATE OR REPLACE FUNCTION public.get_mis_finished_goods_sku_page(p_mos_filter text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(category_name text, sub_category_name text, product_group_name text, sub_group_name text, product_id integer, item text, sku_id bigint, pack_size numeric, uom text, stock_ik numeric, stock_kkd numeric, stock_ok numeric, stock_overall numeric, forecast_ik numeric, forecast_kkd numeric, forecast_ok numeric, forecast_overall numeric, mos_ik numeric, mos_kkd numeric, mos_ok numeric, mos_overall numeric, stock_value_ik numeric, stock_value_kkd numeric, stock_value_ok numeric, stock_value_overall numeric, shade_flag boolean, mos_status text, classification text, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with base as (
    select
      category_name,
      sub_category_name,
      product_group_name,
      sub_group_name,
      product_id,
      item,
      sku_id,
      pack_size,
      uom,

      stock_ik,
      stock_kkd,
      stock_ok,
      coalesce(stock_ik, 0) + coalesce(stock_kkd, 0) + coalesce(stock_ok, 0) as stock_overall,

      forecast_ik,
      forecast_kkd,
      forecast_ok,
      coalesce(forecast_ik, 0) + coalesce(forecast_kkd, 0) + coalesce(forecast_ok, 0) as forecast_overall,

      mos_ik,
      mos_kkd,
      mos_ok,
      mos_overall,

      stock_value_ik,
      stock_value_kkd,
      stock_value_ok,
      stock_value_overall,

      shade_flag,

      case
        when coalesce(stock_ik, 0) + coalesce(stock_kkd, 0) + coalesce(stock_ok, 0) = 0
          then 'ZERO_STOCK'
        when mos_overall < 1
          then 'BELOW_1_MONTH'
        when mos_overall >= 1 and mos_overall <= 3
          then 'ONE_TO_THREE_MONTHS'
        when mos_overall > 6
          then 'ABOVE_6_MONTHS'
        else 'NORMAL'
      end as mos_status,

      concat_ws(
        ' › ',
        nullif(category_name, ''),
        nullif(sub_category_name, ''),
        nullif(product_group_name, ''),
        nullif(sub_group_name, '')
      ) as classification

    from public.v_stock_checker
  ),
  filtered as (
    select *
    from base
    where
      (
        p_mos_filter = 'all'
        or (p_mos_filter = 'zero_stock' and mos_status = 'ZERO_STOCK')
        or (p_mos_filter = 'below_1_month' and mos_status = 'BELOW_1_MONTH')
        or (p_mos_filter = 'one_to_three_months' and mos_status = 'ONE_TO_THREE_MONTHS')
        or (p_mos_filter = 'above_6_months' and mos_status = 'ABOVE_6_MONTHS')
        or (p_mos_filter = 'normal' and mos_status = 'NORMAL')
        or (p_mos_filter = 'shaded' and shade_flag is true)
      )
      and (
        coalesce(trim(p_search), '') = ''
        or item ilike '%' || trim(p_search) || '%'
        or sku_id::text ilike '%' || trim(p_search) || '%'
        or category_name ilike '%' || trim(p_search) || '%'
        or sub_category_name ilike '%' || trim(p_search) || '%'
        or product_group_name ilike '%' || trim(p_search) || '%'
        or sub_group_name ilike '%' || trim(p_search) || '%'
        or classification ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.category_name,
    f.sub_category_name,
    f.product_group_name,
    f.sub_group_name,
    f.product_id,
    f.item,
    f.sku_id,
    f.pack_size,
    f.uom,

    f.stock_ik,
    f.stock_kkd,
    f.stock_ok,
    f.stock_overall,

    f.forecast_ik,
    f.forecast_kkd,
    f.forecast_ok,
    f.forecast_overall,

    f.mos_ik,
    f.mos_kkd,
    f.mos_ok,
    f.mos_overall,

    f.stock_value_ik,
    f.stock_value_kkd,
    f.stock_value_ok,
    f.stock_value_overall,

    f.shade_flag,
    f.mos_status,
    f.classification,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_executive())
  order by
    case f.mos_status
      when 'ZERO_STOCK' then 1
      when 'BELOW_1_MONTH' then 2
      when 'NORMAL' then 3
      when 'ONE_TO_THREE_MONTHS' then 4
      when 'ABOVE_6_MONTHS' then 5
      else 6
    end,
    f.stock_value_overall desc nulls last,
    f.item asc,
    f.pack_size asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

CREATE OR REPLACE FUNCTION public.get_mis_inventory_item_page(p_source_kind text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(source_kind text, source_label text, inv_stock_item_id bigint, code text, item_name text, qty_value numeric, avg_rate_value numeric, stock_value numeric, category_label text, subcategory_label text, group_label text, subgroup_label text, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with base as (
    select
      source_kind,
      category_code,
      case
        when source_kind = 'rm' then 'Raw Material'
        when source_kind = 'plm' then 'Packing Material'
        when source_kind = 'consumable' then 'Consumables'
        when source_kind = 'fuel' then 'Fuel'
        else source_kind
      end as source_label,
      inv_stock_item_id,
      code,
      name as item_name,
      qty_value,
      avg_rate_value,
      CASE WHEN qty_value = 0 THEN 0::numeric WHEN qty_value IS NULL OR avg_rate_value IS NULL OR avg_rate_value <= 0 THEN NULL::numeric ELSE qty_value * avg_rate_value END as stock_value,
      category_label,
      subcategory_label,
      group_label,
      subgroup_label
    from public.v_stock_current_by_item
  ),
  filtered as (
    select *
    from base
    where
      (
        p_source_kind = 'all'
        or (p_source_kind IN ('RM','PM','IND') AND category_code = p_source_kind)
        or (p_source_kind NOT IN ('RM','PM','IND') AND source_kind = p_source_kind)
      )
      and (
        coalesce(trim(p_search), '') = ''
        or code ilike '%' || trim(p_search) || '%'
        or item_name ilike '%' || trim(p_search) || '%'
        or category_label ilike '%' || trim(p_search) || '%'
        or subcategory_label ilike '%' || trim(p_search) || '%'
        or group_label ilike '%' || trim(p_search) || '%'
        or subgroup_label ilike '%' || trim(p_search) || '%'
      )
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.source_kind,
    f.source_label,
    f.inv_stock_item_id,
    f.code,
    f.item_name,
    f.qty_value,
    f.avg_rate_value,
    f.stock_value,
    f.category_label,
    f.subcategory_label,
    f.group_label,
    f.subgroup_label,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_executive())
  order by f.stock_value desc nulls last, f.item_name asc, f.inv_stock_item_id asc, f.source_kind asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

CREATE OR REPLACE FUNCTION public.get_mis_sales_product_page(p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, month_start date, month_upto_date date, product_id bigint, product_name text, sku_count bigint, sales_value numeric, sales_units numeric, billed_units numeric, latest_day_sales_value numeric, latest_day_sales_units numeric, average_daily_sales_value numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with latest_sales as (
    select (select sales_date from public.v_sales_daily_normalized where sales_date is not null order by sales_date desc limit 1) as report_date
  ),
  periods as (
    select
      report_date,
      date_trunc('month', report_date)::date as month_start,
      report_date as month_upto_date
    from latest_sales
  ),
  product_sales as (
    select
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      coalesce(pr.item, 'Product ID ' || s.product_id::text) as product_name,
      count(distinct s.sku_id) as sku_count,
      sum(s.billed_amount) as sales_value,
      sum(s.qty_units) as sales_units,
      sum(s.qty_billed) as billed_units,
      sum(s.billed_amount) filter (where s.sales_date = p.report_date) as latest_day_sales_value,
      sum(s.qty_units) filter (where s.sales_date = p.report_date) as latest_day_sales_units,
      case
        when count(distinct s.sales_date) > 0
        then sum(s.billed_amount) / count(distinct s.sales_date)
        else null
      end as average_daily_sales_value
    from public.v_sales_daily_normalized s
    cross join periods p
    left join public.products pr
      on pr.id = s.product_id
    where s.sales_date >= p.month_start
      and s.sales_date <= p.month_upto_date
    group by
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      pr.item
  ),
  filtered as (
    select *
    from product_sales
    where
      coalesce(trim(p_search), '') = ''
      or product_name ilike '%' || trim(p_search) || '%'
      or product_id::text ilike '%' || trim(p_search) || '%'
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.month_start,
    f.month_upto_date,
    f.product_id,
    f.product_name,
    f.sku_count,
    f.sales_value,
    f.sales_units,
    f.billed_units,
    f.latest_day_sales_value,
    f.latest_day_sales_units,
    f.average_daily_sales_value,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_executive())
  order by f.sales_value desc nulls last, f.product_name asc, f.product_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$;

-- SOURCE: R3_R4_COVERAGE_EXTENSION.sql git blob db99b2c2bfde2309a8e0b4e105c00dfdebcb6f52
-- Review only. Install after R3_R4_SERVER_CANDIDATE and R3_MIS_ACCESS_CANDIDATE.

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
 WITH sku_keys AS MATERIALIZED (
 SELECT public.normalize_key(sa.alias_text) AS key,count(*) AS matches FROM public.sku_aliases sa JOIN public.product_skus k ON k.id=sa.sku_id GROUP BY 1
 ), godown_keys AS MATERIALIZED (
 SELECT public.normalize_key(ga.alias_text) AS key,count(*) AS matches FROM public.godown_aliases ga JOIN public.godowns g ON g.id=ga.godown_id GROUP BY 1
 ), raw AS (
 SELECT s.voucher_date,count(*) AS raw_rows,count(*) FILTER(WHERE s.billed_amount_value IS NULL) AS missing_amount_rows,max(s.inserted_at) AS inserted_at,
 count(*) FILTER(WHERE sk.matches=1 AND gd.matches=1) AS uniquely_mapped_raw_rows,
 count(*) FILTER(WHERE coalesce(sk.matches,0)>1 OR coalesce(gd.matches,0)>1) AS ambiguous_mapping_rows
 FROM public.tally_sales_vreg_snapshot s LEFT JOIN sku_keys sk ON sk.key=public.normalize_key(s.tally_item_name)
 LEFT JOIN godown_keys gd ON gd.key=public.normalize_key(s.godown_label)
 WHERE s.voucher_date BETWEEN m AND a GROUP BY s.voucher_date
 ), mapped AS (
 SELECT sales_date,count(*) AS mapped_rows,count(DISTINCT source_key) AS distinct_source_keys,max(inserted_at) AS inserted_at
 FROM public.v_sales_daily_normalized WHERE sales_date BETWEEN m AND a GROUP BY sales_date
 ), jobs AS (
 SELECT DISTINCT ON(vreg_date_extracted) vreg_date_extracted,status::text AS status,finished_at
 FROM public.etl_jobs WHERE job_type='UPSERT_VREG_SALES' AND vreg_date_extracted BETWEEN m AND a
 ORDER BY vreg_date_extracted,created_at DESC NULLS LAST,id DESC
 ), days AS (
 SELECT d::date AS transaction_date,r.raw_rows,n.mapped_rows,n.distinct_source_keys,r.uniquely_mapped_raw_rows,r.ambiguous_mapping_rows,r.missing_amount_rows,r.inserted_at AS raw_inserted_at,n.inserted_at AS mapped_inserted_at,j.status AS latest_job_status,j.finished_at AS latest_job_finished_at,
 CASE WHEN r.raw_rows IS NULL THEN 'NO_RAW_ROWS_NOT_CERTIFIED'
 WHEN n.mapped_rows IS NULL THEN 'NO_MAPPED_ROWS'
 WHEN r.raw_rows<>r.uniquely_mapped_raw_rows OR n.mapped_rows<>r.uniquely_mapped_raw_rows OR r.ambiguous_mapping_rows>0 THEN 'MAPPING_COUNT_MISMATCH'
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

-- SOURCE: R3_HISTORICAL_MEASURE_RECONCILIATION.sql git blob 849eb3686af7767b3ada6977f4dd1b7d30ab76aa
-- Review candidate; apply after coverage extension. Same public JSON fields; no client rework required.
-- Daily source authoritative; performance gate required before production installation.

CREATE FUNCTION public.ei_sales_verified_months(p_from date,p_to date,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL)
RETURNS TABLE(month_start date,sku_id integer,product_id bigint,region_id integer,godown_id integer,qty_units numeric,qty_billed numeric,billed_amount numeric,source_max_inserted_at timestamptz,amount_ambiguous boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.ei_sales_access();
 IF p_from IS NULL OR p_to IS NULL OR p_from<>date_trunc('month',p_from)::date OR p_to<>date_trunc('month',p_to)::date OR p_from>p_to OR p_to> (p_from+interval '12 months')::date THEN RAISE EXCEPTION 'Invalid month bounds' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 SELECT date_trunc('month',d.sales_date)::date,d.sku_id,d.product_id,d.region_id,d.godown_id,
 CASE WHEN count(*) FILTER(WHERE d.qty_units IS NULL)=0 THEN sum(d.qty_units) END,
 CASE WHEN count(*) FILTER(WHERE d.qty_billed IS NULL)=0 THEN sum(d.qty_billed) END,
 sum(d.billed_amount),max(d.inserted_at),count(*) FILTER(WHERE d.billed_amount IS NULL)>0
 FROM public.v_sales_daily_normalized d WHERE d.sales_date>=p_from AND d.sales_date<p_to
 AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown) AND (p_product IS NULL OR d.product_id=p_product) AND (p_sku IS NULL OR d.sku_id=p_sku)
 GROUP BY 1,2,3,4,5;
END $$;
REVOKE ALL ON FUNCTION public.ei_sales_verified_months(date,date,integer,integer,bigint,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_sales_verified_months(date,date,integer,integer,bigint,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.ei_sales_history(p_anchor date DEFAULT NULL,p_months integer DEFAULT 12,p_group text DEFAULT 'month',p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false,p_search text DEFAULT NULL,p_sort text DEFAULT 'value_desc',p_limit integer DEFAULT 50,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; anchor_date date; anchor_month date; from_date date; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 12 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000
    OR p_group IS NULL OR p_group NOT IN ('month','region','godown','product','sku','category','subcategory','group','subgroup','region_month','godown_month','product_month','sku_month','category_month','subcategory_month')
    OR p_sort IS NULL OR p_sort NOT IN ('value_desc','value_asc','key') OR length(coalesce(p_search,''))>120
  THEN RAISE EXCEPTION 'Invalid history bounds or grouping' USING ERRCODE='22023'; END IF;
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  anchor_date:=coalesce(p_anchor,latest);
  IF anchor_date IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'coverage','NO_MAPPED_DATA'); END IF;
  IF latest IS NULL OR anchor_date>latest OR anchor_date<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  anchor_month:=date_trunc('month',anchor_date)::date;
  from_date:=(anchor_month-make_interval(months=>p_months-1))::date;
  WITH source AS (
    SELECT h.month_start,h.sku_id,h.product_id,h.region_id,h.godown_id,h.qty_units,h.qty_billed,h.billed_amount,h.source_max_inserted_at AS inserted_at,
      true AS monthly_source,h.amount_ambiguous
    FROM public.ei_sales_verified_months(from_date,anchor_month,p_region,p_godown,p_product,p_sku) h
    WHERE h.month_start>=from_date AND h.month_start<anchor_month
      AND (p_region IS NULL OR h.region_id=p_region) AND (p_godown IS NULL OR h.godown_id=p_godown)
      AND (p_product IS NULL OR h.product_id=p_product) AND (p_sku IS NULL OR h.sku_id=p_sku)
    UNION ALL
    SELECT anchor_month,d.sku_id,d.product_id,d.region_id,d.godown_id,d.qty_units,d.qty_billed,d.billed_amount,d.inserted_at,false,d.billed_amount IS NULL
    FROM public.v_sales_daily_normalized d
    WHERE d.sales_date BETWEEN anchor_month AND anchor_date
      AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown)
      AND (p_product IS NULL OR d.product_id=p_product) AND (p_sku IS NULL OR d.sku_id=p_sku)
  ), enriched AS (
    SELECT s.*,k.pack_size,k.uom,
      CASE split_part(p_group,'_month',1)
        WHEN 'month' THEN 'ALL' WHEN 'region' THEN s.region_id::text WHEN 'godown' THEN s.godown_id::text
        WHEN 'product' THEN s.product_id::text WHEN 'sku' THEN s.sku_id::text WHEN 'category' THEN c.id::text
        WHEN 'subcategory' THEN sc.id::text WHEN 'group' THEN pg.id::text WHEN 'subgroup' THEN sg.id::text END AS dimension_id,
      CASE split_part(p_group,'_month',1)
        WHEN 'month' THEN 'All sales' WHEN 'region' THEN r.name WHEN 'godown' THEN g.name WHEN 'product' THEN p.item
        WHEN 'sku' THEN concat(p.item,' · ',k.pack_size,' ',k.uom) WHEN 'category' THEN c.category_name
        WHEN 'subcategory' THEN sc.subcategory_name WHEN 'group' THEN pg.group_name WHEN 'subgroup' THEN sg.sub_group_name END AS dimension_name
    FROM source s LEFT JOIN public.product_skus k ON k.id=s.sku_id LEFT JOIN public.products p ON p.id=s.product_id
      LEFT JOIN public.sub_groups sg ON sg.id=p.sub_group_id LEFT JOIN public.product_groups pg ON pg.id=sg.product_group_id
      LEFT JOIN public.sub_categories sc ON sc.id=pg.sub_category_id LEFT JOIN public.categories c ON c.id=sc.category_id
      LEFT JOIN public.regions r ON r.id=s.region_id LEFT JOIN public.godowns g ON g.id=s.godown_id
    WHERE NOT coalesce(p_active_only,false) OR k.is_active IS TRUE
  ), grouped AS (
    SELECT dimension_id,coalesce(dimension_name,'Unmapped') AS dimension_name,
      CASE WHEN p_group='month' OR right(p_group,6)='_month' THEN month_start END AS month,
      count(*) AS source_groups,count(*) FILTER(WHERE monthly_source) AS historical_groups,
      count(*) FILTER(WHERE amount_ambiguous) AS ambiguous_amount_groups,
      count(*) FILTER(WHERE qty_units IS NULL) AS missing_actual_groups,
      count(*) FILTER(WHERE qty_billed IS NULL) AS missing_billed_groups,
      CASE WHEN count(*) FILTER(WHERE amount_ambiguous)=0 THEN sum(billed_amount) END AS sales_value,
      sum(billed_amount) AS source_reported_amount,
      CASE WHEN count(*) FILTER(WHERE qty_units IS NULL)=0 THEN sum(qty_units) END AS actual_packages,
      CASE WHEN count(*) FILTER(WHERE qty_billed IS NULL)=0 THEN sum(qty_billed) END AS billed_packages,
      max(inserted_at) AS source_max_inserted_at
    FROM enriched
    WHERE nullif(trim(p_search),'') IS NULL OR strpos(lower(coalesce(dimension_name,'')),lower(trim(p_search)))>0 OR strpos(lower(coalesce(dimension_id,'')),lower(trim(p_search)))>0
    GROUP BY dimension_id,dimension_name,CASE WHEN p_group='month' OR right(p_group,6)='_month' THEN month_start END
  ), metrics AS (
    SELECT *,CASE WHEN actual_packages>0 THEN sales_value/actual_packages END AS asp_actual_package,
      CASE WHEN billed_packages>0 THEN sales_value/billed_packages END AS asp_billed_package,
      CASE WHEN ambiguous_amount_groups+missing_actual_groups+missing_billed_groups>0 THEN 'MISSING_OR_AMBIGUOUS_MEASURES' ELSE 'OBSERVED_NOT_CERTIFIED' END AS coverage
    FROM grouped
  ), ranked AS (
    SELECT *,row_number() OVER(ORDER BY CASE WHEN p_sort='value_desc' THEN sales_value END DESC NULLS LAST,
      CASE WHEN p_sort='value_asc' THEN sales_value END ASC NULLS LAST,month NULLS LAST,dimension_id NULLS LAST,dimension_name) AS ordinal
    FROM metrics
  )
  SELECT jsonb_build_object('anchor',anchor_date,'start_date',from_date,'latest_mapped_date',latest,'total',(SELECT count(*) FROM ranked),
    'limit',p_limit,'offset',p_offset,'quantity_basis','NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY',
    'import_completeness','NOT_CERTIFIED','historical_measure_basis','BOUNDED_DAILY_SOURCE_MONTHLY_GROUPS',
    'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY ordinal),'[]'::jsonb))
  INTO result FROM (SELECT * FROM ranked WHERE ordinal>p_offset AND ordinal<=p_offset+p_limit) page;
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.ei_sales_window_totals(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a date; latest date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
 a:=coalesce(p_anchor,latest);
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_MAPPED_DATA'); END IF;
 IF latest IS NULL OR a>latest OR a<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
 WITH verified AS MATERIALIZED (SELECT * FROM public.ei_sales_verified_months((date_trunc('month',a)-interval '12 months')::date,date_trunc('month',a)::date,p_region,p_godown,p_product,p_sku)), periods AS (SELECT n,(date_trunc('month',a)-make_interval(months=>n))::date AS start_date FROM (VALUES(3),(12)) v(n)),
 hist AS (
 SELECT w.n,w.start_date,(date_trunc('month',a)::date-1) AS end_date,
 count(DISTINCT h.month_start) AS observed_months,count(h.month_start) AS source_groups,
 count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.amount_ambiguous) AS ambiguous_amount_groups,
 sum(h.billed_amount) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.qty_units IS NULL)=0 THEN sum(h.qty_units) END AS actual_packages,
 CASE WHEN count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.qty_billed IS NULL)=0 THEN sum(h.qty_billed) END AS billed_packages,
 max(h.source_max_inserted_at) AS source_max_inserted_at
 FROM periods w LEFT JOIN verified h ON h.month_start>=w.start_date AND h.month_start<date_trunc('month',a)::date
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

-- SOURCE: R3_FACILITY_SALES_SCOPE.sql git blob 032456407a75c6aa5b0059483dcb1330f4f16587
-- Review only; additive contract. No product, alias or transaction mutations.

CREATE FUNCTION public.ei_facility_sales_scope(p_anchor date DEFAULT NULL,p_months integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a date; latest date; first_date date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid months' USING ERRCODE='22023'; END IF;
 SELECT voucher_date INTO latest FROM public.tally_sales_vreg_snapshot WHERE voucher_date IS NOT NULL ORDER BY voucher_date DESC LIMIT 1;
 a:=coalesce(p_anchor,latest);
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_RAW_DATA','rows','[]'::jsonb); END IF;
 IF latest IS NULL OR a>latest OR a<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
 first_date:=(date_trunc('month',a)-make_interval(months=>p_months-1))::date;
 WITH classified AS (
 SELECT s.id,s.billed_amount_value,
 CASE WHEN NOT EXISTS(SELECT 1 FROM public.sku_aliases sa JOIN public.product_skus k ON k.id=sa.sku_id WHERE public.normalize_key(sa.alias_text)=public.normalize_key(s.tally_item_name))
 THEN 'SKU_MAPPING_UNRESOLVED'
 WHEN NOT EXISTS(SELECT 1 FROM public.godown_aliases ga JOIN public.godowns g ON g.id=ga.godown_id WHERE public.normalize_key(ga.alias_text)=public.normalize_key(s.godown_label))
 THEN 'GODOWN_MAPPING_UNRESOLVED'
 ELSE 'MAPPED_PRODUCT_SCOPE' END AS scope
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN first_date AND a
 ), grouped AS (
 SELECT scope,count(*) AS recorded_rows,count(*) FILTER(WHERE billed_amount_value IS NULL) AS missing_amount_rows,sum(billed_amount_value) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE billed_amount_value IS NULL)=0 THEN sum(billed_amount_value) END AS billed_value FROM classified GROUP BY scope
 ), totals AS (
 SELECT count(*) AS recorded_rows,count(*) FILTER(WHERE billed_amount_value IS NULL) AS missing_amount_rows,sum(billed_amount_value) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE billed_amount_value IS NULL)=0 THEN sum(billed_amount_value) END AS billed_value FROM classified
 )
 SELECT jsonb_build_object('anchor',a,'start_date',first_date,'latest_raw_date',latest,'facility',to_jsonb(totals),
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY scope),'[]'::jsonb) FROM grouped),
 'import_completeness','NOT_CERTIFIED','ownership_classification','NOT_AVAILABLE_IN_CANONICAL_MASTER','scope_note','Unresolved SKU mapping may represent other parent-organization manufacturing units or other transactions; not automatically a defect. Mapped product scope is not independently certified manufacturing ownership.')
 INTO result FROM totals;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ei_facility_sales_scope(date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_facility_sales_scope(date,integer) TO authenticated;

-- SOURCE: R3_SALES_ITEM_SCOPE_MASTER.sql git blob 36a5d63af10ac694b63fb06f828736a2eca24f2f
-- Review candidate, not installed. Apply after R3_FACILITY_SALES_SCOPE.sql.
-- Dedicated permission target: module:sales-item-classification. No implicit editor grants.

CREATE TABLE public.sales_item_scope (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 alias_text text NOT NULL CHECK(length(trim(alias_text)) BETWEEN 1 AND 300),
 alias_key text GENERATED ALWAYS AS (public.normalize_key(alias_text)) STORED,
 effective_from date NOT NULL CHECK(effective_from>=date '1900-01-01'),
 scope text NOT NULL CHECK(scope IN ('OTHER_MANUFACTURING_UNIT','RAW_MATERIAL','PACKING_MATERIAL','OTHER_MERCHANDISE','SASV_HISTORICAL_PACK','SASV_SAMPLE','EXCLUDE_PRODUCT_ANALYTICS','UNCLASSIFIED')),
 inventory_item_id bigint REFERENCES public.inv_stock_item(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 1 AND 2000),
 approved_by uuid,
 approval_source text NOT NULL CHECK(approval_source IN ('OWNER_RECEIPT','AUTHORIZED_EDITOR')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(alias_key IS NOT NULL AND alias_key<>''),
 CHECK(approval_source='OWNER_RECEIPT' OR approved_by IS NOT NULL),
 CHECK((scope IN ('RAW_MATERIAL','PACKING_MATERIAL') AND inventory_item_id IS NOT NULL) OR (scope NOT IN ('RAW_MATERIAL','PACKING_MATERIAL') AND inventory_item_id IS NULL))
);
-- Immutable decision events; latest effective date then latest event wins.
-- Effective end is derived, not stored; revisions never overlap in the resolved timeline.
CREATE INDEX sales_item_scope_resolution_idx ON public.sales_item_scope(alias_key,effective_from DESC,id DESC);
ALTER TABLE public.sales_item_scope ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_item_scope FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.sales_item_scope TO authenticated;
CREATE POLICY sales_item_scope_read ON public.sales_item_scope FOR SELECT TO authenticated USING (
 auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true' AND
 (coalesce(public.app_has_permission('module:sales-item-classification','view'),false) OR coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) OR coalesce(public.app_has_permission('module:sales-data-viewer','view'),false)));
-- Explicitly approved labels only. No prefix rules or guessed future variants.
INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source)
SELECT label,date '1900-01-01',scope,'Owner classification receipt 2026-11-25','OWNER_RECEIPT'
FROM (VALUES
 ('CHARMA MAHIMA 75 GM','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 75 GM - ?35/-','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 75 GM - ?33/-','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 75 GM MRP ?68/-','OTHER_MANUFACTURING_UNIT'),('CHARMA MAHIMA 15 GM(Sample)','OTHER_MANUFACTURING_UNIT'),
 ('CHARMA SUDHI 75 GM','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 75 GM - ?35/-','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 75 GM - ?33/-','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 75 GM MRP ?68/-','OTHER_MANUFACTURING_UNIT'),('CHARMA SUDHI 15 GM(Sample)','OTHER_MANUFACTURING_UNIT'),
 ('KRIPA VIRGIN COCONUT OIL 100 ML','OTHER_MANUFACTURING_UNIT'),('NALLAMANGALAM-BLUE 150 GM','OTHER_MANUFACTURING_UNIT'),('HONEY 100 GM','OTHER_MANUFACTURING_UNIT'),('HONEY 250 GM','OTHER_MANUFACTURING_UNIT'),
 ('AGARBATHI - SANDAL WOOD 25 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - JASMIN 25 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - RAAT RANI 25 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - SANDAL 27 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - JASMIN 27 GM','OTHER_MANUFACTURING_UNIT'),('AGARBATHI - RAAT RANI 27 GM','OTHER_MANUFACTURING_UNIT'),('AGRI WASH 300 GM','OTHER_MANUFACTURING_UNIT'),('ASHTAGANDHA DHOOP 35 GM','OTHER_MANUFACTURING_UNIT'),
 ('SANTHIGIRI N99 MASK (ADULTS)','SASV_HISTORICAL_PACK'),('SANTHIGIRI N99 MASK (KIDS)','SASV_HISTORICAL_PACK'),('HRIDAYARENJINI LEPAM  250 GM','SASV_HISTORICAL_PACK'),('THRIPHALA CHOORNAM (S) 1 Kg','SASV_HISTORICAL_PACK'),('PADIKARACHENDOORAM 1 Kg','SASV_HISTORICAL_PACK'),('MARMANI ASAVENNA 100ML','SASV_HISTORICAL_PACK'),('VEMBADAPATTA THAILAM 100 ML','SASV_HISTORICAL_PACK'),('KSHEERABALA 021 AVARTHY 10 ML','SASV_HISTORICAL_PACK'),('KABASURA KUDINEER (SAMPLE)','SASV_SAMPLE'),
 ('REGAS (Loose)','EXCLUDE_PRODUCT_ANALYTICS'),('ARJUN FORTE (Loose)','EXCLUDE_PRODUCT_ANALYTICS'),('VATHAMARMAKAN CAP (Loose)','EXCLUDE_PRODUCT_ANALYTICS')
) v(label,scope);
-- Scope-only editor: no modification to SKU aliases. New mapping workflow remains in canonical master admin.
-- No material classification by this RPC until authoritative inventory class validation is wired.
CREATE FUNCTION public.sales_item_scope_approve(p_alias text,p_scope text,p_effective_from date,p_reason text,p_expected_latest_id bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; current_id bigint; new_id bigint;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:sales-item-classification','view'),false) OR NOT coalesce(public.app_has_permission('module:sales-item-classification','edit'),false) THEN RAISE EXCEPTION 'Classification edit denied' USING ERRCODE='42501'; END IF;
 k:=public.normalize_key(p_alias);
 IF k IS NULL OR k='' OR p_scope IS NULL OR p_scope IN ('RAW_MATERIAL','PACKING_MATERIAL') THEN RAISE EXCEPTION 'Invalid or material-specific classification requires verified material authority' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,7332));
 SELECT id INTO current_id FROM public.sales_item_scope WHERE alias_key=k ORDER BY id DESC LIMIT 1;
 IF current_id IS DISTINCT FROM p_expected_latest_id THEN RAISE EXCEPTION 'Classification changed; reload' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=k) THEN RAISE EXCEPTION 'Canonical SKU alias already exists; reconcile in master administration' USING ERRCODE='23514'; END IF;
 INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source,approved_by) VALUES(p_alias,p_effective_from,p_scope,p_reason,'AUTHORIZED_EDITOR',auth.uid()) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint) TO authenticated;
-- Bounded monthly source grouped before alias lookups. No unbounded queue scan.
CREATE FUNCTION public.sales_item_scope_review(p_from date,p_to date,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:sales-item-classification','view'),false) THEN RAISE EXCEPTION 'Classification view denied' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to>p_from+365 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000 THEN RAISE EXCEPTION 'Invalid queue bounds' USING ERRCODE='22023'; END IF;
 WITH raw AS MATERIALIZED (
 SELECT s.tally_item_name,s.voucher_date,count(*) n,sum(s.billed_amount_value) value,count(*) FILTER(WHERE s.billed_amount_value IS NULL) missing
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN p_from AND p_to GROUP BY 1,2
 ), labels AS MATERIALIZED (
 SELECT x.tally_item_name,public.normalize_key(x.tally_item_name) alias_key FROM (SELECT DISTINCT tally_item_name FROM raw) x
 ), scope_events AS MATERIALIZED (
 SELECT DISTINCT ON(s.alias_key,s.effective_from) s.alias_key,s.effective_from,s.id,s.scope
 FROM public.sales_item_scope s ORDER BY s.alias_key,s.effective_from,s.id DESC
 ), scope_periods AS MATERIALIZED (
 SELECT e.*,lead(e.effective_from) OVER(PARTITION BY e.alias_key ORDER BY e.effective_from) next_effective_from FROM scope_events e
 ), alias_map AS MATERIALIZED (
 SELECT public.normalize_key(a.alias_text) AS alias_key,count(*) AS matches,min(a.sku_id) AS sku_id,bool_or(k.is_sample) AS sample
 FROM public.sku_aliases a JOIN public.product_skus k ON k.id=a.sku_id GROUP BY 1
 ), classified AS (
 SELECT r.*,a.sku_id,a.matches,a.sample,c.scope,c.id classification_id
 FROM raw r JOIN labels l ON l.tally_item_name=r.tally_item_name LEFT JOIN alias_map a ON a.alias_key=l.alias_key
 LEFT JOIN scope_periods c ON c.alias_key=l.alias_key AND c.effective_from<=r.voucher_date AND (c.next_effective_from IS NULL OR r.voucher_date<c.next_effective_from)
 ), grouped AS (
 SELECT tally_item_name,CASE WHEN matches>1 OR (sku_id IS NOT NULL AND classification_id IS NOT NULL AND scope NOT IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE')) THEN 'CLASSIFICATION_CONFLICT' WHEN sku_id IS NULL AND scope IS NULL THEN 'UNCLASSIFIED' ELSE scope END AS state,
 sum(n) recorded_rows,sum(value) source_reported_amount,sum(missing) missing_amount_rows,min(voucher_date) first_date,max(voucher_date) last_date
 FROM classified WHERE (sku_id IS NULL AND (scope IS NULL OR scope='UNCLASSIFIED' OR scope IN ('SASV_HISTORICAL_PACK','SASV_SAMPLE'))) OR (matches>1 OR (sku_id IS NOT NULL AND classification_id IS NOT NULL AND scope NOT IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE')))
 GROUP BY 1,2
 ), page AS (SELECT * FROM grouped ORDER BY abs(source_reported_amount) DESC NULLS LAST,tally_item_name,state OFFSET p_offset LIMIT p_limit)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM grouped),'limit',p_limit,'offset',p_offset,'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY abs(source_reported_amount) DESC NULLS LAST,tally_item_name,state),'[]'::jsonb)) INTO result FROM page;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.sales_item_scope_review(date,date,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_item_scope_review(date,date,integer,integer) TO authenticated;

-- SOURCE: R3_UNIFIED_SALES_CLASSIFICATION.sql git blob 580123703f59be9c100439dc54c72fdad5493ab6
-- Review candidate. Install after R3_SALES_ITEM_SCOPE_MASTER.sql.

-- One row per canonical SKU (including never-sold), plus products lacking SKU and latest scope-only identities.
-- Catalog is current master, not a historical transaction classification.
CREATE VIEW public.v_sales_item_classification WITH (security_invoker=true,security_barrier=true) AS
WITH authorized AS (
 SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true' AND (
 coalesce(public.app_has_permission('module:sales-item-classification','view'),false) OR
 coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) OR
 coalesce(public.app_has_permission('module:sales-data-viewer','view'),false)) AS allowed
), aliases AS (
 SELECT sku_id,count(*) alias_count,jsonb_agg(alias_text ORDER BY alias_text) aliases FROM public.sku_aliases GROUP BY sku_id
), current_scope AS (
 SELECT DISTINCT ON(alias_key) * FROM public.sales_item_scope WHERE effective_from<=current_date ORDER BY alias_key,effective_from DESC,id DESC
)
SELECT 'SKU:'||k.id AS identity_key,'CANONICAL_SKU'::text AS identity_type,p.id AS product_id,k.id AS sku_id,p.item AS item_name,k.pack_size::text AS pack_size,k.uom::text AS pack_uom,k.is_active,k.is_sample,
 CASE WHEN k.is_sample IS TRUE THEN 'SASV_SAMPLE' ELSE 'SASV_CANONICAL_PRODUCT' END AS scope,
 coalesce(a.alias_count,0) AS alias_count,coalesce(a.aliases,'[]'::jsonb) AS aliases,NULL::bigint AS classification_id,NULL::bigint AS inventory_item_id,
 CASE WHEN a.alias_count IS NULL THEN 'NO_TALLY_ALIAS' WHEN EXISTS(SELECT 1 FROM public.sku_aliases sa JOIN current_scope c ON c.alias_key=public.normalize_key(sa.alias_text) WHERE sa.sku_id=k.id AND c.scope NOT IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE')) THEN 'CLASSIFICATION_CONFLICT' ELSE 'MAPPED' END AS mapping_state
FROM public.product_skus k JOIN public.products p ON p.id=k.product_id LEFT JOIN aliases a ON a.sku_id=k.id CROSS JOIN authorized z WHERE z.allowed
UNION ALL
SELECT 'PRODUCT:'||p.id,'PRODUCT_WITHOUT_SKU',p.id,NULL::integer,p.item,NULL,NULL,NULL::boolean,NULL::boolean,'SASV_CANONICAL_PRODUCT',0,'[]'::jsonb,NULL::bigint,NULL::bigint,'NO_SKU'
FROM public.products p CROSS JOIN authorized z WHERE z.allowed AND NOT EXISTS(SELECT 1 FROM public.product_skus k WHERE k.product_id=p.id)
UNION ALL
SELECT 'SCOPE:'||c.alias_key,'SCOPE_ONLY',NULL::integer,NULL::integer,c.alias_text,NULL,NULL,NULL::boolean,NULL::boolean,c.scope,0,jsonb_build_array(c.alias_text),c.id,c.inventory_item_id,
 CASE WHEN EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=c.alias_key) THEN 'RECONCILE_WITH_SKU' WHEN c.scope IN ('SASV_HISTORICAL_PACK','SASV_SAMPLE') THEN 'SKU_PENDING' WHEN c.scope='UNCLASSIFIED' THEN 'REVIEW' ELSE 'CLASSIFIED' END
FROM current_scope c CROSS JOIN authorized z WHERE z.allowed;
REVOKE ALL ON public.v_sales_item_classification FROM PUBLIC,anon;
GRANT SELECT ON public.v_sales_item_classification TO authenticated;
-- Effective-dated facility reconciliation; one raw row contributes once, even with conflicting aliases.
CREATE OR REPLACE FUNCTION public.ei_facility_sales_scope(p_anchor date DEFAULT NULL,p_months integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a date; latest date; first_date date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid months' USING ERRCODE='22023'; END IF;
 SELECT voucher_date INTO latest FROM public.tally_sales_vreg_snapshot WHERE voucher_date IS NOT NULL ORDER BY voucher_date DESC LIMIT 1;
 a:=coalesce(p_anchor,latest);
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_RAW_DATA','rows','[]'::jsonb); END IF;
 IF latest IS NULL OR a>latest OR a<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
 first_date:=(date_trunc('month',a)-make_interval(months=>p_months-1))::date;
 WITH raw AS MATERIALIZED (
 SELECT s.tally_item_name,s.godown_label,s.voucher_date,count(*) n,count(*) FILTER(WHERE s.billed_amount_value IS NULL) missing,sum(s.billed_amount_value) amount
 FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN first_date AND a GROUP BY 1,2,3
 ), labels AS MATERIALIZED (
 SELECT x.tally_item_name,public.normalize_key(x.tally_item_name) alias_key FROM (SELECT DISTINCT tally_item_name FROM raw) x
 ), scope_events AS MATERIALIZED (
 SELECT DISTINCT ON(s.alias_key,s.effective_from) s.alias_key,s.effective_from,s.id,s.scope
 FROM public.sales_item_scope s ORDER BY s.alias_key,s.effective_from,s.id DESC
 ), scope_periods AS MATERIALIZED (
 SELECT e.*,lead(e.effective_from) OVER(PARTITION BY e.alias_key ORDER BY e.effective_from) next_effective_from FROM scope_events e
 ), locations AS MATERIALIZED (
 SELECT x.godown_label,public.normalize_key(x.godown_label) alias_key FROM (SELECT DISTINCT godown_label FROM raw) x
 ), sku_map AS MATERIALIZED (
 SELECT public.normalize_key(sa.alias_text) AS alias_key,count(*) matches,bool_or(k.is_sample) sample
 FROM public.sku_aliases sa JOIN public.product_skus k ON k.id=sa.sku_id GROUP BY 1
 ), godown_map AS MATERIALIZED (
 SELECT public.normalize_key(ga.alias_text) AS alias_key,count(*) matches FROM public.godown_aliases ga JOIN public.godowns g ON g.id=ga.godown_id GROUP BY 1
 ), classified AS (
 SELECT r.*,CASE
 WHEN m.matches>1 THEN 'CLASSIFICATION_CONFLICT'
 WHEN m.matches=1 AND c.scope IS NOT NULL AND c.scope NOT IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE') THEN 'CLASSIFICATION_CONFLICT'
 WHEN m.matches=1 AND m.sample IS TRUE THEN 'SASV_SAMPLE'
 WHEN m.matches=1 THEN 'SASV_CANONICAL_PRODUCT'
 ELSE coalesce(c.scope,'UNCLASSIFIED') END AS scope,
 coalesce(g.matches,0)<>1 AS godown_unresolved
 FROM raw r JOIN labels l ON l.tally_item_name=r.tally_item_name JOIN locations d ON d.godown_label=r.godown_label
 LEFT JOIN sku_map m ON m.alias_key=l.alias_key
 LEFT JOIN godown_map g ON g.alias_key=d.alias_key
 LEFT JOIN scope_periods c ON c.alias_key=l.alias_key AND c.effective_from<=r.voucher_date AND (c.next_effective_from IS NULL OR r.voucher_date<c.next_effective_from)
 ), grouped AS (
 SELECT scope,sum(n) recorded_rows,sum(missing) missing_amount_rows,sum(amount) source_reported_amount,CASE WHEN sum(missing)=0 THEN sum(amount) END billed_value,
 coalesce(sum(n) FILTER(WHERE godown_unresolved),0) godown_unresolved_rows FROM classified GROUP BY scope
 ), totals AS (
 SELECT coalesce(sum(n),0) recorded_rows,coalesce(sum(missing),0) missing_amount_rows,sum(amount) source_reported_amount,CASE WHEN sum(missing)=0 THEN sum(amount) END billed_value,coalesce(sum(n) FILTER(WHERE godown_unresolved),0) godown_unresolved_rows FROM classified
 )
 SELECT jsonb_build_object('anchor',a,'start_date',first_date,'latest_raw_date',latest,'facility',to_jsonb(totals),
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(grouped) ORDER BY scope),'[]'::jsonb) FROM grouped),
 'import_completeness','NOT_CERTIFIED','ownership_classification','CANONICAL_MASTER_AND_OWNER_APPROVED_SCOPE','scope_note','Canonical catalog includes all existing SKUs; transaction values are classified once; missing godown mapping is an independent diagnostic; conflicts are excluded from certified product scope.')
 INTO result FROM totals;
 RETURN result;
END $$;

-- SOURCE: R3_SALES_SCOPE_MATERIAL_BACKFILL.sql git blob 48d4b325cef85ccfd07999ae797ffe85bea89612
-- Review candidate; apply after scope master and unified catalog. No production writes yet.

DROP FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint);
CREATE FUNCTION public.sales_item_scope_approve(p_alias text,p_scope text,p_effective_from date,p_reason text,p_expected_latest_id bigint DEFAULT NULL,p_inventory_item_id bigint DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; current_id bigint; new_id bigint;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR NOT coalesce(public.app_has_permission('module:sales-item-classification','view'),false) OR NOT coalesce(public.app_has_permission('module:sales-item-classification','edit'),false) THEN RAISE EXCEPTION 'Classification edit denied' USING ERRCODE='42501'; END IF;
 k:=public.normalize_key(p_alias);
 IF k IS NULL OR k='' OR p_scope IS NULL  THEN RAISE EXCEPTION 'Invalid or material-specific classification requires verified material authority' USING ERRCODE='22023'; END IF;
 IF p_scope IN ('RAW_MATERIAL','PACKING_MATERIAL') THEN
 IF p_inventory_item_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.v_inv_stock_item_with_class c WHERE c.stock_item_id=p_inventory_item_id AND c.category_code=CASE WHEN p_scope='RAW_MATERIAL' THEN 'RM' ELSE 'PM' END) THEN RAISE EXCEPTION 'Inventory class does not match sales scope' USING ERRCODE='23514'; END IF;
 ELSIF p_inventory_item_id IS NOT NULL THEN RAISE EXCEPTION 'Unexpected inventory reference' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(k,7332));
 SELECT id INTO current_id FROM public.sales_item_scope WHERE alias_key=k ORDER BY id DESC LIMIT 1;
 IF current_id IS DISTINCT FROM p_expected_latest_id THEN RAISE EXCEPTION 'Classification changed; reload' USING ERRCODE='40001'; END IF;
 IF EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=k) THEN RAISE EXCEPTION 'Canonical SKU alias already exists; reconcile in master administration' USING ERRCODE='23514'; END IF;
 INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,reason,approval_source,approved_by,inventory_item_id) VALUES(p_alias,p_effective_from,p_scope,p_reason,'AUTHORIZED_EDITOR',auth.uid(),p_inventory_item_id) RETURNING id INTO new_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_item_scope_approve(text,text,date,text,bigint,bigint) TO authenticated;
-- Owner approved verified RM/PM classification. Exact observed labels, unique existing mapped inventory alias, matching category.
-- Fail closed on drift; no master alias or stock item creation.
DO $$
DECLARE inserted_count integer;
BEGIN
WITH expected(label,item_id) AS (VALUES
 ('CHENNINAYAKAM (S)',207),('CHUKKU (S)',241),('JATHIKKA PARIPPU (S)',331),('JATHIPATHRI (S)',332),('JEERAKAM (S)',333),('KARUVAPPATTA - NAADAN (S)',422),('KATAL NURA (S)',430),('KOLARAKKU (S)',475),('KURUMULAKU (S)',527),('KUTA MANJAL (S)',534),('NAKAM (S)',643),('PASUVIN NEYYU (S)',750),('PAVIZHA PUTTU (S)',759),('THAKKOLAM (S)',893),('YAVAM (S)',1049)
), verified AS (
 SELECT e.* FROM expected e WHERE EXISTS(SELECT 1 FROM public.tally_sales_vreg_snapshot s WHERE s.tally_item_name=e.label)
 AND NOT EXISTS(SELECT 1 FROM public.sku_aliases a WHERE public.normalize_key(a.alias_text)=public.normalize_key(e.label))
 AND NOT EXISTS(SELECT 1 FROM public.sales_item_scope c WHERE c.alias_key=public.normalize_key(e.label))
 AND (SELECT count(DISTINCT a.inv_stock_item_id) FROM public.inv_stock_item_alias a WHERE a.status='mapped' AND a.source_system='tally' AND public.normalize_key(a.tally_item_name)=public.normalize_key(regexp_replace(e.label,'[[:space:]]*[(]S[)]$','','i')))=1
 AND EXISTS(SELECT 1 FROM public.inv_stock_item_alias a JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=a.inv_stock_item_id WHERE a.inv_stock_item_id=e.item_id AND a.status='mapped' AND a.source_system='tally' AND a.source_kind='rm' AND c.category_code='RM' AND public.normalize_key(a.tally_item_name)=public.normalize_key(regexp_replace(e.label,'[[:space:]]*[(]S[)]$','','i')))
)
INSERT INTO public.sales_item_scope(alias_text,effective_from,scope,inventory_item_id,reason,approval_source)
SELECT label,date '1900-01-01','RAW_MATERIAL',item_id,'Owner approved verified material scope; unique mapped inventory alias and RM category, historical (S) suffix removed','OWNER_RECEIPT' FROM verified;
GET DIAGNOSTICS inserted_count=ROW_COUNT;
IF inserted_count<>15 THEN RAISE EXCEPTION 'Material seed drift: expected 15, got %',inserted_count; END IF;
END $$;

-- SOURCE: R3_SALES_MTD_PARITY.sql git blob 6b43318d55e6b3067e353fdae9439393690d0299
-- R3 parity: separate sales-only contracts; keep every legacy MIS reporting object executive-only.

CREATE FUNCTION public.ei_can_read_sales() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
 AND (coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false)
 OR coalesce(public.app_has_permission('module:sales-data-viewer','view'),false));
$$;
REVOKE ALL ON FUNCTION public.ei_can_read_sales() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_can_read_sales() TO authenticated;
CREATE VIEW public.v_ei_sales_mtd_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_sales AS (
         SELECT ( SELECT v_sales_daily_normalized.sales_date
                   FROM v_sales_daily_normalized
                  WHERE v_sales_daily_normalized.sales_date IS NOT NULL
                  ORDER BY v_sales_daily_normalized.sales_date DESC
                 LIMIT 1) AS report_date
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            latest_sales.report_date AS month_upto_date
           FROM latest_sales
        ), sales_base AS (
         SELECT s_1.sales_date,
            s_1.sku_id,
            s_1.product_id,
            s_1.godown_id,
            s_1.region_id,
            s_1.qty_units,
            s_1.qty_billed,
            s_1.billed_amount,
            s_1.source_key,
            s_1.inserted_at
           FROM v_sales_daily_normalized s_1
             CROSS JOIN periods p_1
          WHERE s_1.sales_date >= p_1.month_start AND s_1.sales_date <= p_1.month_upto_date
        )
 SELECT p.report_date,
    p.month_start,
    p.month_upto_date,
    sum(s.billed_amount) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_value,
    sum(s.qty_units) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_units,
    sum(s.qty_billed) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_billed_units,
    sum(s.billed_amount) AS month_to_date_sales_value,
    sum(s.qty_units) AS month_to_date_sales_units,
    sum(s.qty_billed) AS month_to_date_billed_units,
    count(DISTINCT s.sales_date) AS sales_days_available_in_month,
    count(DISTINCT s.product_id) AS products_sold_month_to_date,
    count(DISTINCT s.sku_id) AS skus_sold_month_to_date,
        CASE
            WHEN count(DISTINCT s.sales_date) > 0 THEN sum(s.billed_amount) / count(DISTINCT s.sales_date)::numeric
            ELSE NULL::numeric
        END AS average_daily_sales_value,
    'Sales tab summary is based on the latest available sales month from v_sales_daily_normalized. Month-to-date values cover sales from month start up to the latest available sales date.'::text AS sales_scope_note
   FROM periods p
     LEFT JOIN sales_base s ON true
  GROUP BY p.report_date, p.month_start, p.month_upto_date) ei_row WHERE (SELECT public.ei_can_read_sales());

CREATE FUNCTION public.ei_sales_mtd_product_page(p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, month_start date, month_upto_date date, product_id bigint, product_name text, sku_count bigint, sales_value numeric, sales_units numeric, billed_units numeric, latest_day_sales_value numeric, latest_day_sales_units numeric, average_daily_sales_value numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with latest_sales as (
    select (select sales_date from public.v_sales_daily_normalized where sales_date is not null order by sales_date desc limit 1) as report_date
  ),
  periods as (
    select
      report_date,
      date_trunc('month', report_date)::date as month_start,
      report_date as month_upto_date
    from latest_sales
  ),
  product_sales as (
    select
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      coalesce(pr.item, 'Product ID ' || s.product_id::text) as product_name,
      count(distinct s.sku_id) as sku_count,
      sum(s.billed_amount) as sales_value,
      sum(s.qty_units) as sales_units,
      sum(s.qty_billed) as billed_units,
      sum(s.billed_amount) filter (where s.sales_date = p.report_date) as latest_day_sales_value,
      sum(s.qty_units) filter (where s.sales_date = p.report_date) as latest_day_sales_units,
      case
        when count(distinct s.sales_date) > 0
        then sum(s.billed_amount) / count(distinct s.sales_date)
        else null
      end as average_daily_sales_value
    from public.v_sales_daily_normalized s
    cross join periods p
    left join public.products pr
      on pr.id = s.product_id
    where s.sales_date >= p.month_start
      and s.sales_date <= p.month_upto_date
    group by
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      pr.item
  ),
  filtered as (
    select *
    from product_sales
    where
      coalesce(trim(p_search), '') = ''
      or product_name ilike '%' || trim(p_search) || '%'
      or product_id::text ilike '%' || trim(p_search) || '%'
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.month_start,
    f.month_upto_date,
    f.product_id,
    f.product_name,
    f.sku_count,
    f.sales_value,
    f.sales_units,
    f.billed_units,
    f.latest_day_sales_value,
    f.latest_day_sales_units,
    f.average_daily_sales_value,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_sales())
  order by f.sales_value desc nulls last, f.product_name asc, f.product_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 20000));
$function$;
REVOKE ALL ON public.v_ei_sales_mtd_summary FROM PUBLIC,anon;
GRANT SELECT ON public.v_ei_sales_mtd_summary TO authenticated;
REVOKE ALL ON FUNCTION public.ei_sales_mtd_product_page(text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_sales_mtd_product_page(text,integer,integer) TO authenticated;

-- SOURCE: R3_R4_FINAL_PARITY_CANDIDATE.sql git blob 1dd3db3c438c8dd0b88a89247b92b2e4e6d047a2
-- Review candidate, NOT installed. Apply after R3_SALES_MTD_PARITY.sql.
-- Stable API names; appended defaulted hierarchy parameters retain existing call shapes.
-- No changes to shared normalized/monthly sales, master aliases, cron jobs or operational grants.

INSERT INTO public.permission_targets(key,kind,label,sort_order,is_assignable,meta)
VALUES ('module:sales-item-classification','module','Sales Item Classification',900,true,'{}'::jsonb);
-- Narrow EI projection; one raw row at most once. Shared normalization remains unchanged.
-- Canonical sample SKU rows remain in mapped sales (legacy parity); other-unit, loose, incompatible scope and unresolved aliases do not.
CREATE FUNCTION public.ei_sales_product_rows(p_from date,p_to date)
RETURNS TABLE(sales_date date,sku_id integer,product_id bigint,godown_id integer,region_id integer,
 qty_units numeric,qty_billed numeric,billed_amount numeric,source_key text,inserted_at timestamptz,raw_row_id bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.ei_can_read_sales() THEN RETURN; END IF;
 IF p_from IS NULL AND p_to IS NULL THEN RETURN; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from<date '1900-01-01' OR p_to<p_from OR p_to>p_from+366 THEN
  RAISE EXCEPTION 'Invalid bounded product sales period' USING ERRCODE='22023'; END IF;
 RETURN QUERY
 WITH raw AS MATERIALIZED (
  SELECT s.id,s.voucher_date,s.tally_item_name,s.godown_label,s.act_qty_value,s.bill_qty_value,s.billed_amount_value,s.source_key,s.inserted_at
  FROM public.tally_sales_vreg_snapshot s WHERE s.voucher_date BETWEEN p_from AND p_to
 ), labels AS MATERIALIZED (
  SELECT l.tally_item_name,public.normalize_key(l.tally_item_name) AS key FROM (SELECT DISTINCT r.tally_item_name FROM raw r) l
 ), locations AS MATERIALIZED (
  SELECT l.godown_label,public.normalize_key(l.godown_label) AS key FROM (SELECT DISTINCT r.godown_label FROM raw r) l
 ), sku_keys AS MATERIALIZED (
  SELECT public.normalize_key(a.alias_text) AS key,min(k.id) AS sku_id,min(k.product_id)::bigint AS product_id,count(*) AS matches
  FROM public.sku_aliases a JOIN public.product_skus k ON k.id=a.sku_id GROUP BY 1
 ), godown_keys AS MATERIALIZED (
  SELECT public.normalize_key(a.alias_text) AS key,min(g.id) AS godown_id,min(g.region_id) AS region_id,count(*) AS matches
  FROM public.godown_aliases a JOIN public.godowns g ON g.id=a.godown_id GROUP BY 1
 ), items AS MATERIALIZED (
  SELECT l.tally_item_name,l.key,k.sku_id,k.product_id FROM labels l JOIN sku_keys k ON k.key=l.key AND k.matches=1
 ), depots AS MATERIALIZED (
  SELECT l.godown_label,g.godown_id,g.region_id FROM locations l JOIN godown_keys g ON g.key=l.key AND g.matches=1
 ), scope_events AS MATERIALIZED (
  SELECT DISTINCT ON(c.alias_key,c.effective_from) c.alias_key,c.effective_from,c.scope
  FROM public.sales_item_scope c WHERE c.effective_from<=p_to ORDER BY c.alias_key,c.effective_from,c.id DESC
 ), scope_periods AS MATERIALIZED (
  SELECT e.alias_key,e.effective_from,lead(e.effective_from) OVER(PARTITION BY e.alias_key ORDER BY e.effective_from) AS next_effective_from,e.scope
  FROM scope_events e
 )
 SELECT s.voucher_date,k.sku_id,k.product_id,g.godown_id,g.region_id,s.act_qty_value,s.bill_qty_value,s.billed_amount_value,s.source_key,s.inserted_at,s.id
 FROM raw s JOIN items k ON k.tally_item_name=s.tally_item_name JOIN depots g ON g.godown_label=s.godown_label
 LEFT JOIN scope_periods c ON c.alias_key=k.key AND c.effective_from<=s.voucher_date AND (c.next_effective_from IS NULL OR s.voucher_date<c.next_effective_from)
 WHERE c.scope IS NULL OR c.scope IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE');
END $$;
REVOKE ALL ON FUNCTION public.ei_sales_product_rows(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_sales_product_rows(date,date) TO authenticated;
CREATE VIEW public.v_ei_sales_product_hierarchy WITH (security_invoker=true,security_barrier=true) AS
SELECT p.id::bigint AS product_id,c.id AS category_id,sc.id AS subcategory_id,pg.id AS group_id,sg.id AS subgroup_id
FROM public.products p LEFT JOIN public.sub_groups sg ON sg.id=p.sub_group_id
LEFT JOIN public.product_groups pg ON pg.id=sg.product_group_id
LEFT JOIN public.sub_categories sc ON sc.id=pg.sub_category_id LEFT JOIN public.categories c ON c.id=sc.category_id
WHERE (SELECT public.ei_can_read_sales());
REVOKE ALL ON public.v_ei_sales_product_hierarchy FROM PUBLIC,anon;
GRANT SELECT ON public.v_ei_sales_product_hierarchy TO authenticated;
CREATE OR REPLACE FUNCTION public.ei_sales_dimensions() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.ei_sales_access();
  RETURN jsonb_build_object(
    'regions',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM (SELECT id,code,name FROM public.regions) r),
    'godowns',(SELECT coalesce(jsonb_agg(to_jsonb(g) ORDER BY g.id),'[]'::jsonb) FROM (SELECT id,code,name,region_id FROM public.godowns) g),
    'categories',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb) FROM (SELECT id,category_name AS name FROM public.categories) d),
    'subcategories',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb) FROM (SELECT id,category_id,subcategory_name AS name FROM public.sub_categories) d),
    'groups',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb) FROM (SELECT id,sub_category_id AS subcategory_id,group_name AS name FROM public.product_groups) d),
    'subgroups',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb) FROM (SELECT id,product_group_id AS group_id,sub_group_name AS name FROM public.sub_groups) d),
    'first_mapped_date',(SELECT sales_date FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date LIMIT 1),
    'last_mapped_date',(SELECT sales_date FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1));
END $$;
CREATE OR REPLACE FUNCTION public.ei_sales_verified_months(p_from date,p_to date,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL)
RETURNS TABLE(month_start date,sku_id integer,product_id bigint,region_id integer,godown_id integer,qty_units numeric,qty_billed numeric,billed_amount numeric,source_max_inserted_at timestamptz,amount_ambiguous boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.ei_sales_access();
 IF p_from IS NULL OR p_to IS NULL OR p_from<>date_trunc('month',p_from)::date OR p_to<>date_trunc('month',p_to)::date OR p_from>p_to OR p_to> (p_from+interval '12 months')::date THEN RAISE EXCEPTION 'Invalid month bounds' USING ERRCODE='22023'; END IF;
 IF p_from=p_to THEN RETURN; END IF;
 RETURN QUERY
 SELECT date_trunc('month',d.sales_date)::date,d.sku_id,d.product_id,d.region_id,d.godown_id,
 CASE WHEN count(*) FILTER(WHERE d.qty_units IS NULL)=0 THEN sum(d.qty_units) END,
 CASE WHEN count(*) FILTER(WHERE d.qty_billed IS NULL)=0 THEN sum(d.qty_billed) END,
 sum(d.billed_amount),max(d.inserted_at),count(*) FILTER(WHERE d.billed_amount IS NULL)>0
 FROM public.ei_sales_product_rows(p_from,p_to-1) d WHERE d.sales_date>=p_from AND d.sales_date<p_to
 AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown) AND (p_product IS NULL OR d.product_id=p_product) AND (p_sku IS NULL OR d.sku_id=p_sku)
 GROUP BY 1,2,3,4,5;
END $$;
-- These signatures are uninstalled candidates. Restrict drops; no production legacy RPC is removed.
DROP FUNCTION public.ei_sales_comparison(date,integer,integer,bigint,integer,boolean) RESTRICT;
DROP FUNCTION public.ei_sales_history(date,integer,text,integer,integer,bigint,integer,boolean,text,text,integer,integer) RESTRICT;
DROP FUNCTION public.ei_sales_window_totals(date,integer,integer,bigint,integer,boolean) RESTRICT;
DROP FUNCTION public.ei_sales_exceptions(date,integer,integer,text,integer,integer) RESTRICT;
CREATE FUNCTION public.ei_sales_comparison(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false,p_category integer DEFAULT NULL,p_subcategory integer DEFAULT NULL,p_group_id integer DEFAULT NULL,p_subgroup integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; anchor_date date; m date; elapsed integer; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  anchor_date := coalesce(p_anchor,latest);
  IF anchor_date IS NULL THEN RETURN jsonb_build_object('coverage','NO_MAPPED_DATA','periods','[]'::jsonb); END IF;
  IF latest IS NULL OR anchor_date>latest OR anchor_date<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  m:=date_trunc('month',anchor_date)::date; elapsed:=anchor_date-m;
  WITH periods AS (
    SELECT label, start_date, least(start_date+elapsed,(start_date+interval '1 month')::date-1) end_date
    FROM (VALUES ('CURRENT',m),('PREVIOUS_MONTH',(m-interval '1 month')::date),('PREVIOUS_YEAR',(m-interval '1 year')::date)) v(label,start_date)
  ), stats AS (
    SELECT p.label,p.start_date,p.end_date,x.*
    FROM periods p CROSS JOIN LATERAL (
      SELECT count(*) AS row_count,count(DISTINCT s.sales_date) AS observed_dates,max(s.sales_date) AS last_observed_date,
        max(s.inserted_at) AS source_max_inserted_at,
        count(*) FILTER(WHERE s.billed_amount IS NULL) AS missing_amount_rows,
        count(*) FILTER(WHERE s.qty_units IS NULL) AS missing_actual_rows,
        count(*) FILTER(WHERE s.qty_billed IS NULL) AS missing_billed_rows,
        CASE WHEN count(*) FILTER(WHERE s.billed_amount IS NULL)=0 THEN sum(s.billed_amount) END AS sales_value,
        CASE WHEN count(*) FILTER(WHERE s.qty_units IS NULL)=0 THEN sum(s.qty_units) END AS actual_packages,
        CASE WHEN count(*) FILTER(WHERE s.qty_billed IS NULL)=0 THEN sum(s.qty_billed) END AS billed_packages,
        count(*) FILTER(WHERE s.qty_billed>0 OR s.qty_units>0 OR s.billed_amount>0) AS positive_rows,
        count(*) FILTER(WHERE s.qty_billed<0 OR s.qty_units<0 OR s.billed_amount<0) AS negative_rows
      FROM public.ei_sales_product_rows(p.start_date,p.end_date) s
      JOIN public.product_skus k ON k.id=s.sku_id
      WHERE s.sales_date BETWEEN p.start_date AND p.end_date
        AND (p_region IS NULL OR s.region_id=p_region) AND (p_godown IS NULL OR s.godown_id=p_godown)
        AND (p_product IS NULL OR s.product_id=p_product) AND (p_sku IS NULL OR s.sku_id=p_sku)
        AND (NOT coalesce(p_active_only,false) OR k.is_active IS TRUE)
        AND ((p_category IS NULL AND p_subcategory IS NULL AND p_group_id IS NULL AND p_subgroup IS NULL) OR s.product_id IN (
 SELECT ph.product_id FROM public.v_ei_sales_product_hierarchy ph
 WHERE (p_category IS NULL OR ph.category_id=p_category) AND (p_subcategory IS NULL OR ph.subcategory_id=p_subcategory)
 AND (p_group_id IS NULL OR ph.group_id=p_group_id) AND (p_subgroup IS NULL OR ph.subgroup_id=p_subgroup)))
    ) x
  ), metrics AS (
    SELECT *,CASE WHEN actual_packages>0 THEN sales_value/actual_packages END AS asp_actual_package,
      CASE WHEN billed_packages>0 THEN sales_value/billed_packages END AS asp_billed_package,
      CASE WHEN row_count=0 THEN 'NO_RECORDED_ROWS' WHEN missing_amount_rows+missing_actual_rows+missing_billed_rows>0 THEN 'MISSING_MEASURES' ELSE 'OBSERVED_NOT_CERTIFIED' END AS coverage
    FROM stats
  )
  SELECT jsonb_build_object('anchor',anchor_date,'latest_mapped_date',latest,'comparison_basis','MATCHED_CALENDAR_DAY_CAPPED_AT_MONTH_END',
    'quantity_basis','NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY','periods',jsonb_agg(to_jsonb(metrics) ORDER BY start_date),
    'mom_pct',(SELECT 100*(c.sales_value/p.sales_value-1) FROM metrics c CROSS JOIN metrics p WHERE c.label='CURRENT' AND p.label='PREVIOUS_MONTH' AND p.sales_value>0),
    'yoy_pct',(SELECT 100*(c.sales_value/p.sales_value-1) FROM metrics c CROSS JOIN metrics p WHERE c.label='CURRENT' AND p.label='PREVIOUS_YEAR' AND p.sales_value>0),
    'import_completeness','NOT_CERTIFIED','active_filter_basis','CURRENT_MASTER') INTO result FROM metrics;
  RETURN result;
END $$;
CREATE FUNCTION public.ei_sales_history(p_anchor date DEFAULT NULL,p_months integer DEFAULT 12,p_group text DEFAULT 'month',p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false,p_search text DEFAULT NULL,p_sort text DEFAULT 'value_desc',p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_category integer DEFAULT NULL,p_subcategory integer DEFAULT NULL,p_group_id integer DEFAULT NULL,p_subgroup integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; anchor_date date; anchor_month date; from_date date; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  IF p_months IS NULL OR p_months NOT BETWEEN 1 AND 12 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000
    OR p_group IS NULL OR p_group NOT IN ('month','region','godown','product','sku','category','subcategory','group','subgroup','region_month','godown_month','product_month','sku_month','category_month','subcategory_month','group_month','subgroup_month')
    OR p_sort IS NULL OR p_sort NOT IN ('value_desc','value_asc','key') OR length(coalesce(p_search,''))>120
  THEN RAISE EXCEPTION 'Invalid history bounds or grouping' USING ERRCODE='22023'; END IF;
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  anchor_date:=coalesce(p_anchor,latest);
  IF anchor_date IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'coverage','NO_MAPPED_DATA'); END IF;
  IF latest IS NULL OR anchor_date>latest OR anchor_date<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  anchor_month:=date_trunc('month',anchor_date)::date;
  from_date:=(anchor_month-make_interval(months=>p_months-1))::date;
  WITH source AS (
    SELECT h.month_start,h.sku_id,h.product_id,h.region_id,h.godown_id,h.qty_units,h.qty_billed,h.billed_amount,h.source_max_inserted_at AS inserted_at,
      true AS monthly_source,h.amount_ambiguous
    FROM public.ei_sales_verified_months(from_date,anchor_month,p_region,p_godown,p_product,p_sku) h
    WHERE h.month_start>=from_date AND h.month_start<anchor_month
      AND (p_region IS NULL OR h.region_id=p_region) AND (p_godown IS NULL OR h.godown_id=p_godown)
      AND (p_product IS NULL OR h.product_id=p_product) AND (p_sku IS NULL OR h.sku_id=p_sku)
    UNION ALL
    SELECT anchor_month,d.sku_id,d.product_id,d.region_id,d.godown_id,d.qty_units,d.qty_billed,d.billed_amount,d.inserted_at,false,d.billed_amount IS NULL
    FROM public.ei_sales_product_rows(anchor_month,anchor_date) d
    WHERE d.sales_date BETWEEN anchor_month AND anchor_date
      AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown)
      AND (p_product IS NULL OR d.product_id=p_product) AND (p_sku IS NULL OR d.sku_id=p_sku)
  ), enriched AS (
    SELECT s.*,k.pack_size,k.uom,
      CASE split_part(p_group,'_month',1)
        WHEN 'month' THEN 'ALL' WHEN 'region' THEN s.region_id::text WHEN 'godown' THEN s.godown_id::text
        WHEN 'product' THEN s.product_id::text WHEN 'sku' THEN s.sku_id::text WHEN 'category' THEN c.id::text
        WHEN 'subcategory' THEN sc.id::text WHEN 'group' THEN pg.id::text WHEN 'subgroup' THEN sg.id::text END AS dimension_id,
      CASE split_part(p_group,'_month',1)
        WHEN 'month' THEN 'All sales' WHEN 'region' THEN r.name WHEN 'godown' THEN g.name WHEN 'product' THEN p.item
        WHEN 'sku' THEN concat(p.item,' · ',k.pack_size,' ',k.uom) WHEN 'category' THEN c.category_name
        WHEN 'subcategory' THEN sc.subcategory_name WHEN 'group' THEN pg.group_name WHEN 'subgroup' THEN sg.sub_group_name END AS dimension_name
    FROM source s LEFT JOIN public.product_skus k ON k.id=s.sku_id LEFT JOIN public.products p ON p.id=s.product_id
      LEFT JOIN public.sub_groups sg ON sg.id=p.sub_group_id LEFT JOIN public.product_groups pg ON pg.id=sg.product_group_id
      LEFT JOIN public.sub_categories sc ON sc.id=pg.sub_category_id LEFT JOIN public.categories c ON c.id=sc.category_id
      LEFT JOIN public.regions r ON r.id=s.region_id LEFT JOIN public.godowns g ON g.id=s.godown_id
    WHERE (NOT coalesce(p_active_only,false) OR k.is_active IS TRUE)
    AND ((p_category IS NULL AND p_subcategory IS NULL AND p_group_id IS NULL AND p_subgroup IS NULL) OR s.product_id IN (
 SELECT ph.product_id FROM public.v_ei_sales_product_hierarchy ph
 WHERE (p_category IS NULL OR ph.category_id=p_category) AND (p_subcategory IS NULL OR ph.subcategory_id=p_subcategory)
 AND (p_group_id IS NULL OR ph.group_id=p_group_id) AND (p_subgroup IS NULL OR ph.subgroup_id=p_subgroup)))
  ), grouped AS (
    SELECT dimension_id,coalesce(dimension_name,'Unmapped') AS dimension_name,
      CASE WHEN p_group='month' OR right(p_group,6)='_month' THEN month_start END AS month,
      count(*) AS source_groups,count(*) FILTER(WHERE monthly_source) AS historical_groups,
      count(*) FILTER(WHERE amount_ambiguous) AS ambiguous_amount_groups,
      count(*) FILTER(WHERE qty_units IS NULL) AS missing_actual_groups,
      count(*) FILTER(WHERE qty_billed IS NULL) AS missing_billed_groups,
      CASE WHEN count(*) FILTER(WHERE amount_ambiguous)=0 THEN sum(billed_amount) END AS sales_value,
      sum(billed_amount) AS source_reported_amount,
      CASE WHEN count(*) FILTER(WHERE qty_units IS NULL)=0 THEN sum(qty_units) END AS actual_packages,
      CASE WHEN count(*) FILTER(WHERE qty_billed IS NULL)=0 THEN sum(qty_billed) END AS billed_packages,
      max(inserted_at) AS source_max_inserted_at
    FROM enriched
    WHERE nullif(trim(p_search),'') IS NULL OR strpos(lower(coalesce(dimension_name,'')),lower(trim(p_search)))>0 OR strpos(lower(coalesce(dimension_id,'')),lower(trim(p_search)))>0
    GROUP BY dimension_id,dimension_name,CASE WHEN p_group='month' OR right(p_group,6)='_month' THEN month_start END
  ), metrics AS (
    SELECT *,CASE WHEN actual_packages>0 THEN sales_value/actual_packages END AS asp_actual_package,
      CASE WHEN billed_packages>0 THEN sales_value/billed_packages END AS asp_billed_package,
      CASE WHEN ambiguous_amount_groups+missing_actual_groups+missing_billed_groups>0 THEN 'MISSING_OR_AMBIGUOUS_MEASURES' ELSE 'OBSERVED_NOT_CERTIFIED' END AS coverage
    FROM grouped
  ), ranked AS (
    SELECT *,row_number() OVER(ORDER BY CASE WHEN p_sort='value_desc' THEN sales_value END DESC NULLS LAST,
      CASE WHEN p_sort='value_asc' THEN sales_value END ASC NULLS LAST,month NULLS LAST,dimension_id NULLS LAST,dimension_name) AS ordinal
    FROM metrics
  )
  SELECT jsonb_build_object('anchor',anchor_date,'start_date',from_date,'latest_mapped_date',latest,'total',(SELECT count(*) FROM ranked),
    'limit',p_limit,'offset',p_offset,'export_scope','CURRENT_PAGE_ONLY','has_more',((SELECT count(*) FROM ranked)>p_offset+p_limit),'quantity_basis','NET_PACKAGE_COUNTS_NOT_PHYSICAL_QUANTITY',
    'import_completeness','NOT_CERTIFIED','historical_measure_basis','BOUNDED_DAILY_SOURCE_MONTHLY_GROUPS',
    'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY ordinal),'[]'::jsonb))
  INTO result FROM (SELECT * FROM ranked WHERE ordinal>p_offset AND ordinal<=p_offset+p_limit) page;
  RETURN result;
END $$;
CREATE FUNCTION public.ei_sales_window_totals(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_product bigint DEFAULT NULL,p_sku integer DEFAULT NULL,p_active_only boolean DEFAULT false,p_category integer DEFAULT NULL,p_subcategory integer DEFAULT NULL,p_group_id integer DEFAULT NULL,p_subgroup integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE a date; latest date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
 a:=coalesce(p_anchor,latest);
 IF a IS NULL THEN RETURN jsonb_build_object('coverage','NO_MAPPED_DATA'); END IF;
 IF latest IS NULL OR a>latest OR a<date '1900-01-01' THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
 WITH verified AS MATERIALIZED (SELECT * FROM public.ei_sales_verified_months((date_trunc('month',a)-interval '12 months')::date,date_trunc('month',a)::date,p_region,p_godown,p_product,p_sku)), periods AS (SELECT n,(date_trunc('month',a)-make_interval(months=>n))::date AS start_date FROM (VALUES(3),(12)) v(n)),
 hist AS (
 SELECT w.n,w.start_date,(date_trunc('month',a)::date-1) AS end_date,
 count(DISTINCT h.month_start) AS observed_months,count(h.month_start) AS source_groups,
 count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.amount_ambiguous) AS ambiguous_amount_groups,
 sum(h.billed_amount) AS source_reported_amount,
 CASE WHEN count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.qty_units IS NULL)=0 THEN sum(h.qty_units) END AS actual_packages,
 CASE WHEN count(*) FILTER(WHERE h.month_start IS NOT NULL AND h.qty_billed IS NULL)=0 THEN sum(h.qty_billed) END AS billed_packages,
 max(h.source_max_inserted_at) AS source_max_inserted_at
 FROM periods w LEFT JOIN verified h ON h.month_start>=w.start_date AND h.month_start<date_trunc('month',a)::date
 AND (p_region IS NULL OR h.region_id=p_region) AND (p_godown IS NULL OR h.godown_id=p_godown) AND (p_product IS NULL OR h.product_id=p_product) AND (p_sku IS NULL OR h.sku_id=p_sku)
 AND (NOT coalesce(p_active_only,false) OR EXISTS(SELECT 1 FROM public.product_skus k WHERE k.id=h.sku_id AND k.is_active IS TRUE))
 AND ((p_category IS NULL AND p_subcategory IS NULL AND p_group_id IS NULL AND p_subgroup IS NULL) OR h.product_id IN (
 SELECT ph.product_id FROM public.v_ei_sales_product_hierarchy ph
 WHERE (p_category IS NULL OR ph.category_id=p_category) AND (p_subcategory IS NULL OR ph.subcategory_id=p_subcategory)
 AND (p_group_id IS NULL OR ph.group_id=p_group_id) AND (p_subgroup IS NULL OR ph.subgroup_id=p_subgroup)))
 GROUP BY w.n,w.start_date
 ), stats AS (
 SELECT *,CASE WHEN observed_months=n AND ambiguous_amount_groups=0 THEN source_reported_amount END AS sales_value FROM hist
 )
 SELECT jsonb_build_object('anchor',a,'basis','PRECEDING_COMPLETE_CALENDAR_MONTHS_EXCLUDING_ANCHOR_MONTH','import_completeness','NOT_CERTIFIED',
 'windows',jsonb_agg(to_jsonb(stats)||jsonb_build_object('average_monthly_sales',sales_value/n,'asp_actual_package',CASE WHEN actual_packages>0 THEN sales_value/actual_packages END,'asp_billed_package',CASE WHEN billed_packages>0 THEN sales_value/billed_packages END) ORDER BY n)) INTO result FROM stats;
 RETURN result;
END $$;
CREATE FUNCTION public.ei_sales_exceptions(p_anchor date DEFAULT NULL,p_region integer DEFAULT NULL,p_godown integer DEFAULT NULL,p_search text DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_category integer DEFAULT NULL,p_subcategory integer DEFAULT NULL,p_group_id integer DEFAULT NULL,p_subgroup integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest date; a date; m date; region_code text; result jsonb;
BEGIN
  PERFORM public.ei_sales_access();
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 20000 OR length(coalesce(p_search,''))>120 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
  SELECT sales_date INTO latest FROM public.v_sales_daily_normalized WHERE sales_date IS NOT NULL ORDER BY sales_date DESC LIMIT 1;
  a:=coalesce(p_anchor,latest);
  IF a IS NULL THEN RETURN jsonb_build_object('rows','[]'::jsonb,'total',0,'coverage','NO_MAPPED_DATA'); END IF;
  IF latest IS NULL OR a>latest THEN RAISE EXCEPTION 'Invalid anchor' USING ERRCODE='22023'; END IF;
  m:=date_trunc('month',a)::date;
  IF p_godown IS NOT NULL THEN
    SELECT r.code INTO region_code FROM public.godowns g JOIN public.regions r ON r.id=g.region_id WHERE g.id=p_godown AND (p_region IS NULL OR g.region_id=p_region);
    IF region_code IS NULL THEN RAISE EXCEPTION 'Unknown or conflicting godown/region' USING ERRCODE='22023'; END IF;
  ELSIF p_region IS NOT NULL THEN
    SELECT code INTO region_code FROM public.regions WHERE id=p_region;
    IF region_code IS NULL THEN RAISE EXCEPTION 'Unknown region' USING ERRCODE='22023'; END IF;
  END IF;
  WITH activity AS (
    SELECT d.sku_id,count(*) AS recorded_rows,sum(d.qty_billed) AS net_billed,
      count(*) FILTER(WHERE d.qty_billed>0) AS positive_rows,count(*) FILTER(WHERE d.qty_billed<0) AS return_rows,
      count(*) FILTER(WHERE d.qty_billed IS NULL OR d.qty_units IS NULL OR d.billed_amount IS NULL) AS missing_rows
    FROM public.ei_sales_product_rows(m,a) d WHERE d.sales_date BETWEEN m AND a
      AND (p_region IS NULL OR d.region_id=p_region) AND (p_godown IS NULL OR d.godown_id=p_godown) GROUP BY d.sku_id
  ), classified AS (
    SELECT k.id AS sku_id,k.product_id,p.item AS product_name,k.pack_size,k.uom,k.is_active,k.price_list_ik,k.price_list_ok,
      x.recorded_rows,x.net_billed,x.positive_rows,x.return_rows,x.missing_rows,
      CASE WHEN k.is_active IS NOT TRUE THEN 'INACTIVE_CURRENT_MASTER'
        WHEN region_code='IK' AND k.price_list_ik IS TRUE THEN 'CURRENT_ELIGIBLE'
        WHEN region_code='OK' AND k.price_list_ok IS TRUE THEN 'CURRENT_ELIGIBLE'
        WHEN region_code IS NULL AND (k.price_list_ik IS TRUE OR k.price_list_ok IS TRUE) THEN 'CURRENT_ELIGIBLE'
        WHEN region_code IS NULL OR region_code IN ('IK','OK') THEN 'NOT_CURRENTLY_LISTED'
        ELSE 'ELIGIBILITY_UNKNOWN' END AS eligibility,
      CASE WHEN x.recorded_rows IS NULL THEN 'NO_RECORDED_SALES_COVERAGE_UNCERTIFIED'
        WHEN x.missing_rows>0 THEN 'MISSING_MEASURES'
        WHEN x.net_billed=0 AND x.positive_rows>0 AND x.return_rows>0 THEN 'BILLED_SALES_OFFSET_BY_RETURNS'
        WHEN x.net_billed=0 THEN 'ZERO_NET_BILLED_OTHER_ACTIVITY'
        WHEN x.net_billed<0 THEN 'NET_RETURNS' ELSE 'NET_POSITIVE_BILLED' END AS activity_state
    FROM public.product_skus k JOIN public.products p ON p.id=k.product_id LEFT JOIN activity x ON x.sku_id=k.id
    WHERE (nullif(trim(p_search),'') IS NULL OR strpos(lower(p.item),lower(trim(p_search)))>0 OR strpos(k.id::text,trim(p_search))>0)
    AND ((p_category IS NULL AND p_subcategory IS NULL AND p_group_id IS NULL AND p_subgroup IS NULL) OR k.product_id IN (
 SELECT ph.product_id FROM public.v_ei_sales_product_hierarchy ph
 WHERE (p_category IS NULL OR ph.category_id=p_category) AND (p_subcategory IS NULL OR ph.subcategory_id=p_subcategory)
 AND (p_group_id IS NULL OR ph.group_id=p_group_id) AND (p_subgroup IS NULL OR ph.subgroup_id=p_subgroup)))
  ), ranked AS (
    SELECT *,row_number() OVER(ORDER BY product_name,sku_id) AS ordinal FROM classified
    WHERE activity_state<>'NET_POSITIVE_BILLED'
  )
  SELECT jsonb_build_object('anchor',a,'start_date',m,'import_completeness','NOT_CERTIFIED','eligibility_basis','CURRENT_MASTER_ONLY',
    'total',(SELECT count(*) FROM ranked),'limit',p_limit,'offset',p_offset,'rows',coalesce(jsonb_agg(to_jsonb(page) ORDER BY ordinal),'[]'::jsonb))
    INTO result FROM (SELECT * FROM ranked WHERE ordinal>p_offset AND ordinal<=p_offset+p_limit) page;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ei_sales_comparison(date,integer,integer,bigint,integer,boolean,integer,integer,integer,integer),
 public.ei_sales_history(date,integer,text,integer,integer,bigint,integer,boolean,text,text,integer,integer,integer,integer,integer,integer),
 public.ei_sales_window_totals(date,integer,integer,bigint,integer,boolean,integer,integer,integer,integer),
 public.ei_sales_exceptions(date,integer,integer,text,integer,integer,integer,integer,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ei_sales_comparison(date,integer,integer,bigint,integer,boolean,integer,integer,integer,integer),
 public.ei_sales_history(date,integer,text,integer,integer,bigint,integer,boolean,text,text,integer,integer,integer,integer,integer,integer),
 public.ei_sales_window_totals(date,integer,integer,bigint,integer,boolean,integer,integer,integer,integer),
 public.ei_sales_exceptions(date,integer,integer,text,integer,integer,integer,integer,integer,integer) TO authenticated;
CREATE OR REPLACE VIEW public.v_ei_sales_mtd_summary WITH (security_barrier=true,security_invoker=true) AS SELECT ei_row.* FROM (WITH latest_sales AS (
         SELECT ( SELECT v_sales_daily_normalized.sales_date
                   FROM v_sales_daily_normalized
                  WHERE v_sales_daily_normalized.sales_date IS NOT NULL
                  ORDER BY v_sales_daily_normalized.sales_date DESC
                 LIMIT 1) AS report_date
        ), periods AS (
         SELECT latest_sales.report_date,
            date_trunc('month'::text, latest_sales.report_date::timestamp with time zone)::date AS month_start,
            latest_sales.report_date AS month_upto_date
           FROM latest_sales
        ), sales_base AS (
         SELECT s_1.sales_date,
            s_1.sku_id,
            s_1.product_id,
            s_1.godown_id,
            s_1.region_id,
            s_1.qty_units,
            s_1.qty_billed,
            s_1.billed_amount,
            s_1.source_key,
            s_1.inserted_at
           FROM periods p_1 CROSS JOIN LATERAL public.ei_sales_product_rows(p_1.month_start,p_1.month_upto_date) s_1
          WHERE s_1.sales_date >= p_1.month_start AND s_1.sales_date <= p_1.month_upto_date
        )
 SELECT p.report_date,
    p.month_start,
    p.month_upto_date,
    sum(s.billed_amount) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_value,
    sum(s.qty_units) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_sales_units,
    sum(s.qty_billed) FILTER (WHERE s.sales_date = p.report_date) AS latest_day_billed_units,
    sum(s.billed_amount) AS month_to_date_sales_value,
    sum(s.qty_units) AS month_to_date_sales_units,
    sum(s.qty_billed) AS month_to_date_billed_units,
    count(DISTINCT s.sales_date) AS sales_days_available_in_month,
    count(DISTINCT s.product_id) AS products_sold_month_to_date,
    count(DISTINCT s.sku_id) AS skus_sold_month_to_date,
        CASE
            WHEN count(DISTINCT s.sales_date) > 0 THEN sum(s.billed_amount) / count(DISTINCT s.sales_date)::numeric
            ELSE NULL::numeric
        END AS average_daily_sales_value,
    'Sales tab summary is based on the latest available sales month from v_sales_daily_normalized. Month-to-date values cover sales from month start up to the latest available sales date.'::text AS sales_scope_note
   FROM periods p
     LEFT JOIN sales_base s ON true
  GROUP BY p.report_date, p.month_start, p.month_upto_date) ei_row WHERE (SELECT public.ei_can_read_sales());
CREATE OR REPLACE FUNCTION public.ei_sales_mtd_product_page(p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, month_start date, month_upto_date date, product_id bigint, product_name text, sku_count bigint, sales_value numeric, sales_units numeric, billed_units numeric, latest_day_sales_value numeric, latest_day_sales_units numeric, average_daily_sales_value numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with latest_sales as (
    select (select sales_date from public.v_sales_daily_normalized where sales_date is not null order by sales_date desc limit 1) as report_date
  ),
  periods as (
    select
      report_date,
      date_trunc('month', report_date)::date as month_start,
      report_date as month_upto_date
    from latest_sales
  ),
  product_sales as (
    select
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      coalesce(pr.item, 'Product ID ' || s.product_id::text) as product_name,
      count(distinct s.sku_id) as sku_count,
      sum(s.billed_amount) as sales_value,
      sum(s.qty_units) as sales_units,
      sum(s.qty_billed) as billed_units,
      sum(s.billed_amount) filter (where s.sales_date = p.report_date) as latest_day_sales_value,
      sum(s.qty_units) filter (where s.sales_date = p.report_date) as latest_day_sales_units,
      case
        when count(distinct s.sales_date) > 0
        then sum(s.billed_amount) / count(distinct s.sales_date)
        else null
      end as average_daily_sales_value
    from periods p cross join lateral public.ei_sales_product_rows(p.month_start,p.month_upto_date) s
    left join public.products pr
      on pr.id = s.product_id
    where s.sales_date >= p.month_start
      and s.sales_date <= p.month_upto_date
    group by
      p.report_date,
      p.month_start,
      p.month_upto_date,
      s.product_id,
      pr.item
  ),
  filtered as (
    select *
    from product_sales
    where
      coalesce(trim(p_search), '') = ''
      or product_name ilike '%' || trim(p_search) || '%'
      or product_id::text ilike '%' || trim(p_search) || '%'
  ),
  counted as (
    select count(*) as total_rows from filtered
  )
  select
    f.report_date,
    f.month_start,
    f.month_upto_date,
    f.product_id,
    f.product_name,
    f.sku_count,
    f.sales_value,
    f.sales_units,
    f.billed_units,
    f.latest_day_sales_value,
    f.latest_day_sales_units,
    f.average_daily_sales_value,
    c.total_rows
  from filtered f
  cross join counted c
  where (select public.ei_can_read_sales())
  order by f.sales_value desc nulls last, f.product_name asc, f.product_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, least(coalesce(p_offset, 0), 20000));
$function$;
-- Expose only the pinned sales job's latest status. Do not expose cron schema, commands, messages or other jobs.
CREATE FUNCTION app_private.ei_sales_refresh_job_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR coalesce(auth.jwt()->>'is_anonymous','false')='true' OR
 NOT (coalesce(public.app_has_permission('module:executive-mis-dashboard','view'),false) OR coalesce(public.app_has_permission('module:sales-data-viewer','view'),false))
 THEN RAISE EXCEPTION 'Sales access denied' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('status',CASE WHEN NOT j.active THEN 'DISABLED' WHEN h.runid IS NULL THEN 'NO_RECORDED_RUN' ELSE h.status END,
 'active',j.active,'last_started_at',h.start_time,'last_finished_at',h.end_time)
 INTO result FROM cron.job j LEFT JOIN LATERAL (
 SELECT runid,status,start_time,end_time FROM cron.job_run_details h
 WHERE h.jobid=j.jobid AND h.username=j.username AND h.command=j.command
 ORDER BY h.runid DESC LIMIT 1
 ) h ON true WHERE j.jobid=17 AND j.username='postgres' AND j.command='select public.refresh_sales_monthly();';
 RETURN coalesce(result,jsonb_build_object('status','UNAVAILABLE_JOB_IDENTITY'));
END $$;
REVOKE ALL ON FUNCTION app_private.ei_sales_refresh_job_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.ei_sales_refresh_job_status() TO authenticated;
CREATE OR REPLACE FUNCTION public.ei_sales_refresh_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE latest_month date; result jsonb;
BEGIN
 PERFORM public.ei_sales_access();
 SELECT month_start INTO latest_month FROM app_private.sales_monthly ORDER BY month_start DESC LIMIT 1;
 WITH monthly AS (SELECT sum(billed_amount) AS amount,max(source_max_inserted_at) AS source_at FROM app_private.sales_monthly WHERE month_start=latest_month),
 daily AS (SELECT sum(billed_amount) AS amount,max(sales_date) AS last_date,max(inserted_at) AS source_at FROM public.v_sales_daily_normalized WHERE sales_date>=latest_month AND sales_date<(latest_month+interval '1 month')::date)
 SELECT jsonb_build_object('monthly_latest_month',latest_month,'monthly_source_max_inserted_at',monthly.source_at,'daily_source_max_inserted_at',daily.source_at,'daily_last_date_in_month',daily.last_date,'monthly_reported_amount',monthly.amount,'daily_reported_amount',daily.amount,'amount_difference',daily.amount-monthly.amount,'coverage','NOT_CERTIFIED','refresh_job_status',job.info->>'status','refresh_job',job.info) INTO result FROM monthly CROSS JOIN daily CROSS JOIN LATERAL (SELECT app_private.ei_sales_refresh_job_status() AS info) job;
 RETURN result;
END $$;

DO $postflight$
BEGIN
 IF (SELECT count(*) FROM public.sales_item_scope WHERE approval_source='OWNER_RECEIPT')<>49 OR (SELECT count(*) FROM public.sales_item_scope WHERE scope='RAW_MATERIAL')<>15 THEN RAISE EXCEPTION 'Unexpected seed count'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_permissions_canonical WHERE target='module:sales-item-classification') THEN RAISE EXCEPTION 'Unexpected classification assignment'; END IF;
 IF has_table_privilege('authenticated','public.sales_item_scope','INSERT') OR has_table_privilege('authenticated','public.sales_item_scope','UPDATE') OR has_table_privilege('authenticated','public.sales_item_scope','DELETE') OR has_table_privilege('authenticated','app_private.mv_mis_executive_summary','SELECT') THEN RAISE EXCEPTION 'Unexpected direct privileges'; END IF;
 IF NOT has_function_privilege('authenticated','public.ei_sales_product_rows(date,date)','EXECUTE') OR has_function_privilege('anon','public.ei_sales_product_rows(date,date)','EXECUTE') THEN RAISE EXCEPTION 'Product contract ACL drift'; END IF;
END $postflight$;
COMMIT;
