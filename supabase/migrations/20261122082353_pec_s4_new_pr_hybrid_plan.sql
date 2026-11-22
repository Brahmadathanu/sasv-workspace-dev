
-- PEC S4: governed hybrid PR planning evidence. 12 completed calendar months incl zero months.
CREATE OR REPLACE FUNCTION public.proc_pec_s4_new_pr_plan(
 p_start date,p_end date,p_class integer DEFAULT NULL,p_rm_scope text DEFAULT 'normal'
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_month date:=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_h integer;
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',false);
 IF p_start IS NULL OR p_end IS NULL OR p_start<>date_trunc('month',p_start)::date
 OR p_end<>date_trunc('month',p_end)::date OR p_end<p_start
 OR p_start<(v_month-interval '1 month')::date
 OR p_start>(v_month+interval '12 months')::date
 OR (p_class IS NOT NULL AND p_class NOT IN(1,2,5))
 OR p_rm_scope NOT IN('all','normal','jit') THEN RAISE EXCEPTION 'Invalid S4 horizon/class/scope'; END IF;
 v_h:=(12*extract(year from age(p_end,p_start))+extract(month from age(p_end,p_start))+1)::integer;
 IF v_h NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'S4 coverage horizon must be 1–6 months'; END IF;
 RETURN QUERY
 WITH mrp AS (
  SELECT p.material_class_id::bigint class_id,p.stock_item_id,p.uom_id,
   sum(p.procure_qty)::numeric b,count(*)::int mrp_months
  FROM public.v_mrp_procurement_plan p
  JOIN public.inv_stock_item si ON si.id=p.stock_item_id
  JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=p.stock_item_id
  WHERE p.month_start BETWEEN p_start AND p_end AND c.active
   AND (p_class IS NULL OR p.material_class_id=p_class)
   AND (p.material_class_id<>1 OR c.subcategory_code NOT IN('finished_bulk_material','semifinished_goods'))
   AND (p.material_class_id<>1 OR p_rm_scope='all'
        OR (p_rm_scope='jit' AND si.rm_procurement_mode='jit_procured')
        OR (p_rm_scope='normal' AND si.rm_procurement_mode IS DISTINCT FROM 'jit_procured'))
  GROUP BY 1,2,3
 ), usage AS (
  SELECT c.inv_stock_item_id item_id,sum(c.total_consumed_qty)::numeric consumed,
    count(*) FILTER (WHERE c.total_consumed_qty>0)::integer positive_months
  FROM public.v_item_consumption_monthly_by_item c
  WHERE c.month_start_date>=(v_month-interval '12 months')::date
    AND c.month_start_date<v_month GROUP BY 1
 ), consumption_only AS (
  SELECT cl.category_id class_id,si.id stock_item_id,si.default_uom_id uom_id
  FROM usage u JOIN public.inv_stock_item si ON si.id=u.item_id
  JOIN public.v_inv_stock_item_with_class cl ON cl.stock_item_id=si.id
  WHERE si.active AND u.consumed>0 AND cl.category_id IN(1,2)
   AND (p_class IS NULL OR p_class=cl.category_id)
   AND (cl.category_id<>1 OR cl.subcategory_code NOT IN('finished_bulk_material','semifinished_goods'))
   AND (cl.category_id<>1 OR p_rm_scope='all'
        OR (p_rm_scope='jit' AND si.rm_procurement_mode='jit_procured')
        OR (p_rm_scope='normal' AND si.rm_procurement_mode IS DISTINCT FROM 'jit_procured'))
 ), k AS (
  SELECT class_id,stock_item_id,uom_id FROM mrp
  UNION SELECT class_id,stock_item_id,uom_id FROM consumption_only
 ), st AS (
  SELECT s.inv_stock_item_id item_id,sum(s.qty_value) qty,count(*) source_count,max(s.source_kind) source
  FROM public.v_stock_current_by_item s JOIN (SELECT DISTINCT stock_item_id FROM k) z
    ON z.stock_item_id=s.inv_stock_item_id GROUP BY 1
 ), ib AS (
  SELECT i.material_class_id class_id,i.stock_item_id,i.uom_id,
   sum(greatest(0,i.remaining_qty)) unfulfilled,
   count(*) FILTER(WHERE i.remaining_qty>0) open_lines
  FROM public.v_proc_indent_line_balance i
  JOIN k ON k.class_id=i.material_class_id AND k.stock_item_id=i.stock_item_id AND k.uom_id=i.uom_id
  GROUP BY 1,2,3
 ), mq AS (
  SELECT m.stock_item_id,m.uom_id,count(*) policies,max(m.moq_qty) moq
  FROM public.inv_stock_item_moq_policy m
  JOIN (SELECT DISTINCT stock_item_id,uom_id FROM k) q ON q.stock_item_id=m.stock_item_id AND q.uom_id=m.uom_id
  WHERE m.is_active AND (m.effective_from IS NULL OR m.effective_from<=v_today)
   AND (m.effective_to IS NULL OR m.effective_to>=v_today) GROUP BY 1,2
 ), x AS (
  SELECT k.class_id,k.stock_item_id,k.uom_id,si.name item_name,un.code uom_code,
   coalesce(m.b,0) mrp_net,coalesce(m.mrp_months,0) mrp_months,
   coalesce(u.consumed,0) usage12,coalesce(u.positive_months,0) positive_months,
   s.qty stock_qty,s.source_count,s.source,
   coalesce(ib.unfulfilled,0) indent_qty,coalesce(ib.open_lines,0) open_indent_lines,
   coalesce(mq.policies,0) policies,mq.moq,si.default_uom_id,
   CASE WHEN k.class_id=1 THEN (SELECT max(as_of_date) FROM public.tally_rm_stock_snapshot)
        WHEN k.class_id=2 THEN (SELECT max(as_of_date) FROM public.tally_plm_stock_snapshot) END stock_as_of,
   coalesce(u.consumed,0)/12*v_h period_usage
  FROM k JOIN public.inv_stock_item si ON si.id=k.stock_item_id
   LEFT JOIN public.inv_uom un ON un.id=k.uom_id
   LEFT JOIN mrp m ON m.class_id=k.class_id AND m.stock_item_id=k.stock_item_id AND m.uom_id=k.uom_id
   LEFT JOIN usage u ON u.item_id=k.stock_item_id
   LEFT JOIN st s ON s.item_id=k.stock_item_id
   LEFT JOIN ib ON ib.class_id=k.class_id AND ib.stock_item_id=k.stock_item_id AND ib.uom_id=k.uom_id
   LEFT JOIN mq ON mq.stock_item_id=k.stock_item_id AND mq.uom_id=k.uom_id
 ), y AS (
 SELECT x.*,greatest(0,period_usage-coalesce(stock_qty,0)) usage_stock_net,
  greatest(0,greatest(mrp_net,greatest(0,period_usage-coalesce(stock_qty,0)))-indent_qty) net_after_indent,
  CASE WHEN class_id NOT IN(1,2) THEN 'MRP_ONLY_OTHER_CLASS'
   WHEN stock_qty IS NULL OR source_count<>1 OR source<>CASE WHEN class_id=1 THEN 'rm' ELSE 'plm' END THEN 'STOCK_MAPPING_REVIEW'
   WHEN stock_as_of IS NULL OR stock_as_of NOT BETWEEN v_today-1 AND v_today THEN 'STALE_STOCK_REVIEW'
   WHEN stock_qty<0 THEN 'NEGATIVE_STOCK_REVIEW'
   WHEN default_uom_id IS DISTINCT FROM uom_id OR uom_code IS NULL THEN 'UOM_REVIEW'
   WHEN policies>1 OR (moq IS NOT NULL AND moq<=0)
      OR (uom_code='Nos' AND moq IS NOT NULL AND moq<>ceil(moq)) THEN 'MOQ_POLICY_REVIEW'
   WHEN mrp_months NOT IN(0,v_h) THEN 'MRP_HORIZON_REVIEW'
   ELSE 'AUTO_ELIGIBLE' END gate
 FROM x
 ), z AS (
  SELECT y.*,CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL::numeric
   WHEN moq>0 THEN ceil(net_after_indent/moq)*moq
   WHEN uom_code='Nos' THEN ceil(net_after_indent)
   ELSE net_after_indent END qty FROM y
 )
 SELECT jsonb_build_object(
  'material_class_id',class_id,'stock_item_id',stock_item_id,'stock_item_name',item_name,
  'uom_id',uom_id,'uom_code',uom_code,'mrp_net_qty',mrp_net,
  'usage_12m',usage12,'positive_months',positive_months,'coverage_months',v_h,
  'period_consumption',period_usage,'stock_qty',stock_qty,'stock_as_of',stock_as_of,
  'stock_netted_consumption',usage_stock_net,'outstanding_indent_qty',indent_qty,
  'outstanding_indent_lines',open_indent_lines,'net_after_indent',net_after_indent,
  'moq_qty',moq,'gate',gate,'recommended_qty',qty,'consumption_only',mrp_months=0,
  'increment_vs_mrp',CASE WHEN qty IS NOT NULL THEN greatest(0,qty-mrp_net) END
 ) FROM z ORDER BY class_id,item_name;
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s4_new_pr_plan(date,date,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s4_new_pr_plan(date,date,integer,text) TO authenticated;
