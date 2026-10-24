-- Full rollback: restore the original engine view (live body 2026-10-16), then drop overlay and switch.
begin;
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
           FROM costing.v_expense_head_monthly_provision e
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
drop view if exists costing.v_expense_head_monthly_provision_policy;
drop table if exists costing.cost_head_policy_switch;
commit;
