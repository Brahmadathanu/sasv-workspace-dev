-- Preserve exact source precision in reconciliation Reason; no stock quantity or planning arithmetic changes.
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
    concat('Δ=', (COALESCE(m.manual_qty, 0::numeric) - COALESCE(sp.system_qty, 0::numeric))::text,
        CASE
            WHEN COALESCE(b.qty_base, 0::numeric) > 0::numeric THEN '; Bottled '::text || (SELECT string_agg(format('%s×%s %s (x%s)', h.batch_number, ps.pack_size::text, ps.uom, h.on_hand::text), '; ' ORDER BY h.batch_number) FROM public.bottled_stock_on_hand h JOIN public.product_skus ps ON ps.id=h.sku_id WHERE h.on_hand>0 AND ps.product_id=m.product_id)
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(fg.qty_base, 0::numeric) > 0::numeric THEN '; FG Bulk '::text || (SELECT string_agg(format('%s×%s %s', f.bn, f.qty_on_hand::text, f.on_hand_qty_uom), '; ' ORDER BY f.bn) FROM public.fg_bulk_stock f WHERE f.qty_on_hand>0 AND f.product_id=m.product_id)
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(wip.qty_base, 0::numeric) > 0::numeric THEN '; WIP '::text || (SELECT string_agg(format('%s×%s %s (%s)', w.batch_number, w.batch_size::text, w.batch_uom, w.activity), '; ' ORDER BY w.batch_number) FROM public.v_wip_batches w WHERE w.product_id=m.product_id AND w.batch_size>0 AND NOT w.no_product_match)
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(bmr.cnt, 0) > 0 THEN '; BMR '::text || (SELECT string_agg(format('%s×%s %s', x.bn, x.batch_size::text, x.uom), '; ' ORDER BY x.bn) FROM public.bmr_card_not_initiated x WHERE x.product_id=m.product_id AND x.batch_size>0)
            ELSE NULL::text
        END) AS reason
   FROM m
     JOIN products p ON p.id = m.product_id
     LEFT JOIN app_private.mv_system_plan_monthly sp ON sp.product_id = m.product_id AND sp.month_start = m.month_start
     LEFT JOIN app_private.mv_bottled_rollup b ON b.product_id = m.product_id
     LEFT JOIN app_private.mv_fg_bulk_rollup fg ON fg.product_id = m.product_id
     LEFT JOIN app_private.mv_wip_rollup wip ON wip.product_id = m.product_id
     LEFT JOIN app_private.mv_bmr_rollup bmr ON bmr.product_id = m.product_id;
