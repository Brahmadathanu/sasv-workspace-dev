\set VERBOSITY terse
\set ON_ERROR_STOP 0
\pset format unaligned
\pset tuples_only on
-- each case runs in its own transaction and is rolled back; "ERROR" lines are the expected outcomes
\echo T4a switch starting before 1 Nov 2026 is rejected
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-10-01', 'X', 'test'); rollback;
\echo T4b step rule starting before 1 Nov 2026 is rejected
begin; insert into costing.route_step_capacity_rule(rule_code, resource_class_code, activity_id, activity_name_at_approval, resolution, equipment_class_code, policy_reference, effective_from, approval_reference, change_reason)
       values ('X','GRINDER',290,'x','EQUIPMENT_CLASS_CAPACITY','STONE_GRINDER','X',date '2026-10-01','X','t'); rollback;
\echo T4c resolver refuses October dates (runs 122/128, locked periods)
select costing.fn_au9_g4_resolve_step_load('GRINDER', 100, 100, 'Kg', date '2026-10-16', null, null, 121);
\echo T4d provenance cannot be written for run 128 (October) even with the switch on
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
insert into costing.route_step_load_provenance_snapshot(period_start, valuation_date, refresh_run_id, allocation_pool, product_id, resource_class_code, resolution_basis, fallback_policy_id, loads, switch_id)
values (date '2026-11-01', date '2026-11-30', 128, 'PRODUCTION_OVERHEAD', 1, 'GRINDER', 'CLASS_FALLBACK', 1, 1, (select max(id) from costing.plant_aware_load_switch)); rollback;
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
insert into costing.route_step_load_provenance_snapshot(period_start, valuation_date, refresh_run_id, allocation_pool, product_id, resource_class_code, resolution_basis, fallback_policy_id, loads, switch_id)
values (date '2026-10-01', date '2026-10-16', 128, 'PRODUCTION_OVERHEAD', 1, 'GRINDER', 'CLASS_FALLBACK', 1, 1, (select max(id) from costing.plant_aware_load_switch)); rollback;
\echo T4e provenance rows are immutable
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
select 'captured='||costing.fn_au9_g4_capture_provenance(9001, date '2026-11-01', date '2026-11-30', 'PRODUCTION_OVERHEAD', 1266, 4.9, 1, 'Kg', '[{"effective_step_key":"K1","resource_class_code":"GRINDER","activity_id":133}]');
update costing.route_step_load_provenance_snapshot set loads = 9; rollback;
\echo T4f switch and rules are close-only (no edits, no deletes)
begin; update costing.route_step_capacity_rule set equipment_class_code = 'STONE_GRINDER' where rule_code = 'P26_KAJJALI_KHALVAM'; rollback;
begin; delete from costing.route_step_capacity_rule; rollback;
\echo T7a step names a machine with no capacity profile -> error
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
insert into public.plant_machinery(id, section_id, subsection_id, area_id, plant_name, status, type_id) select 99999, section_id, subsection_id, area_id, 'TEST machine without profile', 'O', type_id from public.plant_machinery where id = 29;
update costing.production_route_family_route_step set plant_id = 99999 where id = (select base_step_id from costing.local_step_evidence where resource_class_code='GRINDER' and base_step_id is not null limit 1);
select sum(factor) from costing.local_g4_factors(date '2026-11-30'); rollback;
\echo T7b no usable capacity and the class fallback withdrawn -> error
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
update costing.capacity_fallback_policy set effective_to = date '2026-11-15' where resource_class_code = 'GRINDER' and effective_to is null;
select costing.fn_au9_g4_resolve_step_load('GRINDER', 100, 100, 'Kg', date '2026-11-30', null, null, 21); rollback;
\echo T7c step rule on a class whose machines differ (stone grinders 10/5/3 kg) -> error, never an average
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
insert into costing.route_step_capacity_rule(rule_code, resource_class_code, activity_id, activity_name_at_approval, resolution, equipment_class_code, policy_reference, effective_from, approval_reference, change_reason)
values ('TEST_STONE','GRINDER',290,'Hydraulic crushing — Rasoushadhi','EQUIPMENT_CLASS_CAPACITY','STONE_GRINDER','TEST',date '2026-11-01','TEST','t');
select costing.fn_au9_g4_resolve_step_load('GRINDER', 100, 100, 'Kg', date '2026-11-30', null, null, 290); rollback;
\echo T7d step rule on a class with no operational machine capacity -> error
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
insert into costing.route_step_capacity_rule(rule_code, resource_class_code, activity_id, activity_name_at_approval, resolution, equipment_class_code, policy_reference, effective_from, approval_reference, change_reason)
values ('TEST_KHALVAM_MANUAL','GRINDER',303,'Vennei grinder homogenization','EQUIPMENT_CLASS_CAPACITY','KHALVAM_MANUAL_LEVIGATION','TEST',date '2026-11-01','TEST','t');
select costing.fn_au9_g4_resolve_step_load('GRINDER', 100, 100, 'Kg', date '2026-11-30', null, null, 303); rollback;
\echo T7e litre-rated machine with a batch output in kg -> error (no density assumed)
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
update costing.production_route_family_route_step set plant_id = 105 where id = (select base_step_id from costing.local_step_evidence where resource_class_code='FERMENTATION_VESSEL' and base_step_id is not null limit 1);
select costing.fn_au9_g4_resolve_step_load('FERMENTATION_VESSEL', 100, 100, 'Kg', date '2026-11-30', (select base_step_id from costing.local_step_evidence where resource_class_code='FERMENTATION_VESSEL' and base_step_id is not null limit 1), null, null);
select 'T7e same step in litres resolves: '||costing.fn_au9_g4_resolve_step_load('FERMENTATION_VESSEL', 100, 2500, 'L', date '2026-11-30', (select base_step_id from costing.local_step_evidence where resource_class_code='FERMENTATION_VESSEL' and base_step_id is not null limit 1), null, null)::text; rollback;
\echo T7f step evidence activity contradicting the governed route -> error
begin; insert into costing.plant_aware_load_switch(is_enabled, effective_from, approval_reference, change_reason) values (true, date '2026-11-01', 'LOCAL-TEST-ONLY', 'test');
select costing.fn_au9_g4_resolve_step_load('GRINDER', 100, 100, 'Kg', date '2026-11-30', (select base_step_id from costing.local_step_evidence where activity_id=121 and base_step_id is not null and override_id is null limit 1), null, 133); rollback;
\echo T7g lineage pointing to a missing route step -> error
select costing.fn_au9_g4_resolve_step_load('GRINDER', 100, 100, 'Kg', date '2026-11-30', 987654321, null, null);
\echo T5 package refuses to patch a refresh RPC that changed since review (simulated drift)
begin; create or replace function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 returns table(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 language plpgsql security definer set search_path to 'costing', 'public', 'pg_temp' as $x$ begin return; end $x$;
\i /workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_G4_plant_aware_loads.sql
rollback;
\echo state after negatives (must equal installed state)
\i /workspace/au9/g4/g4_state.sql
