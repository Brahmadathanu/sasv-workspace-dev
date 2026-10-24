-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- =====================================================================
-- AU-9 R2 PREPARED SQL: corrected + additional capacity-profile revisions (user-corrected values)
-- STATUS: PREPARED + TESTED LOCALLY. NOT APPLIED LIVE. Outside supabase/migrations.
-- For live: pass the body unchanged to Supabase MCP apply_migration, name au9_r2_capacity_corrections.
-- Source: user 18 Oct 2026 18:19 IST. The R1 values (8 kg / 2 kg / 2 kg) were WRONG and are superseded.
-- Effect: 77 machines get a CLOSE (void before effect) + SUPERSEDE revision, still effective 1 Nov 2026,
-- all provisional: 50 R1 rows superseded + 27 machines revised for the first time.
-- Throughput machines are recorded as RATED THROUGHPUT (kg/h) for capacity planning only. Costing does
-- not use time: no hours_per_load, and no costing function reads these tables until G4.
-- No schema change (R1 already allows void-before-effect rows). Runs, snapshots and periods untouched.
-- =====================================================================

-- ---------- §0 prechecks ----------
do $$
declare v_r1 int; v_g2 int; v_r2 int;
begin
  if (select count(*) from costing.plant_capacity_profile where effective_to is null) <> 171 then
    raise exception 'AU9-R2: expected 171 open profiles'; end if;
  select count(*) filter (where approval_reference = 'USER-SUPPLIED-20261018-AU9-R1' and plant_id = any(array[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,41,42,43,44,45,46,105,106,107,108,109,110,111,112,113,114,156,159,161])),
         count(*) filter (where approval_reference = 'USER-APPROVAL-20261018-AU9-G1G3' and plant_id = any(array[68,69,70,71,72,73,74,75,76,77,78,79,80,81,174,2,127,129,131,132,133,134,135,136,137,138,162])),
         count(*) filter (where approval_reference = 'USER-CORRECTED-20261018-AU9-R2')
    into v_r1, v_g2, v_r2
    from costing.plant_capacity_profile where effective_to is null and plant_id = any(array[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,41,42,43,44,45,46,68,69,70,71,72,73,74,75,76,77,78,79,80,81,174,105,106,107,108,109,110,111,112,113,114,156,159,161,2,127,129,131,132,133,134,135,136,137,138,162]);
  if not ((v_r1 = 50 and v_g2 = 27 and v_r2 = 0) or (v_r1 = 0 and v_g2 = 0 and v_r2 = 77)) then
    raise exception 'AU9-R2: targets in unexpected state (R1 %, G2 %, R2 %); re-review', v_r1, v_g2, v_r2; end if;
  if v_r2 = 0 and exists (
     select 1 from costing.plant_capacity_profile p
      join (values (4,'RASOUSHADHI_LEVIGATION_GRINDER'),(5,'RASOUSHADHI_LEVIGATION_GRINDER'),(6,'RASOUSHADHI_LEVIGATION_GRINDER'),(7,'RASOUSHADHI_LEVIGATION_GRINDER'),(8,'RASOUSHADHI_LEVIGATION_GRINDER'),(9,'RASOUSHADHI_LEVIGATION_GRINDER'),(10,'RASOUSHADHI_LEVIGATION_GRINDER'),(11,'RASOUSHADHI_LEVIGATION_GRINDER'),(12,'RASOUSHADHI_LEVIGATION_GRINDER'),(13,'RASOUSHADHI_LEVIGATION_GRINDER'),(14,'RASOUSHADHI_LEVIGATION_GRINDER'),(15,'RASOUSHADHI_LEVIGATION_GRINDER'),(16,'RASOUSHADHI_LEVIGATION_GRINDER'),(17,'RASOUSHADHI_LEVIGATION_GRINDER'),(18,'RASOUSHADHI_LEVIGATION_GRINDER'),(19,'RASOUSHADHI_LEVIGATION_GRINDER'),(20,'RASOUSHADHI_LEVIGATION_GRINDER'),(21,'RASOUSHADHI_LEVIGATION_GRINDER'),(22,'RASOUSHADHI_LEVIGATION_GRINDER'),(23,'RASOUSHADHI_LEVIGATION_GRINDER'),(24,'RASOUSHADHI_LEVIGATION_GRINDER'),(25,'RASOUSHADHI_LEVIGATION_GRINDER'),(26,'RASOUSHADHI_LEVIGATION_GRINDER'),(27,'RASOUSHADHI_LEVIGATION_GRINDER'),(28,'RASOUSHADHI_LEVIGATION_GRINDER'),(29,'RASOUSHADHI_LEVIGATION_GRINDER'),(30,'RASOUSHADHI_LEVIGATION_GRINDER'),(31,'RASOUSHADHI_LEVIGATION_GRINDER'),(32,'RASOUSHADHI_LEVIGATION_GRINDER'),(33,'RASOUSHADHI_LEVIGATION_GRINDER'),(34,'RASOUSHADHI_LEVIGATION_GRINDER'),(41,'STONE_GRINDER'),(42,'STONE_GRINDER'),(43,'STONE_GRINDER'),(44,'STONE_GRINDER'),(45,'MECHANISED_KHALVAM_SET'),(46,'MECHANISED_KHALVAM_SET'),(68,'PILLS_WET_GRINDER'),(69,'PILLS_WET_GRINDER'),(70,'PILLS_WET_GRINDER'),(71,'PILLS_WET_GRINDER'),(72,'PILLS_WET_GRINDER'),(73,'PILLS_WET_GRINDER'),(74,'PILLS_WET_GRINDER'),(75,'PILLS_WET_GRINDER'),(76,'PILLS_WET_GRINDER'),(77,'PILLS_WET_GRINDER'),(78,'PILLS_WET_GRINDER'),(79,'PILLS_WET_GRINDER'),(80,'PILLS_WET_GRINDER'),(81,'STONE_GRINDER'),(174,'WET_GRINDER'),(105,'FERMENTATION_TANK_1000L'),(106,'FERMENTATION_TANK_1000L'),(107,'FERMENTATION_TANK_1000L'),(108,'FERMENTATION_TANK_1000L'),(109,'FERMENTATION_TANK_1000L'),(110,'FERMENTATION_TANK_1000L'),(111,'FERMENTATION_TANK_1000L'),(112,'FERMENTATION_TANK_1000L'),(113,'FERMENTATION_TANK_1000L'),(114,'FERMENTATION_TANK_1000L'),(156,'FERMENTATION_TANK_1000L'),(159,'FERMENTATION_TANK_500L'),(161,'FERMENTATION_TANK_500L'),(2,'PULVERISER_DISINTEGRATOR'),(127,'PULVERISER_DISINTEGRATOR'),(129,'PULVERISER_DISINTEGRATOR'),(131,'PULVERISER_DISINTEGRATOR'),(132,'PULVERISER_DISINTEGRATOR'),(133,'PULVERISER_DISINTEGRATOR'),(134,'PULVERISER_DISINTEGRATOR'),(135,'PULVERISER_DISINTEGRATOR'),(136,'VIBRO_SIFTER'),(137,'VIBRO_SIFTER'),(138,'VIBRO_SIFTER'),(162,'VIBRO_SIFTER')) e(plant_id, eq) on e.plant_id = p.plant_id
     where p.effective_to is null and (p.equipment_class_code <> e.eq or p.effective_from <> date '2026-11-01')) then
    raise exception 'AU9-R2: a target profile differs from the reviewed state'; end if;
