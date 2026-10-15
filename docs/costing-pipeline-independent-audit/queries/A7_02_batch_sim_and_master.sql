-- A7: per-SKU batch-true DL+POH (live STABLE simulator, SIMULATION_ONLY) + master-data overlay. SELECT-only.
with sim as (select * from costing.fn_simulate_preferred_batch_manufacturing_cost(119, 503.95, 640.65)),
m as (select sku_id, product_id, pack_size, pack_uom, conversion_to_base from costing.sku_material_cost_snapshot where refresh_run_id=119)
select json_build_object(
 'sku', (select json_agg(json_build_object('sku_id',m.sku_id,'conv',m.conversion_to_base,'sim_per_base',sim.simulated_cost_per_net_base_unit,'sim_status',sim.simulation_status)) from m left join sim on sim.product_id=m.product_id),
 'master', (select json_agg(json_build_object('sku_id',ps.id,'product_id',ps.product_id,'name',p.item,'pack',ps.pack_size,'uom',ps.uom,'active',ps.is_active,'sample',ps.is_sample)) from public.product_skus ps join public.products p on p.id=ps.product_id)
)
