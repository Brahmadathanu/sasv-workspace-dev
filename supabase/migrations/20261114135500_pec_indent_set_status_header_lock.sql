-- PEC R-2 (issue #412) — forward-only, PROPOSED, NOT applied to any live database.
-- Approval race: proc_indent_set_status_pec_internal reads the indent status and counts its lines WITHOUT
-- locking the header, then UPDATEs the header. A SAFE/RESET resync (R10: header FOR UPDATE first) that
-- empties a draft indent can commit between the count and the UPDATE, leaving an APPROVED indent with
-- ZERO lines (reproduced on PG17 with this exact live body, scripts/pec-r10/risk-characterization.sh R2a).
--
-- Correction: ONE token. The first read of the header now takes FOR UPDATE, so the status check, the
-- line-count decision and the UPDATE all happen under the header row lock, in the project lock order
-- (indent header first, then the snapshot-refresh advisory lock the function already takes last).
-- Everything else is byte-identical to the live body (md5 052dfcbd06e19746213aaada2b588036 before this
-- change): signature, SECURITY DEFINER, search_path, error codes and messages, audit-relevant UPDATEs,
-- snapshot refresh calls. No GRANT/REVOKE: CREATE OR REPLACE retains the existing ACL. The public wrapper
-- proc_indent_set_status (permission gate) is not touched.
-- Rollback: forward migration re-issuing the previous body (drop the two words " for update").
BEGIN;

CREATE OR REPLACE FUNCTION public.proc_indent_set_status_pec_internal(p_indent_id bigint, p_status text, p_approved_date date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old text;
  v_new text;
  v_existing_approved_date date;
  v_line_count bigint;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  if p_status is null then raise exception 'p_status is required'; end if;
  v_new := lower(trim(p_status));

  select status, approved_date into v_old, v_existing_approved_date
  from public.proc_indent_header where indent_id = p_indent_id for update;
  if v_old is null then raise exception 'Indent not found: %', p_indent_id; end if;
  if v_old in ('cancelled','closed') then raise exception 'Cannot change status from %', v_old; end if;

  if v_new = 'approved' then
    if v_old <> 'draft' then raise exception 'Only draft indents can be approved'; end if;
    select count(*) into v_line_count from public.proc_indent_line where indent_id = p_indent_id;
    if coalesce(v_line_count,0)=0 then raise exception 'Cannot approve indent without lines'; end if;

    update public.proc_indent_header
    set status='approved',
        approved_date=coalesce(v_existing_approved_date,coalesce(p_approved_date,current_date)),
        approved_at=now(), updated_at=now(), updated_by=auth.uid()
    where indent_id=p_indent_id;

    perform public.proc_request_snapshot_refresh('indent_approved');
    return;
  end if;

  if v_new = 'issued' then
    if v_old <> 'approved' then raise exception 'Only approved indents can be issued'; end if;
    update public.proc_indent_header
    set status='issued', issued_date=current_date, updated_at=now(), updated_by=auth.uid()
    where indent_id=p_indent_id;
    return;
  end if;

  if v_new = 'closed' then
    if v_old not in ('approved','issued') then raise exception 'Only approved/issued indents can be closed'; end if;
    update public.proc_indent_header set status='closed',updated_at=now(),updated_by=auth.uid()
    where indent_id=p_indent_id;
    perform public.proc_request_snapshot_refresh('indent_closed');
    return;
  end if;

  if v_new = 'cancelled' then
    update public.proc_indent_header set status='cancelled',updated_at=now(),updated_by=auth.uid()
    where indent_id=p_indent_id;
    perform public.proc_request_snapshot_refresh('indent_cancelled');
    return;
  end if;

  raise exception 'Unsupported status %', v_new;
end;
$function$;
COMMIT;
