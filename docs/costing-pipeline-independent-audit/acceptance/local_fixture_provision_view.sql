create or replace view costing.v_expense_head_monthly_provision as  WITH periods AS (
         SELECT cp.period_start
           FROM costing.cost_periods cp
          WHERE cp.status = ANY (ARRAY['OPEN'::text, 'LOCKED'::text])
        ), mapped_expenses AS (
         SELECT p.period_start,
            e.as_of_date,
                CASE
                    WHEN EXTRACT(month FROM e.as_of_date) >= 4::numeric THEN make_date(EXTRACT(year FROM e.as_of_date)::integer, 4, 1)
                    ELSE make_date(EXTRACT(year FROM e.as_of_date)::integer - 1, 4, 1)
                END AS financial_year_start,
                CASE
                    WHEN EXTRACT(month FROM e.as_of_date) >= 4::numeric THEN make_date(EXTRACT(year FROM e.as_of_date)::integer + 1, 3, 31)
                    ELSE make_date(EXTRACT(year FROM e.as_of_date)::integer, 3, 31)
                END AS financial_year_end,
            m.allocation_pool,
            e.expense_group,
            e.head_name,
            abs(COALESCE(e.net_cb_value, 0::numeric)) AS expense_value
           FROM periods p
             JOIN tally_expenses_snapshot e ON e.as_of_date < p.period_start
             JOIN costing.expense_head_costing_map m ON m.expense_group = e.expense_group AND m.head_name = e.head_name AND m.is_active = true AND m.include_in_costing = true AND m.allocation_pool <> 'EXCLUDED'::text
        ), snapshot_month_basis AS (
         SELECT me.period_start,
            me.as_of_date,
            me.financial_year_start,
            me.financial_year_end,
            me.allocation_pool,
            me.expense_group,
            me.head_name,
            me.expense_value,
                CASE
                    WHEN me.as_of_date = me.financial_year_end THEN true
                    ELSE false
                END AS is_completed_financial_year_snapshot,
            EXTRACT(year FROM age(date_trunc('month'::text, me.as_of_date::timestamp with time zone)::date::timestamp with time zone, me.financial_year_start::timestamp with time zone))::integer * 12 + EXTRACT(month FROM age(date_trunc('month'::text, me.as_of_date::timestamp with time zone)::date::timestamp with time zone, me.financial_year_start::timestamp with time zone))::integer + 1 AS elapsed_month_count,
                CASE
                    WHEN me.as_of_date = me.financial_year_end THEN 12
                    ELSE EXTRACT(year FROM age(date_trunc('month'::text, me.as_of_date::timestamp with time zone)::date::timestamp with time zone, me.financial_year_start::timestamp with time zone))::integer * 12 + EXTRACT(month FROM age(date_trunc('month'::text, me.as_of_date::timestamp with time zone)::date::timestamp with time zone, me.financial_year_start::timestamp with time zone))::integer + 1
                END AS provision_month_count
           FROM mapped_expenses me
          WHERE me.as_of_date = (date_trunc('month'::text, me.as_of_date::timestamp with time zone)::date + '1 mon -1 days'::interval)::date
        ), fy_head_snapshot_monthly AS (
         SELECT smb.period_start,
            smb.financial_year_start,
            smb.financial_year_end,
            smb.as_of_date,
            smb.allocation_pool,
            smb.expense_group,
            smb.head_name,
            smb.expense_value AS selected_fy_value,
            smb.provision_month_count,
                CASE
                    WHEN smb.provision_month_count > 0 THEN smb.expense_value / smb.provision_month_count::numeric
                    ELSE 0::numeric
                END AS monthly_equivalent_value,
                CASE
                    WHEN smb.as_of_date = smb.financial_year_end THEN 'COMPLETED_FINANCIAL_YEAR'::text
                    ELSE 'RUNNING_FINANCIAL_YEAR_MONTH_END'::text
                END AS snapshot_basis
           FROM snapshot_month_basis smb
        ), fy_best_monthly AS (
         SELECT DISTINCT ON (f.period_start, f.financial_year_start, f.allocation_pool, f.expense_group, f.head_name) f.period_start,
            f.financial_year_start,
            f.financial_year_end,
            f.as_of_date,
            f.allocation_pool,
            f.expense_group,
            f.head_name,
            f.selected_fy_value,
            f.provision_month_count,
            f.monthly_equivalent_value,
            f.snapshot_basis
           FROM fy_head_snapshot_monthly f
          ORDER BY f.period_start, f.financial_year_start, f.allocation_pool, f.expense_group, f.head_name, f.monthly_equivalent_value DESC, f.as_of_date DESC
        ), comparison_details AS (
         SELECT f.period_start,
            f.allocation_pool,
            f.expense_group,
            f.head_name,
            jsonb_agg(jsonb_build_object('financial_year_start', f.financial_year_start, 'financial_year_end', f.financial_year_end, 'snapshot_as_of_date', f.as_of_date, 'snapshot_basis', f.snapshot_basis, 'selected_fy_value', f.selected_fy_value, 'provision_month_count', f.provision_month_count, 'monthly_equivalent_value', f.monthly_equivalent_value) ORDER BY f.financial_year_start) AS comparison_details
           FROM fy_best_monthly f
          GROUP BY f.period_start, f.allocation_pool, f.expense_group, f.head_name
        ), selected_provision AS (
         SELECT DISTINCT ON (f.period_start, f.allocation_pool, f.expense_group, f.head_name) f.period_start,
            f.allocation_pool,
            f.expense_group,
            f.head_name,
            f.monthly_equivalent_value AS standard_monthly_provision,
            f.financial_year_start AS selected_financial_year_start,
            f.selected_fy_value,
            c.comparison_details
           FROM fy_best_monthly f
             JOIN comparison_details c ON c.period_start = f.period_start AND c.allocation_pool = f.allocation_pool AND c.expense_group = f.expense_group AND c.head_name = f.head_name
          ORDER BY f.period_start, f.allocation_pool, f.expense_group, f.head_name, f.monthly_equivalent_value DESC, f.financial_year_start DESC
        )
 SELECT period_start,
    allocation_pool,
    expense_group,
    head_name,
    standard_monthly_provision,
    selected_financial_year_start,
    selected_fy_value,
    comparison_details
   FROM selected_provision;
