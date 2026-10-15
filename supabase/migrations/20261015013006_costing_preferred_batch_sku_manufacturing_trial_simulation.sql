create function costing.fn_simulate_preferred_batch_sku_manufacturing_cost(p_refresh_run_id bigint,p_labour_rate numeric,p_overhead_rate numeric)
returns table(sku_id bigint,product_id bigint,pack_size numeric,pack_uom text,base_uom text,base_qty_per_pack numeric,expected_batch_output numeric,simulated_manufacturing_cost_per_pack numeric,simulation_status text)
language sql stable security invoker set search_path=costing,public,pg_temp as $$
select s.id,s.product_id,s.pack_size,s.uom::text,c.base_uom,c.base_quantity_per_pack,p.expected_net_output,
case when c.conversion_status='READY' and c.base_quantity_per_pack>0 and m.simulation_status='SIMULATION_ONLY_NOT_APPROVED_RATE'
then m.simulated_cost_per_net_base_unit*c.base_quantity_per_pack end,
case when c.conversion_status is distinct from 'READY' or c.base_quantity_per_pack is null or c.base_quantity_per_pack<=0 then 'BLOCKED_SKU_CONVERSION'
when m.product_id is null then 'BLOCKED_PRODUCT_WORKLOAD'
when m.simulation_status<>'SIMULATION_ONLY_NOT_APPROVED_RATE' then m.simulation_status
else 'SIMULATION_ONLY_NOT_APPROVED_RATE' end
from public.product_skus s
cross join lateral costing.fn_resolve_standard_sku_base_quantity(s.id) c
left join costing.fn_simulate_preferred_batch_manufacturing_cost(p_refresh_run_id,p_labour_rate,p_overhead_rate) m on m.product_id=s.product_id
left join costing.fn_preview_standard_batch_net_output(p_refresh_run_id) p on p.product_id=s.product_id
where s.is_active=true
$$;
revoke all on function costing.fn_simulate_preferred_batch_sku_manufacturing_cost(bigint,numeric,numeric) from public,anon,authenticated;
comment on function costing.fn_simulate_preferred_batch_sku_manufacturing_cost(bigint,numeric,numeric) is 'Read-only SKU-level manufacturing labour and overhead hypothetical rates. Uses current active SKU and governed conversion; excludes raw materials, packaging and other cost pools. Not active or historical refresh restatement.';