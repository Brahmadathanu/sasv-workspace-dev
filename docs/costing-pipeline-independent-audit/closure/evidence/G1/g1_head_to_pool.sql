-- current cost-head ledger totals by pool (EXCLUDED removed) vs frozen run pools (cost_pool_monthly_snapshot.expense_provision_amount)
select allocation_pool, count(*) n, sum(normal_monthly_amount) filter (where policy_status<>'EXCLUDED') normal_incl,
       jsonb_object_agg(policy_status, 1) statuses
from costing.cost_head_policy_ledger where effective_to is null group by 1 order by 1;
select refresh_run_id, allocation_pool, staff_pool_amount, expense_provision_amount, manual_provision_amount, total_pool_amount
from costing.cost_pool_monthly_snapshot where refresh_run_id in (122,128) order by 1,2;
