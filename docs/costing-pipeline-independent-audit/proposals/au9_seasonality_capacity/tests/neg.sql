\set VERBOSITY terse
\echo T01 update a profile field (expect ERROR immutable)
update costing.plant_capacity_profile set rated_capacity = 999 where plant_id = 92;
\echo T02 delete a profile (expect ERROR append-only)
delete from costing.plant_capacity_profile where plant_id = 92;
\echo T03 truncate profiles (expect ERROR)
truncate costing.plant_capacity_profile cascade;
\echo T04 update/delete revision journal (expect ERROR x2)
update costing.capacity_master_revision set reason = 'x' where id = 1;
delete from costing.capacity_master_revision where id = 1;
\echo T05 delete fallback row (expect ERROR)
delete from costing.capacity_fallback_policy where resource_class_code = 'GRINDER';
\echo T06 overlapping second profile for same machine (expect ERROR exclusion)
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, capacity_mode, charge_basis, evidence_type, effective_from, change_reason)
values (92, 'CAPACITY_BASED_PRODUCTION', 'FERMENTATION_TANK_3000L', 'CHARGE', 'OUTPUT_VOLUME_L', 'NONE', '2026-12-01', 't');
\echo T07 fictitious capacity on a stove (expect ERROR check)
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 166;
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, capacity_mode, charge_basis, physical_unit, rated_capacity, evidence_type, effective_from, change_reason)
values (166, 'NON_CAPACITY_PRODUCTION', 'HEAT_SOURCE_STOVE', 'CHARGE', 'SOLID_CHARGE_KG', 'kg', 50, 'NONE', '2026-12-01', 't');
rollback;
\echo T08 non-provisional capacity machine without numbers (expect ERROR check)
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 62;
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, capacity_mode, charge_basis, physical_unit, evidence_type, is_provisional, approval_reference, effective_from, change_reason)
values (62, 'CAPACITY_BASED_PRODUCTION', 'SS_PROCESSING_VESSEL', 'CHARGE', 'OUTPUT_VOLUME_L', 'L', 'BMR', false, 'X', '2026-12-01', 't');
rollback;
\echo T09 UNKNOWN marked final (expect ERROR check)
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 105;
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, capacity_mode, charge_basis, evidence_type, is_provisional, approval_reference, effective_from, change_reason)
values (105, 'UNKNOWN', 'WATER_TANK_USED_AS_FERMENTATION', 'NONE', 'NOT_APPLICABLE', 'NONE', false, 'X', '2026-12-01', 't');
rollback;
\echo T10 ALLOWED revision path: close + supersede with user value, journal CLOSE+SUPERSEDE, readiness COSTING_READY (then ROLLBACK)
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 62 and effective_to is null;
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, resource_class_code, capacity_mode, charge_basis, physical_unit, rated_capacity, effective_capacity, evidence_type, evidence_reference, is_provisional, approval_reference, effective_from, supersedes_id, change_reason)
select 62, 'CAPACITY_BASED_PRODUCTION', 'SS_PROCESSING_VESSEL', 'PROCESSING_VESSEL', 'CHARGE', 'OUTPUT_VOLUME_L', 'L', 1000, 800, 'BMR', 'BMR test', false, 'TEST', '2026-12-01', id, 'test revision'
  from costing.plant_capacity_profile where plant_id = 62 and effective_to = '2026-12-01';
select 'T10 journal='||string_agg(action,',' order by id) from costing.capacity_master_revision where plant_id = 62;
select 'T10 readiness='||readiness||' fill='||effective_fill_pct from costing.v_plant_capacity_readiness where plant_id = 62;
rollback;
\echo T11 re-close an already closed row (expect ERROR)
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 62;
update costing.plant_capacity_profile set effective_to = '2027-01-01' where plant_id = 62;
rollback;
\echo T12 hard delete of a machine that has a profile (expect ERROR FK restrict; behaviour change for Plants screen)
delete from public.plant_machinery where id = 145;
\echo T13 precheck: plant master edited since review -> migration aborts (expect ERROR AU9-G1G3)
begin;
update public.plant_machinery set plant_name = plant_name || ' x' where id = 4;
\i /workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_G1_G3_capacity_master.sql
rollback;
\echo T14 approved-run snapshot write still blocked by existing guard (expect ERROR)
update costing.route_load_scaling_snapshot set scaled_factor = 0 where refresh_run_id = 128 and id = 1;
\echo T15 authenticated role: read OK, write denied
set role authenticated;
select 'T15 read rows='||count(*) from costing.plant_capacity_profile;
insert into costing.capacity_fallback_policy(resource_class_code, fallback_allowed, fallback_source, effective_from, approval_reference, change_reason) values ('GRINDER', false, 'BLOCK', '2027-01-01', 'x', 'x');
reset role;
