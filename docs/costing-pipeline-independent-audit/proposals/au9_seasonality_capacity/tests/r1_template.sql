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
         count(*) filter (where approval_reference = '@@APPROVAL@@')
    into v_g2, v_r1
    from costing.plant_capacity_profile
   where effective_to is null and plant_id = any(array[@@IDS@@]);
  if not ((v_g2 = 50 and v_r1 = 0) or (v_g2 = 0 and v_r1 = 50)) then
    raise exception 'AU9-R1: target profiles are in an unexpected state (G2 rows %, R1 rows %); re-review', v_g2, v_r1;
  end if;
  if v_g2 = 50 and exists (
     select 1 from costing.plant_capacity_profile p
      join (values @@EXPECT@@) e(plant_id, eq) on e.plant_id = p.plant_id
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
 @@ROWS@@;

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
       c.corroborating_evidence, r.flags, true, c.effective_from, '@@APPROVAL@@', c.id,
       'AU-9 R1: user-supplied 2026-10-18 capacity / classification'
  from closed c join au9_r1 r on r.plant_id = c.plant_id;

-- ---------- §9 post-checks ----------
do $$
declare v_bad int;
begin
  if (select count(*) from costing.plant_capacity_profile where effective_to is null) <> 171 then
    raise exception 'AU9-R1: open profiles <> 171'; end if;
  if (select count(*) from costing.plant_capacity_profile where effective_to is null and approval_reference = '@@APPROVAL@@') <> 50 then
    raise exception 'AU9-R1: revised open profiles <> 50'; end if;
  if (select count(*) from costing.capacity_master_revision r
       where r.action = 'SUPERSEDE' and r.approval_reference = '@@APPROVAL@@') <> 50
     or (select count(*) from costing.capacity_master_revision r
       where r.action = 'CLOSE' and (r.after_image->>'approval_reference') = 'USER-APPROVAL-20261018-AU9-G1G3'
         and (r.after_image->>'plant_id')::int = any(array[@@IDS@@])) <> 50 then
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
