-- PEC G0 owner-approved prevention of internal/finished-bulk material external procurement via draft PR manual edits.
-- Live definitions captured 2026-11-12. Existing source records untouched.
BEGIN;

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
  where pr_id = p_pr_id;

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
