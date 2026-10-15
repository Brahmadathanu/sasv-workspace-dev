-- MC07 normal-capacity versus forecast-capacity absorption variance.
-- READ ONLY; deterministic standalone sensitivity. No refresh/approval.
-- The forward plan is a 12-month sequential lot-sizing scenario, NOT actual completed production.
with reference as (
 select 706203.0::numeric labour_budget,361578.68166667::numeric fixed_oh_budget,
 654456.6::numeric variable_oh_budget,
 11615.9::numeric/12 historical_labour_month,
 12660.5::numeric/12 historical_oh_month,
 12287.3::numeric/12 forecast_labour_month,
 13328.75::numeric/12 forecast_oh_month
), amounts as (
 select 'MANUFACTURING_LABOUR'::text component,labour_budget budget,
 labour_budget/historical_labour_month*forecast_labour_month absorption from reference
 union all select 'FIXED_PRODUCTION_OVERHEAD',fixed_oh_budget,
 fixed_oh_budget/historical_oh_month*forecast_oh_month from reference
 union all select 'VARIABLE_PRODUCTION_OVERHEAD',variable_oh_budget,
 variable_oh_budget/historical_oh_month*forecast_oh_month from reference
)
select component,round(budget,2) reference_budget,round(absorption,2) scenario_absorption,
 round(absorption-budget,2) absorption_variance,
 'SENSITIVITY_NOT_APPROVED_NO_REFRESH'::text control from amounts
union all
select 'TOTAL',round(sum(budget),2),round(sum(absorption),2),
 round(sum(absorption-budget),2),'SENSITIVITY_NOT_APPROVED_NO_REFRESH'
from amounts;
-- Expected approx: budget ₹1,722,238.28; scenario ₹1,816,685.53;
-- over-absorption ₹94,447.25. Neither budget nor volume forecast is validated
-- as period-matched actuals. Do not force a balancing rate or redistribute.
-- IMPORTANT: 'budget - scenario absorption' is NOT an accounting journal variance.
-- Accounting absorption variance requires actual incurred expense and actual completed
-- production for the SAME period, neither of which is supplied by this test.
-- The variable-cost budget normally flexes with actual activity/resource usage;
-- comparing fixed reference variable expenses to forward forecast volumes is only
-- a denominator sensitivity, not proof of actual over-spend or over-absorption.
-- Job Work Expense remains common overhead in this DRAFT; no direct job-work
-- assignment or marginal consumption rule is established by this calculation.

