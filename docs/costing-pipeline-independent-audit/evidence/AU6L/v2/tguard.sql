\set ON_ERROR_STOP 0
select 'designations', string_agg(refresh_run_id||'='||designation, ', ') from costing.v_costing_run_effective_designation;
create or replace function pg_temp.expect_err(p_sql text, p_label text) returns text language plpgsql as $$
begin execute p_sql; return 'FAIL '||p_label||' (no error)';
exception when others then return 'PASS '||p_label||' -> '||left(sqlerrm,110); end $$;
-- G1 run 122 write into new lineage blocked
select pg_temp.expect_err($q$insert into costing.route_load_scaling_snapshot select * from jsonb_populate_record(null::costing.route_load_scaling_snapshot,(select to_jsonb(s)||jsonb_build_object('id',999999999,'refresh_run_id',122) from costing.route_load_scaling_snapshot s where refresh_run_id=933 limit 1))$q$,'G1 run-122 lineage insert');
-- G2 gates
select 'G2 loads gate Sep/Oct', costing.fn_route_load_scaling_mode('2026-09-10'), costing.fn_route_load_scaling_mode('2026-10-16');
select 'G2 sales gate Sep/Oct', costing.fn_costing_sales_feed_mode('2026-09-01'), costing.fn_costing_sales_feed_mode('2026-10-01');
select 'G2 charge fn Sep', (costing.fn_route_batch_charge(695,50000,'Nos','2026-09-10')).*;
-- G3 pre-Oct effective_from rejected
select pg_temp.expect_err($q$update costing.route_equipment_load_capacity set effective_from='2026-09-01' where equipment_class_code='PUTA'$q$,'G3a capacity pre-Oct');
select pg_temp.expect_err($q$update costing.route_load_scaling_switch set effective_from='2026-09-01'$q$,'G3b loads switch pre-Oct');
select pg_temp.expect_err($q$update costing.costing_sales_feed_switch set effective_from='2026-09-01'$q$,'G3c sales switch pre-Oct');
-- G4 terminal run mutation blocked
update costing.costing_refresh_run set overall_status='COMPLETED' where id=933;
select pg_temp.expect_err($q$delete from costing.route_load_scaling_snapshot where refresh_run_id=933$q$,'G4 terminal-run lineage delete');
select pg_temp.expect_err($q$truncate costing.route_load_scaling_snapshot$q$,'G4b truncate');
update costing.costing_refresh_run set overall_status='RUNNING' where id=933;
-- G5 unmapped resource class fails closed (full chain on fresh run inside a rolled-back txn)
begin;
update costing.route_equipment_load_capacity set effective_to='2026-09-30' where is_resource_class_default and resource_class_code='GRINDER';
select costing.t_mkrun2(960);
select pg_temp.expect_err($q$select costing.t_chain(960)$q$,'G5 unmapped GRINDER fails closed');
rollback;
-- G6 Sep-period sales writer uses old (cleaned max) path
begin;
insert into costing.costing_refresh_run select * from jsonb_populate_record(null::costing.costing_refresh_run,(select to_jsonb(r)||jsonb_build_object('id',950,'period_start','2026-09-01','valuation_date','2026-09-30','overall_status','RUNNING','current_stage_code','03_COST_BUILD_TO_SCHEME') from costing.costing_refresh_run r where id=126));
insert into costing.costing_refresh_run_stage select * from jsonb_populate_recordset(null::costing.costing_refresh_run_stage,(select jsonb_agg(to_jsonb(s)||jsonb_build_object('id',s.id+95000000,'refresh_run_id',950,'stage_status',case when s.stage_code='03_COST_BUILD_TO_SCHEME' then 'RUNNING' else s.stage_status end)) from costing.costing_refresh_run_stage s where refresh_run_id=126));
select 'G6 writer', to_jsonb(x)->>'inserted_row_count' from costing.rpc_refresh_sku_sales_allocation_basis_snapshot('2026-09-01','2026-09-30',950) x;
select 'G6 Sep methods', monthly_driver_method, count(*) from costing.sku_sales_allocation_basis_snapshot where refresh_run_id=950 group by 2 order by 2;
rollback;
