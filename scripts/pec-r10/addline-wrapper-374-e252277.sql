-- PEC R2: prohibit NEW indent lines except on draft manual/non-PR indents.
-- Review-only migration: NEVER replay production-applied earlier 20261112* SQL.
-- Source of truth before change (12 Nov): proc_indent_add_line is SECURITY DEFINER
-- and requires module:procurement-execution-console Edit. Its internal implementation
-- permits approved/issued with reason and UPSERTS on the indent+class+item+UOM key.
--
-- Preserve the internal function and existing-line corrections. The wrapper is
-- the only authenticated entry point; internal proc_indent_add_line_pec_internal
-- has no authenticated/anon EXECUTE. Service-role internal callers are separately
-- privileged and remain outside this UX contract.
--
-- Rollback (only by a separately authorized new forward migration): restore the
-- previous wrapper definition from current schema, do not drop the function.
CREATE OR REPLACE FUNCTION public.proc_indent_add_line(
  p_indent_id bigint,
  p_material_class_id bigint,
  p_stock_item_id bigint,
  p_uom_id bigint,
  p_requested_qty numeric DEFAULT 0,
  p_reason text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_source_pr_id bigint;
  v_line_exists boolean;
BEGIN
  PERFORM public.require_permission('module:procurement-execution-console', 't');

  -- Serialize this wrapper's status/identity check with lifecycle transitions.
  -- Existing-line updates stay delegated to the established internal writer.
  SELECT h.status, h.source_pr_id
    INTO v_status, v_source_pr_id
    FROM public.proc_indent_header h
   WHERE h.indent_id = p_indent_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indent not found: %', p_indent_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.proc_indent_line l
     WHERE l.indent_id = p_indent_id
       AND l.material_class_id = p_material_class_id
       AND l.stock_item_id = p_stock_item_id
       AND l.uom_id = p_uom_id
  ) INTO v_line_exists;

  -- The legacy "add line" RPC is an UPSERT. Do not mistake an allowed
  -- governed existing-line correction (which requires a reason when approved
  -- or issued) for permission to create another line after approval.
  IF NOT v_line_exists AND (v_status <> 'draft' OR v_source_pr_id IS NOT NULL) THEN
    RAISE EXCEPTION
      'New indent lines are allowed only for draft manual/non-PR indents (status %, PR linked %)',
      v_status, (v_source_pr_id IS NOT NULL)
      USING ERRCODE = '23514';
  END IF;

  RETURN public.proc_indent_add_line_pec_internal(
    p_indent_id,
    p_material_class_id,
    p_stock_item_id,
    p_uom_id,
    p_requested_qty,
    p_reason
  );
END;
$function$;

-- CREATE OR REPLACE retains the existing pg_proc identity/ACL. Do not issue
-- broad GRANTs: only prior authenticated EXECUTE is intended; anon remains denied.
