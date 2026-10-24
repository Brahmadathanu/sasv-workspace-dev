-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.proc_indent_set_status(
  p_indent_id bigint,
  p_status text,
  p_approved_date date default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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

create or replace function public.proc_indent_add_line(
  p_indent_id bigint,
  p_material_class_id bigint,
  p_stock_item_id bigint,
  p_uom_id bigint,
  p_requested_qty numeric default 0,
  p_reason text default null
)
returns bigint
language plpgsql
as $function$
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

create or replace function public.proc_indent_close_strict(p_indent_id bigint)
returns void
language plpgsql
security definer
as $function$
declare
  v_status text;
  v_remaining numeric;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  v_status:=public.proc_indent_get_status(p_indent_id);
  if v_status not in ('approved','issued') then raise exception 'Only approved/issued indents can be closed (current status=%)',v_status; end if;
  select coalesce(total_remaining_qty,0) into v_remaining from public.v_proc_indent_header_balance where indent_id=p_indent_id;
  v_remaining:=coalesce(v_remaining,0);
  if v_remaining<>0 then raise exception 'Cannot close: remaining qty is % (must be 0)',v_remaining; end if;
  update public.proc_indent_header set status='closed',updated_at=now(),updated_by=auth.uid() where indent_id=p_indent_id;
  perform public.proc_request_snapshot_refresh('indent_closed_strict');
end;
$function$;

create or replace function public.proc_indent_close_with_override(p_indent_id bigint,p_reason text)
returns void
language plpgsql
security definer
as $function$
declare
  v_status text;
  v_remaining numeric;
  v_reason text;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  v_status:=public.proc_indent_get_status(p_indent_id);
  if v_status not in ('approved','issued') then raise exception 'Only approved/issued indents can be closed (current status=%)',v_status; end if;
  select coalesce(total_remaining_qty,0) into v_remaining from public.v_proc_indent_header_balance where indent_id=p_indent_id;
  v_remaining:=coalesce(v_remaining,0);
  v_reason:=nullif(trim(p_reason),'');
  if v_reason is null then raise exception 'p_reason is required for override close'; end if;
  update public.proc_indent_header
  set status='closed',
      notes=coalesce(notes,'')||E'\n'||'[Override close] remaining='||v_remaining::text||', reason='||v_reason||', by='||coalesce(auth.uid()::text,'(null)')||', at='||now()::text,
      updated_at=now(),updated_by=auth.uid()
  where indent_id=p_indent_id;
  perform public.proc_request_snapshot_refresh('indent_closed_override');
end;
$function$;

create or replace function public.proc_indent_autoclose_if_fully_allocated(p_indent_id bigint)
returns boolean
language plpgsql
security definer
as $function$
declare
  v_status text;
  v_remaining numeric;
begin
  if p_indent_id is null then raise exception 'p_indent_id is required'; end if;
  v_status:=public.proc_indent_get_status(p_indent_id);
  if v_status not in ('approved','issued') then return false; end if;
  select coalesce(total_remaining_qty,0) into v_remaining from public.v_proc_indent_header_balance where indent_id=p_indent_id;
  v_remaining:=coalesce(v_remaining,0);
  if v_remaining=0 then
    update public.proc_indent_header set status='closed',updated_at=now(),updated_by=auth.uid() where indent_id=p_indent_id;
    perform public.proc_request_snapshot_refresh('indent_autoclosed');
    return true;
  end if;
  return false;
end;
$function$;

create or replace function public.proc_indent_accept_excess(
  p_purchase_fact_id bigint,
  p_accept_qty numeric,
  p_reason text default null
)
returns table(purchase_fact_id bigint,accepted_now numeric,unallocated_qty numeric,accepted_total numeric,remaining_unallocated numeric)
language plpgsql
as $function$
declare
  v_unallocated numeric;
  v_already_accepted numeric;
  v_remaining numeric;
begin
  if p_purchase_fact_id is null then raise exception 'p_purchase_fact_id is required'; end if;
  if p_accept_qty is null or p_accept_qty<=0 then raise exception 'p_accept_qty must be > 0'; end if;
  perform pg_advisory_xact_lock(('proc_indent_accept_excess'::regclass::oid)::bigint,p_purchase_fact_id);
  select u.unallocated_qty into v_unallocated from public.v_proc_purchase_unallocated u where u.purchase_fact_id=p_purchase_fact_id;
  if v_unallocated is null then raise exception 'No unallocated qty found for purchase_fact_id=% (either fully allocated or not in scope)',p_purchase_fact_id; end if;
  select coalesce(sum(a.accepted_qty),0) into v_already_accepted from public.proc_indent_excess_acceptance a where a.purchase_fact_id=p_purchase_fact_id;
  v_remaining:=v_unallocated-v_already_accepted;
  if p_accept_qty>v_remaining then raise exception 'Cannot accept %. Remaining unallocated is % for purchase_fact_id=%',p_accept_qty,v_remaining,p_purchase_fact_id; end if;
  insert into public.proc_indent_excess_acceptance(purchase_fact_id,accepted_qty,reason,accepted_by)
  values(p_purchase_fact_id,p_accept_qty,nullif(trim(p_reason),''),auth.uid());

  perform public.proc_request_snapshot_refresh('excess_accepted');

  purchase_fact_id:=p_purchase_fact_id;
  accepted_now:=p_accept_qty;
  unallocated_qty:=v_unallocated;
  accepted_total:=v_already_accepted+p_accept_qty;
  remaining_unallocated:=v_unallocated-(v_already_accepted+p_accept_qty);
  return next;
end;
$function$;