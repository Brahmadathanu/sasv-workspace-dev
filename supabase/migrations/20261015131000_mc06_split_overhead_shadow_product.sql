-- MC06 shadow-only product split-overhead simulation.
-- NEVER feeds refresh chain or overrides governed active COP.
create or replace function costing.fn_preview_mc06_split_overhead_product_shadow(
 p_refresh_run_id bigint, p_labour_rate numeric, p_fixed_oh_rate numeric, p_variable_oh_rate numeric
)
returns table(
 product_id bigint, labour_workload_units numeric, overhead_workload_units numeric,
 expected_net_output numeric, labour_cost numeric, fixed_overhead_cost numeric,
 variable_overhead_cost numeric, total_conversion_cost numeric, cost_per_net_base_unit numeric,
 shadow_status text
)
language sql stable set search_path = costing,public,pg_temp as $mc06$
with w as (
 select q.product_id,q.manufacturing_labour_units_per_standard_batch as labour_units,
 q.overhead_units_per_standard_batch as oh_units,q.foundation_status,
 o.expected_net_output,o.output_status
 from costing.fn_preview_standard_batch_workload(p_refresh_run_id) q
 left join costing.fn_preview_standard_batch_net_output(p_refresh_run_id) o on o.product_id=q.product_id
), evaluated as (
 select w.*,
 case when p_labour_rate>=0 and w.labour_units>=0 then w.labour_units*p_labour_rate end lc,
 case when p_fixed_oh_rate>=0 and w.oh_units>=0 then w.oh_units*p_fixed_oh_rate end fc,
 case when p_variable_oh_rate>=0 and w.oh_units>=0 then w.oh_units*p_variable_oh_rate end vc
 from w
)
select e.product_id,e.labour_units,e.oh_units,e.expected_net_output,e.lc,e.fc,e.vc,
 case when e.foundation_status='STANDARD_BATCH_REFERENCE_READY' and e.output_status='READY_EXPECTED_NET_OUTPUT'
 and e.expected_net_output>0 and e.lc is not null and e.fc is not null and e.vc is not null
 then e.lc+e.fc+e.vc end,
 case when e.foundation_status='STANDARD_BATCH_REFERENCE_READY' and e.output_status='READY_EXPECTED_NET_OUTPUT'
 and e.expected_net_output>0 and e.lc is not null and e.fc is not null and e.vc is not null
 then (e.lc+e.fc+e.vc)/e.expected_net_output end,
 case when e.foundation_status is distinct from 'STANDARD_BATCH_REFERENCE_READY' or e.output_status is distinct from 'READY_EXPECTED_NET_OUTPUT'
      or e.expected_net_output is null or e.expected_net_output<=0
      then 'REVIEW_REQUIRED_FOUNDATION_OR_OUTPUT'
      when e.lc is null or e.fc is null or e.vc is null then 'REVIEW_REQUIRED_SHADOW_RATE'
      else 'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH' end
from evaluated e;
$mc06$;
comment on function costing.fn_preview_mc06_split_overhead_product_shadow(bigint,numeric,numeric,numeric)
is 'MC06 shadow-only separated OH product simulation. No active cost allocation or approval.';
