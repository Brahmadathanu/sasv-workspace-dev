-- =====================================================================
-- AU-9 PREPARED SQL — Seasonality (DVS-1) and Machine Capacity Profiles
-- NOTE 18 Oct 15:45 IST: PARTS B1–B4 ARE SUPERSEDED BY PREPARED_AU9_G1_G3_capacity_master.sql (tested). This file remains the design for G4–G6.
-- STATUS: PREPARED ONLY. NOT APPLIED. NOT A MIGRATION.
-- Kept outside supabase/migrations on purpose. Ends in ROLLBACK.
-- Apply only after explicit user approval, via Supabase MCP apply_migration,
-- split into the gated migrations listed in the proposal (G1..G6).
-- Never touches approved runs 122 / 128 or any existing snapshot row.
-- All objects are additive; no existing column, function or row is altered
-- except where marked "REPLACE (gate G4/G5)", which is shown commented out.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- PART B1. Machine applicability and equipment classes (reference data)
-- ---------------------------------------------------------------------
create table costing.machine_applicability_class (
  code text primary key,
  description text not null,
  requires_numeric_capacity boolean not null,      -- true => Costing Ready needs rated+effective+unit
  participates_in_load_calc boolean not null
);
insert into costing.machine_applicability_class values
 ('CAPACITY_BASED_PRODUCTION','Manufacturing equipment whose charge/throughput limits loads per batch', true,  true),
 ('CAPACITY_BASED_PACKING',   'Filling/packing machines; throughput recorded, not used by costing v1', false, false),
 ('NON_CAPACITY_PRODUCTION',  'Production asset with no load-limiting capacity (e.g. stove; capacity sits with vessel)', false, false),
 ('UTILITY',                  'Pumps, water, power and service assets', false, false),
 ('NON_PRODUCTION',           'Office, lab, vehicle and other non-manufacturing assets', false, false),
 ('UNKNOWN',                  'Not yet classified — blocks Costing Ready', false, false);

create table costing.machine_equipment_class (
  code text primary key,
  description text not null,
  default_applicability text not null references costing.machine_applicability_class(code),
  default_resource_class_code text,                -- costing.production_resource_class.code (soft ref; validated in G2)
  default_capacity_mode text check (default_capacity_mode in ('CHARGE','THROUGHPUT','NONE')),
  default_physical_unit text,
  active boolean not null default true
);
-- seeded in G2 from data/plant_machinery_inventory_backfill.csv (33 classes)

-- ---------------------------------------------------------------------
-- PART B2. Effective-dated, append-only machine capacity profile
-- ---------------------------------------------------------------------
create table costing.plant_capacity_profile (
  id bigint generated always as identity primary key,
  plant_id bigint not null references public.plant_machinery(id),
  applicability_class text not null references costing.machine_applicability_class(code),
  equipment_class_code text not null references costing.machine_equipment_class(code),
  resource_class_code text,                          -- costing resource class it serves in routes
  capacity_mode text not null check (capacity_mode in ('CHARGE','THROUGHPUT','NONE')),
  charge_basis text not null check (charge_basis in
      ('SOLID_CHARGE_KG','OUTPUT_VOLUME_L','OUTPUT_MASS_KG','FEED_RATE_KG_PER_HOUR',
       'OUTPUT_UNITS_PER_HOUR','OUTPUT_UNITS_PER_MINUTE','NOT_APPLICABLE')),
  physical_unit text check (physical_unit in ('kg','L','kg/h','Nos/h','packs/min')),
  rated_capacity numeric check (rated_capacity > 0),          -- nameplate / design
  effective_capacity numeric check (effective_capacity > 0),  -- working charge actually used per load
  effective_fill_pct numeric generated always as
      (case when rated_capacity > 0 and effective_capacity is not null
            then round(100 * effective_capacity / rated_capacity, 2) end) stored,
  hours_per_load numeric check (hours_per_load > 0),          -- THROUGHPUT mode only
  evidence_type text not null check (evidence_type in
      ('NAMEPLATE','SUPPLIER_DOCUMENT','BMR','MEASURED_TRIAL','NAME_DERIVED','WORK_LOG_DERIVED','USER_DECLARED','NONE')),
  evidence_reference text,
  is_provisional boolean not null default true,
  effective_from date not null,
  effective_to date,                                  -- null = open
  approval_reference text,
  supersedes_profile_id bigint references costing.plant_capacity_profile(id),
  change_reason text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint pcp_dates check (effective_to is null or effective_to > effective_from),
  -- applicable manufacturing equipment must carry numbers before it can be non-provisional
  constraint pcp_numbers_for_capacity check (
     applicability_class <> 'CAPACITY_BASED_PRODUCTION' or is_provisional
     or (physical_unit is not null and rated_capacity is not null and effective_capacity is not null
         and (capacity_mode <> 'THROUGHPUT' or hours_per_load is not null))),
  -- no fictitious capacity on non-capacity assets
  constraint pcp_no_fake_capacity check (
     applicability_class in ('CAPACITY_BASED_PRODUCTION','CAPACITY_BASED_PACKING')
     or (rated_capacity is null and effective_capacity is null and capacity_mode = 'NONE')),
  constraint pcp_approved_when_final check (is_provisional or approval_reference is not null)
);
-- one open/overlapping profile per plant
create extension if not exists btree_gist;
alter table costing.plant_capacity_profile add constraint pcp_no_overlap
  exclude using gist (plant_id with =, daterange(effective_from, coalesce(effective_to,'infinity'::date), '[)') with &&);

