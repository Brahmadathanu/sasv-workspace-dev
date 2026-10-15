with s as (select * from costing.fn_simulate_preferred_batch_manufacturing_cost(119, 503.95, 640.65)),
oh as (select product_id, monthly_product_base_qty mq, rounded_batch_count rbc, monthly_batch_equivalents mbe, workload_units ohwu from costing.product_production_overhead_workload_snapshot where refresh_run_id=119),
dl as (select product_id, direct_labour_workload_units dlwu from costing.product_direct_labour_workload_snapshot where refresh_run_id=119),
j as (select s.*, oh.*, dl.dlwu, (oh.rbc>=10*oh.mbe and oh.mbe>0) f from s join oh using(product_id) join dl using(product_id))
select json_build_object(
 'flagged_products',count(*) filter (where f),
 'flagged_charged_month',round(sum(dlwu*127.95+ohwu*189.08) filter (where f),0),
 'flagged_batchtrue_month',round(sum(simulated_cost_per_net_base_unit*mq) filter (where f),0),
 'other_products',count(*) filter (where not f),
 'other_charged_month',round(sum(dlwu*127.95+ohwu*189.08) filter (where not f),0),
 'other_batchtrue_month',round(sum(simulated_cost_per_net_base_unit*mq) filter (where not f),0),
 'other_understated_month',round(sum(simulated_cost_per_net_base_unit*mq-(dlwu*127.95+ohwu*189.08)) filter (where not f),0),
 'sum_mbe',(select round(sum(monthly_batch_equivalents),2) from costing.product_production_overhead_workload_snapshot where refresh_run_id=119),
 'sum_rbc',(select sum(rounded_batch_count) from costing.product_production_overhead_workload_snapshot where refresh_run_id=119)) r from j;
