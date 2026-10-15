-- A7 follow-up: per-SKU batch conversion at the BASELINE illustrative rates (SELECT/STABLE only).
-- labour 729.55483432 / workload unit; overhead = fixed 342.71507286 + variable 620.31351052 = 963.02858338.
with sim as (select * from costing.fn_simulate_preferred_batch_manufacturing_cost(119, 729.55483432, 963.02858338)),
m as (select sku_id, product_id, conversion_to_base from costing.sku_material_cost_snapshot where refresh_run_id=119)
select m.sku_id, m.conversion_to_base, sim.simulated_cost_per_net_base_unit, sim.labour_workload_units,
       sim.overhead_workload_units, sim.expected_net_output, sim.simulation_status
from m left join sim on sim.product_id=m.product_id;
-- MRP policy history for the 21 board SKUs:
-- select sku_id,id,mrp_ik,mrp_ok,effective_from,effective_to,status,created_at from costing.sku_mrp_policy where sku_id in (...) order by 1,5;
