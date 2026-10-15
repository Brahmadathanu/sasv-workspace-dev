-- MC06/MC08 pre-cutover assertions. Read-only; no refresh, approval, or production mutation.
-- Expected today: clear blockers, never 'READY'.
with gate as (
 select * from costing.fn_preview_manufacturing_rate_cutover_gate(119)
), split as (
 select count(*) as rows_total,count(*) filter(where status='APPROVED') as approved
 from costing.manufacturing_cost_behaviour_split
 where reference_refresh_run_id=119
), policies as (
 select count(*) filter(where status='APPROVED') as approved
 from costing.manufacturing_standard_rate_policy
)
select g.refresh_run_id,g.rate_cutover_status,g.source_component_count,
 g.source_amount,g.classified_amount,g.approved_classified_amount,
 s.rows_total as split_heads,s.approved as approved_split_heads,
 p.approved as approved_rate_policies,
 case when g.rate_cutover_status='BLOCKED_CLASSIFICATION_APPROVAL'
 and abs(g.source_amount-g.classified_amount)<0.01
 and s.rows_total=10 and s.approved=0 and p.approved=0
 then 'EXPECTED_BLOCKED_NO_REFRESH' else 'INVESTIGATE_CHANGED_GATE_STATE' end as conclusion
from gate g cross join split s cross join policies p;

-- Expose fail-closed rate readiness, including hardcoded non-packing REVIEW_REQUIRED.
select component_code,source_pool,source_amount,approved_rate,status,reason_code
from costing.fn_preview_manufacturing_rate_readiness(119)
order by component_code;
-- A READY status cannot be inferred from approval rows alone:
-- this read-only readiness function always reports REVIEW_REQUIRED on non-packing heads.
-- To move beyond this gate: approve source/head classification against auditable budget
-- and workload; independently test the new consumer via isolated migration execution,
-- numerical conservation, and mandatory SKU193/988 exception parity; integrate refresh
-- consumer behind fail-closed eligibility only after those results have been reviewed.
