-- PEC original issue #284: DRAFT CONTRACT PROPOSAL ONLY.
-- Do NOT apply this script to production, migration history, or a shared environment.
-- Await independent policy approval, SQL validation in disposable PG clone,
-- true editor/VIEW/no-access JWT, trigger verification and client integration.
-- This is intentionally kept under scripts/, NOT supabase/migrations/.
--
-- Candidate public writer contracts:
--   proc_indent_update_draft_date(id, new_date, expected_date, reason)
--   proc_indent_update_draft_manual_line_qty(id, new_qty, expected_qty, reason)
--
-- Authorization uses the existing PEC 't' edit permission and genuine auth.uid.
-- Existing AFTER UPDATE triggers add generic lifecycle events; these writers
-- separately record the operator-supplied reason in the same transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.proc_indent_update_draft_date(
    p_indent_id bigint,
    p_indent_date date,
    p_expected_date date,
    p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_header public.proc_indent_header%ROWTYPE;
  v_after jsonb;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console','t');
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PEC draft date: authenticated user session required';
  END IF;
  IF p_indent_date IS NULL OR p_expected_date IS NULL THEN
    RAISE EXCEPTION 'PEC draft date: new and expected dates are required';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'PEC draft date: reason must contain 1 to 500 characters';
  END IF;

  SELECT * INTO v_header
    FROM public.proc_indent_header h
   WHERE h.indent_id = p_indent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEC draft date: indent not found'; END IF;
  IF v_header.status <> 'draft' OR v_header.source_pr_id IS NOT NULL
     OR v_header.approved_at IS NOT NULL OR v_header.approved_date IS NOT NULL
     OR v_header.issued_date IS NOT NULL THEN
    RAISE EXCEPTION 'PEC draft date: only independent unapproved manual drafts may be edited';
  END IF;
  IF EXISTS (SELECT 1 FROM public.proc_pr_to_indent_map m WHERE m.indent_id = p_indent_id)
     OR EXISTS (SELECT 1 FROM public.proc_pr_indent_line_map m WHERE m.indent_id = p_indent_id) THEN
    RAISE EXCEPTION 'PEC draft date: PR-linked indent is not editable';
  END IF;
  IF v_header.indent_date IS DISTINCT FROM p_expected_date THEN
    RAISE EXCEPTION 'PEC draft date: stale expected date; reload before saving';
  END IF;
  IF v_header.indent_date = p_indent_date THEN
    RETURN;
  END IF;

  UPDATE public.proc_indent_header
     SET indent_date = p_indent_date,
         updated_at = clock_timestamp(),
         updated_by = auth.uid()
   WHERE indent_id = p_indent_id;
  SELECT to_jsonb(h) INTO v_after
    FROM public.proc_indent_header h WHERE h.indent_id = p_indent_id;
  PERFORM public.proc_lifecycle_audit_write_internal(
    'INDENT_DRAFT_DATE_EDITED','indent',p_indent_id,
    NULL,NULL,btrim(p_reason),to_jsonb(v_header),v_after,
    jsonb_build_object('source','PEC','operation','draft-date-edit')
  );
END
$function$;

REVOKE ALL ON FUNCTION public.proc_indent_update_draft_date(bigint,date,date,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_update_draft_date(bigint,date,date,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proc_indent_update_draft_manual_line_qty(
    p_indent_line_id bigint,
    p_requested_qty numeric,
    p_expected_qty numeric,
    p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_header public.proc_indent_header%ROWTYPE;
  v_line public.proc_indent_line%ROWTYPE;
  v_indent_id bigint;
  v_after jsonb;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console','t');
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'PEC manual quantity: authenticated user session required';
  END IF;
  IF p_requested_qty IS NULL OR p_requested_qty::text IN ('NaN','Infinity','-Infinity')
     OR p_requested_qty <= 0
     OR p_expected_qty IS NULL OR p_expected_qty::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'PEC manual quantity: positive finite requested and expected quantities required';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'PEC manual quantity: reason must contain 1 to 500 characters';
  END IF;

  SELECT l.indent_id INTO v_indent_id
    FROM public.proc_indent_line l WHERE l.indent_line_id = p_indent_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEC manual quantity: indent line not found'; END IF;
  SELECT * INTO v_header
    FROM public.proc_indent_header h
   WHERE h.indent_id = v_indent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEC manual quantity: indent header missing'; END IF;
  SELECT * INTO v_line
    FROM public.proc_indent_line l
   WHERE l.indent_line_id = p_indent_line_id AND l.indent_id = v_indent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PEC manual quantity: line moved or unavailable'; END IF;

  IF v_header.status <> 'draft' OR v_header.source_pr_id IS NOT NULL
     OR v_header.approved_at IS NOT NULL OR v_header.approved_date IS NOT NULL
     OR v_header.issued_date IS NOT NULL THEN
    RAISE EXCEPTION 'PEC manual quantity: only independent unapproved manual drafts may be edited';
  END IF;
  IF EXISTS (SELECT 1 FROM public.proc_pr_to_indent_map m WHERE m.indent_id = v_indent_id)
     OR EXISTS (SELECT 1 FROM public.proc_pr_indent_line_map m WHERE m.indent_id = v_indent_id OR m.indent_line_id = p_indent_line_id) THEN
    RAISE EXCEPTION 'PEC manual quantity: PR-linked line/header is not editable';
  END IF;
  IF v_line.requested_qty IS DISTINCT FROM p_expected_qty THEN
    RAISE EXCEPTION 'PEC manual quantity: stale expected quantity; reload before saving';
  END IF;
  -- Do not change quantities after supplier selection or purchase allocation.
  IF EXISTS (
    SELECT 1 FROM public.proc_indent_line_sourcing_decision s
     WHERE s.indent_line_id = p_indent_line_id AND s.selected_vendor_id IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.v_proc_indent_line_balance b
     WHERE b.indent_line_id = p_indent_line_id AND coalesce(b.allocated_qty,0) <> 0
  ) OR EXISTS (
    SELECT 1 FROM public.v_proc_indent_fifo_allocation a
     WHERE a.indent_line_id = p_indent_line_id AND coalesce(a.allocated_qty,0) <> 0
  ) THEN
    RAISE EXCEPTION 'PEC manual quantity: sourcing or purchase allocation already exists';
  END IF;
  IF v_line.requested_qty = p_requested_qty THEN RETURN; END IF;

  UPDATE public.proc_indent_line
     SET requested_qty = p_requested_qty,
         updated_at = clock_timestamp()
   WHERE indent_line_id = p_indent_line_id;
  SELECT to_jsonb(l) INTO v_after
    FROM public.proc_indent_line l WHERE l.indent_line_id = p_indent_line_id;
  PERFORM public.proc_lifecycle_audit_write_internal(
    'INDENT_DRAFT_MANUAL_QTY_EDITED','indent_line',p_indent_line_id,
    'indent',v_indent_id,btrim(p_reason),to_jsonb(v_line),v_after,
    jsonb_build_object('source','PEC','operation','draft-manual-quantity-edit')
  );
END
$function$;

REVOKE ALL ON FUNCTION public.proc_indent_update_draft_manual_line_qty(bigint,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_update_draft_manual_line_qty(bigint,numeric,numeric,text) TO authenticated, service_role;

-- Candidate DDL is deliberately rolled back if this file is executed as-is.
-- Never remove ROLLBACK before contract signoff and controlled migration creation.
ROLLBACK;
