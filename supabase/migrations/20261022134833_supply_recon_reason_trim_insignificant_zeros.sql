CREATE OR REPLACE VIEW public.v_supply_recon WITH (security_invoker = true) AS
WITH m AS (
         SELECT l.set_id,
            l.product_id,
            l.month_start,
            sum(COALESCE(l.proposed_qty, 0::numeric)) AS manual_qty
           FROM manual_plan_lines l
          GROUP BY l.set_id, l.product_id, l.month_start
        )
 SELECT m.set_id,
    m.product_id,
    p.item,
    p.uom_base,
    m.month_start,
    COALESCE(m.manual_qty, 0::numeric) AS manual_qty,
    COALESCE(sp.system_qty, 0::numeric) AS system_qty,
    COALESCE(m.manual_qty, 0::numeric) - COALESCE(sp.system_qty, 0::numeric) AS delta_qty,
    COALESCE(b.qty_base, 0::numeric) AS bottled_qty_base,
    COALESCE(fg.qty_base, 0::numeric) AS fg_bulk_qty_base,
    COALESCE(wip.qty_base, 0::numeric) AS wip_qty_base,
    COALESCE(bmr.cnt, 0) AS bmr_not_initiated_cnt,
    COALESCE(m.manual_qty, 0::numeric) > 0::numeric OR COALESCE(sp.system_qty, 0::numeric) = 0::numeric AND (COALESCE(b.qty_base, 0::numeric) + COALESCE(fg.qty_base, 0::numeric) + COALESCE(wip.qty_base, 0::numeric)) = 0::numeric AND COALESCE(bmr.cnt, 0) = 0 AS is_manual_needed,
    concat('Δ=', pg_catalog.trim_scale((COALESCE(m.manual_qty, 0::numeric) - COALESCE(sp.system_qty, 0::numeric)))::text,
        CASE
            WHEN COALESCE(b.qty_base, 0::numeric) > 0::numeric THEN '; Bottled '::text || (( SELECT string_agg(format('%s×%s %s (x%s)'::text, h.batch_number, pg_catalog.trim_scale(ps.pack_size)::text, ps.uom, pg_catalog.trim_scale(h.on_hand)::text), '; '::text ORDER BY h.batch_number) AS string_agg
               FROM bottled_stock_on_hand h
                 JOIN product_skus ps ON ps.id = h.sku_id
              WHERE h.on_hand > 0 AND ps.product_id = m.product_id))
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(fg.qty_base, 0::numeric) > 0::numeric THEN '; FG Bulk '::text || (( SELECT string_agg(format('%s×%s %s'::text, f.bn, pg_catalog.trim_scale(f.qty_on_hand)::text, f.on_hand_qty_uom), '; '::text ORDER BY f.bn) AS string_agg
               FROM fg_bulk_stock f
              WHERE f.qty_on_hand > 0::numeric AND f.product_id = m.product_id))
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(wip.qty_base, 0::numeric) > 0::numeric THEN '; WIP '::text || (( SELECT string_agg(format('%s×%s %s (%s)'::text, w.batch_number, pg_catalog.trim_scale(w.batch_size)::text, w.batch_uom, w.activity), '; '::text ORDER BY w.batch_number) AS string_agg
               FROM v_wip_batches w
              WHERE w.product_id = m.product_id AND w.batch_size > 0::numeric AND NOT w.no_product_match))
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(bmr.cnt, 0) > 0 THEN '; BMR '::text || (( SELECT string_agg(format('%s×%s %s'::text, x.bn, pg_catalog.trim_scale(x.batch_size)::text, x.uom), '; '::text ORDER BY x.bn) AS string_agg
               FROM bmr_card_not_initiated x
              WHERE x.product_id = m.product_id AND x.batch_size > 0::numeric))
            ELSE NULL::text
        END) AS reason
   FROM m
     JOIN products p ON p.id = m.product_id
     LEFT JOIN app_private.mv_system_plan_monthly sp ON sp.product_id = m.product_id AND sp.month_start = m.month_start
     LEFT JOIN app_private.mv_bottled_rollup b ON b.product_id = m.product_id
     LEFT JOIN app_private.mv_fg_bulk_rollup fg ON fg.product_id = m.product_id
     LEFT JOIN app_private.mv_wip_rollup wip ON wip.product_id = m.product_id
     LEFT JOIN app_private.mv_bmr_rollup bmr ON bmr.product_id = m.product_id;
