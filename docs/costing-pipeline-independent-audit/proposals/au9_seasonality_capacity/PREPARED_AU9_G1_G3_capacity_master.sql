-- =====================================================================
-- AU-9 G1–G3 PREPARED SQL: machine capacity master (classes, profiles,
-- revision journal, readiness view, provisional backfill of 171 machines,
-- controlled fallback policy seeded from the current class defaults).
--
-- STATUS: PREPARED + TESTED LOCALLY. NOT APPLIED LIVE.
-- Kept outside supabase/migrations. For the live apply, pass this file's
-- body unchanged to Supabase MCP apply_migration (which is transactional),
-- name: au9_g1_g3_capacity_master. Approval: USER-APPROVAL-20261018-AU9-G1G3 (user, 18 Oct 15:36 IST)
--
-- Scope guarantees (asserted below; any failure raises and rolls back):
--  * creates NEW objects only; alters no existing table, function, view or row
--  * no costing function reads these objects (fn_route_step_loads untouched)
--  * every pre-existing function/view in costing+public is byte-identical after
--  * run 122 / run 128 snapshot fingerprints are identical before and after
--  * profiles and fallback rows take effect 1 Nov 2026 (October cannot see them)
--  * re-runnable: a second run creates nothing and changes nothing
-- =====================================================================

-- ---------- §0 prechecks against the reviewed live state (18 Oct 2026) ----------
do $$
begin
  if (select md5(string_agg(id||':'||plant_name||':'||type_id||':'||status, '|' order by id)) from public.plant_machinery)
     <> '0c269021540d679952c40de0c42e14e8' or (select count(*) from public.plant_machinery) <> 171 then
    raise exception 'AU9-G1G3: plant_machinery differs from the reviewed 171-row state; re-review the backfill';
  end if;
  if md5(pg_get_functiondef('costing.fn_route_step_loads(text,numeric,numeric,text,date)'::regprocedure))
     <> '4ce19661b2e40ccf136617f97e6a2b9d' then
    raise exception 'AU9-G1G3: fn_route_step_loads differs from the reviewed definition';
  end if;
  if (select md5(string_agg(id||':'||resource_class_code||':'||load_basis||':'||coalesce(charge_basis,'-')||':'||coalesce(capacity_kg::text,'-')||':'||coalesce(capacity_l::text,'-')||':'||is_resource_class_default||':'||effective_from||':'||coalesce(effective_to::text,'-'), '|' order by id)) from costing.route_equipment_load_capacity)
     <> '3fe4645619d6b2070a308ac011c6deae' then
    raise exception 'AU9-G1G3: route_equipment_load_capacity differs from the reviewed AU-6 V2 class defaults';
  end if;
  if (select count(*) from costing.production_resource_class) <> 17 then
    raise exception 'AU9-G1G3: expected 17 production resource classes';
  end if;
  if not exists (select 1 from pg_extension where extname = 'btree_gist') then
    raise exception 'AU9-G1G3: btree_gist extension is required (installed live in schema extensions)';
  end if;
end $$;

-- ---------- §0b baseline of everything that must not change ----------
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

-- ---------- G1. reference classes ----------
create table if not exists costing.machine_applicability_class (
  code text primary key,
  description text not null,
  requires_numeric_capacity boolean not null,
  participates_in_load_calc boolean not null,
  created_at timestamptz not null default now()
);
insert into costing.machine_applicability_class(code, description, requires_numeric_capacity, participates_in_load_calc) values
 ('CAPACITY_BASED_PRODUCTION','Manufacturing equipment whose charge or throughput limits loads per batch', true,  true),
 ('CAPACITY_BASED_PACKING',   'Filling/packing machine; throughput recorded, not costed for now (user 18 Oct)', false, false),
 ('NON_CAPACITY_PRODUCTION',  'Production asset with no load-limiting capacity of its own (e.g. stove; capacity sits with the vessel)', false, false),
 ('UTILITY',                  'Pumps, water, power and service assets', false, false),
 ('NON_PRODUCTION',           'Office, laboratory, vehicle and other non-manufacturing assets', false, false),
 ('UNKNOWN',                  'Classification open; blocks Costing Ready', false, false)
on conflict (code) do nothing;

