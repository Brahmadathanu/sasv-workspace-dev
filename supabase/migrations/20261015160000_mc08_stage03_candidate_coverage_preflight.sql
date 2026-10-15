-- MC08 isolated preflight intended for future guarded Stage03 cutover.
-- READ ONLY: no snapshot mutations and never authorises refresh.
-- Rejects duplicate candidate SKUs and orphan candidate rows; simple row-count
-- equality alone is insufficient because duplicates can mask missing identities.
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
), candidate_counts as (
 select sku_id,count(*)::bigint n,
 count(*) filter(where consumer_status is distinct from 'REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED'
 or labour_per_pack is null or fixed_oh_per_pack is null
 or variable_oh_per_pack is null or total_conversion_per_pack is null)::bigint bad
 from c group by sku_id
), totals as (
 select (select count(*) from active_skus)::bigint n_active,
 (select count(*) from c)::bigint n_candidate,
 (select count(*) from active_skus a left join candidate_counts cc using(sku_id)
 where cc.sku_id is null)::bigint n_missing,
 (select coalesce(sum(case when n<>1 then n else bad end),0) from candidate_counts)::bigint n_blocked,
 (select count(*) from c left join active_skus a using(sku_id)
 where a.sku_id is null)::bigint n_orphan,
 (select count(*) from c where consumer_status='REVIEW_ONLY_ENGINE_PARITY_UNVERIFIED' and
 (labour_per_pack is null or fixed_oh_per_pack is null or
 variable_oh_per_pack is null or total_conversion_per_pack is null))::bigint n_invalid
)
select p_run,t.n_active,t.n_candidate,t.n_blocked,t.n_missing,
 g.rate_cutover_status,
 case when g.rate_cutover_status is distinct from 'REVIEW_REQUIRED_ENGINE_CONSUMPTION_AND_SCOPE_PARITY'
 then 'BLOCKED_FINANCIAL_GATE'
 when t.n_active=0 or t.n_candidate<>t.n_active or t.n_missing>0 or t.n_blocked>0 or t.n_orphan>0 or t.n_invalid>0
 then 'BLOCKED_SCOPE_OR_COST'
 else 'REVIEW_REQUIRED_ACTIVE_CONSUMER_AND_MONETARY_CONSERVATION' end
from totals t cross join g;
$mc08$;
comment on function costing.fn_preview_mc08_stage03_cutover_preflight(bigint)
is 'Read-only SKU coverage and cost preflight. Does not enable refresh even at REVIEW_REQUIRED stage.';
