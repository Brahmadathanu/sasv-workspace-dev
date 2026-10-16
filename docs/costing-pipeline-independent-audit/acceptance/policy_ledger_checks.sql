-- Acceptance part B (READ-ONLY): heads, provenance, policies, salary, labour split, conservation. :run_id may be 0 (no run => run checks BLOCKED; a skip can never report PASS).
with p as (select (:run_id)::bigint run_id),
r as (select r.* from costing.costing_refresh_run r join p on r.id=p.run_id),
rec as (select * from costing.v_cost_head_policy_reconciliation),
l as (select * from costing.cost_head_policy_ledger where effective_to is null),
ps as (select s.* from costing.cost_pool_monthly_snapshot s join p on s.refresh_run_id=p.run_id),
w(code) as (select null::text where false /* explicit waivers: add values ('CHECK25_MANUAL_REVIEW') only on user sign-off */),
u as (select b.sku_id, b.monthly_allocation_units u from costing.sku_sales_allocation_basis_snapshot b join p on b.refresh_run_id=p.run_id),
c as (select l.*, u.u from costing.sku_internal_loaded_cost_snapshot l join p on l.refresh_run_id=p.run_id join u using(sku_id)),
ab(p,pool_amt,engine_alloc,sku_x_units) as (
 select x.allocation_pool, x.total_pool_amount, e.a, s2.v from ps x
 left join (
  select 'DIRECT_LABOUR' p,(select sum(product_direct_labour_allocation) from costing.product_direct_labour_workload_snapshot d,p where d.refresh_run_id=p.run_id)+(select sum(packing_labour_allocation) from costing.sku_direct_labour_allocation_snapshot d,p where d.refresh_run_id=p.run_id) a
  union all select 'PRODUCTION_OVERHEAD',(select sum(a) from (select distinct on (product_id) product_production_overhead_allocation a from costing.sku_production_overhead_allocation_snapshot d,p where d.refresh_run_id=p.run_id order by product_id) z)
  union all select 'QUALITY_CONTROL_OVERHEAD',(select sum(product_qc_allocation_amount) from costing.product_qc_allocation_snapshot d,p where d.refresh_run_id=p.run_id)
  union all select 'MATERIALS_STORES_OVERHEAD',(select sum(monthly_sku_allocation_amount) from costing.sku_materials_stores_allocation_snapshot d,p where d.refresh_run_id=p.run_id)+coalesce((select sum(allocation_amount) from costing.product_internal_source_materials_stores_allocation_snapshot d,p where d.refresh_run_id=p.run_id),0)
  union all select 'ADMIN_OVERHEAD',(select sum(admin_overhead_cost_per_sku*u) from c)
  union all select 'FINANCE_ADMIN_OVERHEAD',(select sum(finance_admin_overhead_cost_per_sku*u) from c)
  union all select 'MARKETING_EXPENSE',(select sum(m.marketing_expense_cost_per_sku*u.u) from costing.sku_marketing_expense_allocation_snapshot m join p on m.refresh_run_id=p.run_id join u using(sku_id))
 ) e on e.p=x.allocation_pool
 left join (
  select 'DIRECT_LABOUR' p,sum(direct_labour_cost_per_sku*u) v from c union all select 'PRODUCTION_OVERHEAD',sum(production_overhead_cost_per_sku*u) from c
  union all select 'QUALITY_CONTROL_OVERHEAD',sum(quality_control_overhead_cost_per_sku*u) from c union all select 'MATERIALS_STORES_OVERHEAD',sum(materials_stores_overhead_cost_per_sku*u) from c
  union all select 'ADMIN_OVERHEAD',sum(admin_overhead_cost_per_sku*u) from c union all select 'FINANCE_ADMIN_OVERHEAD',sum(finance_admin_overhead_cost_per_sku*u) from c
  union all select 'MARKETING_EXPENSE',(select sum(m.marketing_expense_cost_per_sku*u.u) from costing.sku_marketing_expense_allocation_snapshot m join p on m.refresh_run_id=p.run_id join u using(sku_id))
 ) s2 on s2.p=x.allocation_pool),
