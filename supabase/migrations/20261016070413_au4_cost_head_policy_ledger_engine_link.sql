-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Step 2 (user-authorised 2026-10-16): cost-head policy ledger (52 heads) + engine link, switch OFF.
-- PROPOSAL (NOT APPLIED). Effective-dated cost-head policy ledger. One row per individual Tally head; no grouping loss.
create table if not exists costing.cost_head_policy_ledger(
 id bigserial primary key, expense_group text not null, head_name text not null, allocation_pool text not null,
 policy_status text not null check (policy_status in ('APPROVED','PROVISIONAL','EXCLUDED','UNRESOLVED','CURRENT_METHOD_RETAINED')),
 normal_monthly_amount numeric(18,2) not null default 0, source_provision_amount numeric(18,2), basis text not null, evidence_ref text not null,
 effective_from date not null, effective_to date, approved_by text, approved_at timestamptz, created_at timestamptz not null default now(),
 check (effective_to is null or effective_to>=effective_from),
 check (policy_status<>'EXCLUDED' or normal_monthly_amount=0));
-- Carriage inward row uses pool MATERIAL_LANDED_COST: reclass target, not a costing pool; map change happens only at apply time.
create unique index if not exists cost_head_policy_ledger_one_open on costing.cost_head_policy_ledger(expense_group,head_name) where effective_to is null;
-- Reconciliation: every mapped head present exactly once (open), and ledger vs source provision per pool.
create or replace view costing.v_cost_head_policy_reconciliation as
 select m.expense_group, m.head_name, m.allocation_pool map_pool, l.allocation_pool ledger_pool, l.policy_status, l.normal_monthly_amount, l.source_provision_amount,
  l.normal_monthly_amount-coalesce(l.source_provision_amount,0) delta,
  case when l.id is null then 'MISSING_IN_LEDGER' when m.head_name is null then 'NOT_IN_MAP' else 'OK' end recon_status
 from (select * from costing.expense_head_costing_map where is_active) m
 full join (select * from costing.cost_head_policy_ledger where effective_to is null) l using (expense_group, head_name);
