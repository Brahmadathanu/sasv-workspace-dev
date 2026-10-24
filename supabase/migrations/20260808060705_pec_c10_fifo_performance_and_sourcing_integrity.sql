-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Remove the single confirmed historical sourcing-decision orphan before adding parent integrity.
delete from public.proc_indent_line_sourcing_decision d
where d.indent_line_id = 1742
  and not exists (
    select 1
    from public.proc_indent_line l
    where l.indent_line_id = d.indent_line_id
  );

alter table public.proc_indent_line_sourcing_decision
  add constraint proc_indent_line_sourcing_decision_line_fk
  foreign key (indent_line_id)
  references public.proc_indent_line(indent_line_id)
  on delete cascade;

comment on constraint proc_indent_line_sourcing_decision_line_fk on public.proc_indent_line_sourcing_decision
is 'Prevents sourcing decisions from outliving their authoritative indent line; line deletion cascades the live sourcing overlay.';

create or replace view public.v_proc_indent_fifo_allocation as
with demand as materialized (
  select
    ol.indent_line_id,
    ol.indent_id,
    ol.indent_number,
    ol.approved_date,
    ol.material_class_id,
    ol.stock_item_id,
    ol.uom_id,
    ol.requested_qty,
    sum(ol.requested_qty) over (
      partition by ol.material_class_id, ol.stock_item_id, ol.uom_id
      order by ol.approved_date, ol.indent_id, ol.indent_line_id
      rows between unbounded preceding and current row
    ) as demand_cum_to
  from public.v_proc_indent_open_lines ol
),
purch_base as materialized (
  select
    pu.purchase_fact_id,
    pu.voucher_date,
    pu.material_class_id,
    pu.stock_item_id,
    pu.uom_id,
    pu.purchase_qty,
    sum(pu.purchase_qty) over (
      partition by pu.material_class_id, pu.stock_item_id, pu.uom_id
      order by pu.voucher_date, pu.purchase_fact_id
      rows between unbounded preceding and current row
    ) as purch_cum_to
  from public.v_proc_purchases_for_indent pu
),
offsets as materialized (
  select
    d.indent_line_id,
    coalesce(max(pb.purch_cum_to), 0::numeric) as offset_qty
  from demand d
  left join purch_base pb
    on pb.material_class_id = d.material_class_id
   and pb.stock_item_id = d.stock_item_id
   and pb.uom_id = d.uom_id
   and pb.voucher_date < d.approved_date
  group by d.indent_line_id
),
alloc as (
  select
    d.indent_line_id,
    d.indent_id,
    d.indent_number,
    d.approved_date,
    p.purchase_fact_id,
    p.voucher_date,
    d.material_class_id,
    d.stock_item_id,
    d.uom_id,
    greatest(
      0::numeric,
      least(p.purch_cum_to - o.offset_qty, d.demand_cum_to)
      - greatest(
          p.purch_cum_to - p.purchase_qty - o.offset_qty,
          d.demand_cum_to - d.requested_qty
        )
    ) as allocated_qty
  from demand d
  join offsets o
    on o.indent_line_id = d.indent_line_id
  join purch_base p
    on p.material_class_id = d.material_class_id
   and p.stock_item_id = d.stock_item_id
   and p.uom_id = d.uom_id
   and p.voucher_date >= d.approved_date
   and (p.purch_cum_to - o.offset_qty) > (d.demand_cum_to - d.requested_qty)
   and (p.purch_cum_to - p.purchase_qty - o.offset_qty) < d.demand_cum_to
)
select
  indent_line_id,
  indent_id,
  indent_number,
  approved_date,
  purchase_fact_id,
  voucher_date,
  material_class_id,
  stock_item_id,
  uom_id,
  allocated_qty
from alloc
where allocated_qty > 0::numeric;