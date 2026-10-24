-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- =====================================================================
-- AU-9 R1 PREPARED SQL: first capacity-profile revisions (user-supplied values)
-- STATUS: PREPARED + TESTED LOCALLY. NOT APPLIED LIVE. Outside supabase/migrations.
-- For live: pass the body unchanged to Supabase MCP apply_migration, name au9_r1_capacity_revisions.
-- Sources: user 18 Oct 2026 16:19 IST (grinders 8 kg, stone grinders 2 kg, Khalvam mechanised 2 kg/set)
--          user 18 Oct 2026 16:20 IST (13 water tanks ARE used as fermentation tanks)
-- Effect: 50 machines get a CLOSE + SUPERSEDE revision, still effective 1 Nov 2026, all provisional.
-- No costing function reads these tables until G4: no cost change. Runs, snapshots and periods untouched.
-- One schema change to an AU-9 table only: pcp_dates allows a zero-length (voided-before-effect)
-- range, so a not-yet-effective 1 Nov row can be superseded by another 1 Nov row.
-- =====================================================================

-- ---------- §0 prechecks ----------
do $$
declare v_g2 int; v_r1 int;
begin
  if to_regclass('costing.plant_capacity_profile') is null then raise exception 'AU9-R1: G1-G3 not applied'; end if;
  select count(*) filter (where approval_reference = 'USER-APPROVAL-20261018-AU9-G1G3'),
         count(*) filter (where approval_reference = 'USER-SUPPLIED-20261018-AU9-R1')
    into v_g2, v_r1
    from costing.plant_capacity_profile
   where effective_to is null and plant_id = any(array[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,41,42,43,44,45,46,105,106,107,108,109,110,111,112,113,114,156,159,161]);
  if not ((v_g2 = 50 and v_r1 = 0) or (v_g2 = 0 and v_r1 = 50)) then
    raise exception 'AU9-R1: target profiles are in an unexpected state (G2 rows %, R1 rows %); re-review', v_g2, v_r1;
  end if;
  if v_g2 = 50 and exists (
     select 1 from costing.plant_capacity_profile p
      join (values (4,'RASOUSHADHI_LEVIGATION_GRINDER'),(5,'RASOUSHADHI_LEVIGATION_GRINDER'),(6,'RASOUSHADHI_LEVIGATION_GRINDER'),(7,'RASOUSHADHI_LEVIGATION_GRINDER'),(8,'RASOUSHADHI_LEVIGATION_GRINDER'),(9,'RASOUSHADHI_LEVIGATION_GRINDER'),(10,'RASOUSHADHI_LEVIGATION_GRINDER'),(11,'RASOUSHADHI_LEVIGATION_GRINDER'),(12,'RASOUSHADHI_LEVIGATION_GRINDER'),(13,'RASOUSHADHI_LEVIGATION_GRINDER'),(14,'RASOUSHADHI_LEVIGATION_GRINDER'),(15,'RASOUSHADHI_LEVIGATION_GRINDER'),(16,'RASOUSHADHI_LEVIGATION_GRINDER'),(17,'RASOUSHADHI_LEVIGATION_GRINDER'),(18,'RASOUSHADHI_LEVIGATION_GRINDER'),(19,'RASOUSHADHI_LEVIGATION_GRINDER'),(20,'RASOUSHADHI_LEVIGATION_GRINDER'),(21,'RASOUSHADHI_LEVIGATION_GRINDER'),(22,'RASOUSHADHI_LEVIGATION_GRINDER'),(23,'RASOUSHADHI_LEVIGATION_GRINDER'),(24,'RASOUSHADHI_LEVIGATION_GRINDER'),(25,'RASOUSHADHI_LEVIGATION_GRINDER'),(26,'RASOUSHADHI_LEVIGATION_GRINDER'),(27,'RASOUSHADHI_LEVIGATION_GRINDER'),(28,'RASOUSHADHI_LEVIGATION_GRINDER'),(29,'RASOUSHADHI_LEVIGATION_GRINDER'),(30,'RASOUSHADHI_LEVIGATION_GRINDER'),(31,'RASOUSHADHI_LEVIGATION_GRINDER'),(32,'RASOUSHADHI_LEVIGATION_GRINDER'),(33,'RASOUSHADHI_LEVIGATION_GRINDER'),(34,'RASOUSHADHI_LEVIGATION_GRINDER'),(41,'STONE_GRINDER'),(42,'STONE_GRINDER'),(43,'STONE_GRINDER'),(44,'STONE_GRINDER'),(45,'KHALVAM_MANUAL_LEVIGATION'),(46,'KHALVAM_MANUAL_LEVIGATION'),(105,'WATER_TANK_USED_AS_FERMENTATION'),(106,'WATER_TANK_USED_AS_FERMENTATION'),(107,'WATER_TANK_USED_AS_FERMENTATION'),(108,'WATER_TANK_USED_AS_FERMENTATION'),(109,'WATER_TANK_USED_AS_FERMENTATION'),(110,'WATER_TANK_USED_AS_FERMENTATION'),(111,'WATER_TANK_USED_AS_FERMENTATION'),(112,'WATER_TANK_USED_AS_FERMENTATION'),(113,'WATER_TANK_USED_AS_FERMENTATION'),(114,'WATER_TANK_USED_AS_FERMENTATION'),(156,'WATER_TANK_USED_AS_FERMENTATION'),(159,'WATER_TANK_USED_AS_FERMENTATION'),(161,'WATER_TANK_USED_AS_FERMENTATION')) e(plant_id, eq) on e.plant_id = p.plant_id
     where p.effective_to is null and (p.equipment_class_code <> e.eq or p.effective_from <> date '2026-11-01')) then
    raise exception 'AU9-R1: a target profile differs from the reviewed G2 backfill';
  end if;
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

