-- PEC S5 candidate D: consolidated review/fingerprint and atomic guarded generator.
-- NOT DEPLOYABLE ALONE: requires S5 candidates A and C. This is staged source only.
CREATE OR REPLACE FUNCTION public.proc_pec_s5_review_plan(
  p_start date,p_end date,p_class integer,p_rm_scope text,
  p_method text,p_compare_history boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,public AS $fn$
DECLARE v_rows jsonb;v_signature text;v_scope text;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',false);
  v_scope:=coalesce(nullif(btrim(p_rm_scope),''),'normal');
  -- The authoritative planner validates all method/scope/horizon arguments.
  SELECT coalesce(jsonb_agg(r.obj ORDER BY
       (r.obj->>'material_class_id')::integer,
       (r.obj->>'stock_item_id')::bigint,
       (r.obj->>'uom_id')::bigint),'[]'::jsonb)
    INTO v_rows
  FROM public.proc_pec_s5_unified_plan(
    p_start,p_end,p_class,v_scope,p_method,p_compare_history) AS r(obj);

  v_signature:=md5(jsonb_build_object(
    'start',p_start,'end',p_end,'class',p_class,'scope',v_scope,
    'method',p_method,'compare_history',coalesce(p_compare_history,false),
    'rows',v_rows)::text);
  RETURN jsonb_build_object(
    'planning_method',p_method,'material_class_id',p_class,'rm_scope',v_scope,
    'history_comparison',coalesce(p_compare_history,false),
    'plan_signature',v_signature,'rows',v_rows,
    'total_candidates',jsonb_array_length(v_rows),
    'auto_eligible',(
      SELECT count(*) FROM jsonb_array_elements(v_rows) x
      WHERE x->>'gate'='AUTO_ELIGIBLE'),
    'review_required',(
      SELECT count(*) FROM jsonb_array_elements(v_rows) x
      WHERE x->>'gate'<>'AUTO_ELIGIBLE'));
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s5_review_plan(date,date,integer,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s5_review_plan(date,date,integer,text,text,boolean)
 TO authenticated;

CREATE OR REPLACE FUNCTION public.proc_pec_s5_generate_pr(
  p_pr_number text,p_effective_from_date date,
  p_horizon_start_month date,p_horizon_end_month date,
  p_material_class_id integer,p_rm_scope text,p_method text,
  p_compare_history boolean,p_generation_filters jsonb,p_notes text,
  p_expected_plan_signature text,p_confirm boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,public AS $fn$
DECLARE
 v_id bigint;
 v_scope text := coalesce(nullif(btrim(p_rm_scope),''),'normal');
 v_review jsonb;v_rows jsonb;v_signature text;
 v_auto integer;v_total integer;v_review_count integer;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',true);
  IF p_confirm IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit confirmed S5 review is required';
  END IF;
  IF p_pr_number IS NULL OR length(btrim(p_pr_number))<3
    OR p_effective_from_date IS NULL
    OR p_expected_plan_signature IS NULL
    OR p_expected_plan_signature !~ '^[0-9a-f]{32}$'
  THEN RAISE EXCEPTION 'Valid PR number, effective date and current plan signature are required'; END IF;
  IF p_material_class_id NOT IN (1,2,5) OR p_method NOT IN ('plan','hybrid') THEN
    RAISE EXCEPTION 'Unsupported S5 class or method';
  END IF;

  -- Shared existing S4/JIT lock and exact-horizon/scope duplicate policy.
  PERFORM pg_advisory_xact_lock(hashtext('PEC_S4_HORIZON'),
    hashtext(p_horizon_start_month::text||':'||p_horizon_end_month::text));
  IF EXISTS (
    SELECT 1 FROM public.proc_pr_header h
    WHERE h.status IN ('draft','active')
      AND h.horizon_start_month=p_horizon_start_month
      AND h.horizon_end_month=p_horizon_end_month
      AND (h.material_class_id IS NULL OR h.material_class_id=p_material_class_id)
      AND (p_material_class_id<>1 OR h.material_class_id IS NULL
        OR v_scope='all' OR coalesce(h.generation_filters->>'rm_scope','all')='all'
        OR coalesce(h.generation_filters->>'rm_scope','all')=v_scope)
  ) THEN
    RAISE EXCEPTION 'Existing active or draft PR for the same class and horizon; review or reconcile it instead';
  END IF;

  v_review:=public.proc_pec_s5_review_plan(
    p_horizon_start_month,p_horizon_end_month,p_material_class_id,
    v_scope,p_method,p_compare_history);
  v_signature:=v_review->>'plan_signature';
  v_rows:=v_review->'rows';
  v_total:=coalesce(jsonb_array_length(v_rows),0);
  IF v_total=0 THEN RAISE EXCEPTION 'No valid planning candidates for this class and horizon'; END IF;
  IF v_signature IS DISTINCT FROM p_expected_plan_signature THEN
    RAISE EXCEPTION 'Planning evidence changed since review; refresh and reconfirm the draft';
  END IF;

  -- No untrusted filter key controls actual class, scope or calculation.
  INSERT INTO public.proc_pr_header(
    pr_number,status,effective_from_date,horizon_start_month,horizon_end_month,
    material_class_id,generation_filters,notes,created_by,updated_by
  ) VALUES (
    btrim(p_pr_number),'draft',p_effective_from_date,
    p_horizon_start_month,p_horizon_end_month,p_material_class_id,
    (coalesce(p_generation_filters,'{}'::jsonb)
      - 'rm_scope' - 'method' - 'source' - 's4_mode' - 's5_mode'
      - 'plan_signature' - 'history_comparison')
       || jsonb_build_object(
         'rm_scope',v_scope,'method',p_method,'source','s5_unified',
         's5_mode',p_method,'history_comparison',coalesce(p_compare_history,false),
         'plan_signature',v_signature,'s5_generated_at',now(),
         's5_automatic',true),
    nullif(btrim(p_notes),''),auth.uid(),auth.uid()
  ) RETURNING pr_id INTO v_id;

  -- Immutable per-candidate audit evidence, including class/method and origin.
  INSERT INTO public.proc_pr_ccf_generation_evidence(
     pr_id,material_class_id,stock_item_id,uom_id,baseline_mrp_qty,
     recommended_qty,decision,evidence
  )
  SELECT v_id,p_material_class_id,(x->>'stock_item_id')::bigint,
    (x->>'uom_id')::bigint,
    CASE WHEN p_material_class_id=5 THEN 0
         ELSE coalesce((x->>'mrp_net_qty')::numeric,0) END,
    (x->>'recommended_qty')::numeric,x->>'gate',
    x || jsonb_build_object('s5_plan_signature',v_signature,'s5_frozen_at',now())
  FROM jsonb_array_elements(v_rows) x;

  -- Direct insertion is intentional: IND has no production-MRP source.
  -- Review-required material lines are present at qty 0, never auto-purchased.
  INSERT INTO public.proc_pr_line(
    pr_id,material_class_id,stock_item_id,uom_id,system_suggested_qty,
    requested_qty,manual_delta_qty,manual_reason
  )
  SELECT v_id,p_material_class_id,(x->>'stock_item_id')::bigint,
     (x->>'uom_id')::bigint,
     CASE WHEN x->>'gate'='AUTO_ELIGIBLE'
       THEN coalesce((x->>'recommended_qty')::numeric,0) ELSE 0 END,
     CASE WHEN x->>'gate'='AUTO_ELIGIBLE'
       THEN coalesce((x->>'recommended_qty')::numeric,0) ELSE 0 END,
     0,NULL
  FROM jsonb_array_elements(v_rows) x;

  SELECT count(*) FILTER (WHERE decision='AUTO_ELIGIBLE'),
     count(*) FILTER (WHERE decision<>'AUTO_ELIGIBLE')
    INTO v_auto,v_review_count
  FROM public.proc_pr_ccf_generation_evidence WHERE pr_id=v_id;
  IF (v_auto+v_review_count) IS DISTINCT FROM v_total THEN
    RAISE EXCEPTION 'Frozen evidence mismatch; all PR changes are rolled back';
  END IF;
  RETURN jsonb_build_object(
     'pr_id',v_id,'pr_number',btrim(p_pr_number),'status','draft',
     'mode','s5_unified','method',p_method,
     'material_class_id',p_material_class_id,'rm_scope',v_scope,
     'plan_signature',v_signature,'total_candidates',v_total,
     'auto_evidenced_lines',v_auto,'review_required_lines',v_review_count);
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_s5_generate_pr(
  text,date,date,date,integer,text,text,boolean,jsonb,text,text,boolean)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_s5_generate_pr(
  text,date,date,date,integer,text,text,boolean,jsonb,text,text,boolean)
 TO authenticated;
