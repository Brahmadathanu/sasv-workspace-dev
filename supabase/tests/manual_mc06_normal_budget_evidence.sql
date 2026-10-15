-- Execute after migration in isolated environment; READ ONLY.
select head_name,prior_full_fy_monthly,prior_full_fy_snapshot_date,
 existing_selected_monthly,selected_existing_fy_start,selected_to_prior_ratio,
 budget_review_status from (
 select head_name,prior_full_fy_monthly,prior_full_fy_snapshot_date,
 existing_selected_monthly,existing_selected_fy_start as selected_existing_fy_start,
 selected_to_prior_ratio,budget_review_status
 from costing.fn_preview_mc06_normal_budget_evidence(date '2026-09-01')
) q order by head_name;
-- Eight expenses, zero missing full-FY references expected for frozen Sept 2026 source.
select count(*) heads,
 count(*) filter(where budget_review_status<>'EVIDENCE_ONLY_UNAPPROVED_NORMAL_BUDGET') review_heads,
 sum(prior_full_fy_monthly) prior_total,
 sum(existing_selected_monthly) existing_total
from costing.fn_preview_mc06_normal_budget_evidence(date '2026-09-01');
-- Expected prior total ~629880.0442, current ~974980.2817.
-- This diagnostic neither changes costing snapshots nor certifies budget approval.