-- ---------- §1 allow superseding a not-yet-effective row on the same date ----------
alter table costing.plant_capacity_profile drop constraint if exists pcp_dates;
alter table costing.plant_capacity_profile add constraint pcp_dates
  check (effective_to is null or effective_to >= effective_from);
comment on constraint pcp_dates on costing.plant_capacity_profile is
  'effective_to = effective_from marks a row voided before it took effect (empty range; never resolved)';

-- ---------- §2 equipment classes ----------
insert into costing.machine_equipment_class(code, description, default_applicability, default_resource_class_code, default_capacity_mode, default_physical_unit) values
 ('MECHANISED_KHALVAM_SET','Mechanised khalvam set (4 units x 500 g)','CAPACITY_BASED_PRODUCTION','GRINDER','CHARGE','kg'),
 ('FERMENTATION_TANK_1000L','Fermentation tank 1,000 L (formerly typed water tank)','CAPACITY_BASED_PRODUCTION','FERMENTATION_VESSEL','CHARGE','L'),
 ('FERMENTATION_TANK_500L','Fermentation tank 500 L (formerly typed water tank)','CAPACITY_BASED_PRODUCTION','FERMENTATION_VESSEL','CHARGE','L')
on conflict (code) do nothing;
update costing.machine_equipment_class set active = false
 where code in ('KHALVAM_MANUAL_LEVIGATION','WATER_TANK_USED_AS_FERMENTATION') and active;

-- ---------- §3 revisions (close + supersede), skipped when already done ----------
drop table if exists pg_temp.au9_r1;
create temp table au9_r1(plant_id int primary key, app text, eq text, rc text, mode text, basis text, unit text,
                         rated numeric, eff numeric, ev text, evref text, flags text);