-- revision history: every insert / close is journaled with full before/after image
create table costing.plant_capacity_profile_revision (
  id bigint generated always as identity primary key,
  profile_id bigint not null,
  plant_id bigint not null,
  action text not null check (action in ('CREATE','CLOSE','SUPERSEDE')),
  before_image jsonb,
  after_image jsonb not null,
  reason text not null,
  approval_reference text,
  actor uuid default auth.uid(),
  at timestamptz not null default now()
);

create or replace function costing.fn_plant_capacity_profile_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'plant_capacity_profile is append-only; close with effective_to instead';
  elsif tg_op = 'UPDATE' then
    -- only allowed change: closing an open row (effective_to null -> date)
    if (to_jsonb(new) - 'effective_to') is distinct from (to_jsonb(old) - 'effective_to')
       or old.effective_to is not null then
      raise exception 'plant_capacity_profile rows are immutable (only closing effective_to is allowed)';
    end if;
    insert into costing.plant_capacity_profile_revision(profile_id, plant_id, action, before_image, after_image, reason, approval_reference)
    values (new.id, new.plant_id, 'CLOSE', to_jsonb(old), to_jsonb(new), coalesce(new.change_reason,'close'), new.approval_reference);
    return new;
  else
    insert into costing.plant_capacity_profile_revision(profile_id, plant_id, action, after_image, reason, approval_reference)
    values (new.id, new.plant_id, case when new.supersedes_profile_id is null then 'CREATE' else 'SUPERSEDE' end,
            to_jsonb(new), new.change_reason, new.approval_reference);
    return new;
  end if;
end $$;
create trigger trg_pcp_guard after insert on costing.plant_capacity_profile
  for each row execute function costing.fn_plant_capacity_profile_guard();
create trigger trg_pcp_guard_ud before update or delete on costing.plant_capacity_profile
  for each row execute function costing.fn_plant_capacity_profile_guard();
create or replace function costing.fn_raise_append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger trg_pcpr_append_only before update or delete on costing.plant_capacity_profile_revision
  for each row execute function costing.fn_raise_append_only();

-- ---------------------------------------------------------------------
-- PART B3. Controlled class-level fallback policy
-- ---------------------------------------------------------------------
create table costing.capacity_fallback_policy (
  id bigint generated always as identity primary key,
  resource_class_code text not null,
  equipment_class_code text references costing.machine_equipment_class(code),  -- null = any
  fallback_allowed boolean not null,
  fallback_source text not null check (fallback_source in
      ('ROUTE_EQUIPMENT_LOAD_CAPACITY_CLASS_DEFAULT','MIN_OF_READY_PROFILES_IN_CLASS','BLOCK')),
  max_provisional_share numeric check (max_provisional_share between 0 and 1), -- share of product workload allowed on fallback
  review_flag text not null default 'CAPACITY_FALLBACK_USED',
  effective_from date not null,
  effective_to date,
  approval_reference text not null,
  note text,
  created_at timestamptz not null default now()
);
-- G3 seed (proposal): every current class keeps the AU-6 V2 class default as an explicit, approved fallback
-- insert ... ('GRINDER',null,true,'ROUTE_EQUIPMENT_LOAD_CAPACITY_CLASS_DEFAULT',null,'CAPACITY_FALLBACK_USED','2026-11-01',null,'<USER-APPROVAL-AU9-...>')

-- ---------------------------------------------------------------------
-- PART B4. Readiness view (read-only)
-- ---------------------------------------------------------------------
create or replace view costing.v_plant_capacity_readiness as
with cur as (
  select distinct on (plant_id) * from costing.plant_capacity_profile
  where effective_from <= current_date and (effective_to is null or effective_to > current_date)
  order by plant_id, effective_from desc)
