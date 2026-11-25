-- EI R3/R4 review candidate. NOT an installed migration. No changes to existing objects.
-- Invoke with authenticated JWT; explicit module permission; no new definer or source grants.
BEGIN;
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
COMMIT;
