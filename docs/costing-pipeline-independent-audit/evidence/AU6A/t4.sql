\set VERBOSITY terse
-- G1 lineage row for APPROVED run 122 is blocked
insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run,(select to_jsonb(r)||'{"id":122,"overall_status":"SUCCESS","period_start":"2026-09-01","valuation_date":"2026-09-10"}' from costing.costing_refresh_run r where id=126));
insert into costing.route_batch_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,scaling_mode) values ('2026-09-01','2026-09-10',122,'PRODUCTION_OVERHEAD',1,'SYMMETRIC');
-- G2 lineage row for terminal (SUCCESS) run 126 is blocked
insert into costing.route_batch_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,scaling_mode) values ('2026-10-01','2026-10-16',126,'PRODUCTION_OVERHEAD',1,'SYMMETRIC');
-- G3 lineage immutable once run is terminal: mark 903 SUCCESS then try update/delete
update costing.costing_refresh_run set overall_status='SUCCESS' where id=903;
update costing.route_batch_scaling_snapshot set scaled_factor=0 where refresh_run_id=903;
delete from costing.route_batch_scaling_snapshot where refresh_run_id=903;
truncate costing.route_batch_scaling_snapshot;
-- G4 re-running writers on an existing run is refused (immutable snapshots)
update costing.costing_refresh_run set overall_status='RUNNING' where id=903;
select costing.rpc_refresh_production_overhead_workload_snapshot('2026-10-01','2026-10-16',903);
-- G5 Sep valuation: gate closed
select 'G5 sep gate rows' t, count(*) from costing.fn_route_batch_scaling_mode('2026-09-10');
select 'G5 oct gate rows' t, count(*) from costing.fn_route_batch_scaling_mode('2026-10-16');
-- G6 switch off -> closed; batch-true off -> closed
begin; update costing.route_batch_scaling_switch set is_enabled=false; select 'G6 switch off' t, count(*) from costing.fn_route_batch_scaling_mode('2026-10-16'); rollback;
begin; update costing.batch_true_standard_switch set is_enabled=false; select 'G6 bt off' t, count(*) from costing.fn_route_batch_scaling_mode('2026-10-16'); rollback;
-- G7 fail-closed on unmapped resource class
select costing.t_mkrun(904,false);
begin; delete from costing.route_step_scale_exponent where resource_class_code='GRINDER';
select costing.rpc_refresh_production_overhead_workload_snapshot('2026-10-01','2026-10-16',904); rollback;
begin; delete from costing.route_step_scale_exponent where resource_class_code='GRINDER';
select * from costing.rpc_refresh_sku_direct_labour_component_split_snapshot('2026-10-01','2026-10-16',904); rollback;
-- G8 effective_from check refuses pre-Oct
update costing.route_batch_scaling_switch set effective_from='2026-09-01';
-- G9 mismatch detector: tamper DL lineage ref on a fresh run, POH must refuse
select costing.t_mkrun(905,false);
select (select count(*) from costing.rpc_refresh_sku_direct_labour_component_split_snapshot('2026-10-01','2026-10-16',905)) dl_rows;
update costing.route_batch_scaling_snapshot set reference_batch_size=reference_batch_size+1 where refresh_run_id=905 and product_id=468;
select costing.rpc_refresh_production_overhead_workload_snapshot('2026-10-01','2026-10-16',905);
select 'G10 counts unchanged 903' t, (select count(*) from costing.route_batch_scaling_snapshot where refresh_run_id=903) n;