select pm.id plant_id, pm.plant_name, pm.status, mt.type_name,
       cur.id profile_id, cur.applicability_class, cur.equipment_class_code, cur.resource_class_code,
       cur.capacity_mode, cur.physical_unit, cur.rated_capacity, cur.effective_capacity,
       cur.is_provisional, cur.evidence_type, cur.effective_from,
       case
         when cur.id is null                                         then 'BLOCKED_NO_PROFILE'
         when cur.applicability_class = 'UNKNOWN'                    then 'BLOCKED_UNCLASSIFIED'
         when not mac.requires_numeric_capacity                      then 'NOT_REQUIRED'
         when pm.status <> 'O'                                       then 'NOT_OPERATIONAL'
         when cur.effective_capacity is null or cur.physical_unit is null then 'BLOCKED_NEEDS_CAPACITY'
         when cur.is_provisional                                     then 'READY_PROVISIONAL'
         else 'COSTING_READY' end readiness
from public.plant_machinery pm
left join public.machine_types mt on mt.id = pm.type_id
left join cur on cur.plant_id = pm.id
left join costing.machine_applicability_class mac on mac.code = cur.applicability_class;

-- ---------------------------------------------------------------------
-- PART B5. Plant-aware load resolver (new function; old one untouched)
-- ---------------------------------------------------------------------
create or replace function costing.fn_route_step_loads_v2(
  p_resource_class text, p_plant_id bigint, p_solid_kg numeric, p_output_qty numeric,
  p_output_uom text, p_valuation_date date)
returns table(loads integer, capacity_used numeric, capacity_unit text, capacity_source text,
              profile_id bigint, fallback_policy_id bigint, review_flag text)
language plpgsql stable as $$
declare pr record; fb record; q numeric;
begin
  if p_plant_id is not null then
    select * into pr from costing.plant_capacity_profile
     where plant_id = p_plant_id and capacity_mode = 'CHARGE'
       and effective_from <= p_valuation_date and (effective_to is null or effective_to > p_valuation_date)
       and effective_capacity is not null
     order by effective_from desc limit 1;
    if found then
      q := case when pr.charge_basis = 'OUTPUT_VOLUME_L' then p_output_qty
                when pr.charge_basis = 'OUTPUT_MASS_KG' then p_output_qty else p_solid_kg end;
      return query select greatest(1, ceil(coalesce(q,0) / pr.effective_capacity))::int, pr.effective_capacity,
                          pr.physical_unit, case when pr.is_provisional then 'PLANT_PROFILE_PROVISIONAL' else 'PLANT_PROFILE' end,
                          pr.id, null::bigint, case when pr.is_provisional then 'CAPACITY_PROVISIONAL' end;
      return;
    end if;
  end if;
  select * into fb from costing.capacity_fallback_policy
   where resource_class_code = p_resource_class and effective_from <= p_valuation_date
     and (effective_to is null or effective_to > p_valuation_date)
   order by equipment_class_code nulls last, effective_from desc limit 1;
  if not found or not fb.fallback_allowed or fb.fallback_source = 'BLOCK' then
    return query select null::int, null::numeric, null::text, 'BLOCKED_NO_CAPACITY', null::bigint, fb.id, 'CAPACITY_MISSING_BLOCKER';
    return;
  end if;
  -- controlled fallback: reuse the existing, approved class default resolver unchanged
  return query select l.loads, null::numeric, null::text, 'CLASS_FALLBACK', null::bigint, fb.id, fb.review_flag
    from (select costing.fn_route_step_loads(p_resource_class, p_solid_kg, p_output_qty, p_output_uom, p_valuation_date) loads) l;
end $$;
-- NOTE (G4): the existing fn_route_step_loads return shape must be confirmed before apply;
-- the refresh RPC switches to v2 only behind costing_sales_feed_switch-style switch
-- 'capacity_resolver_version' (default 'V1'), and writes capacity_source/profile_id/
-- fallback_policy_id into route_load_scaling_snapshot.step_detail (additive JSON keys).

-- ---------------------------------------------------------------------
-- PART B6. Governed plant master writes (replace direct client CRUD)
-- ---------------------------------------------------------------------
create table public.plant_machinery_audit (
  id bigint generated always as identity primary key,
  plant_id bigint not null,
  event_type text not null check (event_type in ('CREATE','UPDATE','STATUS_CHANGE','RETIRE')),
  before_image jsonb, after_image jsonb, reason text not null,
  actor uuid default auth.uid(), at timestamptz not null default now());
