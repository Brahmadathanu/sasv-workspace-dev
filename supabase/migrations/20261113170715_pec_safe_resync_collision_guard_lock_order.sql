-- PEC R10 (forward-only): SAFE resync collision guard + consistent lock ordering.
-- Created with `supabase migration new`. NOT applied to any live database.
-- Do NOT replay or edit 20261112143000 / 20261112133000; this supersedes their
-- function bodies via CREATE OR REPLACE (ACLs, SECURITY DEFINER and owner retained;
-- no GRANT/REVOKE is issued and none is broadened).
--
-- Lock order (all writers): indent header -> source PR header -> lines (by id).
--   resync(safe|reset): indent header FOR UPDATE, PR header FOR SHARE, indent lines FOR UPDATE
--   proc_indent_add_line wrapper (#374): indent header FOR UPDATE  (unchanged)
--   proc_pr_add_line / proc_pr_set_manual_delta: PR header FOR UPDATE (new), never the indent header
-- No table locks, no isolation change (READ COMMITTED + row locks).
-- Rollback: forward migration restoring the 20261112143000 / 20261112133000 bodies.
BEGIN;

CREATE OR REPLACE FUNCTION public.proc_indent_resync_from_pr_pec_internal(p_indent_id bigint, p_mode text DEFAULT 'safe'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_source_pr_id bigint;
  v_pr_status text;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  if p_mode not in ('safe','reset') then raise exception 'Invalid p_mode %. Use safe or reset', p_mode; end if;

  -- LOCK ORDER (R10): 1) indent header FOR UPDATE, 2) source PR header FOR SHARE,
  -- 3) indent lines FOR UPDATE ordered by id. Same first lock as the guarded
  -- proc_indent_add_line wrapper and proc_indent_set_status, so those writers
  -- block until this transaction ends. PR line writers lock the PR header
  -- FOR UPDATE (see below), so they cannot change PR-final values underneath.
  select h.status, h.source_pr_id
    into v_status, v_source_pr_id
  from public.proc_indent_header h
  where h.indent_id = p_indent_id
  for update;

  if v_status is null then raise exception 'Indent not found'; end if;
  if v_status <> 'draft' then raise exception 'Resync allowed only for draft indents (status=%)', v_status; end if;
  if v_source_pr_id is null then raise exception 'Indent has no source_pr_id set'; end if;

  select status into v_pr_status
  from public.proc_pr_header
  where pr_id = v_source_pr_id
  for share;

  if v_pr_status is null then raise exception 'Source PR not found (pr_id=%)', v_source_pr_id; end if;
  if v_pr_status <> 'active' then raise exception 'Source PR must be active to resync (status=%)', v_pr_status; end if;

  -- Serialize with any line writer that does not honour the header lock
  -- (e.g. service-role internal callers); deterministic order avoids deadlock.
  perform 1
  from public.proc_indent_line il0
  where il0.indent_id = p_indent_id
  order by il0.indent_line_id
  for update;

  -- FULL RESET: delete all indent lines (and mapping rows will cascade if FK is set)
  if p_mode = 'reset' then
    delete from public.proc_indent_line
    where indent_id = p_indent_id;
  end if;

  -- Materialize PR final quantities (non-zero only)
  create temp table if not exists _pr_final_lines (
    material_class_id bigint,
    stock_item_id bigint,
    uom_id bigint,
    final_qty numeric(20,6),
    manual_reason text,
    pr_line_id bigint
  ) on commit drop;

  truncate table _pr_final_lines;

  insert into _pr_final_lines(material_class_id, stock_item_id, uom_id, final_qty, manual_reason, pr_line_id)
  select
    l.material_class_id,
    l.stock_item_id,
    l.uom_id,
    (coalesce(l.requested_qty,0) + coalesce(l.manual_delta_qty,0))::numeric(20,6) as final_qty,
    nullif(btrim(l.manual_reason),'') as manual_reason,
    l.pr_line_id
  from public.proc_pr_line l
  join public.v_inv_stock_item_with_class sic on sic.stock_item_id=l.stock_item_id
  where sic.active=true
    and (l.material_class_id<>1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'))
    and l.pr_id = v_source_pr_id
    and (coalesce(l.requested_qty,0) + coalesce(l.manual_delta_qty,0)) > 0;

  -- R10 SAFE collision guard (policy R8/R9): fail closed, BEFORE any business
  -- write, when an UNMAPPED indent line shares the (class,item,UOM) identity of a
  -- positive source-PR line but differs in requested_qty or normalized reason.
  -- RESET is intentionally excluded (explicitly destructive, UI-confirmed).
  if p_mode = 'safe' and exists (
    select 1
    from public.proc_indent_line il
    join _pr_final_lines pfl
      on pfl.material_class_id = il.material_class_id
     and pfl.stock_item_id = il.stock_item_id
     and pfl.uom_id = il.uom_id
    where il.indent_id = p_indent_id
      and (il.requested_qty is distinct from pfl.final_qty
        or nullif(btrim(il.manual_reason),'') is distinct from pfl.manual_reason)
      and not exists (
        select 1 from public.proc_pr_indent_line_map m
        where m.indent_id = p_indent_id
          and m.indent_line_id = il.indent_line_id)
  ) then
    raise exception 'SAFE resync manual/PR quantity or reason collision; explicit resolution required'
      using errcode = '23514';
  end if;

  -- SAFE: update existing indent lines to match PR final qty
  update public.proc_indent_line il
  set
    requested_qty = pfl.final_qty,
    manual_reason = pfl.manual_reason,
    updated_at = now()
  from _pr_final_lines pfl
  where il.indent_id = p_indent_id
    and il.material_class_id = pfl.material_class_id
    and il.stock_item_id = pfl.stock_item_id
    and il.uom_id = pfl.uom_id;

  -- Insert missing lines
  insert into public.proc_indent_line(
    indent_id, material_class_id, stock_item_id, uom_id, requested_qty, manual_reason
  )
  select
    p_indent_id,
    pfl.material_class_id,
    pfl.stock_item_id,
    pfl.uom_id,
    pfl.final_qty,
    pfl.manual_reason
  from _pr_final_lines pfl
  where not exists (
    select 1
    from public.proc_indent_line il
    where il.indent_id = p_indent_id
      and il.material_class_id = pfl.material_class_id
      and il.stock_item_id = pfl.stock_item_id
      and il.uom_id = pfl.uom_id
  );

  -- Delete lines that are no longer present in PR final lines (delete-on-zero behavior)
  delete from public.proc_indent_line il
  where il.indent_id = p_indent_id
    -- SAFE preserves deliberate manually added lines not mapped to a PR.
    -- RESET has already removed every previous indent line above.
    and exists (
      select 1 from public.proc_pr_indent_line_map m
      where m.indent_id=p_indent_id and m.indent_line_id=il.indent_line_id
    )
    and not exists (
      select 1 from _pr_final_lines pfl
      where pfl.material_class_id = il.material_class_id
        and pfl.stock_item_id = il.stock_item_id
        and pfl.uom_id = il.uom_id
    );

  -- Update PR→Indent mapping history: deactivate old active, activate new link
  update public.proc_pr_to_indent_map
  set is_active = false, unlinked_at = now(), note = 'superseded by resync'
  where indent_id = p_indent_id
    and is_active = true;

  insert into public.proc_pr_to_indent_map(pr_id, indent_id, created_by, is_active, linked_at, note)
  values (v_source_pr_id, p_indent_id, auth.uid(), true, now(), 'resynced indent from PR');

  -- Rebuild line-level mapping
  delete from public.proc_pr_indent_line_map
  where indent_id = p_indent_id;

  insert into public.proc_pr_indent_line_map(indent_id, indent_line_id, pr_id, pr_line_id)
  select
    p_indent_id,
    il.indent_line_id,
    v_source_pr_id,
    pfl.pr_line_id
  from public.proc_indent_line il
  join _pr_final_lines pfl
    on pfl.material_class_id = il.material_class_id
   and pfl.stock_item_id = il.stock_item_id
   and pfl.uom_id = il.uom_id
  where il.indent_id = p_indent_id;

  update public.proc_indent_header
  set updated_at = now(), updated_by = auth.uid()
  where indent_id = p_indent_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.proc_pr_add_line_pec_internal(p_pr_id bigint, p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_requested_qty numeric DEFAULT 0, p_reason text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
declare
  v_kind text;
  v_line_id bigint;
  v_status text;
begin
  if p_pr_id is null then raise exception 'p_pr_id is required'; end if;
  if p_material_class_id is null then raise exception 'p_material_class_id is required'; end if;
  if p_stock_item_id is null then raise exception 'p_stock_item_id is required'; end if;
  if p_uom_id is null then raise exception 'p_uom_id is required'; end if;

  select status into v_status
  from public.proc_pr_header
  where pr_id = p_pr_id
  for update;

  if v_status is null then raise exception 'PR not found: %', p_pr_id; end if;
  if v_status <> 'draft' then
    raise exception 'PR is not editable in status %', v_status;
  end if;

  -- Internal bulk/semi-finished materials cannot gain a positive new or
  -- increased external PR commitment. Legacy draft reductions remain possible.
  IF p_material_class_id=1 AND EXISTS (
    SELECT 1 FROM public.v_inv_stock_item_with_class sic
    WHERE sic.stock_item_id=p_stock_item_id
      AND sic.subcategory_code IN ('finished_bulk_material','semifinished_goods')
  ) THEN
    IF coalesce(p_requested_qty,0) > coalesce((
      SELECT l.requested_qty FROM public.proc_pr_line l
      WHERE l.pr_id=p_pr_id AND l.material_class_id=p_material_class_id
        AND l.stock_item_id=p_stock_item_id AND l.uom_id=p_uom_id
      FOR UPDATE
    ),0) AND coalesce(p_requested_qty,0)>0 THEN
      RAISE EXCEPTION 'New or increased external PR quantity is prohibited for internal finished-bulk/semi-finished stock item %',p_stock_item_id;
    END IF;
  END IF;

  v_kind := public.proc_material_kind_for_class(p_material_class_id);

  insert into public.proc_pr_line (
    pr_id,
    material_class_id,
    material_kind,
    stock_item_id,
    uom_id,
    system_suggested_qty,
    requested_qty,
    manual_delta_qty,
    manual_reason
  )
  values (
    p_pr_id,
    p_material_class_id,
    v_kind,
    p_stock_item_id,
    p_uom_id,
    0,
    coalesce(p_requested_qty, 0),
    0,
    nullif(trim(p_reason), '')
  )
  on conflict (pr_id, material_class_id, stock_item_id, uom_id)
  do update set
    material_class_id = excluded.material_class_id,
    requested_qty     = excluded.requested_qty,
    manual_reason     = coalesce(excluded.manual_reason, public.proc_pr_line.manual_reason),
    updated_at        = now()
  returning pr_line_id into v_line_id;

  update public.proc_pr_header
  set updated_at = now(), updated_by = auth.uid()
  where pr_id = p_pr_id;

  return v_line_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.proc_pr_set_manual_delta_pec_internal(p_pr_line_id bigint, p_manual_delta_qty numeric, p_manual_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
declare
  v_pr_id bigint;
  v_status text;
begin
  if p_pr_line_id is null then
    raise exception 'p_pr_line_id is required';
  end if;

  select l.pr_id, h.status
  into v_pr_id, v_status
  from public.proc_pr_line l
  join public.proc_pr_header h on h.pr_id = l.pr_id
  where l.pr_line_id = p_pr_line_id;

  if v_pr_id is null then
    raise exception 'PR line not found: %', p_pr_line_id;
  end if;

  -- R10: lock the PR header first (same order as proc_pr_add_line and as the
  -- SAFE resync's PR-header share lock), then re-read status under the lock.
  select h.status into v_status
  from public.proc_pr_header h
  where h.pr_id = v_pr_id
  for update;

  if not exists (select 1 from public.proc_pr_line where pr_line_id = p_pr_line_id) then
    raise exception 'PR line not found: %', p_pr_line_id;
  end if;

  if v_status <> 'draft' then
    raise exception 'PR is not editable in status %', v_status;
  end if;

  -- For an internal material's legacy draft PR line, permit only an
  -- unchanged or decreased final quantity (requested_qty + manual_delta_qty).
  IF EXISTS (
    SELECT 1 FROM public.proc_pr_line l
    JOIN public.v_inv_stock_item_with_class sic ON sic.stock_item_id=l.stock_item_id
    WHERE l.pr_line_id=p_pr_line_id AND l.material_class_id=1
      AND sic.subcategory_code IN ('finished_bulk_material','semifinished_goods')
      AND (coalesce(l.requested_qty,0)+coalesce(p_manual_delta_qty,0))
          > (coalesce(l.requested_qty,0)+coalesce(l.manual_delta_qty,0))
      AND (coalesce(l.requested_qty,0)+coalesce(p_manual_delta_qty,0))>0
  ) THEN
    RAISE EXCEPTION 'New or increased external PR manual quantity prohibited for internal finished-bulk/semi-finished stock item';
  END IF;

  update public.proc_pr_line
  set
    manual_delta_qty = coalesce(p_manual_delta_qty, 0),
    manual_reason    = nullif(trim(p_manual_reason), ''),
    updated_at       = now()
  where pr_line_id = p_pr_line_id;

  update public.proc_pr_header
  set updated_at = now(), updated_by = auth.uid()
  where pr_id = v_pr_id;
end;
$function$;
COMMIT;
