create function costing.fn_preview_manufacturing_absorption_gate(p_refresh_run_id bigint)
returns table(refresh_run_id bigint,component_code text,source_amount numeric,workload_units numeric,eligible_products bigint,review_products bigint,approved_rate numeric,illustrative_absorption numeric,gate_status text,reason_code text)
language sql stable security invoker set search_path=costing,pg_temp as $$
with src as (
 select c.refresh_run_id,c.component_code,c.component_pool_amount::numeric source_amount,c.period_start,c.valuation_date
 from costing.direct_labour_component_pool_snapshot c where c.refresh_run_id=p_refresh_run_id and c.component_code='MANUFACTURING_LABOUR'
 union all
 select p.refresh_run_id,'TOTAL_PRODUCTION_OVERHEAD',p.total_pool_amount,p.period_start,p.valuation_date
 from costing.cost_pool_monthly_snapshot p where p.refresh_run_id=p_refresh_run_id and p.allocation_pool='PRODUCTION_OVERHEAD'
), work as (
 select d.refresh_run_id,'MANUFACTURING_LABOUR'::text component_code,
 sum(d.direct_labour_workload_units)::numeric units,
 count(*) filter(where d.workload_status='READY')::bigint ready,
 count(*) filter(where d.workload_status not in ('READY','READY_ZERO_MANUFACTURING_LABOUR'))::bigint review
 from costing.product_direct_labour_workload_snapshot d where d.refresh_run_id=p_refresh_run_id group by d.refresh_run_id
 union all
 select h.refresh_run_id,'TOTAL_PRODUCTION_OVERHEAD',
 sum(h.workload_units),count(*) filter(where h.workload_status='READY'),
 count(*) filter(where h.workload_status not in ('READY','READY_ZERO_PRODUCTION_OVERHEAD'))
 from costing.product_production_overhead_workload_snapshot h where h.refresh_run_id=p_refresh_run_id group by h.refresh_run_id
)
select s.refresh_run_id,s.component_code,s.source_amount,w.units,w.ready,w.review,
 r.standard_rate,
 null::numeric,
 'REVIEW_REQUIRED'::text,
 case when w.units is null or w.review>0 then 'UNRESOLVED_PRODUCT_WORKLOAD'
      when s.component_code='TOTAL_PRODUCTION_OVERHEAD' then 'OVERHEAD_COMPONENT_SPLIT_UNAPPROVED'
      when r.policy_id is null then 'APPROVED_NORMAL_RATE_MISSING'
      else 'ACTUAL_MANUFACTURING_ACTIVITY_UNVERIFIED' end
from src s left join work w using(refresh_run_id,component_code)
left join lateral costing.fn_resolve_manufacturing_standard_rate(
case when s.component_code='MANUFACTURING_LABOUR' then 'MANUFACTURING_LABOUR' else 'PRODUCTION_OVERHEAD' end,
s.component_code,s.valuation_date) r on true
order by s.component_code
$$;
revoke all on function costing.fn_preview_manufacturing_absorption_gate(bigint) from public,anon,authenticated;
comment on function costing.fn_preview_manufacturing_absorption_gate(bigint) is 'Non-activating diagnostic. Historical sales-derived workload is not actual production and is never multiplied into absorption. Explicitly fails closed on missing production activity, rate evidence or overhead split.';