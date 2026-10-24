-- =====================================================================
-- AU-9 G1–G3 PREPARED SQL: machine capacity master (classes, profiles,
-- revision journal, readiness view, provisional backfill of 171 machines,
-- controlled fallback policy seeded from the current class defaults).
--
-- STATUS: PREPARED + TESTED LOCALLY. NOT APPLIED LIVE.
-- Kept outside supabase/migrations. For the live apply, pass this file's
-- body unchanged to Supabase MCP apply_migration (which is transactional),
-- name: au9_g1_g3_capacity_master. Approval: @@APPROVAL@@ (user, 18 Oct 15:36 IST)
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
 @@EQ@@
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
       true, date '@@EFF@@', '@@APPROVAL@@', 'AU-9 G2 provisional backfill (classification only; no costing effect)'
from (values
 @@BACKFILL@@
) v(plant_id, plant_name, app, eq, rc, mode, basis, unit, rated, ev, evref, wl, flags)
join public.plant_machinery pm on pm.id = v.plant_id and pm.plant_name = v.plant_name
where not exists (select 1 from costing.plant_capacity_profile p where p.plant_id = v.plant_id);

-- ---------- G3. fallback policy = today's approved class defaults (AU-6 V2) ----------
insert into costing.capacity_fallback_policy(resource_class_code, fallback_allowed, fallback_source, legacy_capacity_id,
       effective_from, approval_reference, change_reason)
select c.resource_class_code, true, 'ROUTE_EQUIPMENT_LOAD_CAPACITY_CLASS_DEFAULT', c.id, date '@@EFF@@', '@@APPROVAL@@',
       'Class default '||c.equipment_class_code||' approved as fallback until machine values arrive'
  from costing.route_equipment_load_capacity c
 where c.is_resource_class_default and c.effective_to is null
   and not exists (select 1 from costing.capacity_fallback_policy f
                    where f.resource_class_code = c.resource_class_code and f.equipment_class_code is null
                      and f.effective_from = date '@@EFF@@');
insert into costing.capacity_fallback_policy(resource_class_code, fallback_allowed, fallback_source,
       effective_from, approval_reference, change_reason)
select r.code, true, 'NO_CAPACITY_ROW_SINGLE_LOAD', date '@@EFF@@', '@@APPROVAL@@',
       'No class capacity row today; documents current behaviour (one load per step)'
  from costing.production_resource_class r
 where not exists (select 1 from costing.route_equipment_load_capacity c
                    where c.resource_class_code = r.code and c.is_resource_class_default and c.effective_to is null)
   and not exists (select 1 from costing.capacity_fallback_policy f
                    where f.resource_class_code = r.code and f.equipment_class_code is null
                      and f.effective_from = date '@@EFF@@');

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
  if (select count(*) from costing.machine_equipment_class) <> @@NEQ@@ then raise exception 'AU9: equipment classes <> @@NEQ@@'; end if;
  select count(*) into v_rows from costing.plant_capacity_profile where effective_to is null;
  if v_rows <> 171 or exists (select 1 from public.plant_machinery pm where not exists
       (select 1 from costing.plant_capacity_profile p where p.plant_id = pm.id and p.effective_to is null)) then
    raise exception 'AU9: expected one open profile for each of the 171 machines, found %', v_rows; end if;
  if exists (select 1 from costing.plant_capacity_profile where not is_provisional) then raise exception 'AU9: backfill must be provisional'; end if;
  if (select count(*) from costing.capacity_fallback_policy where effective_to is null) <> 17 then raise exception 'AU9: fallback rows <> 17'; end if;
  if (select count(*) from costing.capacity_master_revision where action = 'CREATE' and approval_reference = '@@APPROVAL@@') <> 171 + 17 then
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
