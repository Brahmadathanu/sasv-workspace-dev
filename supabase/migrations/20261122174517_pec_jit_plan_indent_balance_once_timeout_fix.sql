-- PEC #502 urgent production hotfix: eliminate repeated indent-view rescans in JIT read-only plan.
-- Outputs/quantity decisions unchanged (193-row full JSON fingerprint independently matched on live Nov-Dec data).
-- Only proc_pec_jit_mrp_plan replaced; JIT writer and existing S4 functions remain unchanged.
CREATE OR REPLACE FUNCTION public.proc_pec_jit_mrp_plan(
 p_start date,p_end date,p_compare_consumption boolean DEFAULT true
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_month date:=date_trunc('month',now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_h integer;
 v_cmp boolean:=coalesce(p_compare_consumption,false);
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',false);
 IF p_start IS NULL OR p_end IS NULL OR p_start<>date_trunc('month',p_start)::date
 OR p_end<>date_trunc('month',p_end)::date OR p_end<p_start
 OR p_start<(v_month-interval '1 month')::date
 OR p_start>(v_month+interval '12 months')::date THEN RAISE EXCEPTION 'Invalid JIT horizon'; END IF;
 v_h:=(12*extract(year from age(p_end,p_start))+extract(month from age(p_end,p_start))+1)::integer;
 IF v_h NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'JIT planning horizon must be 1–6 months'; END IF;
 RETURN QUERY
 WITH mrp AS (
  SELECT p.material_class_id::bigint class_id,p.stock_item_id,p.uom_id,
   sum(p.procure_qty)::numeric b,count(*)::int mrp_months
  FROM public.v_mrp_procurement_plan p
  JOIN public.inv_stock_item si ON si.id=p.stock_item_id
  JOIN public.v_inv_stock_item_with_class c ON c.stock_item_id=p.stock_item_id
  WHERE p.month_start BETWEEN p_start AND p_end AND c.active
   AND p.material_class_id=1
   AND c.subcategory_code NOT IN('finished_bulk_material','semifinished_goods')
   AND si.rm_procurement_mode='jit_procured'
  GROUP BY 1,2,3
 ), usage AS (
  SELECT c.inv_stock_item_id item_id,sum(c.total_consumed_qty)::numeric consumed,
    count(*) FILTER (WHERE c.total_consumed_qty>0)::integer positive_months
  FROM public.v_item_consumption_monthly_by_item c
  WHERE v_cmp AND c.month_start_date>=(v_month-interval '12 months')::date
    AND c.month_start_date<v_month GROUP BY 1
 ), ib AS MATERIALIZED (
  SELECT i.material_class_id class_id,i.stock_item_id,i.uom_id,
   sum(greatest(0,i.remaining_qty)) unfulfilled,
   count(*) FILTER(WHERE i.remaining_qty>0) open_lines
  FROM public.v_proc_indent_line_balance i
  WHERE i.material_class_id=1
  GROUP BY 1,2,3
 ), mq AS (
  SELECT m.stock_item_id,m.uom_id,count(*) policies,max(m.moq_qty) moq
  FROM public.inv_stock_item_moq_policy m
  JOIN mrp q ON q.stock_item_id=m.stock_item_id AND q.uom_id=m.uom_id
  WHERE m.is_active AND (m.effective_from IS NULL OR m.effective_from<=v_today)
   AND (m.effective_to IS NULL OR m.effective_to>=v_today) GROUP BY 1,2
 ), x AS (
  SELECT k.class_id,k.stock_item_id,k.uom_id,si.name item_name,un.code uom_code,
   k.b mrp_net,k.mrp_months,
   u.consumed usage12,u.positive_months,
   coalesce(ib.unfulfilled,0) indent_qty,coalesce(ib.open_lines,0) open_indent_lines,
   coalesce(mq.policies,0) policies,mq.moq,si.default_uom_id
  FROM mrp k JOIN public.inv_stock_item si ON si.id=k.stock_item_id
   LEFT JOIN public.inv_uom un ON un.id=k.uom_id
   LEFT JOIN usage u ON u.item_id=k.stock_item_id
   LEFT JOIN ib ON ib.class_id=k.class_id AND ib.stock_item_id=k.stock_item_id AND ib.uom_id=k.uom_id
   LEFT JOIN mq ON mq.stock_item_id=k.stock_item_id AND mq.uom_id=k.uom_id
 ), y AS (
  SELECT x.*,greatest(0,mrp_net-indent_qty) net_after_indent,
   CASE WHEN default_uom_id IS DISTINCT FROM uom_id OR uom_code IS NULL THEN 'UOM_REVIEW'
    WHEN policies>1 OR (moq IS NOT NULL AND moq<=0)
       OR (uom_code='Nos' AND moq IS NOT NULL AND moq<>ceil(moq)) THEN 'MOQ_POLICY_REVIEW'
    WHEN mrp_months<>v_h THEN 'MRP_HORIZON_REVIEW'
    WHEN mrp_net<0 THEN 'MRP_QUANTITY_REVIEW'
    ELSE 'AUTO_ELIGIBLE' END gate
  FROM x
 ), z AS (
  SELECT y.*,CASE WHEN gate<>'AUTO_ELIGIBLE' THEN NULL::numeric
   WHEN moq>0 THEN ceil(net_after_indent/moq)*moq
   WHEN uom_code='Nos' THEN ceil(net_after_indent)
   ELSE net_after_indent END qty FROM y
 )
 SELECT jsonb_build_object(
  'mode','jit_mrp','material_class_id',class_id,'stock_item_id',stock_item_id,
  'stock_item_name',item_name,'uom_id',uom_id,'uom_code',uom_code,
  'mrp_net_qty',mrp_net,'mrp_months',mrp_months,'coverage_months',v_h,
  'stock_netting','mrp_view_opening_qty','outstanding_indent_qty',indent_qty,
  'outstanding_indent_lines',open_indent_lines,'net_after_indent',net_after_indent,
  'moq_qty',moq,'gate',gate,'recommended_qty',qty,'consumption_only',false,
  'increment_vs_mrp',CASE WHEN qty IS NOT NULL THEN greatest(0,qty-mrp_net) END,
  'consumption_comparison',v_cmp,
  'usage_12m',CASE WHEN v_cmp THEN coalesce(usage12,0) END,
  'positive_months',CASE WHEN v_cmp THEN coalesce(positive_months,0) END,
  'period_consumption',CASE WHEN v_cmp THEN coalesce(usage12,0)/12*v_h END,
  'consumption_gap_vs_mrp',CASE WHEN v_cmp THEN greatest(0,coalesce(usage12,0)/12*v_h-mrp_net) END
 ) FROM z ORDER BY item_name,stock_item_id;
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_jit_mrp_plan(date,date,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_jit_mrp_plan(date,date,boolean) TO authenticated;