end $$;

drop table if exists pg_temp.au9_baseline;
create temp table au9_baseline as
  select 'fn:'||p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('costing','public') and p.prokind in ('f','p')
  union all
  select 'view:'||c.oid::regclass::text, md5(pg_get_viewdef(c.oid))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('costing','public') and c.relkind in ('v','m')
  union all
  select 'run:'||r, md5(costing.fn_compute_run_fingerprint(r)::text) from (values (122::bigint),(128::bigint)) t(r);

-- ---------- §2 equipment classes (split throughput classes) ----------
insert into costing.machine_equipment_class(code, description, default_applicability, default_resource_class_code, default_capacity_mode, default_physical_unit) values
 ('DISINTEGRATOR','Disintegrator (rated throughput, kg/h)','CAPACITY_BASED_PRODUCTION','GRINDER','THROUGHPUT','kg/h'),
 ('SEMI_AUTO_PULVERISER','Semi-automatic pulveriser (rated throughput, kg/h)','CAPACITY_BASED_PRODUCTION','GRINDER','THROUGHPUT','kg/h'),
 ('VIBRO_SIFTER_HORIZONTAL','Vibro sifter, horizontal (rated throughput, kg/h)','CAPACITY_BASED_PRODUCTION','GRINDER','THROUGHPUT','kg/h'),
 ('VIBRO_SIFTER_ROUND','Vibro sifter, round (rated throughput, kg/h)','CAPACITY_BASED_PRODUCTION','GRINDER','THROUGHPUT','kg/h')
