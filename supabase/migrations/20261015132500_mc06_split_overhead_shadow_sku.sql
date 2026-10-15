-- MC06 read-only SKU shadow; no actual COP snapshot writes.
create or replace function costing.fn_preview_mc06_split_overhead_sku_shadow(
 p_refresh_run_id bigint,p_labour_rate numeric,p_fixed_oh_rate numeric,p_variable_oh_rate numeric
)
returns table(sku_id bigint,product_id bigint,pack_size numeric,pack_uom text,
 base_uom text,base_qty_per_pack numeric,expected_net_output numeric,
 labour_cost_per_pack numeric,fixed_oh_cost_per_pack numeric,variable_oh_cost_per_pack numeric,
 conversion_cost_per_pack numeric,shadow_status text)
language sql stable set search_path=costing,public,pg_temp as $mc06$
select s.id,s.product_id,s.pack_size,s.uom::text,c.base_uom,c.base_quantity_per_pack,
 m.expected_net_output,
 case when c.conversion_status='READY' and c.base_quantity_per_pack>0 and
 m.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then m.labour_cost/m.expected_net_output*c.base_quantity_per_pack end,
 case when c.conversion_status='READY' and c.base_quantity_per_pack>0 and
 m.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then m.fixed_overhead_cost/m.expected_net_output*c.base_quantity_per_pack end,
 case when c.conversion_status='READY' and c.base_quantity_per_pack>0 and
 m.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then m.variable_overhead_cost/m.expected_net_output*c.base_quantity_per_pack end,
 case when c.conversion_status='READY' and c.base_quantity_per_pack>0 and
 m.shadow_status='SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH'
 then m.total_conversion_cost/m.expected_net_output*c.base_quantity_per_pack end,
 case when c.conversion_status is distinct from 'READY' or c.base_quantity_per_pack<=0
 or c.base_quantity_per_pack is null then 'BLOCKED_SKU_CONVERSION'
 when m.product_id is null then 'BLOCKED_PRODUCT_WORKLOAD'
 when m.shadow_status<>'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH' then m.shadow_status
 else 'SHADOW_ONLY_NOT_APPROVED_FOR_REFRESH' end
from public.product_skus s
cross join lateral costing.fn_resolve_standard_sku_base_quantity(s.id) c
left join costing.fn_preview_mc06_split_overhead_product_shadow(
 p_refresh_run_id,p_labour_rate,p_fixed_oh_rate,p_variable_oh_rate) m
 on m.product_id=s.product_id
where s.is_active=true;
$mc06$;
comment on function costing.fn_preview_mc06_split_overhead_sku_shadow(bigint,numeric,numeric,numeric)
is 'MC06 separate fixed and variable OH at SKU level, shadow-only and not a cutover approval.';
