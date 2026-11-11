-- PEC-ERP-S1: REVIEW-ONLY SQL CANDIDATE (2026-11-11)
-- NOT a Supabase migration. DO NOT RUN on production.
-- Gate: owner-approved G1 contract + isolated PG 17.4 test matrix + exact migration creation.
-- STOP: proc_indent_next_number embeds YYYY-MM in IND numbers. Cross-month
-- draft date edits must not run until owner decides whether to retain the
-- original immutable identifier or enforce same-month edits / renumber safely.
-- This candidate currently permits cross-month edits and is NOT deployable as-is.
-- New endpoints only. Leaves proc_indent_add_line and all historical rows unchanged.
--
-- Entry point 1: proc_indent_update_manual_draft_qty
-- The existing line read view lacks updated_at; use authoritative parent updated_at
-- plus a compare-and-swap expected quantity. Both are validated after row locks.
CREATE OR REPLACE FUNCTION public.proc_indent_update_manual_draft_qty(
    p_indent_line_id bigint,
    p_expected_indent_updated_at timestamptz,
    p_expected_qty numeric,
    p_new_qty numeric,
    p_reason text
) RETURNS TABLE (
    indent_id bigint,
    indent_line_id bigint,
    requested_qty numeric,
    indent_updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $pec_s1_qty$
DECLARE
    v_h public.proc_indent_header%ROWTYPE;
    v_l public.proc_indent_line%ROWTYPE;
    v_reason text := NULLIF(btrim(p_reason), '');
    v_updated_at timestamptz;
BEGIN
    PERFORM public.require_permission('module:procurement-execution-console', true);
    IF p_indent_line_id IS NULL OR p_expected_indent_updated_at IS NULL
       OR p_expected_qty IS NULL OR p_new_qty IS NULL THEN
        RAISE EXCEPTION 'Indent line ID, expected revision/quantity and new quantity are required';
    END IF;
    IF p_new_qty <= 0 OR p_new_qty = 'Infinity'::numeric OR p_new_qty = '-Infinity'::numeric OR p_new_qty = 'NaN'::numeric THEN
        RAISE EXCEPTION 'New quantity must be a finite positive number';
    END IF;
    IF v_reason IS NULL THEN RAISE EXCEPTION 'Edit reason is required'; END IF;

    -- Lock parent first, then child, always in the same order.
    SELECT h.* INTO v_h
    FROM public.proc_indent_header h
    JOIN public.proc_indent_line l ON l.indent_id = h.indent_id
    WHERE l.indent_line_id = p_indent_line_id
    FOR UPDATE OF h;
    IF NOT FOUND THEN RAISE EXCEPTION 'Indent line not found'; END IF;
    IF v_h.status <> 'draft' OR v_h.source_pr_id IS NOT NULL THEN
        RAISE EXCEPTION 'Quantity edits require an independent draft indent';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.proc_pr_to_indent_map m
        WHERE m.indent_id = v_h.indent_id AND m.is_active
    ) THEN RAISE EXCEPTION 'Indent has an active PR link'; END IF;
    IF v_h.updated_at IS DISTINCT FROM p_expected_indent_updated_at THEN
        RAISE EXCEPTION 'Indent changed since it was opened; reload before editing';
    END IF;

    SELECT l.* INTO v_l FROM public.proc_indent_line l
    WHERE l.indent_line_id = p_indent_line_id FOR UPDATE;
    IF v_l.requested_qty IS DISTINCT FROM p_expected_qty THEN
        RAISE EXCEPTION 'Line quantity changed since it was opened; reload before editing';
    END IF;
    -- Draft sourcing decisions may already exist under the current ERP rules.
    -- Changing requested quantity after a vendor is selected needs separate reconciliation.
    IF EXISTS (
        SELECT 1 FROM public.proc_indent_line_sourcing_decision d
        WHERE d.indent_line_id = p_indent_line_id
          AND (d.selected_vendor_id IS NOT NULL OR d.recommended_vendor_id IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'Clear or reconcile existing vendor assignment before changing quantity';
    END IF;
    IF p_new_qty IS NOT DISTINCT FROM v_l.requested_qty THEN
        RAISE EXCEPTION 'Quantity unchanged';
    END IF;

    UPDATE public.proc_indent_line l
    SET requested_qty = p_new_qty,
        manual_reason = v_reason,
        updated_at = GREATEST(clock_timestamp(), v_l.updated_at + interval '1 microsecond')
    WHERE l.indent_line_id = p_indent_line_id;
    -- Existing lifecycle trigger records old/new line and manual_reason.
    v_updated_at := GREATEST(clock_timestamp(), v_h.updated_at + interval '1 microsecond');
    UPDATE public.proc_indent_header h
    SET updated_at = v_updated_at, updated_by = auth.uid()
    WHERE h.indent_id = v_h.indent_id;
    RETURN QUERY SELECT v_h.indent_id, v_l.indent_line_id, p_new_qty, v_updated_at;
END;
$pec_s1_qty$;

CREATE OR REPLACE FUNCTION public.proc_indent_update_manual_draft_date(
    p_indent_id bigint,
    p_expected_indent_updated_at timestamptz,
    p_new_indent_date date,
    p_reason text
) RETURNS TABLE (
    indent_id bigint,
    indent_date date,
    indent_updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $pec_s1_date$
DECLARE
    v_h public.proc_indent_header%ROWTYPE;
    v_reason text := NULLIF(btrim(p_reason), '');
    v_updated_at timestamptz;
BEGIN
    PERFORM public.require_permission('module:procurement-execution-console', true);
    IF p_indent_id IS NULL OR p_expected_indent_updated_at IS NULL OR p_new_indent_date IS NULL THEN
        RAISE EXCEPTION 'Indent ID, expected revision and new indent date are required';
    END IF;
    IF v_reason IS NULL THEN RAISE EXCEPTION 'Edit reason is required'; END IF;

    SELECT h.* INTO v_h FROM public.proc_indent_header h
    WHERE h.indent_id = p_indent_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Indent not found'; END IF;
    IF v_h.status <> 'draft' OR v_h.source_pr_id IS NOT NULL THEN
        RAISE EXCEPTION 'Date edits require an independent draft indent';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.proc_pr_to_indent_map m
        WHERE m.indent_id = p_indent_id AND m.is_active
    ) THEN RAISE EXCEPTION 'Indent has an active PR link'; END IF;
    IF v_h.updated_at IS DISTINCT FROM p_expected_indent_updated_at THEN
        RAISE EXCEPTION 'Indent changed since it was opened; reload before editing';
    END IF;
    IF p_new_indent_date = v_h.indent_date THEN RAISE EXCEPTION 'Indent date unchanged'; END IF;
    v_updated_at := GREATEST(clock_timestamp(), v_h.updated_at + interval '1 microsecond');
    UPDATE public.proc_indent_header h
    SET indent_date = p_new_indent_date, updated_at = v_updated_at, updated_by = auth.uid()
    WHERE h.indent_id = p_indent_id;
    -- Automatic header trigger captures the full old/new row. A distinct reason
    -- event supplements that generic event without changing operator notes.
    PERFORM public.proc_lifecycle_audit_write_internal(
        'INDENT_DRAFT_DATE_REASON', 'indent', p_indent_id, NULL, NULL,
        v_reason,
        jsonb_build_object('indent_date', v_h.indent_date),
        jsonb_build_object('indent_date', p_new_indent_date),
        jsonb_build_object('operation', 'independent_draft_date_change')
    );
    RETURN QUERY SELECT p_indent_id, p_new_indent_date, v_updated_at;
END;
$pec_s1_date$;

-- SECURITY GATE: public SECURITY DEFINER RPCs must not be callable as PUBLIC/anon.
REVOKE ALL ON FUNCTION public.proc_indent_update_manual_draft_qty(bigint,timestamptz,numeric,numeric,text)
    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.proc_indent_update_manual_draft_date(bigint,timestamptz,date,text)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proc_indent_update_manual_draft_qty(bigint,timestamptz,numeric,numeric,text)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.proc_indent_update_manual_draft_date(bigint,timestamptz,date,text)
    TO authenticated, service_role;

-- Mandatory isolated PG 17.4 tests BEFORE migration:
-- 01 View-only and anon denied; editor passes permission check.
-- 02 Draft standalone qty and date edits succeed, updated_at advances.
-- 03 PR-linked draft, approved, issued, closed and cancelled all reject.
-- 04 Active PR map rejects even if header source_pr_id is NULL.
-- 05 Two concurrent editors CAS: first succeeds, second rejects; no lost update.
-- 06 Zero, negative, NaN, infinity quantities; null/blank reason/date reject.
-- 07 Existing vendor recommendation/selection blocks qty edit; no hidden reset.
-- 08 Legacy add-line RPC, ordering, serials, existing exports unchanged.
-- 09 Lifecycle trigger and date-reason event capture actor, old/new, reason.
-- 10 No snapshot refresh request is added for draft-only edits.
-- 11 Rollback: DROP these two new functions after confirming no client callers.
