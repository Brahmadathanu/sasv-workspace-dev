-- Review candidate, NOT installed. Apply after R3_SALES_MTD_PARITY.sql.
-- Stable API names; appended defaulted hierarchy parameters retain existing call shapes.
-- No changes to shared normalized/monthly sales, master aliases, cron jobs or operational grants.
BEGIN;
INSERT INTO public.permission_targets(key,kind,label,sort_order,is_assignable,meta)
VALUES ('module:sales-item-classification','module','Sales Item Classification',900,true,'{}'::jsonb);
-- Narrow EI projection; one raw row at most once. Shared normalization remains unchanged.
-- Canonical sample SKU rows remain in mapped sales (legacy parity); other-unit, loose, incompatible scope and unresolved aliases do not.
CREATE VIEW public.v_ei_sales_product_daily WITH (security_invoker=true,security_barrier=true) AS
WITH sku_keys AS MATERIALIZED (
 SELECT public.normalize_key(a.alias_text) AS key,min(k.id) AS sku_id,min(k.product_id)::bigint AS product_id,count(*) AS matches
 FROM public.sku_aliases a JOIN public.product_skus k ON k.id=a.sku_id GROUP BY 1
), godown_keys AS MATERIALIZED (
 SELECT public.normalize_key(a.alias_text) AS key,min(g.id) AS godown_id,min(g.region_id) AS region_id,count(*) AS matches
 FROM public.godown_aliases a JOIN public.godowns g ON g.id=a.godown_id GROUP BY 1
)
SELECT s.voucher_date AS sales_date,k.sku_id,k.product_id,g.godown_id,g.region_id,
 s.act_qty_value AS qty_units,s.bill_qty_value AS qty_billed,s.billed_amount_value AS billed_amount,
 s.source_key,s.inserted_at,s.id AS raw_row_id
FROM public.tally_sales_vreg_snapshot s
JOIN sku_keys k ON k.key=public.normalize_key(s.tally_item_name) AND k.matches=1
JOIN godown_keys g ON g.key=public.normalize_key(s.godown_label) AND g.matches=1
LEFT JOIN LATERAL (
 SELECT c.scope FROM public.sales_item_scope c
 WHERE c.alias_key=public.normalize_key(s.tally_item_name) AND c.effective_from<=s.voucher_date
 ORDER BY c.effective_from DESC,c.id DESC LIMIT 1
) scope ON true
WHERE (SELECT public.ei_can_read_sales())
AND (scope.scope IS NULL OR scope.scope IN ('UNCLASSIFIED','SASV_HISTORICAL_PACK','SASV_SAMPLE'));
REVOKE ALL ON public.v_ei_sales_product_daily FROM PUBLIC,anon;
GRANT SELECT ON public.v_ei_sales_product_daily TO authenticated;
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
 RETURN QUERY
 SELECT date_trunc('month',d.sales_date)::date,d.sku_id,d.product_id,d.region_id,d.godown_id,
 CASE WHEN count(*) FILTER(WHERE d.qty_units IS NULL)=0 THEN sum(d.qty_units) END,
 CASE WHEN count(*) FILTER(WHERE d.qty_billed IS NULL)=0 THEN sum(d.qty_billed) END,
 sum(d.billed_amount),max(d.inserted_at),count(*) FILTER(WHERE d.billed_amount IS NULL)>0
 FROM public.v_ei_sales_product_daily d WHERE d.sales_date>=p_from AND d.sales_date<p_to
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
      FROM public.v_ei_sales_product_daily s
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
    FROM public.v_ei_sales_product_daily d
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
    FROM public.v_ei_sales_product_daily d WHERE d.sales_date BETWEEN m AND a
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
           FROM public.v_ei_sales_product_daily s_1
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
    from public.v_ei_sales_product_daily s
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
COMMIT;
