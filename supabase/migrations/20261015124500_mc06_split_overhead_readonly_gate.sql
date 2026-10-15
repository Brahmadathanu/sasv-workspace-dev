-- MC06 independent diagnostic only. Does not replace pricing/costing consumers.
-- No APPROVED transition, rate cutover, or refresh is authorised by this migration.
create or replace function costing.fn_preview_mc06_split_overhead_gate(p_refresh_run_id bigint)
returns table (
  refresh_run_id bigint,
  fixed_source_amount numeric,
  variable_source_amount numeric,
  total_source_amount numeric,
  draft_or_approved_split_amount numeric,
  approved_split_amount numeric,
  approved_fixed_rate_count bigint,
  approved_variable_rate_count bigint,
  outcome text
)
language sql stable
set search_path = costing, pg_temp
as $mc06$
with source_pool as (
  select s.total_pool_amount::numeric source_amount
  from costing.cost_pool_monthly_snapshot s
  where s.refresh_run_id = p_refresh_run_id
    and s.allocation_pool = 'PRODUCTION_OVERHEAD'
), components as (
  select coalesce(sum(source_reference_amount) filter(where cost_behaviour='FIXED'),0)::numeric fixed_amount,
         coalesce(sum(source_reference_amount) filter(where cost_behaviour='VARIABLE'),0)::numeric variable_amount,
         coalesce(sum(source_reference_amount),0)::numeric classified_amount,
         coalesce(sum(source_reference_amount) filter(where status='APPROVED'),0)::numeric approved_amount
  from costing.manufacturing_cost_behaviour_split
  where reference_refresh_run_id=p_refresh_run_id
    and source_component_code <> 'MANUFACTURING_LABOUR'
), rates as (
  select count(*) filter(where status='APPROVED' and component_code='POH_FIXED_COMPONENT'
    and cost_behaviour='FIXED' and normal_workload_units>0)::bigint fixed_count,
         count(*) filter(where status='APPROVED' and component_code='POH_VARIABLE_COMPONENT'
    and cost_behaviour='VARIABLE' and normal_workload_units>0)::bigint variable_count
  from costing.manufacturing_standard_rate_policy
  where allocation_pool='PRODUCTION_OVERHEAD'
)
select p_refresh_run_id,c.fixed_amount,c.variable_amount,s.source_amount,c.classified_amount,
       c.approved_amount,r.fixed_count,r.variable_count,
       case when abs(c.classified_amount-s.source_amount) > 0.01 then 'BLOCKED_SOURCE_MISMATCH'
            when abs(c.approved_amount-s.source_amount) > 0.01 then 'BLOCKED_CLASSIFICATION_APPROVAL'
            when r.fixed_count<>1 or r.variable_count<>1 then 'BLOCKED_SPLIT_RATE_APPROVAL'
            else 'REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
       end
from source_pool s cross join components c cross join rates r;
$mc06$;
comment on function costing.fn_preview_mc06_split_overhead_gate(bigint) is
 'Read-only MC06 split-head policy diagnostic. Never authorises production rate cutover or user costing refresh.';
