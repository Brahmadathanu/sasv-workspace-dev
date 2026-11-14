-- PEC R10b PROPOSED (forward-only, NOT applied): lock prelude for source-PR reassignment.
-- Created with `supabase migration new`.
--
-- Finding (owner's read-only live inspection): proc_indent_set_source_pr_pec_internal
-- checks indent status and source-PR status BEFORE taking row locks; only its later UPDATE
-- locks the indent. A concurrent approval / PR status flip / Add Line / resync can therefore
-- commit between the check and the write (stale decision, e.g. reassigning an indent that was
-- approved a moment earlier).
--
-- The internal body is NOT in the repository and is deliberately NOT replaced here, so its
-- business rules and audit metadata are preserved byte-for-byte. Instead the public wrapper
-- (the only authenticated entry point; same signature, SECURITY DEFINER, search_path and
-- permission call as the c8a-generated wrapper) takes the locks FIRST, in the project lock
-- order, and then delegates. The internal function's own status checks then run under those
-- locks (READ COMMITTED re-reads the committed row after a lock wait).
--
-- Lock order (consistent with resync / Add Line wrapper / PR writers):
--   1) indent header FOR UPDATE   2) new source PR header FOR SHARE   3) (internal) maps/lines
-- No GRANT/REVOKE is issued: CREATE OR REPLACE retains the existing ACL
-- (authenticated + service_role; anon/PUBLIC denied; internal not executable by authenticated).
-- Rollback: forward migration re-issuing the c8a template wrapper (permission call + delegate).
-- Residual (documented, not claimed fixed): service_role/postgres callers of the internal
-- function bypass this wrapper; table DML is revoked from anon/authenticated by c8a.
BEGIN;

CREATE OR REPLACE FUNCTION public.proc_indent_set_source_pr(p_indent_id bigint, p_pr_id bigint, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.require_permission('module:procurement-execution-console', true);

  -- 1) indent header: same first lock as resync, Add Line and status writers.
  perform 1 from public.proc_indent_header h where h.indent_id = p_indent_id for update;
  -- 2) NEW source PR header: blocks a concurrent PR status change until we commit.
  if p_pr_id is not null then
    perform 1 from public.proc_pr_header p where p.pr_id = p_pr_id for share;
  end if;

  perform public.proc_indent_set_source_pr_pec_internal(p_indent_id, p_pr_id, p_note);
  return;
end
$function$;

COMMIT;