insert into au9_r1 values
 (4,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (5,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (6,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (7,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (8,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (9,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (10,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (11,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (12,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (13,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (14,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (15,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (16,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','DUPLICATE_NAME_OTHER_LOCATION'),
 (17,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (18,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (19,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (20,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (21,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (22,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','STATUS_N_NOT_OPERATIONAL'),
 (23,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (24,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','STATUS_N_NOT_OPERATIONAL'),
 (25,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (26,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (27,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (28,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)','STATUS_N_NOT_OPERATIONAL'),
 (29,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (30,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (31,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (32,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (33,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (34,'CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',8,8,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: steel-drum grinder, 8 kg MAXIMUM per charge (rated). Working capacity 8 kg provisional: no fill-factor evidence (no work logs for these machines)',null),
 (41,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: stone grinder 2 kg per charge (rated); working 2 kg provisional',null),
 (42,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: stone grinder 2 kg per charge (rated); working 2 kg provisional',null),
 (43,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: stone grinder 2 kg per charge (rated); working 2 kg provisional',null),
 (44,'CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: stone grinder 2 kg per charge (rated); working 2 kg provisional',null),
 (45,'CAPACITY_BASED_PRODUCTION','MECHANISED_KHALVAM_SET','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: mechanised (not manual) khalvam set of 4 units x 500 g = 2 kg per charge; working 2 kg provisional',null),
 (46,'CAPACITY_BASED_PRODUCTION','MECHANISED_KHALVAM_SET','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',2,2,'USER_DECLARED','user-supplied 2026-10-18 16:19 IST: mechanised (not manual) khalvam set of 4 units x 500 g = 2 kg per charge; working 2 kg provisional',null),
 (105,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (106,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (107,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (108,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (109,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (110,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (111,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (112,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (113,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (114,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (156,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1000,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 1000 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT'),
 (159,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',500,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 500 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT;ALSO_LOGGED_AS_FG_BULK_STORAGE'),
 (161,'CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',500,null,'NAME_DERIVED','user 2026-10-18 16:20 IST: used as a fermentation tank. Rated 500 L from plant name; working volume / fill % not supplied','TYPE_CONFIRMED_FERMENTATION_USE_2026-10-18;NEEDS_WORKING_VOLUME_OR_FILL_PCT;ALSO_LOGGED_AS_FG_BULK_STORAGE');

with closed as (
  update costing.plant_capacity_profile p set effective_to = p.effective_from
    from au9_r1 r
   where p.plant_id = r.plant_id and p.effective_to is null
     and p.approval_reference = 'USER-APPROVAL-20261018-AU9-G1G3'
  returning p.*)
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, resource_class_code,
       capacity_mode, charge_basis, physical_unit, rated_capacity, effective_capacity, evidence_type, evidence_reference,
       corroborating_evidence, data_flags, is_provisional, effective_from, approval_reference, supersedes_id, change_reason)
select r.plant_id, r.app, r.eq, r.rc, r.mode, r.basis, r.unit, r.rated, r.eff, r.ev, r.evref,
       c.corroborating_evidence, r.flags, true, c.effective_from, 'USER-SUPPLIED-20261018-AU9-R1', c.id,
       'AU-9 R1: user-supplied 2026-10-18 capacity / classification'
  from closed c join au9_r1 r on r.plant_id = c.plant_id;

-- ---------- §9 post-checks ----------
do $$
declare v_bad int;
begin
  if (select count(*) from costing.plant_capacity_profile where effective_to is null) <> 171 then
    raise exception 'AU9-R1: open profiles <> 171'; end if;
  if (select count(*) from costing.plant_capacity_profile where effective_to is null and approval_reference = 'USER-SUPPLIED-20261018-AU9-R1') <> 50 then
    raise exception 'AU9-R1: revised open profiles <> 50'; end if;
  if (select count(*) from costing.capacity_master_revision r
       where r.action = 'SUPERSEDE' and r.approval_reference = 'USER-SUPPLIED-20261018-AU9-R1') <> 50
     or (select count(*) from costing.capacity_master_revision r
       where r.action = 'CLOSE' and (r.after_image->>'approval_reference') = 'USER-APPROVAL-20261018-AU9-G1G3'
         and (r.after_image->>'plant_id')::int = any(array[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,41,42,43,44,45,46,105,106,107,108,109,110,111,112,113,114,156,159,161])) <> 50 then
    raise exception 'AU9-R1: journal does not show exactly 50 CLOSE + 50 SUPERSEDE'; end if;
  if exists (select 1 from costing.plant_capacity_profile where effective_to is null and not is_provisional) then
    raise exception 'AU9-R1: all profiles must stay provisional'; end if;
  if exists (select 1 from costing.plant_capacity_profile where effective_from < date '2026-11-01') then
    raise exception 'AU9-R1: no profile may take effect before 1 Nov 2026'; end if;
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
  if v_bad > 0 then raise exception 'AU9-R1: % pre-existing function/view/run fingerprint(s) changed', v_bad; end if;
end $$;
drop table if exists pg_temp.au9_r1;
drop table if exists pg_temp.au9_baseline;