create table if not exists costing.machine_equipment_class (
  code text primary key,
  description text not null,
  default_applicability text not null references costing.machine_applicability_class(code),
  default_resource_class_code text references costing.production_resource_class(code),
  default_capacity_mode text not null check (default_capacity_mode in ('CHARGE','THROUGHPUT','NONE')),
  default_physical_unit text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into costing.machine_equipment_class(code, description, default_applicability, default_resource_class_code, default_capacity_mode, default_physical_unit) values
 ('CAPSULE_FILLER','Capsule Filler','CAPACITY_BASED_PRODUCTION','TABLET_OR_CAPSULE_EQUIPMENT','THROUGHPUT','Nos/h'),
 ('CAPSULE_LOADER','Capsule Loader','CAPACITY_BASED_PRODUCTION','TABLET_OR_CAPSULE_EQUIPMENT','THROUGHPUT','Nos/h'),
 ('COATING_PAN','Coating Pan','CAPACITY_BASED_PRODUCTION','TABLET_OR_CAPSULE_EQUIPMENT','CHARGE','kg'),
 ('ELECTRIC_TRAY_DRYER_24','Electric Tray Dryer 24','CAPACITY_BASED_PRODUCTION','DRYER_OR_OVEN','CHARGE','kg'),
 ('FERMENTATION_TANK_1500L','Fermentation Tank 1500L','CAPACITY_BASED_PRODUCTION','FERMENTATION_VESSEL','CHARGE','L'),
 ('FERMENTATION_TANK_3000L','Fermentation Tank 3000L','CAPACITY_BASED_PRODUCTION','FERMENTATION_VESSEL','CHARGE','L'),
 ('FILLING_PACKING_MACHINE','Filling Packing Machine','CAPACITY_BASED_PACKING','PACKING_MACHINE','THROUGHPUT','packs/min'),
 ('FIREWOOD_DRYER','Firewood Dryer','CAPACITY_BASED_PRODUCTION','DRYER_OR_OVEN','CHARGE','kg'),
 ('GRANULATOR_SIZING','Granulator Sizing','CAPACITY_BASED_PRODUCTION','TABLET_OR_CAPSULE_EQUIPMENT','CHARGE','kg'),
 ('HEAT_SOURCE_STOVE','Heat Source Stove','NON_CAPACITY_PRODUCTION',null,'NONE',null),
 ('HYDRAULIC_JUICE_PRESS','Hydraulic Juice Press','CAPACITY_BASED_PRODUCTION','EXTRACTION_SYSTEM','CHARGE','kg'),
 ('HYDRAULIC_OIL_PRESS','Hydraulic Oil Press','CAPACITY_BASED_PRODUCTION','FILTRATION_SYSTEM','CHARGE','kg'),
 ('KHALVAM_MANUAL_LEVIGATION','Khalvam Manual Levigation','UNKNOWN','GRINDER','NONE',null),
 ('PILLS_WET_GRINDER','Pills Wet Grinder','CAPACITY_BASED_PRODUCTION','GRINDER','CHARGE','kg'),
 ('PILL_MAKER','Pill Maker','CAPACITY_BASED_PRODUCTION','PILL_PROCESSING','THROUGHPUT','kg/h'),
 ('PLANETARY_MIXER','Planetary Mixer','CAPACITY_BASED_PRODUCTION','MIXING_EQUIPMENT','CHARGE','kg'),
 ('PULVERISER_DISINTEGRATOR','Pulveriser Disintegrator','CAPACITY_BASED_PRODUCTION','GRINDER','THROUGHPUT','kg/h'),
 ('PUTA_FURNACE','Puta Furnace','CAPACITY_BASED_PRODUCTION','TRADITIONAL_FURNACE','CHARGE','kg'),
 ('RAPID_MIXER_GRANULATOR','Rapid Mixer Granulator','CAPACITY_BASED_PRODUCTION','TABLET_OR_CAPSULE_EQUIPMENT','CHARGE','kg'),
 ('RASOUSHADHI_LEVIGATION_GRINDER','Rasoushadhi Levigation Grinder','CAPACITY_BASED_PRODUCTION','GRINDER','CHARGE','kg'),
 ('ROOT_WASHER','Root Washer','CAPACITY_BASED_PRODUCTION','MANUAL','THROUGHPUT','kg/h'),
 ('ROTARY_TABLET_PRESS','Rotary Tablet Press','CAPACITY_BASED_PRODUCTION','TABLET_OR_CAPSULE_EQUIPMENT','THROUGHPUT','Nos/h'),
 ('SCREW_EXTRUDER','Screw Extruder','CAPACITY_BASED_PRODUCTION','PILL_PROCESSING','THROUGHPUT','kg/h'),
 ('SS_COOKER','Ss Cooker','CAPACITY_BASED_PRODUCTION','EXTRACTION_SYSTEM','CHARGE','L'),
 ('SS_OPEN_VESSEL','Ss Open Vessel','CAPACITY_BASED_PRODUCTION','PROCESSING_VESSEL','CHARGE','L'),
 ('SS_PROCESSING_VESSEL','Ss Processing Vessel','CAPACITY_BASED_PRODUCTION','PROCESSING_VESSEL','CHARGE','L'),
 ('STEAM_JACKETED_DISTILLATION','Steam Jacketed Distillation','CAPACITY_BASED_PRODUCTION','DISTILLATION_UNIT','CHARGE','L'),
 ('STONE_GRINDER','Stone Grinder','CAPACITY_BASED_PRODUCTION','GRINDER','CHARGE','kg'),
 ('TRADITIONAL_METAL_VESSEL','Traditional Metal Vessel','CAPACITY_BASED_PRODUCTION','PROCESSING_VESSEL','CHARGE','kg'),
 ('TRANSFER_PUMP','Transfer Pump','UTILITY',null,'NONE',null),
 ('VIBRO_SIFTER','Vibro Sifter','CAPACITY_BASED_PRODUCTION','GRINDER','THROUGHPUT','kg/h'),
 ('WATER_TANK_USED_AS_FERMENTATION','Water Tank Used As Fermentation','UNKNOWN','FERMENTATION_VESSEL','NONE',null),
 ('WET_GRINDER','Wet Grinder','CAPACITY_BASED_PRODUCTION','GRINDER','CHARGE','kg')
on conflict (code) do nothing;

-- journal for every profile / fallback insert and close
create table if not exists costing.capacity_master_revision (
  id bigint generated always as identity primary key,
  entity text not null,
  entity_id bigint not null,
  plant_id integer,
  action text not null check (action in ('CREATE','SUPERSEDE','CLOSE')),
  before_image jsonb,
  after_image jsonb not null,
  reason text not null,
  approval_reference text,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);

create table if not exists costing.plant_capacity_profile (
  id bigint generated always as identity primary key,
  plant_id integer not null references public.plant_machinery(id) on delete restrict,
  applicability_class text not null references costing.machine_applicability_class(code),
  equipment_class_code text not null references costing.machine_equipment_class(code),
  resource_class_code text references costing.production_resource_class(code),
  capacity_mode text not null check (capacity_mode in ('CHARGE','THROUGHPUT','NONE')),
  charge_basis text not null check (charge_basis in ('SOLID_CHARGE_KG','OUTPUT_VOLUME_L','OUTPUT_MASS_KG',
      'FEED_RATE_KG_PER_HOUR','OUTPUT_UNITS_PER_HOUR','OUTPUT_UNITS_PER_MINUTE','NOT_APPLICABLE')),
  physical_unit text check (physical_unit in ('kg','L','kg/h','Nos/h','packs/min')),
  rated_capacity numeric check (rated_capacity > 0),
  effective_capacity numeric check (effective_capacity > 0),
  hours_per_load numeric check (hours_per_load > 0),
  evidence_type text not null check (evidence_type in ('NAMEPLATE','SUPPLIER_DOCUMENT','BMR','MEASURED_TRIAL',
      'NAME_DERIVED','WORK_LOG_DERIVED','USER_DECLARED','NONE')),
  evidence_reference text,
  corroborating_evidence text,
  data_flags text,
  is_provisional boolean not null default true,
  effective_from date not null,
  effective_to date,
  approval_reference text,
  supersedes_id bigint references costing.plant_capacity_profile(id),
  change_reason text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint pcp_dates check (effective_to is null or effective_to > effective_from),
  constraint pcp_mode_basis check ((capacity_mode = 'NONE') = (charge_basis = 'NOT_APPLICABLE')),
  constraint pcp_numbers_when_final check (
     applicability_class <> 'CAPACITY_BASED_PRODUCTION' or is_provisional
     or (physical_unit is not null and rated_capacity is not null and effective_capacity is not null
         and (capacity_mode <> 'THROUGHPUT' or hours_per_load is not null))),
  constraint pcp_no_fictitious_capacity check (
     applicability_class in ('CAPACITY_BASED_PRODUCTION','CAPACITY_BASED_PACKING')
     or (rated_capacity is null and effective_capacity is null and hours_per_load is null and capacity_mode = 'NONE')),
  constraint pcp_unknown_is_provisional check (applicability_class <> 'UNKNOWN' or is_provisional),
  constraint pcp_final_needs_approval check (is_provisional or approval_reference is not null),
  constraint pcp_no_overlap exclude using gist (
     plant_id with =, daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&)
);

-- ---------- G3 table (seeded below) ----------
create table if not exists costing.capacity_fallback_policy (
  id bigint generated always as identity primary key,
  resource_class_code text not null references costing.production_resource_class(code),
  equipment_class_code text references costing.machine_equipment_class(code),
  fallback_allowed boolean not null,
  fallback_source text not null check (fallback_source in
      ('ROUTE_EQUIPMENT_LOAD_CAPACITY_CLASS_DEFAULT','NO_CAPACITY_ROW_SINGLE_LOAD','BLOCK')),
  legacy_capacity_id bigint references costing.route_equipment_load_capacity(id),
  review_flag text not null default 'CAPACITY_FALLBACK_USED',
  effective_from date not null,
  effective_to date,
  approval_reference text not null,
  change_reason text not null,
  supersedes_id bigint references costing.capacity_fallback_policy(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint cfp_dates check (effective_to is null or effective_to > effective_from),
  constraint cfp_source_consistency check (
     (fallback_source = 'ROUTE_EQUIPMENT_LOAD_CAPACITY_CLASS_DEFAULT') = (legacy_capacity_id is not null)
     and (fallback_source <> 'BLOCK' or not fallback_allowed)),
  constraint cfp_no_overlap exclude using gist (
     resource_class_code with =, (coalesce(equipment_class_code, '*')) with =,
     daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&)
);

-- ---------- immutability + revision triggers ----------
create or replace function costing.fn_au9_close_only_guard() returns trigger
language plpgsql set search_path = costing, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception '% is append-only; close a row by setting effective_to', tg_table_name;
  end if;
  if old.effective_to is not null or new.effective_to is null
     or (to_jsonb(new) - 'effective_to') is distinct from (to_jsonb(old) - 'effective_to') then
    raise exception '% rows are immutable; only closing an open row (setting effective_to) is allowed', tg_table_name;
  end if;
  return new;
end $$;

create or replace function costing.fn_au9_journal() returns trigger
language plpgsql set search_path = costing, pg_temp as $$
declare j jsonb := to_jsonb(new);
begin
  insert into costing.capacity_master_revision(entity, entity_id, plant_id, action, before_image, after_image, reason, approval_reference)
  values (tg_table_name, new.id, (j->>'plant_id')::int,
          case when tg_op = 'UPDATE' then 'CLOSE' when j->>'supersedes_id' is not null then 'SUPERSEDE' else 'CREATE' end,
          case when tg_op = 'UPDATE' then to_jsonb(old) end, j, j->>'change_reason', j->>'approval_reference');
  return null;
end $$;

create or replace function costing.fn_au9_append_only() returns trigger
language plpgsql set search_path = costing, pg_temp as $$
begin
  raise exception '% is append-only (% blocked)', tg_table_name, tg_op;
end $$;

create or replace trigger trg_pcp_close_only before update or delete on costing.plant_capacity_profile
  for each row execute function costing.fn_au9_close_only_guard();
create or replace trigger trg_pcp_journal after insert or update on costing.plant_capacity_profile
  for each row execute function costing.fn_au9_journal();
create or replace trigger trg_pcp_no_truncate before truncate on costing.plant_capacity_profile
  for each statement execute function costing.fn_au9_append_only();
create or replace trigger trg_cfp_close_only before update or delete on costing.capacity_fallback_policy
  for each row execute function costing.fn_au9_close_only_guard();
create or replace trigger trg_cfp_journal after insert or update on costing.capacity_fallback_policy
  for each row execute function costing.fn_au9_journal();
create or replace trigger trg_cfp_no_truncate before truncate on costing.capacity_fallback_policy
  for each statement execute function costing.fn_au9_append_only();
create or replace trigger trg_cmr_append_only before update or delete on costing.capacity_master_revision
  for each row execute function costing.fn_au9_append_only();
create or replace trigger trg_cmr_no_truncate before truncate on costing.capacity_master_revision
  for each statement execute function costing.fn_au9_append_only();

-- ---------- G2. provisional backfill of all 171 machines ----------
insert into costing.plant_capacity_profile(plant_id, applicability_class, equipment_class_code, resource_class_code,
       capacity_mode, charge_basis, physical_unit, rated_capacity, evidence_type, evidence_reference,
       corroborating_evidence, data_flags, is_provisional, effective_from, approval_reference, change_reason)
select v.plant_id, v.app, v.eq, v.rc, v.mode, v.basis, v.unit, v.rated, v.ev, v.evref, v.wl, v.flags,
       true, date '2026-11-01', 'USER-APPROVAL-20261018-AU9-G1G3', 'AU-9 G2 provisional backfill (classification only; no costing effect)'
from (values
 (1,'Empty Capsule Loading Machine (Size 0)','CAPACITY_BASED_PRODUCTION','CAPSULE_LOADER','TABLET_OR_CAPSULE_EQUIPMENT','THROUGHPUT','OUTPUT_UNITS_PER_HOUR','Nos/h',null::numeric,'NONE',null,'1 logs; batch Nos P50 100000 / P90 100000; Capsule filling and polishing','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (2,'Disintegrator','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'644 logs; batch Kg P50 300 / P90 800; Disintegration|Pulverization|Pulverizing and Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (4,'Grinder 1','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (5,'Grinder 2','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (6,'Grinder 3','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (7,'Grinder 4','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (8,'Grinder 5','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (9,'Grinder 6','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (10,'Grinder 7','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (11,'Grinder 8','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (12,'Grinder 9','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (13,'Grinder 10','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (14,'Grinder 11','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (15,'Grinder 12','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (16,'Grinder 13','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (17,'Grinder 14','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (18,'Grinder 15','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (19,'Grinder 16','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (20,'Grinder 17','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (21,'Grinder 18','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (22,'Grinder 19','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'STATUS_N_NOT_OPERATIONAL'),
 (23,'Grinder 20','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (24,'Grinder 21','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'STATUS_N_NOT_OPERATIONAL'),
 (25,'Grinder 22','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (26,'Grinder 23','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (27,'Grinder 24','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (28,'Grinder 25','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,'STATUS_N_NOT_OPERATIONAL'),
 (29,'Grinder 26','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (30,'Grinder 27','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (31,'Grinder 28','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (32,'Grinder 29','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (33,'Grinder 30','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (34,'Grinder 31','CAPACITY_BASED_PRODUCTION','RASOUSHADHI_LEVIGATION_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (35,'Cooker 1','CAPACITY_BASED_PRODUCTION','SS_COOKER','EXTRACTION_SYSTEM','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'269 logs; batch L P50 300 / P90 3000; Pressurized extraction','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (36,'Cooker 2','CAPACITY_BASED_PRODUCTION','SS_COOKER','EXTRACTION_SYSTEM','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'223 logs; batch L P50 500 / P90 3000; Pressurized extraction','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (37,'Cooker 3','CAPACITY_BASED_PRODUCTION','SS_COOKER','EXTRACTION_SYSTEM','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'270 logs; batch L P50 360 / P90 3000; Lehyam processing|Oil processing|Pressurized extraction','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (38,'Cooker 4','CAPACITY_BASED_PRODUCTION','SS_COOKER','EXTRACTION_SYSTEM','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'199 logs; batch Kg P50 120 / P90 3000; Lehyam processing|Pressurized extraction','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (39,'Open Vessel 1','CAPACITY_BASED_PRODUCTION','SS_OPEN_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'6 logs; batch L P50 1155 / P90 1155; Lehyam processing|Suktham processing',null),
 (40,'Open Vessel 2','CAPACITY_BASED_PRODUCTION','SS_OPEN_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'4 logs; batch Kg P50 722.5 / P90 1155; Lehyam processing|Pressurized extraction|Suktham processing',null),
 (41,'Stone Grinder 1','CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (42,'Stone Grinder 2','CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (43,'Stone Grinder 3','CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (44,'Stone Grinder 4','CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (45,'Khalvam Set 1','UNKNOWN','KHALVAM_MANUAL_LEVIGATION','GRINDER','NONE','NOT_APPLICABLE',null,null::numeric,'NONE','Manual tool vs capacity asset question OPEN',null,'CONFIRM_MANUAL_TOOL_OR_CAPACITY_ASSET'),
 (46,'Khalvam Set 2','UNKNOWN','KHALVAM_MANUAL_LEVIGATION','GRINDER','NONE','NOT_APPLICABLE',null,null::numeric,'NONE','Manual tool vs capacity asset question OPEN',null,'CONFIRM_MANUAL_TOOL_OR_CAPACITY_ASSET'),
 (47,'Processing Vessel 1','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'94 logs; batch Kg P50 290 / P90 793.1; Curd preparation|Ghritam processing|Khandam processing|Lehyam processing|Lepam processing|Manappaku (Panakam) processing|Oil processing|Open vessel boiling|Pill processing|Swarasa bhavana (fortificati','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (48,'Processing Vessel 2','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'70 logs; batch Kg P50 290 / P90 800; Ghritam processing|Khandam processing|Lehyam processing|Manappaku (Panakam) processing|Oil processing|Open vessel boiling|Swarasa bhavana (fortification)|Vatakam processing','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (49,'Processing Vessel 3','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'74 logs; batch Kg P50 290 / P90 800; Ghritam processing|Khandam processing|Lehyam processing|Manappaku (Panakam) processing|Oil processing|Open vessel boiling|Pressurized extraction|Swarasa bhavana (fortification)|Vatakam processing','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (50,'Processing Vessel 4','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'94 logs; batch Kg P50 190 / P90 708; Anjanam processing|Ghritam processing|Khandam processing|Lehyam processing|Manappaku (Panakam) processing|Oil processing|Open vessel boiling|Pressurized extraction|RM sudhi|Sweetner dissolution|Vataka',null),
 (51,'Open Vessel 3','CAPACITY_BASED_PRODUCTION','SS_OPEN_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'3 logs; batch Kg P50 300 / P90 356; Oil processing|Open vessel boiling|Pressurized extraction',null),
 (52,'Open Vessel 4','CAPACITY_BASED_PRODUCTION','SS_OPEN_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'4 logs; batch Kg P50 685 / P90 770; Batch mixing|Lehyam processing|Manappaku (Panakam) Processing',null),
 (53,'Processing Vessel 5','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'28 logs; batch Kg P50 240 / P90 804; Ghritam processing|Lehyam processing|Oil processing',null),
 (54,'Processing Vessel 6','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'33 logs; batch Kg P50 240 / P90 944; Ghritam processing|Lepam processing|Oil extraction|Oil processing',null),
 (55,'Processing Vessel 7','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'139 logs; batch Kg P50 360 / P90 1000; Ghritam processing|Lepam processing|Oil processing|Pressurized extraction',null),
 (56,'Processing Vessel 8','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'137 logs; batch Kg P50 360 / P90 1000; Ghritam processing|Lepam processing|Oil processing|Pressurized extraction',null),
 (57,'Processing Vessel 9','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'129 logs; batch Kg P50 360 / P90 1000; Ghritam processing|Lepam processing|Oil processing|Open vessel boiling',null),
 (58,'Processing Vessel 10','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'124 logs; batch Kg P50 360 / P90 1000; Ghritam processing|Lepam processing|Oil processing|Open vessel boiling','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (59,'Processing Vessel 11','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'117 logs; batch Kg P50 250 / P90 720; Ghritam processing|Lepam processing|Oil extraction|Oil processing|Open vessel boiling',null),
 (60,'Processing Vessel 12','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'115 logs; batch Kg P50 360 / P90 738; Ghritam processing|Lehyam processing|Lepam processing|Oil processing|Open vessel boiling',null),
 (61,'Processing Vessel 13','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'100 logs; batch Kg P50 480 / P90 723; Ghritam processing|Lepam processing|Oil processing|Pressurized extraction',null),
 (62,'Processing Vessel 14','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'82 logs; batch Kg P50 480 / P90 975; Kashaya bhavana (fortification)|Lepam processing|Oil processing','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (63,'Processing Vessel 15','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'171 logs; batch L P50 500 / P90 3000; Asavam processing|Kashaya bhavana (fortification)|Open vessel boiling|Swarasa bhavana (fortification)|Sweetner dissolution','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (64,'Processing Vessel 16','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'203 logs; batch L P50 750 / P90 3000; Asavam processing|Kashaya bhavana (fortification)|Oil processing|Open vessel boiling|Sweetner dissolution','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (65,'Processing Vessel 17','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'202 logs; batch L P50 675 / P90 3000; Asavam processing|Open vessel boiling|Pressurized extraction|Sweetner dissolution',null),
 (66,'Processing Vessel 18','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'12 logs; batch L P50 1250 / P90 3000; Kashaya bhavana (fortification)|Open vessel boiling|Sweetner dissolution',null),
 (67,'Processing Vessel 19','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'58 logs; batch Kg P50 105 / P90 66500; Gulgulu processing|Kashaya bhavana (fortification)|Oil processing|Open vessel boiling|Pill processing|RM sudhi|Swarasa bhavana (fortification)','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (68,'Grinder 1','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'8 logs; batch Nos P50 45000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (69,'Grinder 2','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'8 logs; batch Nos P50 45000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (70,'Grinder 3','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'8 logs; batch Nos P50 45000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (71,'Grinder 4','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'8 logs; batch Nos P50 45000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (72,'Grinder 5','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'9 logs; batch Nos P50 45000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (73,'Grinder 6','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'9 logs; batch Nos P50 45000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (74,'Grinder 7','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'10 logs; batch Nos P50 72500 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (75,'Grinder 8','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'11 logs; batch Nos P50 80000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (76,'Grinder 9','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'11 logs; batch Nos P50 80000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (77,'Grinder 10','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'11 logs; batch Nos P50 80000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (78,'Grinder 11','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'11 logs; batch Nos P50 80000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (79,'Grinder 12','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'8 logs; batch Nos P50 80000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (80,'Grinder 13','CAPACITY_BASED_PRODUCTION','PILLS_WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'7 logs; batch Nos P50 80000 / P90 200000; Pill grinding','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (81,'Stone Grinder','CAPACITY_BASED_PRODUCTION','STONE_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (82,'Automatic Volumetric Filling Machine (6 Syringes)','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'553 logs; batch L P50 500 / P90 3000; Bottling|Bottling and labelling|Bottling, labelling and cartoning|Cartoning|Labelling and cartoning|Transfer to FG store',null),
 (83,'Fermentation Tank (1500 L) 1','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','25 logs; batch L P50 1500 / P90 3000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (84,'Fermentation Tank (1500 L) 2','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','35 logs; batch L P50 1500 / P90 3000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-assisted clarification filtration|Pump-Assisted',null),
 (85,'Fermentation Tank (1500 L) 3','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','30 logs; batch L P50 2000 / P90 3000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-Assisted Filtra',null),
 (86,'Fermentation Tank (1500 L) 4','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','33 logs; batch L P50 2000 / P90 2000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (87,'Fermentation Tank (1500 L) 5','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','16 logs; batch L P50 1500 / P90 2000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-Assisted Filtration',null),
 (88,'Fermentation Tank (1500 L) 6','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','24 logs; batch L P50 1500 / P90 2000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate storage',null),
 (89,'Fermentation Tank (1500 L) 7','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','21 logs; batch L P50 1500 / P90 2400; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (90,'Fermentation Tank (1500 L) 8','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','11 logs; batch L P50 1500 / P90 2000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (91,'Fermentation Tank (1500 L) 9','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_1500L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',1500.0::numeric,'NAME_DERIVED','Rated 1500 L from plant name; effective working volume not yet supplied','12 logs; batch L P50 1000 / P90 1500; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (92,'Fermentation Tank (3000 L) 10','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','29 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-Assisted Filtration',null),
 (93,'Fermentation Tank (3000 L) 11','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','31 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (94,'Fermentation Tank (3000 L) 12','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','25 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (95,'Fermentation Tank (3000 L) 13','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','29 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-Assisted Filtration',null),
 (96,'Fermentation Tank (3000 L) 14','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','28 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-Assisted Filtration',null),
 (97,'Fermentation Tank (3000 L) 15','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','5 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (98,'Fermentation Tank (3000 L) 16','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','13 logs; batch L P50 2000 / P90 2000; Closed fermentation (sandhana prakriya)|Open fermentation (sandhana prakriya)',null),
 (99,'Fermentation Tank (3000 L) 17','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','13 logs; batch L P50 2000 / P90 2000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (100,'Fermentation Tank (3000 L) 18','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','9 logs; batch L P50 3000 / P90 3000; FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (101,'Fermentation Tank (3000 L) 19','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','11 logs; batch L P50 3000 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (102,'Fermentation Tank (3000 L) 20','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','6 logs; batch L P50 2200 / P90 2400; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)',null),
 (103,'Fermentation Tank (3000 L) 21','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','3 logs; batch L P50 2000 / P90 2800; Closed fermentation (sandhana prakriya)|Open fermentation (sandhana prakriya)',null),
 (104,'Fermentation Tank (3000 L) 22','CAPACITY_BASED_PRODUCTION','FERMENTATION_TANK_3000L','FERMENTATION_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',3000.0::numeric,'NAME_DERIVED','Rated 3000 L from plant name; effective working volume not yet supplied','1 logs; batch L P50 2000 / P90 2000; Open fermentation (sandhana prakriya)',null),
 (105,'Water Tank (1000 L) 1','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','25 logs; batch L P50 2000 / P90 2760; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)|Pump-Assisted Filtration','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (106,'Water Tank (1000 L) 2','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','20 logs; batch L P50 1500 / P90 2460; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate storage','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (107,'Water Tank (1000 L) 3','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','16 logs; batch L P50 1500 / P90 2000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (108,'Water Tank (1000 L) 4','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','21 logs; batch L P50 1500 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Pump-Assisted Filtration','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (109,'Water Tank (1000 L) 5','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','19 logs; batch L P50 1500 / P90 2520; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (110,'Water Tank (1000 L) 6','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','13 logs; batch L P50 1500 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage|Open fermentation (sandhana prakriya)','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (111,'Water Tank (1000 L) 7','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','17 logs; batch L P50 1500 / P90 2160; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (112,'Water Tank (1000 L) 8','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','20 logs; batch L P50 1500 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate storage','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (113,'Water Tank (1000 L) 9','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','20 logs; batch L P50 1500 / P90 3000; Closed fermentation (sandhana prakriya)|FG bulk storage|Intermediate settling / holding|Intermediate storage|Open fermentation (sandhana prakriya)','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (114,'Water Tank (1000 L) 10','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','22 logs; batch L P50 2000 / P90 3000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate storage|Pump-Assisted Filtration','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (115,'Volumetric Filling Machine (25 mL - 100 mL)','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'23 logs; batch Kg P50 105 / P90 400; Bottling, labelling and cartoning|Transfer to FG store',null),
 (116,'Volumetric Filling Machine (25 mL - 200 mL)','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'110 logs; batch Kg P50 120 / P90 720; Bottling|Bottling, labelling and cartoning',null),
 (117,'Volumetric Filling Machine (50 mL - 500 mL)','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'268 logs; batch Kg P50 360 / P90 1000; Bottling|Bottling, labelling and cartoning|Transfer to FG store','DUPLICATE_NAME_OTHER_LOCATION'),
 (118,'Firewood Dryer 2','CAPACITY_BASED_PRODUCTION','FIREWOOD_DRYER','DRYER_OR_OVEN','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'2 logs; batch Kg P50 25045 / P90 45009; Drying in firewood oven','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (119,'Firewood Dryer 1','CAPACITY_BASED_PRODUCTION','FIREWOOD_DRYER','DRYER_OR_OVEN','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'4 logs; batch Kg P50 43 / P90 223.8; RM washing and drying','DUPLICATE_NAME_OTHER_LOCATION'),
 (120,'Firewood Dryer 1','CAPACITY_BASED_PRODUCTION','FIREWOOD_DRYER','DRYER_OR_OVEN','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'20 logs; batch Kg P50 377.5 / P90 73000; Oil extraction|RM Drying|RM washing and drying','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (121,'Steam Jacketed Distillation Unit','CAPACITY_BASED_PRODUCTION','STEAM_JACKETED_DISTILLATION','DISTILLATION_UNIT','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'16 logs; batch L P50 150 / P90 1575; Distillation|RM soaking',null),
 (122,'Semi-automatic Auger Filling Machine','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'2 logs; batch Kg P50 460 / P90 708; Bottling, labelling and cartoning',null),
 (123,'Semi-automatic Pneumatic Filling Machine','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'207 logs; batch Kg P50 220 / P90 770; Bottling|Bottling, labelling and cartoning|Transfer to FG store',null),
 (124,'Volumetric Filling Machine (50 mL - 500 mL)','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'5 logs; batch Kg P50 30 / P90 30; Bottling, labelling and cartoning','DUPLICATE_NAME_OTHER_LOCATION'),
 (125,'Planetary Mixing Machine','CAPACITY_BASED_PRODUCTION','PLANETARY_MIXER','MIXING_EQUIPMENT','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'30 logs; batch Kg P50 770 / P90 770; Batch mixing',null),
 (126,'Hydraulic Oil Pressing Machine','CAPACITY_BASED_PRODUCTION','HYDRAULIC_OIL_PRESS','FILTRATION_SYSTEM','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'322 logs; batch Kg P50 120 / P90 720; Oil extraction|Oil processing|Pressurized extraction',null),
 (127,'Semi Automatic Pulverizer Machine 1','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'1 logs; batch Nos P50 200000 / P90 200000; Wet pulverization','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (129,'Semi Automatic Pulverizer Machine 2','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION'),
 (130,'Hydraulic Juice Press','CAPACITY_BASED_PRODUCTION','HYDRAULIC_JUICE_PRESS','EXTRACTION_SYSTEM','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'52 logs; batch Kg P50 360 / P90 1000; Juice extraction','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (131,'Semi Automatic Pulverizer Machine 1','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'200 logs; batch Kg P50 66 / P90 50000; Disintegration|Pulverization|Pulverizing and Sieving|Sieving','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (132,'Semi Automatic Pulverizer Machine 2','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'314 logs; batch Kg P50 115 / P90 50000; Disintegration|Pulverization|Pulverizing and Sieving|Sieving','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (133,'Semi Automatic Pulverizer Machine 3','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'79 logs; batch L P50 1000 / P90 3000; Pulverization|Pulverizing and Sieving',null),
 (134,'Semi Automatic Pulverizer Machine 4','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'8 logs; batch Kg P50 300 / P90 24350; Pulverization|Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (135,'Semi Automatic Pulverizer Machine 5','CAPACITY_BASED_PRODUCTION','PULVERISER_DISINTEGRATOR','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'306 logs; batch Kg P50 120 / P90 480; Pulverization|Pulverizing and Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (136,'Vibro Sifter Machine (Horizontal) 1','CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'89 logs; batch Kg P50 166 / P90 72000; Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (137,'Vibro Sifter Machine (Horizontal) 2','CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'96 logs; batch Kg P50 190 / P90 770; Pulverizing and Sieving|Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (138,'Vibro Sifter Machine (Round) 1','CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'250 logs; batch Kg P50 95 / P90 50000; Pulverization|Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (139,'Manual Capsule Filling Machine','CAPACITY_BASED_PRODUCTION','CAPSULE_FILLER','TABLET_OR_CAPSULE_EQUIPMENT','THROUGHPUT','OUTPUT_UNITS_PER_HOUR','Nos/h',null::numeric,'NONE',null,'47 logs; batch Nos P50 100000 / P90 100000; Capsule filling|Capsule filling and polishing','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (140,'Rapid Mixer Granulator','CAPACITY_BASED_PRODUCTION','RAPID_MIXER_GRANULATOR','TABLET_OR_CAPSULE_EQUIPMENT','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'89 logs; batch Nos P50 50000 / P90 100000; Granulation|Powder blending|Wet granulation|Wet mixing','WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (141,'Electric Tray Dryer (24 - Tray Single Door)','CAPACITY_BASED_PRODUCTION','ELECTRIC_TRAY_DRYER_24','DRYER_OR_OVEN','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'17 logs; batch Nos P50 50000 / P90 100000; Drying in electric oven','DUPLICATE_NAME_OTHER_LOCATION;NAME_GIVES_24_TRAYS_KG_PER_TRAY_NEEDED;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (142,'Pouch Packing Machine 1','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'41 logs; batch Kg P50 66 / P90 66; Bottling|Bottling, labelling and cartoning|Pouch packing|Pouch packing and cartoning',null),
 (143,'Monoblock Motor Pump (Tank to Tank)','UTILITY','TRANSFER_PUMP',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,'256 logs; batch L P50 2000 / P90 3000; Pump-assisted clarification filtration|Pump-Assisted Filtration',null),
 (144,'Monoblock Motor Pump (Tank to Filling)','UTILITY','TRANSFER_PUMP',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,'3 logs; batch L P50 3000 / P90 3000; Pump-Assisted Filtration',null),
 (145,'Monoblock Motor Pump (1 HP) 3','UTILITY','TRANSFER_PUMP',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'STATUS_N_NOT_OPERATIONAL'),
 (146,'Firewood Dryer 1','CAPACITY_BASED_PRODUCTION','FIREWOOD_DRYER','DRYER_OR_OVEN','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'23 logs; batch Nos P50 100000 / P90 100000; Drying in firewood oven|RM washing and drying','DUPLICATE_NAME_OTHER_LOCATION;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (147,'Granulator','CAPACITY_BASED_PRODUCTION','GRANULATOR_SIZING','TABLET_OR_CAPSULE_EQUIPMENT','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'1 logs; batch Kg P50 300 / P90 300; Granule sizing',null),
 (148,'Processing Vessel (100 L)','CAPACITY_BASED_PRODUCTION','SS_PROCESSING_VESSEL','PROCESSING_VESSEL','CHARGE','OUTPUT_VOLUME_L','L',100.0::numeric,'NAME_DERIVED','Rated 100 L from plant name; effective working volume not yet supplied','1 logs; batch Kg P50 275 / P90 275; RM sudhi',null),
 (149,'Electric Tray Dryer (24 - Tray Single Door)','CAPACITY_BASED_PRODUCTION','ELECTRIC_TRAY_DRYER_24','DRYER_OR_OVEN','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'54 logs; batch Nos P50 45000 / P90 200000; Drying in electric oven|Drying in firewood oven','DUPLICATE_NAME_OTHER_LOCATION;NAME_GIVES_24_TRAYS_KG_PER_TRAY_NEEDED;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (150,'Pouch Packing Machine 2','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'20 logs; batch Kg P50 150 / P90 2162; Bottling, labelling and cartoning|Dangler assembly and cartoning|Pouch packing|Pouch packing and cartoning',null),
 (151,'Tube Filling Machine','CAPACITY_BASED_PACKING','FILLING_PACKING_MACHINE','PACKING_MACHINE','THROUGHPUT','OUTPUT_UNITS_PER_MINUTE','packs/min',null::numeric,'NONE',null,'17 logs; batch Kg P50 250 / P90 279.6; Bottling, labelling and cartoning|Tube filling',null),
 (152,'Screw Extruder Machine','CAPACITY_BASED_PRODUCTION','SCREW_EXTRUDER','PILL_PROCESSING','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'12 logs; batch Nos P50 55000 / P90 187000; Pill making','PILL_PROCESSING_HAS_NO_CAPACITY_ROW;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (153,'Pill Making Machine','CAPACITY_BASED_PRODUCTION','PILL_MAKER','PILL_PROCESSING','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'36 logs; batch Nos P50 45000 / P90 90000; Manual sorting|Pill making|Pill polishing','PILL_PROCESSING_HAS_NO_CAPACITY_ROW;WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (154,'Tablet Coating Pan with Hot Air Blower','CAPACITY_BASED_PRODUCTION','COATING_PAN','TABLET_OR_CAPSULE_EQUIPMENT','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'10 logs; batch Nos P50 55000 / P90 82000; Pill polishing','WORK_LOG_IN_NOS_NOT_USABLE;WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (155,'Rotary Tablet Compression Machine (20-Station)','CAPACITY_BASED_PRODUCTION','ROTARY_TABLET_PRESS','TABLET_OR_CAPSULE_EQUIPMENT','THROUGHPUT','OUTPUT_UNITS_PER_HOUR','Nos/h',null::numeric,'NONE',null,'49 logs; batch Nos P50 50000 / P90 100000; Tablet punching','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (156,'Water Tank (1000 L) 11','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 1000 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','12 logs; batch L P50 1750 / P90 3000; Closed fermentation (sandhana prakriya)|Closed fermentation / maturation|FG bulk storage|Intermediate storage|Stock transfer','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (157,'Cooker 5','CAPACITY_BASED_PRODUCTION','SS_COOKER','EXTRACTION_SYSTEM','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'2 logs; batch L P50 50375 / P90 90075; Pressurized extraction','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (158,'Cooker 6','CAPACITY_BASED_PRODUCTION','SS_COOKER','EXTRACTION_SYSTEM','CHARGE','OUTPUT_VOLUME_L','L',null::numeric,'NONE',null,'3 logs; batch L P50 150 / P90 630; Pressurized extraction',null),
 (159,'Water Tank (500 L) 12','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 500 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','2 logs; batch L P50 1350 / P90 2190; FG bulk storage|Open fermentation (sandhana prakriya)','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (160,'Chembu Vaarpu','CAPACITY_BASED_PRODUCTION','TRADITIONAL_METAL_VESSEL','PROCESSING_VESSEL','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'3 logs; batch Kg P50 60 / P90 60; Oil processing',null),
 (161,'Water Tank (500 L) 13','UNKNOWN','WATER_TANK_USED_AS_FERMENTATION','FERMENTATION_VESSEL','NONE','NOT_APPLICABLE',null,null::numeric,'NAME_DERIVED','Name states 500 L; typed Fermentation Tank; fermentation-scale work logs; type question OPEN','3 logs; batch L P50 1500 / P90 1500; FG bulk storage|Intermediate storage','TYPE_NAME_MISMATCH_WATER_TANK_LOGGED_AS_FERMENTATION'),
 (162,'Vibro Sifter Machine (Round) 2','CAPACITY_BASED_PRODUCTION','VIBRO_SIFTER','GRINDER','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,'50 logs; batch Kg P50 207.5 / P90 100000; Sieving','WORK_LOG_HAS_IMPLAUSIBLE_BATCH_VALUES'),
 (164,'Root Washing Machine','CAPACITY_BASED_PRODUCTION','ROOT_WASHER','MANUAL','THROUGHPUT','FEED_RATE_KG_PER_HOUR','kg/h',null::numeric,'NONE',null,null,null),
 (165,'Pukaipokki Chakkara Aduppu','CAPACITY_BASED_PRODUCTION','PUTA_FURNACE','TRADITIONAL_FURNACE','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (166,'Gas Stove 2','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION;CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (167,'Gas Stove 3','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION;CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (168,'Gas Stove 1','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION;CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (169,'Heavy thick iron vessel (Irumbu Chatti)','CAPACITY_BASED_PRODUCTION','TRADITIONAL_METAL_VESSEL','TRADITIONAL_FURNACE','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,null,null),
 (170,'Gas Stove - Pills Grinding Area','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (171,'Gas Stove 1','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,'1 logs; batch Kg P50 60 / P90 60; Ghritam processing','DUPLICATE_NAME_OTHER_LOCATION;CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (172,'Gas Stove 2','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION;CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (173,'Gas Stove 3','NON_CAPACITY_PRODUCTION','HEAT_SOURCE_STOVE',null,'NONE','NOT_APPLICABLE',null,null::numeric,'NONE',null,null,'DUPLICATE_NAME_OTHER_LOCATION;CAPACITY_CARRIED_BY_VESSEL_ON_STOVE'),
 (174,'Grinder 1','CAPACITY_BASED_PRODUCTION','WET_GRINDER','GRINDER','CHARGE','SOLID_CHARGE_KG','kg',null::numeric,'NONE',null,'1 logs; batch Kg P50 720 / P90 720; Oil extraction','DUPLICATE_NAME_OTHER_LOCATION')
) v(plant_id, plant_name, app, eq, rc, mode, basis, unit, rated, ev, evref, wl, flags)
join public.plant_machinery pm on pm.id = v.plant_id and pm.plant_name = v.plant_name
where not exists (select 1 from costing.plant_capacity_profile p where p.plant_id = v.plant_id);

-- ---------- G3. fallback policy = today's approved class defaults (AU-6 V2) ----------
insert into costing.capacity_fallback_policy(resource_class_code, fallback_allowed, fallback_source, legacy_capacity_id,
       effective_from, approval_reference, change_reason)
select c.resource_class_code, true, 'ROUTE_EQUIPMENT_LOAD_CAPACITY_CLASS_DEFAULT', c.id, date '2026-11-01', 'USER-APPROVAL-20261018-AU9-G1G3',
       'Class default '||c.equipment_class_code||' approved as fallback until machine values arrive'
  from costing.route_equipment_load_capacity c
 where c.is_resource_class_default and c.effective_to is null
   and not exists (select 1 from costing.capacity_fallback_policy f
                    where f.resource_class_code = c.resource_class_code and f.equipment_class_code is null
                      and f.effective_from = date '2026-11-01');
insert into costing.capacity_fallback_policy(resource_class_code, fallback_allowed, fallback_source,
       effective_from, approval_reference, change_reason)
select r.code, true, 'NO_CAPACITY_ROW_SINGLE_LOAD', date '2026-11-01', 'USER-APPROVAL-20261018-AU9-G1G3',
       'No class capacity row today; documents current behaviour (one load per step)'
  from costing.production_resource_class r
 where not exists (select 1 from costing.route_equipment_load_capacity c
                    where c.resource_class_code = r.code and c.is_resource_class_default and c.effective_to is null)
   and not exists (select 1 from costing.capacity_fallback_policy f
                    where f.resource_class_code = r.code and f.equipment_class_code is null
                      and f.effective_from = date '2026-11-01');

-- ---------- readiness view ----------
create or replace view costing.v_plant_capacity_readiness with (security_invoker = true) as
select pm.id as plant_id, pm.plant_name, pm.status, mt.name as machine_type,
       p.id as profile_id, p.applicability_class, p.equipment_class_code, p.resource_class_code,
       p.capacity_mode, p.charge_basis, p.physical_unit, p.rated_capacity, p.effective_capacity,
       case when p.rated_capacity > 0 and p.effective_capacity is not null
            then round(100 * p.effective_capacity / p.rated_capacity, 1) end as effective_fill_pct,
       p.is_provisional, p.evidence_type, p.evidence_reference, p.data_flags, p.effective_from,
       case
         when p.id is null                                  then 'BLOCKED_NO_PROFILE'
         when p.applicability_class = 'UNKNOWN'             then 'BLOCKED_UNCLASSIFIED'
         when not mac.requires_numeric_capacity             then 'NOT_REQUIRED'
         when pm.status <> 'O'                              then 'NOT_OPERATIONAL'
         when p.effective_capacity is null or p.physical_unit is null then 'BLOCKED_NEEDS_CAPACITY'
         when p.is_provisional                              then 'READY_PROVISIONAL'
         else 'COSTING_READY' end as readiness
from public.plant_machinery pm
left join public.machine_types mt on mt.id = pm.type_id
left join costing.plant_capacity_profile p on p.plant_id = pm.id and p.effective_to is null
left join costing.machine_applicability_class mac on mac.code = p.applicability_class;

-- ---------- grants (read-only for app users; writes only via future governed RPCs) ----------
revoke all on costing.machine_applicability_class, costing.machine_equipment_class, costing.capacity_master_revision,
              costing.plant_capacity_profile, costing.capacity_fallback_policy, costing.v_plant_capacity_readiness
  from public, anon, authenticated;
grant select on costing.machine_applicability_class, costing.machine_equipment_class, costing.capacity_master_revision,
                costing.plant_capacity_profile, costing.capacity_fallback_policy, costing.v_plant_capacity_readiness
  to authenticated, service_role;
revoke all on function costing.fn_au9_close_only_guard(), costing.fn_au9_journal(), costing.fn_au9_append_only() from public, anon, authenticated;

comment on table costing.plant_capacity_profile is 'AU-9: effective-dated, append-only machine capacity profile. Not read by any costing function until gate G4.';
comment on table costing.capacity_fallback_policy is 'AU-9: controlled class-level capacity fallback. Seeded from AU-6 V2 class defaults; not read by costing until G4.';

-- ---------- §9 post-checks ----------
do $$
declare v_bad int; v_rows int;
begin
  if (select count(*) from costing.machine_applicability_class) <> 6 then raise exception 'AU9: applicability classes <> 6'; end if;
  if (select count(*) from costing.machine_equipment_class) <> 33 then raise exception 'AU9: equipment classes <> 33'; end if;
  select count(*) into v_rows from costing.plant_capacity_profile where effective_to is null;
  if v_rows <> 171 or exists (select 1 from public.plant_machinery pm where not exists
       (select 1 from costing.plant_capacity_profile p where p.plant_id = pm.id and p.effective_to is null)) then
    raise exception 'AU9: expected one open profile for each of the 171 machines, found %', v_rows; end if;
  if exists (select 1 from costing.plant_capacity_profile where not is_provisional) then raise exception 'AU9: backfill must be provisional'; end if;
  if (select count(*) from costing.capacity_fallback_policy where effective_to is null) <> 17 then raise exception 'AU9: fallback rows <> 17'; end if;
  if (select count(*) from costing.capacity_master_revision where action = 'CREATE' and approval_reference = 'USER-APPROVAL-20261018-AU9-G1G3') <> 171 + 17 then
    raise exception 'AU9: G1-G3 revision journal count <> 188'; end if;
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
  if v_bad > 0 then raise exception 'AU9: % pre-existing function/view/run fingerprint(s) changed', v_bad; end if;
end $$;
drop table if exists pg_temp.au9_baseline;
