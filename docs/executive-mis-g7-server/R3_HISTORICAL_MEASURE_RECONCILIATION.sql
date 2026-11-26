-- Review candidate; apply after coverage extension. Same public JSON fields; no client rework required.
-- Daily source authoritative; performance gate required before production installation.
BEGIN;
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
COMMIT;
