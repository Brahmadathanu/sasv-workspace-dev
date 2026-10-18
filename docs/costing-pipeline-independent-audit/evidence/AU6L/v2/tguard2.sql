create or replace function pg_temp.expect_err(p_sql text, p_label text) returns text language plpgsql as $$
begin execute p_sql; return 'FAIL '||p_label||' (no error)';
exception when others then return 'PASS '||p_label||' -> '||left(sqlerrm,120); end $$;
begin;
update costing.costing_refresh_run set overall_status='SUCCESS' where id=933;
select pg_temp.expect_err($q$delete from costing.route_load_scaling_snapshot where refresh_run_id=933$q$,'G4 terminal-run lineage delete');
select pg_temp.expect_err($q$update costing.route_load_scaling_snapshot set route_factor=route_factor where refresh_run_id=933$q$,'G4 terminal-run lineage update');
rollback;
begin;
delete from costing.route_equipment_load_capacity where is_resource_class_default and resource_class_code='GRINDER';
select costing.t_mkrun2(960) is not null mk;
select pg_temp.expect_err($q$select costing.t_chain(960)$q$,'G5 unmapped GRINDER fails closed');
rollback;
select 'after rollback runs', string_agg(id::text,',') from costing.costing_refresh_run;
