drop table if exists sim.sku;
create table sim.sku as
select d.sku_id, d.product_id, d.manufacturing_direct_labour_cost_per_sku*coalesce(p.dl_sh_new/nullif(p.dl_sh,0),1) - d.manufacturing_direct_labour_cost_per_sku dl_delta,
       o.production_overhead_cost_per_sku*coalesce(p.poh_sh_new/nullif(p.poh_sh,0),1) - o.production_overhead_cost_per_sku poh_delta
 from costing.sku_direct_labour_allocation_snapshot d join costing.sku_production_overhead_allocation_snapshot o using(refresh_run_id,sku_id) left join sim.p p on p.product_id=d.product_id
 where d.refresh_run_id=:run;
