-- MC08 governed candidate consumer, isolated from active refresh chain.
-- Does not write COP snapshots; never signals client refresh readiness.
create or replace function costing.fn_preview_mc08_governed_sku_conversion(p_run bigint)
returns table(sku_id bigint,product_id bigint,labour_per_pack numeric,
 fixed_oh_per_pack numeric,variable_oh_per_pack numeric,total_conversion_per_pack numeric,
 consumer_status text)
language sql stable set search_path=costing,public,pg_temp as $mc08$
with ctx as (
 select r.valuation_date from costing.costing_refresh_run r where r.id=p_run
), gate as (
 select g.rate_cutover_status from costing.fn_preview_manufacturing_rate_cutover_gate(p_run) g
), rates as (
 select
 (select standard_rate from ctx cross join lateral costing.fn_resolve_manufacturing_standard_rate(
 'MANUFACTURING_LABOUR','MANUFACTURING_LABOUR',ctx.valuation_date)) labour_rate,
 (select standard_rate from ctx cross join lateral costing.fn_resolve_manufacturing_standard_rate(
 'PRODUCTION_OVERHEAD','POH_FIXED_COMPONENT',ctx.valuation_date)) fixed_rate,
 (select standard_rate from ctx cross join lateral costing.fn_resolve_manufacturing_standard_rate(
 'PRODUCTION_OVERHEAD','POH_VARIABLE_COMPONENT',ctx.valuation_date)) variable_rate
), shadow as (
 select s.* from rates r cross join lateral
 costing.fn_preview_mc06_split_overhead_sku_shadow(
 p_run,r.labour_rate,r.fixed_rate,r.variable_rate) s
)
select s.sku_id,s.product_id,
 case when g.rate_cutover_status='REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 and s.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then s.labour_cost_per_pack end,
 case when g.rate_cutover_status='REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 and s.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then s.fixed_oh_cost_per_pack end,
 case when g.rate_cutover_status='REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 and s.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then s.variable_oh_cost_per_pack end,
 case when g.rate_cutover_status='REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 and s.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then s.conversion_cost_per_pack end,
 case when g.rate_cutover_status is distinct from 'REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 then 'BLOCKED_FINANCIAL_GATE'
 when s.shadow_status is distinct from 'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then 'BLOCKED_BATCH_OR_CONVERSION'
 else 'REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED' end
from shadow s cross join gate g;
$mc08$;
comment on function costing.fn_preview_mc08_governed_sku_conversion(bigint)
is 'Approved-policy sourced, fail-closed candidate costing consumer; never an active refresh or cutover authorization.';
