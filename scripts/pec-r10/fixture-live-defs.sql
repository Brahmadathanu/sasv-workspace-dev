-- Function DEFINITIONS copied read-only from the live catalog on 14 Nov 2026 (no data), so that the F4
-- characterisation runs the REAL logic of the approval and vendor bulk writers inside a disposable
-- fixture. Parity is asserted by scripts/pec-r10/risk-characterization.sh (md5 of each body):
--   proc_indent_set_status_pec_internal                         052dfcbd06e19746213aaada2b588036
--   proc_apply_vendor_to_same_item_lines_pec_internal           547b5348a0808f99dde8c5ff23533a16
--   proc_clear_vendor_assignment_for_same_item_lines_pec_internal c6be0665c3906b9c37da8adcc755bedc
-- NEVER run against production; these are test-fixture copies only.
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
  from public.proc_indent_header where indent_id = p_indent_id;
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

CREATE OR REPLACE FUNCTION public.proc_apply_vendor_to_same_item_lines_pec_internal(p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_vendor_id bigint, p_rate_value numeric, p_reason text, p_include_cleared boolean DEFAULT false)
 RETURNS TABLE(affected_line_count integer, affected_indent_count integer, total_qty numeric, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reason text;
  v_vendor_active boolean;
  v_count integer := 0;
  v_indent_count integer := 0;
  v_total_qty numeric := 0;
begin
  if p_material_class_id is null then
    raise exception 'Material class is required';
  end if;

  if p_stock_item_id is null then
    raise exception 'Stock item is required';
  end if;

  if p_uom_id is null then
    raise exception 'UOM is required';
  end if;

  if p_vendor_id is null then
    raise exception 'Vendor is required';
  end if;

  /*
   * A missing rate is a valid rate-pending procurement decision.
   * A supplied rate must still be strictly positive.
   */
  if p_rate_value is not null and p_rate_value <= 0 then
    raise exception 'Rate must be greater than zero when provided';
  end if;

  v_reason := nullif(trim(p_reason), '');

  if v_reason is null then
    raise exception 'Reason is required';
  end if;

  select v.is_active
  into v_vendor_active
  from public.proc_vendor v
  where v.vendor_id = p_vendor_id;

  if v_vendor_active is null then
    raise exception 'Vendor not found: %', p_vendor_id;
  end if;

  if v_vendor_active = false then
    raise exception 'Vendor is inactive and cannot be assigned: %', p_vendor_id;
  end if;

  if not exists (
    select 1
    from public.inv_stock_item i
    where i.id = p_stock_item_id
  ) then
    raise exception 'Stock item not found: %', p_stock_item_id;
  end if;

  if not exists (
    select 1
    from public.inv_uom u
    where u.id = p_uom_id
  ) then
    raise exception 'UOM not found: %', p_uom_id;
  end if;

  if not exists (
    select 1
    from public.inv_class_category c
    where c.id = p_material_class_id
  ) then
    raise exception 'Material class not found: %', p_material_class_id;
  end if;

  with target as (
    select
      lb.indent_line_id,
      lb.indent_id,
      lb.remaining_qty
    from public.v_proc_published_indent_line_balance lb
    join public.proc_indent_line il
      on il.indent_line_id = lb.indent_line_id
    join public.proc_indent_header h
      on h.indent_id = lb.indent_id
    left join public.proc_indent_line_sourcing_decision d
      on d.indent_line_id = lb.indent_line_id
    where lb.remaining_qty > 0
      and h.status not in ('closed', 'cancelled')
      and lb.material_class_id = p_material_class_id
      and lb.stock_item_id = p_stock_item_id
      and il.uom_id = p_uom_id
      and (
        coalesce(p_include_cleared, false)
        or coalesce(d.vendor_assignment_cleared, false) = false
      )
  ),
  upserted as (
    insert into public.proc_indent_line_sourcing_decision (
      indent_line_id,
      recommended_vendor_id,
      recommended_rate,
      recommended_source,
      recommended_meta,
      selected_vendor_id,
      selected_rate,
      selection_reason,
      decided_at,
      decided_by,
      vendor_assignment_cleared
    )
    select
      t.indent_line_id,
      d.recommended_vendor_id,
      d.recommended_rate,
      d.recommended_source,
      coalesce(d.recommended_meta, '[]'::jsonb),
      p_vendor_id,
      p_rate_value,
      v_reason,
      now(),
      auth.uid(),
      false
    from target t
    left join public.proc_indent_line_sourcing_decision d
      on d.indent_line_id = t.indent_line_id
    on conflict on constraint proc_indent_line_sourcing_decision_pkey
    do update set
      selected_vendor_id = excluded.selected_vendor_id,
      selected_rate = excluded.selected_rate,
      selection_reason = excluded.selection_reason,
      decided_at = now(),
      decided_by = auth.uid(),
      vendor_assignment_cleared = false
    returning indent_line_id
  )
  select
    count(*)::integer,
    count(distinct t.indent_id)::integer,
    coalesce(sum(t.remaining_qty), 0)
  into
    v_count,
    v_indent_count,
    v_total_qty
  from target t
  join upserted u
    on u.indent_line_id = t.indent_line_id;

  update public.proc_indent_header h
  set
    updated_at = now(),
    updated_by = auth.uid()
  where h.indent_id in (
    select distinct lb.indent_id
    from public.v_proc_published_indent_line_balance lb
    join public.proc_indent_line il
      on il.indent_line_id = lb.indent_line_id
    where lb.remaining_qty > 0
      and lb.material_class_id = p_material_class_id
      and lb.stock_item_id = p_stock_item_id
      and il.uom_id = p_uom_id
  );

  return query
  select
    v_count,
    v_indent_count,
    v_total_qty,
    case
      when p_rate_value is null then
        format(
          'Vendor applied with rate pending to %s line(s) across %s indent(s).',
          v_count,
          v_indent_count
        )
      else
        format(
          'Vendor applied to %s line(s) across %s indent(s).',
          v_count,
          v_indent_count
        )
    end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.proc_clear_vendor_assignment_for_same_item_lines_pec_internal(p_material_class_id bigint, p_stock_item_id bigint, p_uom_id bigint, p_reason text DEFAULT NULL::text, p_include_cleared boolean DEFAULT false)
 RETURNS TABLE(affected_line_count integer, affected_indent_count integer, total_qty numeric, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count integer := 0;
  v_indent_count integer := 0;
  v_total_qty numeric := 0;
begin
  if p_material_class_id is null then
    raise exception 'Material class is required';
  end if;

  if p_stock_item_id is null then
    raise exception 'Stock item is required';
  end if;

  if p_uom_id is null then
    raise exception 'UOM is required';
  end if;

  if not exists (
    select 1
    from public.inv_stock_item i
    where i.id = p_stock_item_id
  ) then
    raise exception 'Stock item not found: %', p_stock_item_id;
  end if;

  if not exists (
    select 1
    from public.inv_uom u
    where u.id = p_uom_id
  ) then
    raise exception 'UOM not found: %', p_uom_id;
  end if;

  if not exists (
    select 1
    from public.inv_class_category c
    where c.id = p_material_class_id
  ) then
    raise exception 'Material class not found: %', p_material_class_id;
  end if;

  drop table if exists pg_temp.tmp_clear_vendor_assignment_targets;

  create temp table tmp_clear_vendor_assignment_targets
  on commit drop
  as
  select
    lb.indent_line_id,
    lb.indent_id,
    lb.remaining_qty
  from public.v_proc_published_indent_line_balance lb
  join public.proc_indent_line il
    on il.indent_line_id = lb.indent_line_id
  join public.proc_indent_header h
    on h.indent_id = lb.indent_id
  left join public.proc_indent_line_sourcing_decision d
    on d.indent_line_id = lb.indent_line_id
  where lb.remaining_qty > 0
    and h.status not in ('closed', 'cancelled')
    and lb.material_class_id = p_material_class_id
    and lb.stock_item_id = p_stock_item_id
    and il.uom_id = p_uom_id
    and (
      coalesce(p_include_cleared, false)
      or coalesce(d.vendor_assignment_cleared, false) = false
    );

  insert into public.proc_indent_line_sourcing_decision (
    indent_line_id,
    recommended_vendor_id,
    recommended_rate,
    recommended_source,
    recommended_meta,
    selected_vendor_id,
    selected_rate,
    selection_reason,
    decided_at,
    decided_by,
    vendor_assignment_cleared
  )
  select
    t.indent_line_id,
    null,
    null,
    null,
    '[]'::jsonb,
    null,
    null,
    null,
    now(),
    auth.uid(),
    true
  from pg_temp.tmp_clear_vendor_assignment_targets t
  on conflict on constraint proc_indent_line_sourcing_decision_pkey
  do update set
    recommended_vendor_id = null,
    recommended_rate = null,
    recommended_source = null,
    recommended_meta = '[]'::jsonb,
    selected_vendor_id = null,
    selected_rate = null,
    selection_reason = null,
    decided_at = now(),
    decided_by = auth.uid(),
    vendor_assignment_cleared = true;

  select
    count(*)::integer,
    count(distinct t.indent_id)::integer,
    coalesce(sum(t.remaining_qty), 0)
  into
    v_count,
    v_indent_count,
    v_total_qty
  from pg_temp.tmp_clear_vendor_assignment_targets t;

  update public.proc_indent_header h
  set
    updated_at = now(),
    updated_by = auth.uid()
  where h.indent_id in (
    select distinct t.indent_id
    from pg_temp.tmp_clear_vendor_assignment_targets t
  );

  return query
  select
    v_count,
    v_indent_count,
    v_total_qty,
    format(
      'Vendor assignment cleared for %s line(s) across %s indent(s).',
      v_count,
      v_indent_count
    );
end;
$function$;
