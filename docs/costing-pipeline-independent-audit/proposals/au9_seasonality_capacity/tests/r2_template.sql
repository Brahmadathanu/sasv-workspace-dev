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
  select count(*) filter (where approval_reference = 'USER-SUPPLIED-20261018-AU9-R1' and plant_id = any(array[@@IDS_R1@@])),
         count(*) filter (where approval_reference = 'USER-APPROVAL-20261018-AU9-G1G3' and plant_id = any(array[@@IDS_G2@@])),
         count(*) filter (where approval_reference = '@@APPROVAL@@')
    into v_r1, v_g2, v_r2
    from costing.plant_capacity_profile where effective_to is null and plant_id = any(array[@@IDS@@]);
  if not ((v_r1 = 50 and v_g2 = 27 and v_r2 = 0) or (v_r1 = 0 and v_g2 = 0 and v_r2 = 77)) then
    raise exception 'AU9-R2: targets in unexpected state (R1 %, G2 %, R2 %); re-review', v_r1, v_g2, v_r2; end if;
  if v_r2 = 0 and exists (
     select 1 from costing.plant_capacity_profile p
      join (values @@EXPECT@@) e(plant_id, eq) on e.plant_id = p.plant_id
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
 @@ROWS@@;

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
       c.corroborating_evidence, r.flags, true, c.effective_from, '@@APPROVAL@@', c.id,
       'AU-9 R2: user-corrected 2026-10-18 18:19 capacity (supersedes R1 where applicable)'
  from closed c join au9_r2 r on r.plant_id = c.plant_id;

-- ---------- §9 post-checks ----------
do $$
declare v_bad int;
begin
  if (select count(*) from costing.plant_capacity_profile where effective_to is null) <> 171 then
    raise exception 'AU9-R2: open profiles <> 171'; end if;
  if (select count(*) from costing.plant_capacity_profile where effective_to is null and approval_reference = '@@APPROVAL@@') <> 77 then
    raise exception 'AU9-R2: revised open profiles <> 77'; end if;
  if (select count(*) from costing.capacity_master_revision where action = 'SUPERSEDE' and approval_reference = '@@APPROVAL@@') <> 77 then
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
