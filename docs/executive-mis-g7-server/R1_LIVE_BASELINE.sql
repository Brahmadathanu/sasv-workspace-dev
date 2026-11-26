-- Captured live definitions; evidence only, not executable rollback for appended columns.
CREATE OR REPLACE VIEW public.v_mis_sales_tab_summary WITH (security_invoker=true) AS
WITH latest_sales AS (
         SELECT max(v_sales_daily_normalized.sales_date) AS report_date
           FROM v_sales_daily_normalized
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
  GROUP BY p.report_date, p.month_start, p.month_upto_date;
CREATE OR REPLACE FUNCTION public.get_mis_sales_product_page(p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(report_date date, month_start date, month_upto_date date, product_id bigint, product_name text, sku_count bigint, sales_value numeric, sales_units numeric, billed_units numeric, latest_day_sales_value numeric, latest_day_sales_units numeric, average_daily_sales_value numeric, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with latest_sales as (
    select max(sales_date) as report_date
    from public.v_sales_daily_normalized
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
  order by f.sales_value desc nulls last, f.product_name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$
;
CREATE OR REPLACE VIEW public.v_mis_inventory_tab_summary WITH (security_invoker=true) AS
SELECT CURRENT_DATE AS report_date,
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
    'Inventory tab covers manufacturing inventory only: Raw Material, Packing Material, Consumables, and Fuel. Finished Goods inventory is handled separately in the Finished Goods tab.'::text AS inventory_scope_note
   FROM v_stock_current_by_item;
CREATE OR REPLACE FUNCTION public.get_mis_inventory_item_page(p_source_kind text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(source_kind text, source_label text, inv_stock_item_id bigint, code text, item_name text, qty_value numeric, avg_rate_value numeric, stock_value numeric, category_label text, subcategory_label text, group_label text, subgroup_label text, total_rows bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
  with base as (
    select
      source_kind,
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
      coalesce(qty_value, 0) * coalesce(avg_rate_value, 0) as stock_value,
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
        or source_kind = p_source_kind
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
  order by f.stock_value desc nulls last, f.item_name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100))
  offset greatest(0, coalesce(p_offset, 0));
$function$
;
