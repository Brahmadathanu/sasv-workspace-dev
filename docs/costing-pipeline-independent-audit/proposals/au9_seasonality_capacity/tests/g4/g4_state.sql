\pset format unaligned
\pset tuples_only on
select 'g4_state switch='||(select count(*) from costing.plant_aware_load_switch)||' rules='||(select count(*) from costing.route_step_capacity_rule)
  ||' provenance='||(select count(*) from costing.route_step_load_provenance_snapshot)
  ||' rules_md5='||(select md5(string_agg(concat_ws(',',rule_code,activity_id,resolution,equipment_class_code,effective_from,effective_to,approval_reference),'|' order by rule_code)) from costing.route_step_capacity_rule)
  ||' g4_fn_md5='||(select md5(string_agg(md5(pg_get_functiondef(p.oid)),'|' order by p.oid::regprocedure::text)) from pg_proc p where p.pronamespace='costing'::regnamespace and (p.proname like 'fn_au9_g4%' or p.proname like 'rpc_refresh%'))
  ||' rpc_poh='||md5(pg_get_functiondef('costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint)'::regprocedure))
  ||' rpc_dl='||md5(pg_get_functiondef('costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)'::regprocedure))
  ||' journal='||(select count(*) from costing.capacity_master_revision)
  ||' profiles='||(select count(*) from costing.plant_capacity_profile);
