-- PREPARED (NOT APPLIED; next approval batch). CI-005 policy accepted 19 Oct 2026 19:02 IST (USER-APPROVAL-20261019-TB1-TB7):
-- the 22 non-marketing PROVISIONAL cost heads become APPROVED normals, review due 31 Mar 2027. Marketing heads stay PROVISIONAL.
-- Method: supersession (history kept). Each current row is closed (effective_to = 2026-10-19) and an identical row is inserted
-- with policy_status APPROVED, effective_from 2026-10-20 (in-month, going forward only; nothing backdated).
-- Cost effect: NIL in amount. costing.v_expense_head_monthly_provision_policy treats APPROVED and PROVISIONAL identically
-- (both use normal_monthly_amount); only the policy_status label in comparison_details / readiness counts changes for future runs.
-- Frozen snapshots of runs 122/128 are not touched; the ledger is not a fingerprint-scoped table.
do $g$
declare n int; s numeric;
begin
  select count(*), sum(normal_monthly_amount) into n, s from costing.cost_head_policy_ledger
   where effective_to is null and policy_status = 'PROVISIONAL'
     and allocation_pool in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD');
  if n <> 22 or s <> 514421.93 then raise exception 'LB1_GUARD: expected 22 heads / 514421.93, found % / %', n, s; end if;
  if (select count(*) from costing.cost_head_policy_ledger where effective_to is null and policy_status='PROVISIONAL' and allocation_pool='MARKETING_EXPENSE') <> 16
  then raise exception 'LB1_GUARD: marketing provisional heads changed'; end if;
end $g$;

with old as (
  update costing.cost_head_policy_ledger l set effective_to = date '2026-10-19'
   where l.effective_to is null and l.policy_status = 'PROVISIONAL'
     and l.allocation_pool in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD','PRODUCTION_OVERHEAD','QUALITY_CONTROL_OVERHEAD')
  returning l.*)
insert into costing.cost_head_policy_ledger (expense_group, head_name, allocation_pool, policy_status, normal_monthly_amount, source_provision_amount,
                                             basis, evidence_ref, effective_from, effective_to, approved_by, approved_at)
select expense_group, head_name, allocation_pool, 'APPROVED', normal_monthly_amount, source_provision_amount,
       basis || ' | CI-005: approved as normal 2026-10-19 (USER-APPROVAL-20261019-TB1-TB7); review due 2027-03-31',
       'USER-APPROVAL-20261019-TB1-TB7', date '2026-10-20', null, 'user', timestamptz '2026-10-19 19:02:00+05:30'
  from old;

do $p$
declare n int;
begin
  select count(*) into n from costing.cost_head_policy_ledger where effective_to is null and evidence_ref='USER-APPROVAL-20261019-TB1-TB7' and policy_status='APPROVED';
  if n <> 22 then raise exception 'LB1_POST: % approved rows', n; end if;
  select count(*) into n from (select expense_group, head_name from costing.cost_head_policy_ledger where effective_to is null group by 1,2 having count(*)>1) d;
  if n <> 0 then raise exception 'LB1_POST: % heads with two current rows', n; end if;
end $p$;
