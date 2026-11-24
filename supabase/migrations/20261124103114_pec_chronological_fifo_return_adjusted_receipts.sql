set lock_timeout='5s';
create view public.v_proc_fifo_effective_receipts with (security_invoker=true) as
with p0 as (
 select purchase_fact_id,voucher_date,material_class_id,stock_item_id,uom_id,purchase_qty,supplier_name,
 sum(purchase_qty) over(partition by material_class_id,stock_item_id,uom_id,supplier_name order by voucher_date,purchase_fact_id rows unbounded preceding) as c
 from public.v_proc_purchase_fact_with_vendor
), p1 as (
 select *,min(c) over(partition by material_class_id,stock_item_id,uom_id,supplier_name order by voucher_date,purchase_fact_id rows between current row and unbounded following) as floor_c from p0
)
select purchase_fact_id,voucher_date,material_class_id,stock_item_id,uom_id,purchase_qty,
 greatest(0::numeric,least(purchase_qty,floor_c-(c-purchase_qty))) as net_qty
from p1 where purchase_qty>0;
revoke all on public.v_proc_fifo_effective_receipts from public,anon,authenticated;
grant select on public.v_proc_fifo_effective_receipts to authenticated,service_role;
comment on view public.v_proc_fifo_effective_receipts is 'PEC receipt quantity retained after chronological supplier/item/UOM-specific LIFO reversal of negative purchase facts; gross original facts unchanged.';
create or replace view public.v_proc_indent_fifo_allocation with (security_invoker=true) as
with receipts as materialized (select * from public.v_proc_fifo_effective_receipts where net_qty>0),
demand as materialized (
 select d.*,sum(requested_qty) over(partition by material_class_id,stock_item_id,uom_id order by approved_date,indent_id,indent_line_id rows unbounded preceding) as demand_to
 from public.v_proc_indent_open_lines d where requested_qty>0
), events as (
 select material_class_id,stock_item_id,uom_id,approved_date as dt,0 as kind,indent_id as seq,indent_line_id as id,requested_qty as dq,0::numeric as pq from demand
 union all
 select material_class_id,stock_item_id,uom_id,voucher_date,1,purchase_fact_id,purchase_fact_id,0::numeric,net_qty from receipts
), running as (
 select *,sum(dq-pq) over w as net,sum(pq) over w as supply from events
 window w as (partition by material_class_id,stock_item_id,uom_id order by dt,kind,seq,id rows unbounded preceding)
), reflected as (
 select *,supply+least(0::numeric,min(net) over(partition by material_class_id,stock_item_id,uom_id order by dt,kind,seq,id rows unbounded preceding)) as used_to from running
), spans as (
 select *,lag(used_to,1,0::numeric) over(partition by material_class_id,stock_item_id,uom_id order by dt,kind,seq,id) as used_from from reflected
)
select d.indent_line_id,d.indent_id,d.indent_number,d.approved_date,s.id as purchase_fact_id,s.dt as voucher_date,d.material_class_id,d.stock_item_id,d.uom_id,
 least(s.used_to,d.demand_to)-greatest(s.used_from,d.demand_to-d.requested_qty) as allocated_qty
from spans s join demand d using(material_class_id,stock_item_id,uom_id)
where s.kind=1 and s.used_to>s.used_from and s.dt>=d.approved_date and s.used_to>d.demand_to-d.requested_qty and s.used_from<d.demand_to;
comment on view public.v_proc_indent_fifo_allocation is 'Chronological work-conserving FIFO, demand first on same date, no pre-approval or double allocation; excess at receipt time is not carried forward to future indents. Return-adjusted effective receipt capacity.';
create or replace view public.v_proc_purchase_unallocated with (security_invoker=true) as
with a as (select purchase_fact_id,sum(allocated_qty) as allocated_qty from public.v_proc_indent_fifo_allocation group by purchase_fact_id)
select p.purchase_fact_id,p.voucher_date,p.material_class_id,p.stock_item_id,p.uom_id,p.net_qty::numeric(20,6) as purchase_qty,
 coalesce(a.allocated_qty,0::numeric) as allocated_qty,p.net_qty-coalesce(a.allocated_qty,0::numeric) as unallocated_qty
from public.v_proc_fifo_effective_receipts p left join a using(purchase_fact_id)
where p.net_qty-coalesce(a.allocated_qty,0::numeric)>0;
comment on view public.v_proc_purchase_unallocated is 'Excess receipt capacity after supplier-specific purchase returns and FIFO allocations. purchase_qty is retained net receipt quantity; gross source purchase facts remain unchanged.';
do $guard$
begin
 if exists(select 1 from public.v_proc_indent_fifo_allocation a join public.v_proc_fifo_effective_receipts r using(purchase_fact_id) group by a.purchase_fact_id,r.net_qty having sum(a.allocated_qty)>r.net_qty)
 or exists(select 1 from public.v_proc_indent_fifo_allocation a join public.v_proc_indent_open_lines d using(indent_line_id) group by a.indent_line_id,d.requested_qty having sum(a.allocated_qty)>d.requested_qty)
 or exists(select 1 from public.v_proc_indent_fifo_allocation where allocated_qty<=0 or voucher_date<approved_date)
 then raise exception 'PEC FIFO invariant violation'; end if;
 if exists(select 1 from public.proc_indent_excess_acceptance) then
 raise exception 'Review existing excess acceptance against corrected receipt capacities before deployment'; end if;
end $guard$;
select * from public.proc_request_snapshot_refresh_pec_internal('fifo_chronological_correction_20261124');