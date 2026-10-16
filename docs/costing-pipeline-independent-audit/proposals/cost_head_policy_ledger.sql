-- PROPOSAL (NOT APPLIED). Effective-dated cost-head policy ledger. One row per individual Tally head; no grouping loss.
begin;
create table if not exists costing.cost_head_policy_ledger(
 id bigserial primary key, expense_group text not null, head_name text not null, allocation_pool text not null,
 policy_status text not null check (policy_status in ('APPROVED','PROVISIONAL','EXCLUDED','UNRESOLVED')),
 normal_monthly_amount numeric(18,2) not null default 0, source_provision_amount numeric(18,2), basis text not null, evidence_ref text not null,
 effective_from date not null, effective_to date, approved_by text, approved_at timestamptz, created_at timestamptz not null default now(),
 check (effective_to is null or effective_to>=effective_from),
 check (policy_status<>'EXCLUDED' or normal_monthly_amount=0));
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
('Direct Expenses','Carriage Inward (DE)','MATERIALS_STORES_OVERHEAD','UNRESOLVED',67725.0,67725,'Reclass to material acquisition cost (not a saving); duplicate-charge control required','CARRIAGE_INWARD_AND_DRIVERS.md',date '2026-04-01',null,null),
('Direct Expenses','Cleaning Expenses (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',35511.1,35511.1,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Electricity & Water Charges (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',149304.75,149304.75,'AU-3 higher-of-years provision','AU4_NORMAL_BUDGET_PROPOSAL.md',date '2026-04-01',null,null),
('Direct Expenses','Employer Contributions (DE)','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map (salary via HR roster)','expense_head_costing_map',date '2026-04-01',null,null),
('Direct Expenses','Factory Expenses (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',29983.51,29983.51,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Fuel & Gas (DE)','PRODUCTION_OVERHEAD','APPROVED',161969.07,479589.6,'User-approved normal; stock-register consumption ~1.89L/mo kept as separate actual reconciliation','AU4_DECISION_TABLE_v2.md',date '2026-04-01','user', timestamptz '2026-10-16 08:00+05:30'),
('Direct Expenses','Job Work Expense','PRODUCTION_OVERHEAD','PROVISIONAL',25562.25,25562.25,'FY25-26/12; attribution to processes pending','JOB_WORK_EVIDENCE (this sprint)',date '2026-04-01',null,null),
('Direct Expenses','Lab Expenses (DE)','QUALITY_CONTROL_OVERHEAD','PROVISIONAL',51291.67,51291.67,'FY25-26/12','AU4_NORMAL_BUDGET_PROPOSAL.md',date '2026-04-01',null,null),
('Direct Expenses','Mess Expenses (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',177224.92,177224.92,'100% mfg pending headcount-share evidence','MESS_SHARE (this sprint)',date '2026-04-01',null,null),
('Direct Expenses','Packing & Forwarding Charges (DE)','MATERIALS_STORES_OVERHEAD','UNRESOLVED',5618.53,9979.33,'Inbound/production share only; outbound share to MARKETING pending split evidence','AU4_DECISION_TABLE_v2.md',date '2026-04-01',null,null),
('Direct Expenses','Printing & Stationery (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',8346.24,8346.24,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Rates & Taxes (DE)','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',18959.67,18959.67,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Repairs & Maintenances (DE)','PRODUCTION_OVERHEAD','PROVISIONAL',41978.2,69457.91,'Recurring normal; FY26-27 spike 2.78L excluded as non-recurring','AU4_DECISION_TABLE_v2.md',date '2026-04-01',null,null),
('Direct Expenses','Research & Development Expenses','ADMIN_OVERHEAD','PROVISIONAL',780.31,780.31,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Round Off on Purchase','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map','expense_head_costing_map',date '2026-04-01',null,null),
('Direct Expenses','Salaries & Allowances (DE)','EXCLUDED','EXCLUDED',0,0,'Mapped EXCLUDED in expense_head_costing_map (salary via HR roster)','expense_head_costing_map',date '2026-04-01',null,null),
('Direct Expenses','Travelling & Conveyance (DE)','MARKETING_EXPENSE','PROVISIONAL',4632.67,4632.67,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Direct Expenses','Vehicle Running & Maintenances (DE)','ADMIN_OVERHEAD','PROVISIONAL',14747.17,14747.17,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Advertisement Expenses','MARKETING_EXPENSE','PROVISIONAL',12500,12500,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Auditors Remuneration','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',25083.33,25083.33,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Books & Periodicals','ADMIN_OVERHEAD','PROVISIONAL',545,545,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Carriage Outward','MARKETING_EXPENSE','PROVISIONAL',57948,57948,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Central Office Charges','ADMIN_OVERHEAD','UNRESOLVED',871972.83,871972.83,'FY25-26 10.46L/yr vs FY26-27 7.58L/5mo; nature/allocation unverified','this ledger',date '2026-04-01',null,null),
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
('Indirect Expenses','Interest Paid','FINANCE_ADMIN_OVERHEAD','UNRESOLVED',1389594.9,1389594.9,'Finance cost; inclusion in product cost needs user policy','this ledger',date '2026-04-01',null,null),
('Indirect Expenses','Legal & Professional Charges','FINANCE_ADMIN_OVERHEAD','PROVISIONAL',3125,3125,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Mess Expenses','MARKETING_EXPENSE','PROVISIONAL',54793.86,54793.86,'AU-3 standard monthly provision (higher-of-years)','v_expense_head_monthly_provision_au3',date '2026-04-01',null,null),
('Indirect Expenses','Miscellaneous Expenses','EXCLUDED','UNRESOLVED',0,0,'Currently excluded; 2.60L FY25-26 not classified','this ledger',date '2026-04-01',null,null),
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
commit;
-- ROLLBACK: begin; drop view if exists costing.v_cost_head_policy_reconciliation; drop table if exists costing.cost_head_policy_ledger; commit;
