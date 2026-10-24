with nv as (WITH periods AS (
         SELECT cost_periods.period_start
           FROM costing.cost_periods
          WHERE cost_periods.status = ANY (ARRAY['OPEN'::text, 'LOCKED'::text])
        ), active_skus AS (
         SELECT ps.id AS sku_id,
            ps.product_id,
            p_1.item AS product_name,
            p_1.uom_base AS product_base_uom,
            p_1.conversion_to_base,
            ps.pack_size,
            ps.uom AS pack_uom,
            COALESCE(ps.pack_size, 0::numeric) * COALESCE(p_1.conversion_to_base, 1::numeric) AS sku_base_qty_per_unit,
            x.sku_base_qty_per_unit AS exception_base_qty,
            (CASE WHEN x.sku_id = 865 THEN DATE '2026-10-01' END) AS exception_costing_from
           FROM product_skus ps
             JOIN products p_1 ON p_1.id = ps.product_id
             LEFT JOIN costing.sku_base_quantity_exception x ON x.sku_id = ps.id AND x.product_id = ps.product_id AND x.base_uom = p_1.uom_base
          WHERE ps.is_active = true AND COALESCE(p_1.status, ''::text) ~~* 'active'::text
        ), sku_sales_12m AS (
         SELECT pr.period_start,
            s_1.sku_id,
            s_1.product_id,
            s_1.product_name,
            s_1.product_base_uom,
            s_1.conversion_to_base,
            s_1.pack_size,
            s_1.pack_uom,
            CASE WHEN s_1.exception_base_qty IS NOT NULL AND s_1.exception_costing_from IS NOT NULL AND pr.period_start >= s_1.exception_costing_from THEN s_1.exception_base_qty ELSE s_1.sku_base_qty_per_unit END AS sku_base_qty_per_unit,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) AS sales_units_12m,
            COALESCE(sum(COALESCE(v.qty_clean, 0::numeric)), 0::numeric) * COALESCE(CASE WHEN s_1.exception_base_qty IS NOT NULL AND s_1.exception_costing_from IS NOT NULL AND pr.period_start >= s_1.exception_costing_from THEN s_1.exception_base_qty ELSE s_1.sku_base_qty_per_unit END, 0::numeric) AS sales_base_qty_12m
           FROM periods pr
             CROSS JOIN active_skus s_1
             LEFT JOIN v_sales_monthly_clean v ON v.sku_id = s_1.sku_id AND v.month_start >= (pr.period_start - '1 year'::interval) AND v.month_start < pr.period_start
          GROUP BY pr.period_start, s_1.sku_id, s_1.product_id, s_1.product_name, s_1.product_base_uom, s_1.conversion_to_base, s_1.pack_size, s_1.pack_uom, s_1.sku_base_qty_per_unit, s_1.exception_base_qty, s_1.exception_costing_from
        ), product_sales_12m AS (
         SELECT sku_sales_12m.period_start,
            sku_sales_12m.product_id,
            sum(sku_sales_12m.sales_units_12m) AS product_sales_units_12m,
            sum(sku_sales_12m.sales_base_qty_12m) AS product_sales_base_qty_12m
           FROM sku_sales_12m
          GROUP BY sku_sales_12m.period_start, sku_sales_12m.product_id
        ), company_sales_12m AS (
         SELECT product_sales_12m.period_start,
            sum(product_sales_12m.product_sales_units_12m) AS company_sales_units_12m
           FROM product_sales_12m
          GROUP BY product_sales_12m.period_start
        )
 SELECT s.period_start,
    s.sku_id,
    s.product_id,
    s.product_name,
    s.product_base_uom,
    s.conversion_to_base,
    s.pack_size,
    s.pack_uom,
    s.sku_base_qty_per_unit,
    s.sales_units_12m,
    s.sales_base_qty_12m,
    p.product_sales_units_12m,
    p.product_sales_base_qty_12m,
    c.company_sales_units_12m,
        CASE
            WHEN c.company_sales_units_12m > 0::numeric THEN p.product_sales_units_12m / c.company_sales_units_12m
            ELSE 0::numeric
        END AS product_allocation_share,
        CASE
            WHEN c.company_sales_units_12m IS NULL OR c.company_sales_units_12m = 0::numeric THEN 'NO_TOTAL_SALES_BASIS'::text
            WHEN p.product_sales_units_12m = 0::numeric THEN 'NO_PRODUCT_SALES_IN_LOOKBACK'::text
            WHEN s.sales_units_12m = 0::numeric THEN 'NO_SKU_SALES_IN_LOOKBACK'::text
            WHEN p.product_sales_base_qty_12m = 0::numeric THEN 'NO_PRODUCT_BASE_QTY'::text
            ELSE 'OK'::text
        END AS allocation_basis_status,
    (s.period_start - '1 year'::interval)::date AS lookback_start,
    (s.period_start - '1 mon'::interval)::date AS lookback_end
   FROM sku_sales_12m s
     JOIN product_sales_12m p ON p.period_start = s.period_start AND p.product_id = s.product_id
     JOIN company_sales_12m c ON c.period_start = s.period_start), ov as (select * from costing.v_sku_sales_volume_allocation_basis)
select json_build_object(
 'n_new',(select count(*) from nv),'n_old',(select count(*) from ov),
 'diff_rows',(select count(*) from nv join ov using(period_start,sku_id) where row(nv.*)::text is distinct from row(ov.*)::text),
 'diff_skus',(select json_agg(json_build_object('p',nv.period_start,'sku',nv.sku_id,'k',ov.sku_base_qty_per_unit||'->'||nv.sku_base_qty_per_unit,'b12',ov.sales_base_qty_12m||'->'||nv.sales_base_qty_12m,'prod_b12',ov.product_sales_base_qty_12m||'->'||nv.product_sales_base_qty_12m)) from nv join ov using(period_start,sku_id) where row(nv.*)::text is distinct from row(ov.*)::text),
 'periods',(select json_agg(distinct period_start) from nv)) r