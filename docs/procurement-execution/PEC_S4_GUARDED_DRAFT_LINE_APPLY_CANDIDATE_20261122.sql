-- PEC S4: opt-in, single-line, draft-only application of an explicitly reviewed CCF.
-- No bulk mass-update. Never changes original MRP/system suggestion, approved PRs,
-- manually adjusted lines, indents or stock. Uses canonical audited manual-delta writer.
CREATE OR REPLACE FUNCTION public.proc_pec_ccf_apply_draft_line(
  p_pr_line_id bigint,
  p_expected_effective_qty numeric,
  p_expected_ccf_floor numeric,
  p_expected_stock_as_of date,
  p_reason text,
  p_confirm boolean
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public
AS $fn$
DECLARE
  v_pr_id bigint;
  v_pr_status text;
  v_pr_created timestamptz;
  v_requested numeric;
  v_effective numeric;
  v_delta numeric;
  v_existing_reason text;
  v_preview jsonb;
  v_floor numeric;
  v_source_date date;
  v_review_state text;
  v_pr_number text;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',true);
  IF p_confirm IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit consumption-coverage approval is required';
  END IF;
  IF length(trim(coalesce(p_reason,'')))<20 THEN
    RAISE EXCEPTION 'Provide an audit reason of at least 20 characters';
  END IF;
  IF p_pr_line_id IS NULL OR p_expected_effective_qty IS NULL
      OR p_expected_ccf_floor IS NULL OR p_expected_stock_as_of IS NULL THEN
    RAISE EXCEPTION 'Expected PR line, quantity, floor and stock watermark are required';
  END IF;

  SELECT pl.pr_id INTO v_pr_id FROM public.proc_pr_line pl
    WHERE pl.pr_line_id=p_pr_line_id;
  IF v_pr_id IS NULL THEN RAISE EXCEPTION 'PR line not found'; END IF;

  -- Canonical locking order: header, then line. No stale read is trusted.
  SELECT h.status,h.created_at,h.pr_number
    INTO v_pr_status,v_pr_created,v_pr_number
  FROM public.proc_pr_header h WHERE h.pr_id=v_pr_id FOR UPDATE;
  IF v_pr_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'CCF is editable only on draft PRs';
  END IF;
  SELECT pl.requested_qty,COALESCE(pl.manual_delta_qty,0),
         COALESCE(pl.manual_reason,''),GREATEST(0,pl.requested_qty+COALESCE(pl.manual_delta_qty,0))
    INTO v_requested,v_delta,v_existing_reason,v_effective
  FROM public.proc_pr_line pl
  WHERE pl.pr_line_id=p_pr_line_id AND pl.pr_id=v_pr_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PR line was changed; reopen coverage preview'; END IF;
  IF v_delta<>0 OR v_existing_reason<>'' THEN
    RAISE EXCEPTION 'Manually adjusted PR line requires separate review';
  END IF;
  IF v_effective IS DISTINCT FROM p_expected_effective_qty THEN
    RAISE EXCEPTION 'PR quantity changed; reopen coverage preview';
  END IF;

  SELECT x INTO v_preview FROM public.proc_pec_ccf_pr_preview(v_pr_id) x
  WHERE (x->>'pr_line_id')::bigint=p_pr_line_id;
  IF v_preview IS NULL THEN RAISE EXCEPTION 'Coverage evidence unavailable'; END IF;
  v_review_state := v_preview->>'review_state';
  IF v_review_state IS DISTINCT FROM 'ANCHOR_AND_POLICY_REVIEW' THEN
    RAISE EXCEPTION 'Coverage evidence requires additional review: %',v_review_state;
  END IF;
  IF COALESCE((v_preview->>'months_with_usage')::integer,0)=0 THEN
    RAISE EXCEPTION 'No verified consumption history';
  END IF;
  IF COALESCE((v_preview->>'outstanding_indent_lines')::integer,0)<>0 THEN
    RAISE EXCEPTION 'Outstanding indent reconciliation is required';
  END IF;
  IF (v_preview->>'stock_on_hand')::numeric < 0 THEN
    RAISE EXCEPTION 'Negative stock balance requires review';
  END IF;
  v_source_date := (v_preview->>'stock_as_of')::date;
  IF v_source_date IS NULL OR v_source_date<>p_expected_stock_as_of
      OR v_source_date<>((v_pr_created AT TIME ZONE 'Asia/Kolkata')::date)
      OR v_source_date<>((now() AT TIME ZONE 'Asia/Kolkata')::date) THEN
    RAISE EXCEPTION 'Stock/PR source anchor changed; reopen evidence review';
  END IF;
  v_floor := (v_preview->>'illustrative_ccf_floor')::numeric;
  IF v_floor IS NULL OR v_floor<=v_effective OR v_floor IS DISTINCT FROM p_expected_ccf_floor THEN
    RAISE EXCEPTION 'Coverage floor is stale, unavailable or does not exceed this PR line';
  END IF;
  IF v_floor>1000000000 THEN
    RAISE EXCEPTION 'Coverage quantity exceeds safety threshold; separate review required';
  END IF;

  -- Preserve original system/production MRP suggestion. Audit the CCF increase
  -- as a deliberately accepted manual delta through existing guarded lifecycle.
  PERFORM public.proc_pr_set_manual_delta_pec_internal(
    p_pr_line_id,
    v_floor - v_requested,
    trim(p_reason) || ' [S4 CCF, 12 calendar months, stock-as-of '
      || v_source_date::text || ', approved by ' || auth.uid()::text || ']'
  );
  RETURN jsonb_build_object(
    'pr_id',v_pr_id,'pr_number',v_pr_number,
    'pr_line_id',p_pr_line_id,'previous_effective_qty',v_effective,
    'new_effective_qty',v_floor,'approved_increment',v_floor-v_effective,
    'stock_as_of',v_source_date,'action','CCF_APPROVED_DRAFT_ONLY'
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pec_ccf_apply_draft_line(bigint,numeric,numeric,date,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proc_pec_ccf_apply_draft_line(bigint,numeric,numeric,date,text,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.proc_pec_ccf_apply_draft_line(bigint,numeric,numeric,date,text,boolean) TO authenticated;
