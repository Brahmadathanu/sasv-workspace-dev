\set VERBOSITY terse
\pset tuples_only on
\echo R1-T1 by-date resolution at 30 Nov: exactly one covering profile per machine
select 'machines='||count(distinct plant_id)||' rows='||count(*) from costing.plant_capacity_profile where daterange(effective_from, coalesce(effective_to,'infinity'),'[)') @> date '2026-11-30';
\echo R1-T2 voided rows never cover any date
select 'voided_covering='||count(*) from costing.plant_capacity_profile where effective_to = effective_from and daterange(effective_from, effective_to,'[)') @> date '2026-11-01';
\echo R1-T3 edit a voided row (expect ERROR)
update costing.plant_capacity_profile set effective_to = '2027-01-01' where plant_id = 4 and effective_to is not null;
\echo R1-T4 overlapping third row for grinder 4 (expect ERROR exclusion)
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, capacity_mode, charge_basis, physical_unit, rated_capacity, effective_capacity, evidence_type, effective_from, change_reason)
values (4,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','2026-12-01','t');
\echo R1-T5 supersede chain readable (journal for grinder 4 and tank 105)
select plant_id||': '||string_agg(action||'('||coalesce(after_image->>'equipment_class_code','')||' eff '||coalesce(after_image->>'effective_capacity','-')||')',' > ' order by id) from costing.capacity_master_revision where plant_id in (4,45,105) group by plant_id;
\echo R1-T6 partial state -> precheck aborts (simulate: one target already re-revised by hand)
begin;
update costing.plant_capacity_profile set effective_to = '2026-12-01' where plant_id = 4 and effective_to is null;
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, resource_class_code, capacity_mode, charge_basis, physical_unit, rated_capacity, effective_capacity, evidence_type, effective_from, approval_reference, change_reason)
values (4,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,6,'MEASURED_TRIAL','2026-12-01','X','t');
\i /workspace/au4wt/docs/costing-pipeline-independent-audit/proposals/au9_seasonality_capacity/PREPARED_AU9_R1_capacity_revisions.sql
rollback;
