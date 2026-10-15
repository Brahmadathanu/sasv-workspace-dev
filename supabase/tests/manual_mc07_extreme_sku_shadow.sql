-- MC07 named extreme-SKU diagnostic; run in isolated DB after MC06 shadow migrations.
-- Rates are illustrative first-transfer historical sensitivities, NOT approvals.
with old as (
 select b.sku_id,b.product_id,b.internal_loaded_cost_per_sku,
 c.rm_cost_per_sku,c.pm_cost_per_sku,c.direct_labour_cost_per_sku,
 c.production_overhead_cost_per_sku
 from costing.sku_pricing_bridge_snapshot b
 join costing.sku_manufacturing_cop_snapshot c
 on c.refresh_run_id=b.refresh_run_id and c.sku_id=b.sku_id
 where b.refresh_run_id=119 and b.sku_id in (193,988)
), shadow as (
 select sku_id,product_id,expected_net_output,base_qty_per_pack,
 labour_cost_per_pack,fixed_oh_cost_per_pack,variable_oh_cost_per_pack,
 conversion_cost_per_pack,shadow_status
 from costing.fn_preview_mc06_split_overhead_sku_shadow(119,729.5548,342.7151,620.3135)
 where sku_id in (193,988)
)
select o.*,s.expected_net_output,s.base_qty_per_pack,
 s.labour_cost_per_pack,s.fixed_oh_cost_per_pack,s.variable_oh_cost_per_pack,
 s.conversion_cost_per_pack,s.shadow_status,
 case when s.sku_id is null then 'BLOCKED_MISSING_SHADOW'
 when s.shadow_status is distinct from 'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then 'BLOCKED_UNREADY_SHADOW' else 'REVIEW_ONLY_UNAPPROVED' end as gate
from old o left join shadow s using(sku_id,product_id)
order by o.sku_id;
-- No pricing proposal recommendation or runtime activation follows from this query.
