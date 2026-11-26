-- R3 parity: separate sales-only contracts; keep every legacy MIS reporting object executive-only.
BEGIN;
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
COMMIT;
