-- MC08 isolated preflight intended for future guarded Stage03 cutover.
-- READ ONLY: no snapshot mutations and never authorises refresh.
create or replace function costing.fn_preview_mc08_stage03_cutover_preflight(p_run bigint)
returns table(reference_run bigint,active_skus bigint,candidate_skus bigint,
 blocked_candidate_skus bigint,missing_candidate_skus bigint,
 financial_status text,release_status text)
language sql stable set search_path=costing,public,pg_temp as $mc08$
with active_skus as (
 select s.id sku_id from public.product_skus s where s.is_active=true
), c as (
 select * from costing.fn_preview_mc08_governed_sku_conversion(p_run)
), g as (
 select rate_cutover_status from costing.fn_preview_manufacturing_rate_cutover_gate(p_run)
), totals as (
 select count(*)::bigint n_active,
 count(c.sku_id)::bigint n_candidate,
 count(*) filter(where c.sku_id is null)::bigint n_missing,
 count(*) filter(where c.consumer_status is distinct from 'REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED')::bigint n_blocked,
 count(*) filter(where c.consumer_status='REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED' and
 (c.labour_per_pack is null or c.fixed_oh_per_pack is null or
 c.variable_oh_per_pack is null or c.total_conversion_per_pack is null))::bigint n_invalid
 from active_skus a left join c on c.sku_id=a.sku_id
)
select p_run,t.n_active,t.n_candidate,t.n_blocked,t.n_missing,
 g.rate_cutover_status,
 case when g.rate_cutover_status is distinct from 'REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 then 'BLOCKED_FINANCIAL_GATE'
 when t.n_active=0 or t.n_candidate<>t.n_active or t.n_missing>0 or t.n_blocked>0 or t.n_invalid>0
 then 'BLOCKED_SCOPE_OR_COST'
 else 'REVIEW_REQUIRED_ACTIVE_CONSUMER_AND_MONETARY_CONSERVATION' end
from totals t cross join g;
$mc08$;
comment on function costing.fn_preview_mc08_stage03_cutover_preflight(bigint)
is 'Read-only SKU coverage and cost preflight. Does not enable refresh even at REVIEW_REQUIRED stage.';
