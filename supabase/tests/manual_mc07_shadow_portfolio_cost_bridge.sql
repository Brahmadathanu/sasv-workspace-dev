-- MC07 shadow-only portfolio conversion. Execute in isolated database after MC06 migrations.
-- Rates deliberately explicit sensitivity parameters, not approved manufacturing rates.
-- Never inserts/updates costing snapshot rows or requests refresh.
with source as (
 select s.sku_id,s.product_id,s.internal_loaded_cost_per_sku as old_loaded,
 c.direct_labour_cost_per_sku as old_labour,
 c.production_overhead_cost_per_sku as old_poh
 from costing.sku_pricing_bridge_snapshot s
 join costing.sku_manufacturing_cop_snapshot c
 on c.refresh_run_id=s.refresh_run_id and c.sku_id=s.sku_id
 where s.refresh_run_id=119
), shadow as (
 select sku_id,product_id,expected_net_output,base_qty_per_pack,
 labour_cost_per_pack,fixed_oh_cost_per_pack,variable_oh_cost_per_pack,
 conversion_cost_per_pack,shadow_status
 from costing.fn_preview_mc06_split_overhead_sku_shadow(
  119,729.5548::numeric,342.7151::numeric,620.3135::numeric)
), joined as (
 select s.*,h.expected_net_output,h.base_qty_per_pack,h.labour_cost_per_pack,
 h.fixed_oh_cost_per_pack,h.variable_oh_cost_per_pack,
 h.conversion_cost_per_pack,h.shadow_status,
 (s.old_loaded-s.old_labour-s.old_poh+h.conversion_cost_per_pack)
 as hypothetical_loaded_cost
 from source s left join shadow h on h.sku_id=s.sku_id and h.product_id=s.product_id
)
select count(*) as bridge_rows,
 count(distinct sku_id) as distinct_skus,
 count(*) filter(where shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH') as shadow_arithmetic_ready,
 count(*) filter(where shadow_status is distinct from 'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH') as blocked_shadow,
 count(*) filter(where old_loaded is null or old_labour is null or old_poh is null) as missing_old_components,
 count(*) filter(where hypothetical_loaded_cost<0) as negative_hypothetical_cost,
 sum(old_labour) as old_portfolio_labour_sum,
 sum(old_poh) as old_portfolio_poh_sum,
 sum(labour_cost_per_pack) as hypothetical_portfolio_labour_sum,
 sum(fixed_oh_cost_per_pack) as hypothetical_portfolio_fixed_poh_sum,
 sum(variable_oh_cost_per_pack) as hypothetical_portfolio_variable_poh_sum
from joined;
-- Caution: summing per-SKU costs is NOT monetary pool conservation.
-- Pool conservation requires a separately reviewed monthly manufacturing quantity /
-- batch schedule and must reconcile ₹706203 labour and ₹1016035.28166667 POH
-- without using the 460-product all-batch model as a monthly production plan.
with bridge as (
 select b.sku_id,b.product_id,b.internal_loaded_cost_per_sku,
 c.direct_labour_cost_per_sku,c.production_overhead_cost_per_sku
 from costing.sku_pricing_bridge_snapshot b
 join costing.sku_manufacturing_cop_snapshot c
 on c.refresh_run_id=b.refresh_run_id and c.sku_id=b.sku_id
 where b.refresh_run_id=119 and b.sku_id in (193,988)
), shadow as (
 select * from costing.fn_preview_mc06_split_overhead_sku_shadow(
 119,729.5548::numeric,342.7151::numeric,620.3135::numeric)
 where sku_id in (193,988)
)
select b.sku_id,b.internal_loaded_cost_per_sku,
 b.direct_labour_cost_per_sku,b.production_overhead_cost_per_sku,
 s.expected_net_output,s.base_qty_per_pack,s.labour_cost_per_pack,
 s.fixed_oh_cost_per_pack,s.variable_oh_cost_per_pack,s.shadow_status,
 case when s.shadow_status is distinct from 'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then 'BLOCKED_SHADOW_EVIDENCE'
 else 'REVIEW_ONLY_UNAPPROVED' end as release_decision
from bridge b left join shadow s using(sku_id,product_id) order by b.sku_id;
