
-- PEC S4: reconciliation of fresh, unmodified, DRAFT legacy MRP requisitions.
-- Never silently bulk edits: explicit owner/editor confirmation, reason, exactly-once.
-- The original system MRP value is frozen in append-only item evidence.
CREATE OR REPLACE FUNCTION public.proc_pec_s4_reconcile_draft(
 p_pr_id bigint,p_expected_updated_at timestamptz,p_reason text,p_confirm boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE h public.proc_pr_header%ROWTYPE;v_today date:=(now() AT TIME ZONE 'Asia/Kolkata')::date;
 v_scope text;v_added int;v_updated int;v_candidates int;v_review int;
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',true);
 IF p_confirm IS DISTINCT FROM true OR length(trim(coalesce(p_reason,'')))<20 THEN
   RAISE EXCEPTION 'Explicit confirmation and a reason of 20 characters required';END IF;
 SELECT * INTO h FROM public.proc_pr_header WHERE pr_id=p_pr_id FOR UPDATE;
 IF NOT FOUND OR h.status<>'draft' THEN RAISE EXCEPTION 'Only an existing draft PR may be reconciled'; END IF;
 IF h.updated_at IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'PR has changed; reopen the S4 review'; END IF;
 IF (h.created_at AT TIME ZONE 'Asia/Kolkata')::date<>v_today THEN
   RAISE EXCEPTION 'Historic draft stock anchor requires a separate review';END IF;
 IF h.horizon_start_month IS NULL OR h.horizon_end_month IS NULL THEN
   RAISE EXCEPTION 'PR has no governed horizon';END IF;
 IF EXISTS(SELECT 1 FROM public.proc_pr_ccf_generation_evidence WHERE pr_id=h.pr_id) THEN
   RAISE EXCEPTION 'S4 evidence already recorded: this PR must not be reconciled twice';END IF;
 v_scope:=coalesce(nullif(h.generation_filters->>'rm_scope',''),'normal');
 PERFORM 1 FROM public.proc_pec_s4_new_pr_plan(
    h.horizon_start_month,h.horizon_end_month,h.material_class_id::int,v_scope) LIMIT 1;
 INSERT INTO public.proc_pr_ccf_generation_evidence(
   pr_id,material_class_id,stock_item_id,uom_id,baseline_mrp_qty,recommended_qty,decision,evidence)
 SELECT h.pr_id,(x->>'material_class_id')::bigint,(x->>'stock_item_id')::bigint,
   (x->>'uom_id')::bigint,(x->>'mrp_net_qty')::numeric,
   (x->>'recommended_qty')::numeric,x->>'gate',x
 FROM public.proc_pec_s4_new_pr_plan(
   h.horizon_start_month,h.horizon_end_month,h.material_class_id::int,v_scope) x;
 GET DIAGNOSTICS v_candidates=ROW_COUNT;
 IF v_candidates=0 THEN RAISE EXCEPTION 'No S4 candidate item available'; END IF;
 -- Only absolutely untouched baseline MRP lines are replaced.
 UPDATE public.proc_pr_line l SET
  system_suggested_qty=e.recommended_qty,requested_qty=e.recommended_qty,
  manual_delta_qty=0,manual_reason=NULL,updated_at=now()
 FROM public.proc_pr_ccf_generation_evidence e
 WHERE l.pr_id=h.pr_id AND e.pr_id=h.pr_id
  AND l.material_class_id=e.material_class_id AND l.stock_item_id=e.stock_item_id AND l.uom_id=e.uom_id
  AND e.decision='AUTO_ELIGIBLE' AND e.recommended_qty IS NOT NULL
  AND l.manual_delta_qty=0 AND NULLIF(trim(coalesce(l.manual_reason,'')),'') IS NULL
  AND l.requested_qty=l.system_suggested_qty
  AND l.updated_at<=l.created_at+interval '1 second';
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 INSERT INTO public.proc_pr_line(
  pr_id,material_class_id,stock_item_id,uom_id,system_suggested_qty,
  requested_qty,manual_delta_qty,manual_reason)
 SELECT h.pr_id,e.material_class_id,e.stock_item_id,e.uom_id,
  CASE WHEN e.decision='AUTO_ELIGIBLE' THEN coalesce(e.recommended_qty,0) ELSE 0 END,
  CASE WHEN e.decision='AUTO_ELIGIBLE' THEN coalesce(e.recommended_qty,0) ELSE 0 END,0,NULL
 FROM public.proc_pr_ccf_generation_evidence e
 WHERE e.pr_id=h.pr_id AND NOT EXISTS(
  SELECT 1 FROM public.proc_pr_line l WHERE l.pr_id=h.pr_id
    AND l.material_class_id=e.material_class_id AND l.stock_item_id=e.stock_item_id AND l.uom_id=e.uom_id);
 GET DIAGNOSTICS v_added=ROW_COUNT;
 UPDATE public.proc_pr_header SET
  generation_filters=coalesce(h.generation_filters,'{}'::jsonb)
     ||jsonb_build_object('s4_mode','12_calendar_months','s4_reconciled_at',now(),
        's4_reconciliation_reason',trim(p_reason)),
  updated_at=now(),updated_by=auth.uid() WHERE pr_id=h.pr_id;
 SELECT count(*) INTO v_review FROM public.proc_pr_ccf_generation_evidence
   WHERE pr_id=h.pr_id AND decision<>'AUTO_ELIGIBLE';
 RETURN jsonb_build_object('pr_id',h.pr_id,'pr_number',h.pr_number,
  'updated_untouched_lines',v_updated,'added_missing_lines',v_added,
  'review_required',v_review,'candidates',v_candidates,'status','draft');
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s4_reconcile_draft(bigint,timestamptz,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s4_reconcile_draft(bigint,timestamptz,text,boolean) TO authenticated;