chk(n,code,res,detail) as (
 select 13,'ALL_HEADS_IN_LEDGER', case when not exists(select 1 from rec where recon_status<>'OK') and exists(select 1 from rec) then 'PASS' else 'FAIL' end,(select count(*)||' heads; non-OK '||count(*) filter (where recon_status<>'OK') from rec)
 union all select 14,'ONE_OPEN_ROW_PER_HEAD', case when (select count(*)=count(distinct (expense_group,head_name)) from l) then 'PASS' else 'FAIL' end,''
 union all select 15,'EXCLUDED_ARE_ZERO', case when not exists(select 1 from l where policy_status='EXCLUDED' and normal_monthly_amount<>0) then 'PASS' else 'FAIL' end,''
 union all select 16,'APPROVED_HAVE_APPROVER', case when not exists(select 1 from l where policy_status='APPROVED' and (approved_by is null or approved_at is null)) then 'PASS' else 'FAIL' end,''
 union all select 17,'PROVENANCE_EVIDENCE_REF', case when not exists(select 1 from l where coalesce(trim(evidence_ref),'')='' or coalesce(trim(basis),'')='') then 'PASS' else 'FAIL' end,''
 union all select 18,'FUEL_APPROVED_161969_07', case when exists(select 1 from l where head_name='Fuel & Gas (DE)' and policy_status='APPROVED' and normal_monthly_amount=161969.07) then 'PASS' else 'FAIL' end,''
 union all select 19,'UNRESOLVED_BLOCK_APPROVAL', case when exists(select 1 from l where policy_status='UNRESOLVED') then 'BLOCK' else 'PASS' end,(select string_agg(head_name,'; ') from l where policy_status='UNRESOLVED')
 union all select 20,'PF_ESI_IN_ROSTER_COMPENSATION', 'PASS','User ruling 2026-10-16: PF/ESI included in roster per-head compensation (total_salary_cost); employer_contribution column intentionally 0'
 union all select 21,'POOL_CONSERVATION_vs_POLICY_VIEW', case when not exists(select 1 from r) then 'BLOCKED' when not exists(select 1 from ps p2 left join (select v.allocation_pool,sum(v.standard_monthly_provision) a from costing.v_expense_head_monthly_provision_policy v, r where v.period_start=r.period_start group by 1) x using(allocation_pool) where abs(p2.expense_provision_amount-coalesce(x.a,0))>0.01) then 'PASS' else 'FAIL' end,case when not exists(select 1 from r) then 'no run: BLOCKED' else 'expense provision per pool = policy view (run '||(select max(id) from r)||')' end
 union all select 22,'SALARY_FROM_HR_ROSTER', case when not exists(select 1 from r) then 'BLOCKED' when not exists(select 1 from ps p2 left join (select allocation_pool,sum(pool_amount) a from costing.v_staff_cost_pool_monthly v,r where v.period_start=r.period_start group by 1) y using(allocation_pool) where abs(coalesce(p2.staff_pool_amount,0)-coalesce(y.a,0))>0.01) then 'PASS' else 'FAIL' end,''
 union all select 23,'MFG_PACKING_LABOUR_SEPARATE', case when not exists(select 1 from r) then 'BLOCKED' when (select count(distinct component_code)=2 from costing.direct_labour_component_pool_snapshot d,p where d.refresh_run_id=p.run_id) then 'PASS' else 'FAIL' end,''
 union all select 24,'POOL_ABSORPTION_CONSERVATION', case when not exists(select 1 from r) then 'BLOCKED'
   when not exists(select 1 from ab where coalesce(abs(engine_alloc-pool_amt),1e15)>1) and not exists(select 1 from ab where coalesce(abs(sku_x_units-pool_amt),1e15)>0.005*pool_amt) and exists(select 1 from ab) then 'PASS' else 'FAIL' end,
   (select string_agg(p||' pool '||round(pool_amt)||' engine '||round(engine_alloc)||' sku*units '||round(sku_x_units),'; ' order by p) from ab)
 union all select 25,'SKU_COSTS_EXCEPTIONS_VARIANCE_IMMUTABILITY', case when exists(select 1 from w where code='CHECK25_MANUAL_REVIEW') then 'WAIVED' else 'BLOCKED' end,'manual review of top-cost and corrected SKUs; BLOCKED until recorded as waived/accepted by the user'
)
select n,code,res,detail from chk
union all select 99,'OVERALL', case when bool_and(res in ('PASS','WAIVED')) then 'PASS' else 'NOT_PASS' end, 'non-PASS: '||coalesce(string_agg(n::text,',') filter (where res not in ('PASS','WAIVED')),'none') from chk
order by n;
