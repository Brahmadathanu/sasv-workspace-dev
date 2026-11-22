
-- PEC S4: append-only generation evidence + governed hybrid PR writer.
-- DML only through authenticated PEC edit permission, no direct table grants.
CREATE TABLE IF NOT EXISTS public.proc_pr_ccf_generation_evidence(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pr_id bigint NOT NULL REFERENCES public.proc_pr_header(pr_id) ON DELETE CASCADE,
 material_class_id bigint NOT NULL,
 stock_item_id bigint NOT NULL,
 uom_id bigint NOT NULL,
 baseline_mrp_qty numeric NOT NULL DEFAULT 0,
 recommended_qty numeric,
 decision text NOT NULL,
 evidence jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(pr_id,material_class_id,stock_item_id,uom_id)
);
ALTER TABLE public.proc_pr_ccf_generation_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proc_pr_ccf_generation_evidence FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.proc_pec_s4_generate_pr(
 p_pr_number text,p_effective_from_date date,p_horizon_start_month date,
 p_horizon_end_month date,p_material_class_id integer,p_generation_filters jsonb,p_notes text,
 p_confirm boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public AS $fn$
DECLARE v_id bigint;v_scope text;v_count int;v_auto int;v_review int;v_missing int;
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',true);
 IF p_confirm IS DISTINCT FROM true THEN RAISE EXCEPTION 'S4 generation confirmation required'; END IF;
 IF p_pr_number IS NULL OR length(trim(p_pr_number))<3 THEN RAISE EXCEPTION 'PR number required'; END IF;
 IF p_horizon_start_month IS NULL OR p_horizon_end_month IS NULL THEN RAISE EXCEPTION 'S4 horizon required'; END IF;
 v_scope:=coalesce(nullif(trim(p_generation_filters->>'rm_scope'),''),'normal');
 -- Prevent two overlapping draft/active PRs with the same complete horizon.
 -- Shared horizon lock serializes concurrent creators across class and RM scope.
 PERFORM pg_advisory_xact_lock(hashtext('PEC_S4_HORIZON'),
    hashtext(p_horizon_start_month::text || ':' || p_horizon_end_month::text));
 IF EXISTS(
   SELECT 1 FROM public.proc_pr_header h
   WHERE h.status IN ('draft','active')
     AND h.horizon_start_month=p_horizon_start_month
     AND h.horizon_end_month=p_horizon_end_month
     AND (p_material_class_id IS NULL OR h.material_class_id IS NULL
       OR h.material_class_id=p_material_class_id)
     AND (p_material_class_id IS NULL OR h.material_class_id IS NULL
       OR p_material_class_id<>1 OR h.material_class_id<>1
       OR v_scope='all' OR coalesce(h.generation_filters->>'rm_scope','all')='all'
       OR coalesce(h.generation_filters->>'rm_scope','all')=v_scope)
 ) THEN
   RAISE EXCEPTION 'An active or draft PR already exists for this class/horizon; reconcile or revise the existing PR instead of generating a duplicate';
 END IF;
 -- Atomic: on any failure all newly created lines, header and evidence roll back.
 -- Preflight is permission-checked and validates the planning horizon before DML.
 PERFORM 1 FROM public.proc_pec_s4_new_pr_plan(p_horizon_start_month,p_horizon_end_month,p_material_class_id,v_scope) LIMIT 1;
 v_id:=public.create_pr_from_mrp_plan_pec_internal(
  p_pr_number,p_effective_from_date,p_horizon_start_month,p_horizon_end_month,
  p_material_class_id,coalesce(p_generation_filters,'{}'::jsonb)
   || jsonb_build_object('source','hybrid_mrp_ccf','s4_mode','12_calendar_months',
      's4_generated_at',now(),'s4_automatic',true),
  p_notes
 );
 INSERT INTO public.proc_pr_ccf_generation_evidence(
   pr_id,material_class_id,stock_item_id,uom_id,baseline_mrp_qty,recommended_qty,decision,evidence
 )
 SELECT v_id,(x->>'material_class_id')::bigint,(x->>'stock_item_id')::bigint,
  (x->>'uom_id')::bigint,coalesce((x->>'mrp_net_qty')::numeric,0),
  (x->>'recommended_qty')::numeric,x->>'gate',x
 FROM public.proc_pec_s4_new_pr_plan(p_horizon_start_month,p_horizon_end_month,p_material_class_id,v_scope) x;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'No eligible planning materials found for this PR'; END IF;

 -- Auto update only fully evidenced lines. Store original MRP in immutable audit.
 UPDATE public.proc_pr_line l SET
   system_suggested_qty=e.recommended_qty,
   requested_qty=e.recommended_qty,
   manual_delta_qty=0,
   manual_reason=NULL,
   updated_at=now()
 FROM public.proc_pr_ccf_generation_evidence e
 WHERE e.pr_id=v_id AND l.pr_id=v_id AND e.decision='AUTO_ELIGIBLE'
  AND e.recommended_qty IS NOT NULL
  AND e.material_class_id=l.material_class_id AND e.stock_item_id=l.stock_item_id
  AND e.uom_id=l.uom_id;

 -- Consumption-only and other planning candidates absent from MRP have
 -- their own lines, with 0 qty + review status if not evidence eligible.
 INSERT INTO public.proc_pr_line(
   pr_id,material_class_id,stock_item_id,uom_id,
   system_suggested_qty,requested_qty,manual_delta_qty,manual_reason
 )
 SELECT v_id,e.material_class_id,e.stock_item_id,e.uom_id,
    CASE WHEN e.decision='AUTO_ELIGIBLE' THEN coalesce(e.recommended_qty,0) ELSE 0 END,
    CASE WHEN e.decision='AUTO_ELIGIBLE' THEN coalesce(e.recommended_qty,0) ELSE 0 END,
    0,NULL
 FROM public.proc_pr_ccf_generation_evidence e
 WHERE e.pr_id=v_id AND NOT EXISTS(
   SELECT 1 FROM public.proc_pr_line l
   WHERE l.pr_id=v_id AND l.material_class_id=e.material_class_id
    AND l.stock_item_id=e.stock_item_id AND l.uom_id=e.uom_id
 );
 SELECT count(*) FILTER(WHERE decision='AUTO_ELIGIBLE'),
  count(*) FILTER(WHERE decision<>'AUTO_ELIGIBLE'),
  count(*) FILTER(WHERE (evidence->>'consumption_only')::boolean)
 INTO v_auto,v_review,v_missing
 FROM public.proc_pr_ccf_generation_evidence WHERE pr_id=v_id;
 RETURN jsonb_build_object('pr_id',v_id,'pr_number',trim(p_pr_number),
   'total_candidates',v_count,'auto_evidenced_lines',v_auto,
   'review_required_lines',v_review,'consumption_only_lines',v_missing,
   'mode','hybrid_mrp_ccf','status','draft');
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s4_generate_pr(text,date,date,date,integer,jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s4_generate_pr(text,date,date,date,integer,jsonb,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.proc_pec_s4_pr_evidence(p_pr_id bigint)
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
 PERFORM public.require_permission('module:procurement-execution-console',false);
 RETURN QUERY SELECT e.evidence || jsonb_build_object(
 'pr_id',e.pr_id,'decision',e.decision,'frozen_mrp_qty',e.baseline_mrp_qty,
 'frozen_recommended_qty',e.recommended_qty,'recorded_at',e.recorded_at)
 FROM public.proc_pr_ccf_generation_evidence e
 WHERE e.pr_id=p_pr_id ORDER BY e.material_class_id,e.stock_item_id;
END;$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s4_pr_evidence(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s4_pr_evidence(bigint) TO authenticated;
