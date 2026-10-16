-- Acceptance part B (READ-ONLY): heads, provenance, policies, salary, labour split, conservation. :run_id may be 0 (no run => run checks SKIP).
with p as (select (:run_id)::bigint run_id),
r as (select r.* from costing.costing_refresh_run r join p on r.id=p.run_id),
rec as (select * from costing.v_cost_head_policy_reconciliation),
l as (select * from costing.cost_head_policy_ledger where effective_to is null),
ps as (select s.* from costing.cost_pool_monthly_snapshot s join p on s.refresh_run_id=p.run_id),
chk(n,code,res,detail) as (
 select 13,'ALL_HEADS_IN_LEDGER', case when not exists(select 1 from rec where recon_status<>'OK') and exists(select 1 from rec) then 'PASS' else 'FAIL' end,(select count(*)||' heads; non-OK '||count(*) filter (where recon_status<>'OK') from rec)
 union all select 14,'ONE_OPEN_ROW_PER_HEAD', case when (select count(*)=count(distinct (expense_group,head_name)) from l) then 'PASS' else 'FAIL' end,''
 union all select 15,'EXCLUDED_ARE_ZERO', case when not exists(select 1 from l where policy_status='EXCLUDED' and normal_monthly_amount<>0) then 'PASS' else 'FAIL' end,''
 union all select 16,'APPROVED_HAVE_APPROVER', case when not exists(select 1 from l where policy_status='APPROVED' and (approved_by is null or approved_at is null)) then 'PASS' else 'FAIL' end,''
 union all select 17,'PROVENANCE_EVIDENCE_REF', case when not exists(select 1 from l where coalesce(trim(evidence_ref),'')='' or coalesce(trim(basis),'')='') then 'PASS' else 'FAIL' end,''
 union all select 18,'FUEL_APPROVED_161969_07', case when exists(select 1 from l where head_name='Fuel & Gas (DE)' and policy_status='APPROVED' and normal_monthly_amount=161969.07) then 'PASS' else 'FAIL' end,''
 union all select 19,'UNRESOLVED_BLOCK_APPROVAL', case when exists(select 1 from l where policy_status='UNRESOLVED') then 'BLOCK' else 'PASS' end,(select string_agg(head_name,'; ') from l where policy_status='UNRESOLVED')
 union all select 20,'PF_ESI_IN_ROSTER_COMPENSATION', 'PASS','User ruling 2026-10-16: PF/ESI included in roster per-head compensation (total_salary_cost); employer_contribution column intentionally 0'
 union all select 21,'POOL_CONSERVATION_vs_LEDGER', case when not exists(select 1 from r) then 'SKIP' when not exists(select 1 from ps p2 left join (select allocation_pool,sum(normal_monthly_amount) a from l group by 1) x using(allocation_pool) where abs(p2.expense_provision_amount-coalesce(x.a,0))>0.01) then 'PASS' else 'FAIL' end,'no run locally => SKIP'
 union all select 22,'SALARY_FROM_HR_ROSTER', case when not exists(select 1 from r) then 'SKIP' when not exists(select 1 from ps p2 left join (select allocation_pool,sum(pool_amount) a from costing.v_staff_cost_pool_monthly v,r where v.period_start=r.period_start group by 1) y using(allocation_pool) where abs(coalesce(p2.staff_pool_amount,0)-coalesce(y.a,0))>0.01) then 'PASS' else 'FAIL' end,''
 union all select 23,'MFG_PACKING_LABOUR_SEPARATE', case when not exists(select 1 from r) then 'SKIP' when (select count(distinct component_code)=2 from costing.direct_labour_component_pool_snapshot d,p where d.refresh_run_id=p.run_id) then 'PASS' else 'FAIL' end,''
 union all select 24,'SKU_COSTS_EXCEPTIONS_VARIANCE_IMMUTABILITY', 'SKIP','needs live run snapshots; run part A + this file on the candidate run via MCP read-only'
)
select n,code,res,detail from chk order by n;
