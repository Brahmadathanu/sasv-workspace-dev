\set VERBOSITY terse
\echo R2-T1 partial state -> precheck aborts
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 4 and effective_to is null;
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, resource_class_code, capacity_mode, charge_basis, physical_unit, rated_capacity, effective_capacity, evidence_type, effective_from, approval_reference, change_reason)
values (4,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,18,'MEASURED_TRIAL','2026-12-01','X','t');
\i /workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_R2_capacity_corrections.sql
rollback;
\echo R2-T2 edit a superseded R1 row (expect ERROR)
update costing.plant_capacity_profile set effective_capacity = 9 where plant_id = 4 and approval_reference = 'USER-SUPPLIED-20261018-AU9-R1';
