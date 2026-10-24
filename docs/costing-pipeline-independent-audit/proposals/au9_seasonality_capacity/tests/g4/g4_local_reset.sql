-- LOCAL ONLY: remove G4 so the full test sequence can run from a clean R2 state
drop table if exists costing.route_step_load_provenance_snapshot, costing.route_step_capacity_rule, costing.plant_aware_load_switch cascade;
drop function if exists costing.fn_au9_g4_load_mode(date), costing.fn_au9_g4_resolve_step_load(text,numeric,numeric,text,date,bigint,bigint,integer),
  costing.fn_au9_g4_route_step_loads(text,numeric,numeric,text,date,bigint,bigint,integer),
  costing.fn_au9_g4_capture_provenance(bigint,date,date,text,bigint,numeric,numeric,text,jsonb), costing.fn_au9_g4_provenance_guard() cascade;
drop function if exists costing.local_g4_factors(date), costing.local_g4_capture(date);
alter table costing.capacity_master_revision disable trigger trg_cmr_append_only;
delete from costing.capacity_master_revision where entity in ('route_step_capacity_rule','plant_aware_load_switch');
alter table costing.capacity_master_revision enable trigger trg_cmr_append_only;
