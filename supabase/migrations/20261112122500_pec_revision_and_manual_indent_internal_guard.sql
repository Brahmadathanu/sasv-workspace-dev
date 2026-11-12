-- PEC G0 forward-only exclusion: owner policy that semi-finished and finished-bulk
-- are internal materials, not external procurement candidates.
-- Applied live on 2026-11-12; captured verbatim here for source-control parity.
-- Existing approved/active PR and indent data is NOT mutated by this migration.
BEGIN;
CREATE OR REPLACE FUNCTION public.proc_pr_create_revision_from_active_pec_internal(p_pr_id bigint, p_notes text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_base_pr_number text;
  v_root_pr_id bigint;
  v_prev_pr_id bigint;
  v_next_rev int;
  v_new_pr_id bigint;
  v_new_pr_number text;
  v_hdr record;
begin
  if p_pr_id is null then raise exception 'p_pr_id is required'; end if;

  select * into v_hdr
  from public.proc_pr_header
  where pr_id = p_pr_id;

  if v_hdr.pr_id is null then raise exception 'PR not found'; end if;
  if v_hdr.status <> 'active' then raise exception 'Revision can be created only from active PR (status=%)', v_hdr.status; end if;

  v_base_pr_number := v_hdr.pr_number;

  -- Determine root + previous PR in chain
  select root_pr_id into v_root_pr_id
  from public.proc_pr_revision_map
  where pr_id = p_pr_id;

  if v_root_pr_id is null then
    v_root_pr_id := p_pr_id;
  end if;

  select max(revision_no) into v_next_rev
  from public.proc_pr_revision_map
  where root_pr_id = v_root_pr_id;

  v_next_rev := coalesce(v_next_rev, 0) + 1;

  v_new_pr_number := public.proc_pr_next_revision_number(v_base_pr_number, v_next_rev);

  -- Create new PR header as draft (copy key fields)
  insert into public.proc_pr_header(
    pr_number, status, effective_from_date, horizon_start_month, horizon_end_month,
    material_class_id, generation_filters, notes, created_by, updated_by
  )
  values(
    v_new_pr_number,
    'draft',
    v_hdr.effective_from_date,
    v_hdr.horizon_start_month,
    v_hdr.horizon_end_month,
    v_hdr.material_class_id,
    coalesce(v_hdr.generation_filters,'{}'::jsonb) || jsonb_build_object(
      'source','proc_pr_create_revision_from_active',
      'source_pr_id', p_pr_id,
      'source_pr_number', v_base_pr_number,
      'revision_no', v_next_rev
    ),
    nullif(trim(coalesce(p_notes, v_hdr.notes)), ''),
    auth.uid(), auth.uid()
  )
  returning pr_id into v_new_pr_id;

  -- Copy lines
  insert into public.proc_pr_line(
    pr_id, material_class_id, stock_item_id, uom_id,
    system_suggested_qty, requested_qty, manual_delta_qty, manual_reason
  )
  select
    v_new_pr_id,
    l.material_class_id,
    l.stock_item_id,
    l.uom_id,
    l.system_suggested_qty,
    l.requested_qty,
    l.manual_delta_qty,
    l.manual_reason
  from public.proc_pr_line l
  join public.v_inv_stock_item_with_class sic on sic.stock_item_id=l.stock_item_id
  where l.pr_id = p_pr_id
    and sic.active = true
    and (l.material_class_id <> 1 or sic.subcategory_code not in ('finished_bulk_material','semifinished_goods'));

  -- Insert revision map row (supersedes = the PR you revised from)
  insert into public.proc_pr_revision_map(root_pr_id, pr_id, supersedes_pr_id, revision_no)
  values (v_root_pr_id, v_new_pr_id, p_pr_id, v_next_rev);

  return v_new_pr_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.proc_indent_add_line_pec_internal(p_indent_id bigint, p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_requested_qty numeric DEFAULT 0, p_reason text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'public', 'pg_temp'
AS $function$
declare
  v_line_id bigint;
  v_status text;
  v_reason text;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  if p_material_class_id is null then raise exception 'p_material_class_id is required'; end if;
  if p_stock_item_id is null then raise exception 'p_stock_item_id is required'; end if;
  if p_uom_id is null then raise exception 'p_uom_id is required'; end if;

  select status into v_status from public.proc_indent_header where indent_id=p_indent_id;
  if v_status is null then raise exception 'Indent not found: %',p_indent_id; end if;
  if v_status in ('closed','cancelled') then raise exception 'Indent is not editable in status %',v_status; end if;

  -- For internal/finished bulk items, permit only existing line reductions or
  -- unchanged quantities. Do not create or increase external commitments.
  IF EXISTS (
    SELECT 1 FROM public.v_inv_stock_item_with_class sic
    WHERE sic.stock_item_id=p_stock_item_id
      AND sic.subcategory_code IN ('finished_bulk_material','semifinished_goods')
  ) THEN
    IF coalesce(p_requested_qty,0) > coalesce((
      SELECT il.requested_qty FROM public.proc_indent_line il
      WHERE il.indent_id=p_indent_id AND il.material_class_id=p_material_class_id
        AND il.stock_item_id=p_stock_item_id AND il.uom_id=p_uom_id
      FOR UPDATE
    ),0) AND coalesce(p_requested_qty,0)>0 THEN
      RAISE EXCEPTION 'New or increased external procurement indent quantity is prohibited for internal finished-bulk/semi-finished stock item %',p_stock_item_id;
    END IF;
  END IF;

  v_reason:=nullif(trim(p_reason),'');
  if v_status in ('approved','issued') and v_reason is null then
    raise exception 'Reason is required to modify an indent in status %',v_status;
  end if;

  insert into public.proc_indent_line(indent_id,material_class_id,stock_item_id,uom_id,requested_qty,manual_reason)
  values(p_indent_id,p_material_class_id,p_stock_item_id,p_uom_id,coalesce(p_requested_qty,0),v_reason)
  on conflict(indent_id,material_class_id,stock_item_id,uom_id)
  do update set requested_qty=excluded.requested_qty,
                manual_reason=coalesce(excluded.manual_reason,public.proc_indent_line.manual_reason),
                updated_at=now()
  returning indent_line_id into v_line_id;

  update public.proc_indent_header set updated_at=now(),updated_by=auth.uid() where indent_id=p_indent_id;

  if v_status in ('approved','issued') then
    perform public.proc_request_snapshot_refresh('indent_line_changed');
  end if;

  return v_line_id;
end;
$function$;
COMMIT;
