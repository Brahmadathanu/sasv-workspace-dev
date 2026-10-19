with d as (select refresh_run_id run, sku_id, resolved_sales_units u, direct_labour_cost_per_sku dl, manufacturing_direct_labour_cost_per_sku mdl, packing_labour_cost_per_sku pl,
                  direct_labour_pool_amount dlpool, manufacturing_direct_labour_pool_amount mdlpool, packing_labour_pool_amount plpool
           from costing.sku_direct_labour_allocation_snapshot where refresh_run_id in (122,128)),
o as (select refresh_run_id run, sku_id, production_overhead_cost_per_sku po, quality_control_overhead_cost_per_sku qc, materials_stores_overhead_cost_per_sku st,
             production_pool_amount pop, quality_control_pool_amount qcp, materials_stores_pool_amount stp from costing.sku_overhead_allocation_snapshot where refresh_run_id in (122,128)),
i as (select refresh_run_id run, sku_id, admin_overhead_cost_per_sku ad, finance_admin_overhead_cost_per_sku fa from costing.sku_internal_loaded_cost_snapshot where refresh_run_id in (122,128)),
b as (select refresh_run_id run, sku_id, marketing_expense_cost_per_sku mk, marketing_expense_cost_per_sku_ik mki, marketing_expense_cost_per_sku_ok mko from costing.sku_pricing_bridge_snapshot where refresh_run_id in (122,128))
select d.run,
 jsonb_build_object(
  'units_null', count(*) filter (where u is null),
  'sum_units', sum(u),
  'dl_alloc', sum(dl*u), 'dl_pool', max(dlpool), 'dl_pool_distinct', count(distinct dlpool),
  'mdl_alloc', sum(mdl*u), 'mdl_pool', max(mdlpool), 'pl_alloc', sum(pl*u), 'pl_pool', max(plpool),
  'po_alloc', sum(po*u), 'po_pool', max(pop), 'qc_alloc', sum(qc*u), 'qc_pool', max(qcp), 'st_alloc', sum(st*u), 'st_pool', max(stp),
  'admin_alloc', sum(ad*u), 'finadmin_alloc', sum(fa*u), 'mkt_alloc', sum(mk*u), 'mkt_ik_alloc', sum(mki*u), 'mkt_ok_alloc', sum(mko*u)
 ) r,
 (select jsonb_agg(to_jsonb(p) - 'id' - 'refreshed_at') from costing.cost_pool_monthly_snapshot p where p.refresh_run_id=d.run) pools
from d join o using (run, sku_id) join i using (run, sku_id) join b using (run, sku_id) group by d.run order by 1