insert into costing.cost_head_policy_ledger(expense_group,head_name,allocation_pool,policy_status,normal_monthly_amount,source_provision_amount,basis,evidence_ref,effective_from,approved_by,approved_at)
select v.* from (values
('Direct Expenses','Carriage Inward (DE)','MATERIAL_LANDED_COST','APPROVED',67725.0,67725,'User decision 2026-10-16: reclass to material acquisition cost (not a saving); duplicate-freight control required','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01','user', timestamptz '2026-10-16 09:00+05:30'),
('Direct Expenses','Cleaning Expenses (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',35511.1,35511.1,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Electricity & Water Charges (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',149304.75,149304.75,'AU-3 higher-of-years provision','AU4_NORMAL_BUDGET_PROPOSAL.md',date '2026-04-01',null,null),
('Direct Expenses','Employer Contributions (DE)','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map (salary via HR roster)','expense_head_costing_map',date '2026-04-01',null,null),
('Direct Expenses','Factory Expenses (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',29983.51,29983.51,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Fuel & Gas (DE)','PRODUCTION_OVERHEAD','APPROVED',161969.07,479589.6,'User-approved normal; stock-register consumption ~1.89L/mo kept as separate actual reconciliation','AU4_DECISION_TABLE_v2.md',date '2026-04-01','user', timestamptz '2026-10-16 08:00+05:30'),
('Direct Expenses','Job Work Expense','PRODUCTION_OVERHEAD','PROVISIONAL',25562.25,25562.25,'User decision 2026-10-16: provisional; attribution pending','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01',null,null),
('Direct Expenses','Lab Expenses (DE)','QUALITY_CONTROL_OVERHEAD','PROVISIONAL',51291.67,51291.67,'FY25-26/12','AU4_NORMAL_BUDGET_PROPOSAL.md',date '2026-04-01',null,null),
('Direct Expenses','Mess Expenses (DE)','PRODUCTION_OVERHEAD','APPROVED',177224.92,177224.92,'User decision 2026-10-16: 100% factory (DE head; marketing mess separate)','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01','user', timestamptz '2026-10-16 09:00+05:30'),
('Direct Expenses','Packing & Forwarding Charges (DE)','MATERIALS_STORES_OVERHEAD','APPROVED',5618.53,9979.33,'User decision 2026-10-16: factory share; outbound balance not in product cost','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01','user', timestamptz '2026-10-16 09:00+05:30'),
('Direct Expenses','Printing & Stationery (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',8346.24,8346.24,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Rates & Taxes (DE)','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',18959.67,18959.67,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Repairs & Maintenances (DE)','PRODUCTION_OVERHEAD','APPROVED',41978.2,69457.91,'User decision 2026-10-16: recurring normal; FY26-27 spike to variance','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01','user', timestamptz '2026-10-16 09:00+05:30'),
('Direct Expenses','Research & Development Expenses','ADMIN_OVERHEAD','PROVISIONAL',780.31,780.31,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Round Off on Purchase','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map','expense_head_costing_map',date '2026-04-01',null,null),
('Direct Expenses','Salaries & Allowances (DE)','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map (salary via HR roster)','expense_head_costing_map',date '2026-04-01',null,null),
('Direct Expenses','Travelling & Conveyance (DE)','MARKETING_EXPENSE','PROVISIONAL',4632.67,4632.67,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Vehicle Running & Maintenances (DE)','ADMIN_OVERHEAD','PROVISIONAL',14747.17,14747.17,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Advertisement Expenses','MARKETING_EXPENSE','PROVISIONAL',12500,12500,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Auditors Remuneration','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',25083.33,25083.33,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Books & Periodicals','ADMIN_OVERHEAD','PROVISIONAL',545,545,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Carriage Outward','MARKETING_EXPENSE','PROVISIONAL',57948,57948,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Central Office Charges','ADMIN_OVERHEAD','CURRENT_METHOD_RETAINED',871972.83,871972.83,'User ruling 2026-10-16: current engine method retained: higher of (last completed FY total / 12) and (running FY to-date monthly equivalent); Sept 2026 = FY25-26 1,04,63,674/12 = 8,71,972.83; no new normal','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01',null,null),
('Indirect Expenses','Cleaning Expenses','MARKETING_EXPENSE','PROVISIONAL',1634.96,1634.96,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Damage Stock A/c','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map','expense_head_costing_map',date '2026-04-01',null,null),
('Indirect Expenses','Discounts','MARKETING_EXPENSE','PROVISIONAL',240174.45,240174.45,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Employer Contributions','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map (salary via HR roster)','expense_head_costing_map',date '2026-04-01',null,null),
('Indirect Expenses','Field Work Expenses','MARKETING_EXPENSE','PROVISIONAL',319765.5,319765.5,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Financial Charges','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',66603.78,66603.78,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Fine & Penalty','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map','expense_head_costing_map',date '2026-04-01',null,null),
('Indirect Expenses','Forex Gain/loss','MARKETING_EXPENSE','PROVISIONAL',280.43,280.43,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Govt Stamping Fee','ADMIN_OVERHEAD','PROVISIONAL',62.5,62.5,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Ineligible ITC','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',8351.35,8351.35,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Insurance Premium Paid','MARKETING_EXPENSE','PROVISIONAL',20776.25,20776.25,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Interest Paid','FINANCE_ADMIN_OVERHEAD','EXCLUDED',0,1389594.9,'User decision 2026-10-16: finance cost excluded from product cost','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01','user', timestamptz '2026-10-16 09:00+05:30'),
('Indirect Expenses','Legal & Professional Charges','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',3125,3125,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Mess Expenses','MARKETING_EXPENSE','PROVISIONAL',54793.86,54793.86,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Miscellaneous Expenses','EXCLUDED','EXCLUDED',0,0,'User decision 2026-10-16: excluded','User decisions 2026-10-16 (DECISIONS_AND_OPEN_QUESTIONS)',date '2026-04-01','user', timestamptz '2026-10-16 09:00+05:30'),
('Indirect Expenses','Pooja Expenses','ADMIN_OVERHEAD','PROVISIONAL',967.67,967.67,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Postage & Courier Charges','MARKETING_EXPENSE','PROVISIONAL',30895.4,30895.4,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Printing & Stationery','MARKETING_EXPENSE','PROVISIONAL',25265.77,25265.77,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Rates & Taxes','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',5402.33,5402.33,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Registration Charges','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',0,0,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Rent','MARKETING_EXPENSE','PROVISIONAL',89190,89190,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Repairs & Maintenances','ADMIN_OVERHEAD','PROVISIONAL',11134.92,11134.92,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Salaries & Allowances','MARKETING_EXPENSE','PROVISIONAL',1653024.67,1653024.67,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Sales Promotion Expenses','MARKETING_EXPENSE','PROVISIONAL',84411.69,84411.69,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Security Charges','ADMIN_OVERHEAD','PROVISIONAL',24800,24800,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Telephone,Internet & Cable Charges','ADMIN_OVERHEAD','PROVISIONAL',20213.3,20213.3,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Travelling & Conveyance','MARKETING_EXPENSE','PROVISIONAL',145271.94,145271.94,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Vehicle Running & Maintenances','MARKETING_EXPENSE','PROVISIONAL',223935.42,223935.42,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Welfare Expenses','ADMIN_OVERHEAD','PROVISIONAL',11246.08,11246.08,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null)
) v(g,h,p,s,n,sp,b,e,f,ab,aa) where not exists (select 1 from costing.cost_head_policy_ledger l where l.expense_group=v.g and l.head_name=v.h and l.effective_to is null);
-- ROLLBACK: begin; drop view if exists costing.v_cost_head_policy_reconciliation; drop table if exists costing.cost_head_policy_ledger; commit;
-- PROPOSAL (NOT APPLIED). Step 2: connect cost_head_policy_ledger to the EXISTING engine; switch defaults OFF.
-- Prereq: proposals/cost_head_policy_ledger.sql applied. Engine path (live 2026-10-16): rpc_refresh_cost_pool_monthly_snapshot -> v_cost_pool_monthly_combined -> v_expense_head_monthly_provision.
-- Only engine change: v_cost_pool_monthly_combined.expense_pool reads v_expense_head_monthly_provision_policy (identical output while OFF).
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
-- Enable (separate user-approved step): update costing.cost_head_policy_switch set is_enabled=true, changed_by='<user>', changed_at=now(), note='<approval ref>';
-- Disable (instant effect rollback):     update costing.cost_head_policy_switch set is_enabled=false, changed_at=now();
