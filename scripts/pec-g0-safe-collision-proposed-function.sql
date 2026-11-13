-- PROPOSED PEC R9 prospective SAFE quantity-collision guard; NOT deployed.
-- RESET retains its explicitly destructive rebuild semantics.
-- Forward-only proposal source, retaining the #317 function except bounded collision precondition.
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

  select h.status, h.source_pr_id
    into v_status, v_source_pr_id
  from public.proc_indent_header h
  where h.indent_id = p_indent_id;

  if v_status is null then raise exception 'Indent not found'; end if;
  if v_status <> 'draft' then raise exception 'Resync allowed only for draft indents (status=%)', v_status; end if;
  if v_source_pr_id is null then raise exception 'Indent has no source_pr_id set'; end if;

  select status into v_pr_status
  from public.proc_pr_header
  where pr_id = v_source_pr_id;

  if v_pr_status is null then raise exception 'Source PR not found (pr_id=%)', v_source_pr_id; end if;
  if v_pr_status <> 'active' then raise exception 'Source PR must be active to resync (status=%)', v_pr_status; end if;

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

  -- PEC R9 PROPOSED: fail closed when an unmapped indent line has a
  -- positive source PR identity with a different requested quantity.
  -- No business writes occur before this check in SAFE mode.
  IF p_mode = 'safe' AND EXISTS (
    SELECT 1 FROM public.proc_indent_line il
    JOIN _pr_final_lines pfl
      ON pfl.material_class_id = il.material_class_id
     AND pfl.stock_item_id = il.stock_item_id
     AND pfl.uom_id = il.uom_id
    WHERE il.indent_id = p_indent_id
      AND il.requested_qty IS DISTINCT FROM pfl.final_qty
      AND NOT EXISTS (
        SELECT 1 FROM public.proc_pr_indent_line_map m
        WHERE m.indent_id = p_indent_id
          AND m.indent_line_id = il.indent_line_id
      )
  ) THEN
    RAISE EXCEPTION 'SAFE resync manual/PR quantity collision; explicit resolution required'
      USING ERRCODE = '23514';
  END IF;

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
COMMIT;
