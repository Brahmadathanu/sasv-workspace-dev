-- backfilled from live schema_migrations on 2026-10-24, CI-016
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

  perform pg_advisory_xact_lock(
    hashtext('proc_indent_accept_excess:' || p_purchase_fact_id::text)::bigint
  );

  select u.unallocated_qty into v_unallocated
  from public.v_proc_purchase_unallocated u
  where u.purchase_fact_id=p_purchase_fact_id;

  if v_unallocated is null then
    raise exception 'No unallocated qty found for purchase_fact_id=% (either fully allocated or not in scope)',p_purchase_fact_id;
  end if;

  select coalesce(sum(a.accepted_qty),0) into v_already_accepted
  from public.proc_indent_excess_acceptance a
  where a.purchase_fact_id=p_purchase_fact_id;

  v_remaining:=v_unallocated-v_already_accepted;
  if p_accept_qty>v_remaining then
    raise exception 'Cannot accept %. Remaining unallocated is % for purchase_fact_id=%',p_accept_qty,v_remaining,p_purchase_fact_id;
  end if;

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