on conflict (code) do nothing;
update costing.machine_equipment_class set active = false
 where code in ('PULVERISER_DISINTEGRATOR','VIBRO_SIFTER') and active;

-- ---------- §3 revisions (close + supersede), skipped when already done ----------
drop table if exists pg_temp.au9_r2;
create temp table au9_r2(plant_id int primary key, app text, eq text, rc text, mode text, basis text, unit text,
                         rated numeric, eff numeric, ev text, evref text, flags text);
insert into au9_r2 values
 (4,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (5,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (6,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (7,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (8,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (9,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (10,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (11,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (12,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (13,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (14,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (15,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (16,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','DUPLICATE_NAME_OTHER_LOCATION'),
 (17,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (18,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (19,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (20,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (21,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (22,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','STATUS_N_NOT_OPERATIONAL'),
 (23,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (24,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','STATUS_N_NOT_OPERATIONAL'),
 (25,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (26,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (27,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (28,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence','STATUS_N_NOT_OPERATIONAL'),
 (29,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (30,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (31,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (32,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (33,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (34,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',20,20,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: steel-drum grinder 20 kg maximum per charge (supersedes R1 8 kg, which was wrong). Working = 20 kg provisional: no fill-factor evidence',null),
 (41,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',10,10,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: first stone grinder 10 kg per charge (mapped to "Stone Grinder 1", lowest id) (supersedes R1 2 kg)','FIRST_STONE_GRINDER_MAPPED_BY_NAME_AND_LOWEST_ID'),
 (42,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: further stone grinder 5 kg per charge (supersedes R1 2 kg)',null),
 (43,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: further stone grinder 5 kg per charge (supersedes R1 2 kg)',null),
 (44,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: further stone grinder 5 kg per charge (supersedes R1 2 kg)',null),
 (45,'CAPACITY_BASED_PRODUCTION','MECHANISED_KHALVAM_SET','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3.2,3.2,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: mechanised khalvam 0.8 kg per unit, set of 4 = 3.2 kg per charge (supersedes R1 2 kg)',null),
 (46,'CAPACITY_BASED_PRODUCTION','MECHANISED_KHALVAM_SET','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3.2,3.2,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: mechanised khalvam 0.8 kg per unit, set of 4 = 3.2 kg per charge (supersedes R1 2 kg)',null),
 (68,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (69,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (70,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (71,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (72,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (73,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (74,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (75,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (76,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (77,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (78,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (79,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (80,'CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (81,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',3,3,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: Pills area grinder 3 kg per charge; this stone grinder in the Pills area ASSUMED 3 kg (confirm)','ASSUMPTION_PILLS_STONE_GRINDER_3KG'),
 (174,'CAPACITY_BASED_PRODUCTION','WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: wet grinder 2 kg per charge','DUPLICATE_NAME_OTHER_LOCATION'),
 (105,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (106,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (107,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (108,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (109,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (110,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (111,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (112,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (113,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (114,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (156,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,1000,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 1000 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18'),
 (159,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',500,500,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 500 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;ALSO_LOGGED_AS_FG_BULK_STORAGE'),
 (161,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',500,500,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: fermentation tank used at full capacity: working = rated 500 L (rated from plant name)','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;ALSO_LOGGED_AS_FG_BULK_STORAGE'),
 (2,'CAPACITY_BASED_PRODUCTION','DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',28.3333,28.3333,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: disintegrator 85 kg in 3 h = 28.3333 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (127,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (129,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (131,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (132,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (133,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (134,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (135,'CAPACITY_BASED_PRODUCTION','SEMI_AUTO_PULVERISER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',5,5,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: pulveriser 10 kg in 2 h = 5 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (136,'CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER_HORIZONTAL','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',9.4286,9.4286,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: horizontal sifter 66 kg in 7 h = 9.4286 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (137,'CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER_HORIZONTAL','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',9.4286,9.4286,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: horizontal sifter 66 kg in 7 h = 9.4286 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (138,'CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER_ROUND','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',1.1,1.1,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: round sifter 22 kg in 20 h = 1.1 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS'),
 (162,'CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER_ROUND','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',1.1,1.1,'USER_DECLARED','user-corrected 2026-10-18 18:19 IST: round sifter 22 kg in 20 h = 1.1 kg/h. General guide; varies with material. Recorded as rated throughput for capacity planning only; costing uses no time basis','RATED_THROUGHPUT_NOT_A_COSTING_TIME_BASIS');

with closed as (
  update costing.plant_capacity_profile p set effective_to = p.effective_from
    from au9_r2 r
   where p.plant_id = r.plant_id and p.effective_to is null
     and p.approval_reference in ('USER-SUPPLIED-20261018-AU9-R1','USER-APPROVAL-20261018-AU9-G1G3')
  returning p.*)
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, resource_class_code,
       capacity_mode, charge_basis, physical_unit, rated_capacity, effective_capacity, evidence_type, evidence_reference,
       corroborating_evidence, data_flags, is_provisional, effective_from, approval_reference, supersedes_id, change_reason)
select r.plant_id, r.app, r.eq, r.rc, r.mode, r.basis, r.unit, r.rated, r.eff, r.ev, r.evref,
       c.corroborating_evidence, r.flags, true, c.effective_from, 'USER-CORRECTED-20261018-AU9-R2', c.id,
       'AU-9 R2: user-corrected 2026-10-18 18:19 capacity (supersedes R1 where applicable)'
  from closed c join au9_r2 r on r.plant_id = c.plant_id;

-- ---------- §9 post-checks ----------
do $$
declare v_bad int;
begin
  if (select count(*) from costing.plant_capacity_profile where effective_to is null) <> 171 then
    raise exception 'AU9-R2: open profiles <> 171'; end if;
  if (select count(*) from costing.plant_capacity_profile where effective_to is null and approval_reference = 'USER-CORRECTED-20261018-AU9-R2') <> 77 then
    raise exception 'AU9-R2: revised open profiles <> 77'; end if;
  if (select count(*) from costing.capacity_master_revision where action = 'SUPERSEDE' and approval_reference = 'USER-CORRECTED-20261018-AU9-R2') <> 77 then
    raise exception 'AU9-R2: journal SUPERSEDE rows <> 77'; end if;
  if exists (select 1 from costing.capacity_master_revision where at = now()) and
     ((select count(*) from costing.capacity_master_revision where at = now() and action = 'CLOSE') <> 77
      or (select count(*) from costing.capacity_master_revision where at = now() and action = 'SUPERSEDE') <> 77) then
    raise exception 'AU9-R2: this transaction did not journal exactly 77 CLOSE + 77 SUPERSEDE'; end if;
  if exists (select 1 from costing.plant_capacity_profile where effective_to is null and not is_provisional) then
    raise exception 'AU9-R2: all profiles must stay provisional'; end if;
  if exists (select 1 from costing.plant_capacity_profile where effective_from < date '2026-11-01') then
    raise exception 'AU9-R2: no profile may take effect before 1 Nov 2026'; end if;
  if exists (select 1 from costing.plant_capacity_profile where effective_to is null and hours_per_load is not null) then
    raise exception 'AU9-R2: no time basis may be recorded for costing'; end if;
  select count(*) into v_bad from (
    select k, v from au9_baseline
    except
    select 'fn:'||p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('costing','public') and p.prokind in ('f','p')
    except
    select 'view:'||c.oid::regclass::text, md5(pg_get_viewdef(c.oid))
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('costing','public') and c.relkind in ('v','m')
    except
    select 'run:'||r, md5(costing.fn_compute_run_fingerprint(r)::text) from (values (122::bigint),(128::bigint)) t(r)
  ) d;
  if v_bad > 0 then raise exception 'AU9-R2: % pre-existing function/view/run fingerprint(s) changed', v_bad; end if;
end $$;
drop table if exists pg_temp.au9_r2;
drop table if exists pg_temp.au9_baseline;