-- G6: rpc_plant_machinery_upsert(p_id, p_plant_name, p_type_id, p_area_id, p_status, p_reason)
--     rpc_plant_machinery_retire(p_id, p_reason)  -- soft: status='R', never DELETE
-- G6: revoke insert, update, delete on public.plant_machinery from authenticated;  (after client switch)
-- G6: trigger blocking DELETE on public.plant_machinery when referenced by route steps,
--     cost centres, overrides, daily_work_log or capacity profiles.

-- ---------------------------------------------------------------------
-- PART A1. Demand seasonality (separate from manufacture season)
-- ---------------------------------------------------------------------
create table costing.product_demand_seasonality (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id),
  demand_pattern text not null check (demand_pattern in ('DEMAND_SEASONAL','NON_SEASONAL','UNDER_REVIEW')),
  peak_months int[] check (peak_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]),
  evidence text not null,
  effective_from date not null, effective_to date,
  approval_reference text, created_at timestamptz not null default now());

-- ---------------------------------------------------------------------
-- PART A2. Versioned demand-volume selection policy (DVS)
-- ---------------------------------------------------------------------
create table costing.demand_volume_selection_policy (
  id bigint generated always as identity primary key,
  policy_code text not null,                      -- 'DVS-1'
  version int not null,
  params jsonb not null,                          -- see proposal §A4
  diagnostic_top3_threshold numeric not null default 0.6,  -- retained diagnostic only
  effective_from date not null, effective_to date,
  approval_reference text,
  status text not null check (status in ('DRAFT','APPROVED','RETIRED')),
  unique (policy_code, version));

create table costing.demand_event_register (
  id bigint generated always as identity primary key,
  sku_id bigint not null,
  event_month date not null,
  event_date date,
  event_type text not null check (event_type in
      ('BULK_INSTITUTIONAL_ORDER','PROMOTION_SCHEME','SUPPLY_CONSTRAINT','LAUNCH_STOCKING',
       'EXHIBITION_FESTIVAL','PRICE_CHANGE_PREBUY','DATA_CORRECTION','OTHER')),
  units_affected numeric,
  treatment text not null check (treatment in ('EXCLUDE_UNITS','EXCLUDE_MONTH','CAP_AT_BASELINE','INFORMATION_ONLY')),
  evidence_reference text not null,
  status text not null check (status in ('PROPOSED','CONFIRMED','REJECTED')),
  approval_reference text,
  created_at timestamptz not null default now());

create table costing.sku_demand_volume_override (
  id bigint generated always as identity primary key,
  sku_id bigint not null,
  effective_from date not null, effective_to date,
  override_method text not null check (override_method in ('FIXED_MONTHLY_UNITS','AVERAGE_OF_MONTHS','MAX_MONTH','PLAN_FORECAST')),
  monthly_units numeric check (monthly_units >= 0),
  reason text not null, approval_reference text not null,
  created_at timestamptz not null default now());

-- per-run lineage of the selection (new snapshot; existing basis snapshot gets 2 nullable cols in G5)
create table costing.sku_demand_volume_selection_snapshot (
  id bigint generated always as identity primary key,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  period_start date not null, valuation_date date not null,
  sku_id bigint not null,
  policy_id bigint not null references costing.demand_volume_selection_policy(id),
  method text not null,
  candidate_max_month numeric, candidate_12m_avg numeric, candidate_in_stock_avg numeric,
  candidate_since_launch_avg numeric, candidate_max_excl_events numeric,
  diagnostic_top3_share numeric, diagnostic_flag boolean,
  master_manufacture_seasonal boolean, demand_pattern text,
  event_ids bigint[], override_id bigint,
  selected_monthly_units numeric not null,
  created_at timestamptz not null default now(),
  unique (refresh_run_id, sku_id));
-- G5: attach existing guards (fn_guard_append_only / fn_guard_designated_run_rows /
--     fn_guard_snapshot_truncate) exactly as on sku_sales_allocation_basis_snapshot,
--     so rows of APPROVED runs (122, 128, ...) can never be updated or deleted.
-- G5: DO NOT add columns to sku_sales_allocation_basis_snapshot (adding a column changes the row hash of
--     approved runs; see AU9 G1-G3 test report, run-122 drift finding). Use the separate selection snapshot only.
-- (withdrawn) alter table costing.sku_sales_allocation_basis_snapshot
--     add column demand_policy_id bigint, add column demand_method text;   -- nullable; old rows untouched

rollback;   -- PREPARED ONLY
