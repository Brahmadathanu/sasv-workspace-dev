-- PROPOSAL (NOT APPLIED). Step 2: connect cost_head_policy_ledger to the EXISTING engine; switch defaults OFF.
-- Prereq: proposals/cost_head_policy_ledger.sql applied. Engine path (live 2026-10-16): rpc_refresh_cost_pool_monthly_snapshot -> v_cost_pool_monthly_combined -> v_expense_head_monthly_provision.
-- Only engine change: v_cost_pool_monthly_combined.expense_pool reads v_expense_head_monthly_provision_policy (identical output while OFF).
begin;
create table if not exists costing.cost_head_policy_switch(
  id boolean primary key default true check (id), is_enabled boolean not null default false,
  changed_by text, changed_at timestamptz not null default now(), note text);
insert into costing.cost_head_policy_switch(id) values (true) on conflict do nothing;
revoke all on costing.cost_head_policy_switch from public;
-- OFF: engine values unchanged. ON: ledger governs APPROVED/PROVISIONAL/EXCLUDED heads; CURRENT_METHOD_RETAINED/UNRESOLVED keep engine value;
-- MATERIAL_LANDED_COST (carriage reclass) keeps engine pool/value until the material-cost side is wired (prevents a fake saving).
create or replace view costing.v_expense_head_monthly_provision_policy as
with sw as (select coalesce((select is_enabled from costing.cost_head_policy_switch),false) on_),
l as (select * from costing.cost_head_policy_ledger where effective_to is null),
e as (select * from costing.v_expense_head_monthly_provision)
select e.period_start,
  case when sw.on_ and l.policy_status in ('APPROVED','PROVISIONAL') and l.allocation_pool<>'MATERIAL_LANDED_COST' then l.allocation_pool else e.allocation_pool end allocation_pool,
  e.expense_group, e.head_name,
  case when not sw.on_ or l.id is null or l.policy_status in ('CURRENT_METHOD_RETAINED','UNRESOLVED') or l.allocation_pool='MATERIAL_LANDED_COST' then e.standard_monthly_provision
       when l.policy_status='EXCLUDED' then 0 else l.normal_monthly_amount end standard_monthly_provision,
  e.selected_financial_year_start, e.selected_fy_value,
  e.comparison_details || jsonb_build_object('policy_switch',sw.on_,'policy_status',l.policy_status,'ledger_id',l.id) comparison_details
from e cross join sw left join l on l.expense_group=e.expense_group and l.head_name=e.head_name
union all
select p.period_start, l.allocation_pool, l.expense_group, l.head_name, l.normal_monthly_amount, null::date, null::numeric,
  jsonb_build_object('policy_switch',true,'policy_status',l.policy_status,'ledger_id',l.id,'source','LEDGER_ONLY')
from l cross join sw join costing.cost_periods p on p.status in ('OPEN','LOCKED')
where sw.on_ and l.policy_status in ('APPROVED','PROVISIONAL') and l.normal_monthly_amount<>0 and l.allocation_pool<>'MATERIAL_LANDED_COST'
  and not exists (select 1 from costing.v_expense_head_monthly_provision e2 where e2.period_start=p.period_start and e2.expense_group=l.expense_group and e2.head_name=l.head_name);

create or replace view costing.v_cost_pool_monthly_combined as  WITH staff_pool AS (
         SELECT s.period_start,
            s.allocation_pool,
            sum(s.pool_amount) AS staff_pool_amount,
            0::numeric AS expense_provision_amount,
            0::numeric AS manual_provision_amount
           FROM costing.v_staff_cost_pool_monthly s
          GROUP BY s.period_start, s.allocation_pool
        ), expense_pool AS (
         SELECT e.period_start,
            e.allocation_pool,
            0::numeric AS staff_pool_amount,
            sum(e.standard_monthly_provision) AS expense_provision_amount,
            0::numeric AS manual_provision_amount
           FROM costing.v_expense_head_monthly_provision_policy e
          GROUP BY e.period_start, e.allocation_pool
        ), manual_pool AS (
         SELECT m.period_start,
            m.allocation_pool,
            0::numeric AS staff_pool_amount,
            0::numeric AS expense_provision_amount,
            sum(m.manual_provision_amount) AS manual_provision_amount
           FROM v_costing_manual_cost_pool_monthly_summary m
          GROUP BY m.period_start, m.allocation_pool
        ), combined AS (
         SELECT s.period_start,
            s.allocation_pool,
            s.staff_pool_amount,
            s.expense_provision_amount,
            s.manual_provision_amount
           FROM staff_pool s
        UNION ALL
         SELECT e.period_start,
            e.allocation_pool,
            e.staff_pool_amount,
            e.expense_provision_amount,
            e.manual_provision_amount
           FROM expense_pool e
        UNION ALL
         SELECT m.period_start,
            m.allocation_pool,
            m.staff_pool_amount,
            m.expense_provision_amount,
            m.manual_provision_amount
           FROM manual_pool m
        )
 SELECT period_start,
    allocation_pool,
    sum(staff_pool_amount) AS staff_pool_amount,
    sum(expense_provision_amount) AS expense_provision_amount,
    sum(staff_pool_amount) + sum(expense_provision_amount) + sum(manual_provision_amount) AS total_pool_amount,
    sum(manual_provision_amount) AS manual_provision_amount
   FROM combined c
  GROUP BY period_start, allocation_pool;
commit;
-- Enable (separate user-approved step): update costing.cost_head_policy_switch set is_enabled=true, changed_by='<user>', changed_at=now(), note='<approval ref>';
-- Disable (instant effect rollback):     update costing.cost_head_policy_switch set is_enabled=false, changed_at=now();
