-- PEC S5 candidate B: server-side default for draft PR manual quantity adjustments.
-- NOT A DEPLOYABLE MIGRATION. Integrate with the complete S5 release package.
-- Wrapper only; preserves R10 header-lock, draft-only and internal-material restrictions
-- in proc_pr_set_manual_delta_pec_internal. Avoids recording an invented procurement rationale.
CREATE OR REPLACE FUNCTION public.proc_pr_set_manual_delta(
  p_pr_line_id bigint, p_manual_delta_qty numeric,
  p_manual_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public AS $fn$
DECLARE
  v_old_final numeric;
  v_new_final numeric;
  v_base numeric;
  v_note text := nullif(btrim(p_manual_reason),'');
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console',true);

  IF p_pr_line_id IS NULL THEN
    RAISE EXCEPTION 'PR line id is required';
  END IF;
  SELECT l.requested_qty + l.manual_delta_qty,
         l.requested_qty + coalesce(p_manual_delta_qty,0),
         l.requested_qty
    INTO v_old_final,v_new_final,v_base
  FROM public.proc_pr_line l
  WHERE l.pr_line_id=p_pr_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PR line not found'; END IF;
  IF v_new_final<0 THEN RAISE EXCEPTION 'Final PR quantity cannot be negative'; END IF;

  IF coalesce(p_manual_delta_qty,0)<>0 AND v_note IS NULL THEN
    v_note := format('Manual quantity adjustment during PR review: %s to %s.',
                       v_old_final,v_new_final);
  END IF;
  -- Deliberately delegate the authoritative header lock, stale-status recheck,
  -- prohibited internal RM material increase, actual update and audit trigger.
  PERFORM public.proc_pr_set_manual_delta_pec_internal(
    p_pr_line_id,p_manual_delta_qty,v_note
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.proc_pr_set_manual_delta(bigint,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.proc_pr_set_manual_delta(bigint,numeric,text) TO authenticated;
