-- PEC: procurement-route-aware PR generation for RM (JIT Only). Issue #502. Forward-only, additive.
-- Adds two NEW functions; proc_pec_s4_new_pr_plan / proc_pec_s4_generate_pr / reconcile / rebuild are NOT modified,
-- so RM Normal, PM and RM All keep their approved S4 hybrid behaviour byte-for-byte.
--
-- Contract (server-owned; the caller cannot choose a different route by editing p_generation_filters):
--   * class is fixed to RM (1) and scope fixed to jit_procured items (inv_stock_item.rm_procurement_mode).
--   * Candidate set = MRP rows only. Historical consumption NEVER creates a JIT candidate (no consumption-only items).
--   * v_mrp_procurement_plan.procure_qty is already stock-netted (opening_qty -> net_need -> procure_qty), so stock is
--     NOT deducted again and missing stock mapping does not veto an item. Outstanding approved/issued indent balances
--     (same class/item/UOM) are subtracted once, then governed MOQ once / ceil for indivisible Nos, as in S4.
--   * Still fail-closed per line: UOM_REVIEW, MOQ_POLICY_REVIEW, MRP_HORIZON_REVIEW, MRP_QUANTITY_REVIEW.
--   * Historical consumption comparison is optional (p_compare_consumption) and informational only; it never changes qty.
--   * Frozen evidence rows carry mode='jit_mrp' (hybrid rows carry no mode and remain 'hybrid_mrp_ccf').

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
 ), ib AS (
  SELECT i.material_class_id class_id,i.stock_item_id,i.uom_id,
   sum(greatest(0,i.remaining_qty)) unfulfilled,
   count(*) FILTER(WHERE i.remaining_qty>0) open_lines
  FROM public.v_proc_indent_line_balance i
  JOIN mrp k ON k.class_id=i.material_class_id AND k.stock_item_id=i.stock_item_id AND k.uom_id=i.uom_id
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

CREATE OR REPLACE FUNCTION public.proc_pec_jit_generate_pr(
 p_pr_number text,p_effective_from_date date,p_horizon_start_month date,
 p_horizon_end_month date,p_generation_filters jsonb,p_notes text,
 p_compare_consumption boolean,p_confirm boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_id bigint;v_scope text;v_count int;v_auto int;v_review int;v_unlined int;
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',true);
 IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'JIT generation confirmation required'; END IF;
 IF p_pr_number IS NULL OR length(trim(p_pr_number))<3 THEN RAISE EXCEPTION 'PR number required'; END IF;
 IF p_horizon_start_month IS NULL OR p_horizon_end_month IS NULL THEN RAISE EXCEPTION 'JIT horizon required'; END IF;
 -- The route is owned by the server: this writer is RM + JIT-only. A caller-supplied conflicting scope is rejected.
 v_scope:=coalesce(nullif(trim(p_generation_filters->>'rm_scope'),''),'jit');
 IF v_scope<>'jit' THEN RAISE EXCEPTION 'JIT generator only accepts the RM (JIT Only) scope'; END IF;
 -- Same shared horizon lock and duplicate rule as the S4 hybrid generator (class 1, scope jit).
 PERFORM pg_advisory_xact_lock(hashtext('PEC_S4_HORIZON'),
    hashtext(p_horizon_start_month::text || ':' || p_horizon_end_month::text));
 IF EXISTS(
   SELECT 1 FROM public.proc_pr_header h
   WHERE h.status IN ('draft','active')
     AND h.horizon_start_month=p_horizon_start_month
     AND h.horizon_end_month=p_horizon_end_month
     AND (h.material_class_id IS NULL OR h.material_class_id=1)
     AND (h.material_class_id IS NULL
       OR coalesce(h.generation_filters->>'rm_scope','all') IN ('all','jit'))
 ) THEN
   RAISE EXCEPTION 'An active or draft PR already exists for this class/horizon; reconcile or revise the existing PR instead of generating a duplicate';
 END IF;
 -- Validates horizon/permission before any DML; the whole writer is atomic.
 PERFORM 1 FROM public.proc_pec_jit_mrp_plan(p_horizon_start_month,p_horizon_end_month,p_compare_consumption) LIMIT 1;
 v_id:=public.create_pr_from_mrp_plan_pec_internal(
  p_pr_number,p_effective_from_date,p_horizon_start_month,p_horizon_end_month,
  1,coalesce(p_generation_filters,'{}'::jsonb)
   || jsonb_build_object('rm_scope','jit','source','jit_mrp','s4_mode','jit_mrp',
      's4_generated_at',now(),'s4_automatic',true,
      'jit_consumption_comparison',coalesce(p_compare_consumption,false)),
  p_notes
 );
 INSERT INTO public.proc_pr_ccf_generation_evidence(
   pr_id,material_class_id,stock_item_id,uom_id,baseline_mrp_qty,recommended_qty,decision,evidence
 )
 SELECT v_id,(x->>'material_class_id')::bigint,(x->>'stock_item_id')::bigint,
  (x->>'uom_id')::bigint,coalesce((x->>'mrp_net_qty')::numeric,0),
  (x->>'recommended_qty')::numeric,x->>'gate',x
 FROM public.proc_pec_jit_mrp_plan(p_horizon_start_month,p_horizon_end_month,p_compare_consumption) x;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No JIT MRP requirement found for this horizon'; END IF;
 -- The candidate set and the MRP-created lines are defined by the same predicate; any divergence aborts.
 SELECT count(*) INTO v_unlined FROM public.proc_pr_ccf_generation_evidence e
  WHERE e.pr_id=v_id AND NOT EXISTS(SELECT 1 FROM public.proc_pr_line l
   WHERE l.pr_id=v_id AND l.material_class_id=e.material_class_id
    AND l.stock_item_id=e.stock_item_id AND l.uom_id=e.uom_id);
 IF v_unlined>0 THEN RAISE EXCEPTION 'JIT plan and MRP lines diverged (% items); nothing was written',v_unlined; END IF;
 UPDATE public.proc_pr_line l SET
   system_suggested_qty=e.recommended_qty,requested_qty=e.recommended_qty,
   manual_delta_qty=0,manual_reason=NULL,updated_at=now()
 FROM public.proc_pr_ccf_generation_evidence e
 WHERE e.pr_id=v_id AND l.pr_id=v_id AND e.decision='AUTO_ELIGIBLE'
  AND e.recommended_qty IS NOT NULL
  AND e.material_class_id=l.material_class_id AND e.stock_item_id=l.stock_item_id
  AND e.uom_id=l.uom_id;
 SELECT count(*) FILTER(WHERE decision='AUTO_ELIGIBLE'),count(*) FILTER(WHERE decision<>'AUTO_ELIGIBLE')
  INTO v_auto,v_review FROM public.proc_pr_ccf_generation_evidence WHERE pr_id=v_id;
 RETURN jsonb_build_object('pr_id',v_id,'pr_number',trim(p_pr_number),
   'total_candidates',v_count,'auto_evidenced_lines',v_auto,
   'review_required_lines',v_review,'consumption_only_lines',0,
   'mode','jit_mrp','status','draft');
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_jit_generate_pr(text,date,date,date,jsonb,text,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_jit_generate_pr(text,date,date,date,jsonb,text,boolean,boolean) TO authenticated;
