with f as (select as_of_date d, net_cb_value v, lag(net_cb_value) over (order by as_of_date) pv from public.tally_expenses_snapshot where head_name='Fuel & Gas (DE)' and as_of_date between '2026-04-01' and '2026-08-07'),
s as (select tally_item_name i, as_of_date d, qty_value q, coalesce(rate_value, lag(rate_value) over w) r, lag(qty_value) over w pq from public.tally_fuel_stock_snapshot window w as (partition by tally_item_name order by as_of_date)),
mo as (select to_char(date_trunc('month',d),'YYYY-MM') m, round(sum(case when q<pq then (pq-q)*coalesce(r,0) end)) iss, round(sum(case when q>pq then (q-pq)*coalesce(r,0) end)) rec from s group by 1)
select json_build_object(
 'ledger_first_date',(select min(d) from f),
 'ledger_first_value',(select v from f order by d limit 1),
 'ledger_increments_after_first',(select json_agg(v-pv) from f where pv is not null and v<>pv),
 'provision_selected',(select round(standard_monthly_provision,2) from costing.v_expense_head_monthly_provision where period_start='2026-09-01' and head_name='Fuel & Gas (DE)'),
 'issues_2026_06',(select iss from mo where m='2026-06'),'issues_2026_07',(select iss from mo where m='2026-07'),
 'issues_2026_08',(select iss from mo where m='2026-08'),'issues_2026_09',(select iss from mo where m='2026-09'),
 'receipts_2026_06',(select rec from mo where m='2026-06')) r;
