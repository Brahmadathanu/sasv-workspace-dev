-- PROPOSED, NOT APPLIED. Make the Head Office admin allocation (Rs 5,00,000/month, ADMIN_OVERHEAD) an effective-dated recurring provision.
-- Today costing.manual_cost_pool_provisions is period-specific (period_start only; rows exist for Jun and Jul 2026 only), so Aug/Sep/Oct carry 0.
-- 1. Recurring definition table
create table if not exists costing.recurring_cost_pool_provision (
  id bigint generated always as identity primary key,
  provision_key text not null, provision_type text not null, allocation_pool text not null,
  provision_label text not null, monthly_amount numeric not null check (monthly_amount > 0),
  source_reference text not null, approval_reference text not null,
  effective_from date not null check (effective_from = date_trunc('month', effective_from)::date),
  effective_to date, review_due_on date not null,
  status text not null default 'APPROVED' check (status in ('APPROVED','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  check (effective_to is null or effective_to >= effective_from));
create unique index if not exists recurring_cost_pool_provision_one_open
  on costing.recurring_cost_pool_provision (provision_key, allocation_pool) where status='APPROVED' and effective_to is null;
alter table costing.recurring_cost_pool_provision enable row level security;
-- 2. Feed the pool: period rows (manual_cost_pool_provisions) override a recurring row with the same key; otherwise recurring applies.
create or replace view public.v_costing_manual_cost_pool_monthly_summary as
with periods as (select generate_series(date '2026-06-01', (date_trunc('month', current_date) + interval '12 months')::date, interval '1 month')::date period_start),
rec as (
  select p.period_start, r.id, 'RECURRING'::text src, r.provision_type, r.provision_key, r.provision_label, r.allocation_pool,
         r.monthly_amount provision_amount, r.source_reference, r.approval_reference remarks
  from costing.recurring_cost_pool_provision r join periods p
    on p.period_start >= r.effective_from and (r.effective_to is null or p.period_start <= r.effective_to)
  where r.status in ('APPROVED','CLOSED')
    and not exists (select 1 from costing.manual_cost_pool_provisions m where m.is_active and m.period_start=p.period_start
                    and m.provision_key=r.provision_key and m.allocation_pool=r.allocation_pool)),
man as (
  select m.period_start, m.id, 'PERIOD'::text src, m.provision_type, m.provision_key, m.provision_label, m.allocation_pool,
         m.provision_amount, m.source_reference, m.remarks
  from costing.manual_cost_pool_provisions m where m.is_active),
u as (select * from rec union all select * from man)
select u.period_start, u.allocation_pool,
       coalesce(o.allocation_pool_label, u.allocation_pool) allocation_pool_label,
       sum(u.provision_amount) manual_provision_amount, count(*) active_provision_count,
       jsonb_agg(jsonb_build_object('provision_id',u.id,'source',u.src,'provision_type',u.provision_type,'provision_key',u.provision_key,
         'provision_label',u.provision_label,'provision_amount',u.provision_amount,'source_reference',u.source_reference,'remarks',u.remarks)
         order by u.provision_type,u.provision_key,u.id) provision_details
from u left join public.v_costing_manual_provision_pool_options o on o.allocation_pool=u.allocation_pool
group by u.period_start, u.allocation_pool, coalesce(o.allocation_pool_label, u.allocation_pool);
-- 3. Seed (from Oct 2026 only; closed Sep run 122 and Aug are not touched; pool snapshots are per run anyway)
-- insert into costing.recurring_cost_pool_provision(provision_key,provision_type,allocation_pool,provision_label,monthly_amount,source_reference,approval_reference,effective_from,review_due_on)
-- values ('HO_ADMIN_ALLOCATION','HEAD_OFFICE_ALLOCATION','ADMIN_OVERHEAD','Head Office Admin Overhead Allocation',500000,'HO Estimate','USER-APPROVAL-AU6-HO-ADMIN-<DATE>','2026-10-01','2027-03-31');
-- Pre-check (user decision): ADMIN_OVERHEAD already carries the expense head 'Central Office Charges' at Rs 8,71,973/mo (FY25-26 actual; ledger 52).
-- If the Rs 5L HO allocation is the same money, adding it double counts.
