-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- =====================================================================================================
-- AU-9 G4: plant-aware equipment-load calculation (PREPARED, NOT APPLIED)
-- Prepared 18 Oct 2026 (IST) under user approval 20:46 IST "build G4 and test it locally" (LOCAL ONLY).
-- Implements the user-approved (20:11 IST) grinder rule v2 (register P26) and T1 for throughput machines.
--
-- Intended apply (only after a separate explicit go-ahead): Supabase MCP apply_migration
--   name: au9_g4_plant_aware_loads    (never `supabase db push`, repair or migration up)
--
-- What it installs
--   * costing.plant_aware_load_switch          effective-dated switch; installed EMPTY = OFF; cannot start before 1 Nov 2026
--   * costing.route_step_capacity_rule         P26 step rules by governed activity (+ T1 rules), effective 1 Nov 2026
--   * costing.route_step_load_provenance_snapshot  per-step lineage of every plant-aware load (Nov 2026 onward only)
--   * functions fn_au9_g4_load_mode, fn_au9_g4_resolve_step_load, fn_au9_g4_route_step_loads,
--     fn_au9_g4_capture_provenance, fn_au9_g4_provenance_guard
--   * a guarded in-place patch of the two refresh RPCs (Production Overhead and Direct Labour) that swaps
--     fn_route_step_loads(...) for fn_au9_g4_route_step_loads(..., step lineage). With the switch OFF
--     (or any date before 1 Nov 2026) the wrapper returns fn_route_step_loads(...) unchanged.
-- Resolution order when ON: explicit machine on the route step / product override  >  approved step rule
--   (activity)  >  approved class fallback (capacity_fallback_policy). Never uses hours or time; T1 keeps
--   throughput machines (kg/h) on the class weight lot. Fails closed (raises) when a requirement is unmet
--   and no approved fallback exists.
-- No change to runs, snapshots, periods, cron, capacities, Sheets. No cost changes while OFF.
-- =====================================================================================================

-- ---------- §0 prechecks ----------
do $$
declare v_n int; v_def text;
begin
  if to_regclass('costing.plant_capacity_profile') is null or to_regclass('costing.capacity_fallback_policy') is null
     or to_regprocedure('costing.fn_route_step_loads(text,numeric,numeric,text,date)') is null then
    raise exception 'AU9-G4: AU-9 G1-G3 / AU-6L objects missing';
  end if;
  if (select count(*) from costing.plant_capacity_profile where effective_to is null) <> 171 then
    raise exception 'AU9-G4: expected 171 open capacity profiles'; end if;
  if (select count(*) from costing.plant_capacity_profile where effective_to is null and approval_reference = 'USER-CORRECTED-20261018-AU9-R2') <> 77 then
    raise exception 'AU9-G4: AU-9 R2 capacities not in place (77 expected)'; end if;
  if (select count(*) from costing.capacity_fallback_policy where effective_to is null and effective_from = date '2026-11-01') <> 17 then
    raise exception 'AU9-G4: expected the 17 approved class fallback rows'; end if;
  select count(*) into v_n from public.activities a
    join (values (121,'Grinding'),(133,'Kajjali grinding'),(50,'Pill grinding'),(314,'Wet grinding — Vessels & Cookers'),
                 (21,'Pulverization'),(161,'Disintegration'),(22,'Sieving'),(158,'Pulverizing and Sieving'),(222,'Wet pulverization')) x(id, n)
      on x.id = a.id and a.activity_name = x.n;
  if v_n <> 9 then raise exception 'AU9-G4: governed activity ids/names differ from the reviewed set (% of 9)', v_n; end if;
  -- each P26 target class must resolve to exactly one operational capacity on 1 Nov 2026
  select count(*) into v_n from (
    select e.code, count(distinct p.effective_capacity) nc, min(p.effective_capacity) cap
      from (values ('RASOUSHADHI_LEVIGATION_GRINDER',20::numeric),('MECHANISED_KHALVAM_SET',3.2),('PILLS_WET_GRINDER',3),('WET_GRINDER',2)) e(code, cap0)
      join costing.plant_capacity_profile p on p.equipment_class_code = e.code and p.effective_to is null and p.capacity_mode = 'CHARGE'
      join public.plant_machinery pm on pm.id = p.plant_id and pm.status = 'O'
     group by e.code, e.cap0 having count(distinct p.effective_capacity) = 1 and min(p.effective_capacity) = e.cap0) z;
  if v_n <> 4 then raise exception 'AU9-G4: P26 target classes do not resolve to the approved capacities (% of 4)', v_n; end if;
  -- refresh RPCs must be exactly the reviewed definitions, or already patched by this package
  v_def := pg_get_functiondef('costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint)'::regprocedure);
  if md5(v_def) not in ('3087b71eda32e09a8b13ee12700fcdd6','9a87d9275b36b81602a4ba7c5833c9d2') then
    raise exception 'AU9-G4: Production Overhead refresh RPC changed since review (md5 %); re-review', md5(v_def); end if;
  v_def := pg_get_functiondef('costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)'::regprocedure);
  if md5(v_def) not in ('3b68b6aaef95a68764a0627ff97c72e2','653f851c52e840d2431cf523775a68c8') then
    raise exception 'AU9-G4: Direct Labour refresh RPC changed since review (md5 %); re-review', md5(v_def); end if;
  if to_regclass('costing.route_step_capacity_rule') is not null then
    execute 'select count(*) from costing.route_step_capacity_rule' into v_n;
    if v_n not in (0, 9) then raise exception 'AU9-G4: step-rule table in unexpected state (% rows); re-review', v_n; end if;
  end if;
end $$;

-- baseline for post-checks (existing functions/views except the two RPCs patched below and AU-9 helpers; run fingerprints)
create temporary table au9_g4_base on commit drop as
select 'fn_view'::text k, md5(string_agg(x.k || x.v, '|' order by x.k)) v from (
  select p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('costing','public') and p.prokind in ('f','p') and p.proname not like 'fn_au9%'
     and p.proname not in ('rpc_refresh_production_overhead_workload_snapshot','rpc_refresh_sku_direct_labour_component_split_snapshot')
  union all
  select c.oid::regclass::text, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('costing','public') and c.relkind = 'v') x
union all select 'run122', md5(costing.fn_compute_run_fingerprint(122)::text)
union all select 'run128', md5(costing.fn_compute_run_fingerprint(128)::text);

-- ---------- §1 switch (installed empty = OFF) ----------
create table if not exists costing.plant_aware_load_switch (
  id bigint generated always as identity primary key,
  is_enabled boolean not null,
  effective_from date not null,
  effective_to date,
  approval_reference text not null,
  change_reason text not null,
  supersedes_id bigint references costing.plant_aware_load_switch(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint pals_from_nov2026 check (effective_from >= date '2026-11-01'),
  constraint pals_dates check (effective_to is null or effective_to >= effective_from),
  constraint pals_no_overlap exclude using gist (daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&)
);
create or replace trigger trg_pals_close_only before update or delete on costing.plant_aware_load_switch
  for each row execute function costing.fn_au9_close_only_guard();
create or replace trigger trg_pals_journal after insert or update on costing.plant_aware_load_switch
  for each row execute function costing.fn_au9_journal();
create or replace trigger trg_pals_no_truncate before truncate on costing.plant_aware_load_switch
  for each statement execute function costing.fn_au9_append_only();
comment on table costing.plant_aware_load_switch is 'AU-9 G4: effective-dated switch for plant-aware equipment loads. Empty = OFF. Cannot start before 1 Nov 2026. Turning on needs explicit user approval.';

-- ---------- §2 step rules (P26 + T1) ----------
create table if not exists costing.route_step_capacity_rule (
  id bigint generated always as identity primary key,
  rule_code text not null,
  resource_class_code text not null references costing.production_resource_class(code),
  activity_id integer not null references public.activities(id),
  activity_name_at_approval text not null,
  resolution text not null check (resolution in ('EQUIPMENT_CLASS_CAPACITY','CLASS_FALLBACK_T1')),
  equipment_class_code text references costing.machine_equipment_class(code),
  policy_reference text not null,
  effective_from date not null,
  effective_to date,
  approval_reference text not null,
  change_reason text not null,
  supersedes_id bigint references costing.route_step_capacity_rule(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint rscr_from_nov2026 check (effective_from >= date '2026-11-01'),
  constraint rscr_dates check (effective_to is null or effective_to >= effective_from),
  constraint rscr_target check ((resolution = 'EQUIPMENT_CLASS_CAPACITY') = (equipment_class_code is not null)),
  constraint rscr_no_overlap exclude using gist (resource_class_code with =, activity_id with =,
                                                daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&)
);
create or replace trigger trg_rscr_close_only before update or delete on costing.route_step_capacity_rule
  for each row execute function costing.fn_au9_close_only_guard();
create or replace trigger trg_rscr_journal after insert or update on costing.route_step_capacity_rule
  for each row execute function costing.fn_au9_journal();
create or replace trigger trg_rscr_no_truncate before truncate on costing.route_step_capacity_rule
  for each statement execute function costing.fn_au9_append_only();
comment on table costing.route_step_capacity_rule is 'AU-9 G4: approved step-to-capacity rules by governed activity (P26 grinder rule v2 + T1). Used only when a step names no usable machine.';

insert into costing.route_step_capacity_rule(rule_code, resource_class_code, activity_id, activity_name_at_approval, resolution,
       equipment_class_code, policy_reference, effective_from, approval_reference, change_reason)
select r.rule_code, 'GRINDER', r.activity_id, r.activity_name, r.resolution, r.eq, r.policy, date '2026-11-01',
       'USER-APPROVAL-20261018-AU9-P26-T1',
       'AU-9 G4: user-approved 2026-10-18 20:11 IST grinder rule v2 (P26) and T1 for throughput machines'
  from (values
    ('P26_RASOUSHADHI_GRINDING', 121, 'Grinding',                          'EQUIPMENT_CLASS_CAPACITY', 'RASOUSHADHI_LEVIGATION_GRINDER', 'P26'),
    ('P26_KAJJALI_KHALVAM',      133, 'Kajjali grinding',                  'EQUIPMENT_CLASS_CAPACITY', 'MECHANISED_KHALVAM_SET',         'P26'),
    ('P26_PILL_GRINDING',         50, 'Pill grinding',                     'EQUIPMENT_CLASS_CAPACITY', 'PILLS_WET_GRINDER',              'P26'),
    ('P26_WET_GRINDING',         314, 'Wet grinding — Vessels & Cookers',  'EQUIPMENT_CLASS_CAPACITY', 'WET_GRINDER',                    'P26'),
    ('T1_PULVERIZATION',          21, 'Pulverization',                     'CLASS_FALLBACK_T1', null, 'P26-T1'),
    ('T1_DISINTEGRATION',        161, 'Disintegration',                    'CLASS_FALLBACK_T1', null, 'P26-T1'),
    ('T1_SIEVING',                22, 'Sieving',                           'CLASS_FALLBACK_T1', null, 'P26-T1'),
    ('T1_PULVERIZING_SIEVING',   158, 'Pulverizing and Sieving',           'CLASS_FALLBACK_T1', null, 'P26-T1'),
    ('T1_WET_PULVERIZATION',     222, 'Wet pulverization',                 'CLASS_FALLBACK_T1', null, 'P26-T1')
  ) r(rule_code, activity_id, activity_name, resolution, eq, policy)
 where not exists (select 1 from costing.route_step_capacity_rule x where x.rule_code = r.rule_code);

-- ---------- §3 provenance snapshot (Nov 2026 onward only) ----------
create table if not exists costing.route_step_load_provenance_snapshot (
  id bigint generated always as identity primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null,
  allocation_pool text not null check (allocation_pool in ('PRODUCTION_OVERHEAD','MANUFACTURING_LABOUR')),
  product_id bigint not null,
  effective_step_key text,
  sequence_no numeric,
  source_type text,
  base_step_id bigint,
  override_id bigint,
  activity_id integer,
  resource_class_code text not null,
  resolution_basis text not null check (resolution_basis in ('EXPLICIT_MACHINE','STEP_RULE_EQUIPMENT_CLASS','STEP_RULE_T1_CLASS_LOT',
                                                             'THROUGHPUT_MACHINE_T1_CLASS_LOT','CLASS_FALLBACK')),
  machine_link_source text,
  plant_id integer,
  equipment_class_code text,
  capacity_profile_id bigint,
  capacity_revision_id bigint,
  class_machine_count integer,
  step_rule_id bigint,
  fallback_policy_id bigint,
  legacy_capacity_id bigint,
  charge_basis text,
  charge_qty numeric,
  capacity numeric,
  capacity_unit text,
  loads numeric not null check (loads >= 1),
  is_provisional boolean,
  review_flags text[] not null default '{}',
  switch_id bigint not null references costing.plant_aware_load_switch(id),
  captured_at timestamptz not null default now(),
  constraint rslp_from_nov2026 check (valuation_date >= date '2026-11-01' and period_start >= date '2026-11-01'),
  constraint rslp_basis_lineage check (
    (resolution_basis in ('EXPLICIT_MACHINE','STEP_RULE_EQUIPMENT_CLASS') and capacity_profile_id is not null and capacity_revision_id is not null and capacity is not null)
    or (resolution_basis in ('STEP_RULE_T1_CLASS_LOT','THROUGHPUT_MACHINE_T1_CLASS_LOT','CLASS_FALLBACK') and fallback_policy_id is not null)),
  constraint rslp_one_per_step unique (refresh_run_id, allocation_pool, product_id, effective_step_key)
);
create or replace function costing.fn_au9_g4_provenance_guard() returns trigger language plpgsql
set search_path to 'costing', 'pg_temp' as $f$
begin
  if not exists (select 1 from costing.costing_refresh_run r
                  where r.id = new.refresh_run_id and r.period_start = new.period_start and r.valuation_date = new.valuation_date
                    and r.period_start >= date '2026-11-01') then
    raise exception 'AU-9 G4: provenance only for an existing refresh run of November 2026 or later (run %, period %)', new.refresh_run_id, new.period_start;
  end if;
  return new;
end $f$;
create or replace trigger trg_rslp_guard before insert on costing.route_step_load_provenance_snapshot
  for each row execute function costing.fn_au9_g4_provenance_guard();
create or replace trigger trg_rslp_immutable before update or delete on costing.route_step_load_provenance_snapshot
  for each row execute function costing.fn_au9_append_only();
create or replace trigger trg_rslp_no_truncate before truncate on costing.route_step_load_provenance_snapshot
  for each statement execute function costing.fn_au9_append_only();
comment on table costing.route_step_load_provenance_snapshot is 'AU-9 G4: per-step lineage of plant-aware equipment loads (machine/rule/fallback, capacity profile and revision). Written only when the switch is on; Nov 2026 onward.';

-- ---------- §4 functions ----------
create or replace function costing.fn_au9_g4_load_mode(p_valuation_date date) returns bigint
language sql stable security definer set search_path to 'costing', 'pg_temp' as $f$
  select s.id from costing.plant_aware_load_switch s
   where s.is_enabled and p_valuation_date >= date '2026-11-01'
     and s.effective_from <= p_valuation_date and (s.effective_to is null or s.effective_to > p_valuation_date)
$f$;

create or replace function costing.fn_au9_g4_resolve_step_load(
  p_resource_class_code text, p_solid_kg numeric, p_output_qty numeric, p_output_uom text, p_valuation_date date,
  p_base_step_id bigint, p_override_id bigint, p_activity_id integer)
returns jsonb language plpgsql stable security definer set search_path to 'costing', 'public', 'pg_temp' as $f$
declare
  d date := p_valuation_date;
  v_plant int; v_link text; v_act int; v_ok boolean;
  v_pr record; v_rule record; v_cls record; v_fb record; v_leg record;
  v_basis text; v_flags text[] := '{}'; v_qty numeric; v_cap numeric; v_unit text; v_cb text; v_loads numeric;
  v_profile bigint; v_rev bigint; v_eq text; v_rule_id bigint; v_fb_id bigint; v_leg_id bigint; v_prov boolean; v_n int;
  v_try_rule boolean := true;
begin
  if d is null or d < date '2026-11-01' then
    raise exception 'AU-9 G4: plant-aware loads are not available for valuation date % (effective from 1 Nov 2026 only)', d;
  end if;
  if p_resource_class_code is null then raise exception 'AU-9 G4: route step without a resource class'; end if;

  -- 1. machine link and activity from the governed route lineage (product override first, then route step)
  select coalesce(o.plant_id, b.plant_id),
         case when o.plant_id is not null then 'PRODUCT_OVERRIDE' when b.plant_id is not null then 'ROUTE_STEP' end,
         coalesce(o.activity_id, b.activity_id),
         (p_override_id is null or o.id is not null) and (p_base_step_id is null or b.id is not null)
    into v_plant, v_link, v_act, v_ok
    from (select 1) one
    left join costing.product_process_route_override o on o.id = p_override_id
    left join costing.production_route_family_route_step b on b.id = p_base_step_id;
  if not v_ok then
    raise exception 'AU-9 G4: route step lineage not found (route step %, override %)', p_base_step_id, p_override_id;
  end if;
  if p_activity_id is not null and v_act is not null and p_activity_id <> v_act then
    raise exception 'AU-9 G4: step evidence activity % differs from governed route activity %', p_activity_id, v_act;
  end if;
  v_act := coalesce(v_act, p_activity_id);

  if v_plant is not null then
    select p.*, pm.status::text plant_status, mac.participates_in_load_calc
      into v_pr
      from costing.plant_capacity_profile p
      join public.plant_machinery pm on pm.id = p.plant_id
      join costing.machine_applicability_class mac on mac.code = p.applicability_class
     where p.plant_id = v_plant and p.effective_from <= d and (p.effective_to is null or p.effective_to > d);
    if not found then
      raise exception 'AU-9 G4: route step names machine % but it has no capacity profile effective on % (fail-closed)', v_plant, d;
    end if;
    v_profile := v_pr.id; v_eq := v_pr.equipment_class_code; v_prov := v_pr.is_provisional;
    select max(r.id) into v_rev from costing.capacity_master_revision r
     where r.entity = 'plant_capacity_profile' and r.entity_id = v_pr.id and r.action in ('CREATE','SUPERSEDE');
    if v_pr.applicability_class = 'UNKNOWN' then
      raise exception 'AU-9 G4: machine % on the route is unclassified; classify it before costing (fail-closed)', v_plant;
    elsif not v_pr.participates_in_load_calc then
      v_flags := array_append(v_flags, 'LINKED_MACHINE_NOT_CAPACITY_LIMITING'::text);
    elsif v_pr.resource_class_code is distinct from p_resource_class_code then
      v_flags := array_append(v_flags, 'LINKED_MACHINE_OTHER_RESOURCE_CLASS'::text);
    elsif v_pr.plant_status <> 'O' then
      v_flags := array_append(v_flags, 'LINKED_MACHINE_NOT_OPERATIONAL'::text);
    elsif v_pr.capacity_mode = 'THROUGHPUT' then
      v_basis := 'THROUGHPUT_MACHINE_T1_CLASS_LOT'; v_try_rule := false;
      v_flags := array_append(v_flags, 'T1_RATED_THROUGHPUT_NOT_A_COSTING_BASIS'::text);
    elsif v_pr.capacity_mode = 'CHARGE' and v_pr.effective_capacity is not null and v_pr.physical_unit is not null then
      v_basis := 'EXPLICIT_MACHINE'; v_cap := v_pr.effective_capacity; v_unit := v_pr.physical_unit; v_cb := v_pr.charge_basis;
    else
      v_flags := array_append(v_flags, 'LINKED_MACHINE_CAPACITY_PENDING'::text);
    end if;
  end if;

  -- 2. approved step rule (activity) when no usable machine capacity
  if v_basis is null and v_try_rule and v_act is not null then
    select r.* into v_rule from costing.route_step_capacity_rule r
     where r.resource_class_code = p_resource_class_code and r.activity_id = v_act
       and r.effective_from <= d and (r.effective_to is null or r.effective_to > d);
    if found then
      v_rule_id := v_rule.id;
      if v_rule.resolution = 'EQUIPMENT_CLASS_CAPACITY' then
        select count(*) n, count(distinct p.effective_capacity) nc, min(p.effective_capacity) cap, min(p.id) pid,
               bool_or(p.is_provisional) prov, count(distinct p.charge_basis) ncb, min(p.charge_basis) cb,
               count(distinct p.physical_unit) nu, min(p.physical_unit) u
          into v_cls
          from costing.plant_capacity_profile p
          join public.plant_machinery pm on pm.id = p.plant_id and pm.status = 'O'
         where p.equipment_class_code = v_rule.equipment_class_code and p.capacity_mode = 'CHARGE'
           and p.effective_capacity is not null and p.effective_from <= d and (p.effective_to is null or p.effective_to > d);
        if v_cls.n = 0 then
          raise exception 'AU-9 G4: step rule % needs an operational % machine with capacity on % (fail-closed)', v_rule.rule_code, v_rule.equipment_class_code, d;
        elsif v_cls.nc > 1 or v_cls.ncb > 1 or v_cls.nu > 1 then
          raise exception 'AU-9 G4: step rule % is ambiguous: % machines of class % have different capacities; name the machine on the route', v_rule.rule_code, v_cls.n, v_rule.equipment_class_code;
        end if;
        v_basis := 'STEP_RULE_EQUIPMENT_CLASS'; v_cap := v_cls.cap; v_unit := v_cls.u; v_cb := v_cls.cb;
        v_profile := v_cls.pid; v_eq := v_rule.equipment_class_code; v_prov := v_cls.prov; v_n := v_cls.n; v_link := v_link || '_NOT_USABLE';
        select max(r.id) into v_rev from costing.capacity_master_revision r
         where r.entity = 'plant_capacity_profile' and r.entity_id = v_cls.pid and r.action in ('CREATE','SUPERSEDE');
      else
        v_basis := 'STEP_RULE_T1_CLASS_LOT';
      end if;
    end if;
  end if;

  -- 3a. machine or class capacity: loads = ceil(charge / capacity), at least 1 (no time element)
  if v_basis in ('EXPLICIT_MACHINE','STEP_RULE_EQUIPMENT_CLASS') then
    if v_cb = 'SOLID_CHARGE_KG' and v_unit = 'kg' then
      v_qty := coalesce(p_solid_kg, 0);
    elsif v_cb = 'OUTPUT_VOLUME_L' and v_unit = 'L' then
      if p_output_uom is distinct from 'L' then
        raise exception 'AU-9 G4: machine capacity is in litres but the batch output is in % (no conversion assumed)', p_output_uom;
      end if;
      v_qty := coalesce(p_output_qty, 0);
    else
      raise exception 'AU-9 G4: unsupported capacity basis % / % for loads', v_cb, v_unit;
    end if;
    if v_rev is null then raise exception 'AU-9 G4: capacity profile % has no revision journal entry', v_profile; end if;
    v_loads := greatest(1::numeric, ceil(v_qty / v_cap));
  else
    -- 3b. approved class fallback (T1 lot, or no usable machine/rule)
    v_basis := coalesce(v_basis, 'CLASS_FALLBACK');
    select f.* into v_fb from costing.capacity_fallback_policy f
     where f.resource_class_code = p_resource_class_code and (f.equipment_class_code is null or f.equipment_class_code = v_eq)
       and f.effective_from <= d and (f.effective_to is null or f.effective_to > d)
     order by (f.equipment_class_code is null), f.id limit 1;
    if not found then
      raise exception 'AU-9 G4: no usable capacity and no approved fallback for resource class % on % (fail-closed)', p_resource_class_code, d;
    end if;
    v_fb_id := v_fb.id; v_flags := array_append(v_flags, v_fb.review_flag);
    if not v_fb.fallback_allowed or v_fb.fallback_source = 'BLOCK' then
      raise exception 'AU-9 G4: fallback for resource class % is blocked; capacity required (fail-closed)', p_resource_class_code;
    elsif v_fb.fallback_source = 'NO_CAPACITY_ROW_SINGLE_LOAD' then
      v_loads := 1; v_cb := 'SINGLE_LOAD';
    else
      select c.* into v_leg from costing.route_equipment_load_capacity c
       where c.resource_class_code = p_resource_class_code and c.is_resource_class_default
         and c.effective_from <= d and (c.effective_to is null or c.effective_to >= d)
       order by c.effective_from desc limit 1;
      if not found or v_leg.id <> v_fb.legacy_capacity_id then
        raise exception 'AU-9 G4: fallback policy % points to class capacity % but the effective class default is % (re-approve)', v_fb.id, v_fb.legacy_capacity_id, v_leg.id;
      end if;
      v_leg_id := v_leg.id;
      if v_leg.load_basis = 'FIXED' then
        v_loads := 1; v_cb := 'FIXED';
      else
        v_cb := v_leg.charge_basis;
        v_qty := coalesce(case when v_leg.charge_basis = 'OUTPUT' then p_output_qty else p_solid_kg end, 0);
        v_cap := case when v_leg.charge_basis = 'OUTPUT' and p_output_uom = 'L' then coalesce(v_leg.capacity_l, v_leg.capacity_kg)
                      else coalesce(v_leg.capacity_kg, v_leg.capacity_l) end;
        v_unit := case when v_leg.charge_basis = 'OUTPUT' and p_output_uom = 'L' and v_leg.capacity_l is not null then 'L' else 'kg' end;
        v_loads := greatest(1::numeric, ceil(v_qty / v_cap));
      end if;
      v_prov := v_leg.is_provisional;
    end if;
  end if;

  return jsonb_build_object('loads', v_loads, 'resolution_basis', v_basis, 'machine_link_source', v_link, 'plant_id', v_plant,
    'equipment_class_code', v_eq, 'capacity_profile_id', v_profile, 'capacity_revision_id', v_rev, 'class_machine_count', v_n,
    'step_rule_id', v_rule_id, 'fallback_policy_id', v_fb_id, 'legacy_capacity_id', v_leg_id, 'charge_basis', v_cb,
    'charge_qty', v_qty, 'capacity', v_cap, 'capacity_unit', v_unit, 'is_provisional', v_prov, 'activity_id', v_act,
    'review_flags', to_jsonb(v_flags));
end $f$;

create or replace function costing.fn_au9_g4_route_step_loads(
  p_resource_class_code text, p_solid_kg numeric, p_output_qty numeric, p_output_uom text, p_valuation_date date,
  p_base_step_id bigint, p_override_id bigint, p_activity_id integer)
returns numeric language plpgsql stable security definer set search_path to 'costing', 'pg_temp' as $f$
begin
  if costing.fn_au9_g4_load_mode(p_valuation_date) is null then
    return costing.fn_route_step_loads(p_resource_class_code, p_solid_kg, p_output_qty, p_output_uom, p_valuation_date);
  end if;
  return (costing.fn_au9_g4_resolve_step_load(p_resource_class_code, p_solid_kg, p_output_qty, p_output_uom, p_valuation_date,
                                              p_base_step_id, p_override_id, p_activity_id) ->> 'loads')::numeric;
end $f$;

create or replace function costing.fn_au9_g4_capture_provenance(
  p_refresh_run_id bigint, p_period_start date, p_valuation_date date, p_allocation_pool text, p_product_id bigint,
  p_solid_kg numeric, p_output_qty numeric, p_output_uom text, p_steps jsonb)
returns integer language plpgsql volatile security definer set search_path to 'costing', 'pg_temp' as $f$
declare v_sw bigint := costing.fn_au9_g4_load_mode(p_valuation_date); v_n integer;
begin
  if v_sw is null then return 0; end if;
  insert into costing.route_step_load_provenance_snapshot(period_start, valuation_date, refresh_run_id, allocation_pool, product_id,
         effective_step_key, sequence_no, source_type, base_step_id, override_id, activity_id, resource_class_code, resolution_basis,
         machine_link_source, plant_id, equipment_class_code, capacity_profile_id, capacity_revision_id, class_machine_count, step_rule_id,
         fallback_policy_id, legacy_capacity_id, charge_basis, charge_qty, capacity, capacity_unit, loads, is_provisional, review_flags, switch_id)
  select p_period_start, p_valuation_date, p_refresh_run_id, p_allocation_pool, p_product_id,
         e->>'effective_step_key', nullif(e->>'sequence_no','')::numeric, e->>'source_type',
         nullif(e->>'base_step_id','')::bigint, nullif(e->>'override_id','')::bigint, (r->>'activity_id')::integer, e->>'resource_class_code',
         r->>'resolution_basis', r->>'machine_link_source', (r->>'plant_id')::integer, r->>'equipment_class_code',
         (r->>'capacity_profile_id')::bigint, (r->>'capacity_revision_id')::bigint, (r->>'class_machine_count')::integer, (r->>'step_rule_id')::bigint,
         (r->>'fallback_policy_id')::bigint, (r->>'legacy_capacity_id')::bigint, r->>'charge_basis', (r->>'charge_qty')::numeric,
         (r->>'capacity')::numeric, r->>'capacity_unit', (r->>'loads')::numeric, (r->>'is_provisional')::boolean,
         array(select jsonb_array_elements_text(r->'review_flags')), v_sw
    from jsonb_array_elements(case when jsonb_typeof(p_steps) = 'array' then p_steps else '[]'::jsonb end) e
    cross join lateral (select costing.fn_au9_g4_resolve_step_load(e->>'resource_class_code', p_solid_kg, p_output_qty, p_output_uom,
                               p_valuation_date, nullif(e->>'base_step_id','')::bigint, nullif(e->>'override_id','')::bigint,
                               nullif(e->>'activity_id','')::integer) r) x;
  get diagnostics v_n = row_count;
  return v_n;
end $f$;

revoke all on costing.plant_aware_load_switch, costing.route_step_capacity_rule, costing.route_step_load_provenance_snapshot
  from public, anon, authenticated, service_role;
grant select on costing.plant_aware_load_switch, costing.route_step_capacity_rule, costing.route_step_load_provenance_snapshot
  to authenticated, service_role;
revoke all on function costing.fn_au9_g4_load_mode(date),
  costing.fn_au9_g4_resolve_step_load(text,numeric,numeric,text,date,bigint,bigint,integer),
  costing.fn_au9_g4_route_step_loads(text,numeric,numeric,text,date,bigint,bigint,integer),
  costing.fn_au9_g4_capture_provenance(bigint,date,date,text,bigint,numeric,numeric,text,jsonb),
  costing.fn_au9_g4_provenance_guard() from public, anon, authenticated, service_role;

-- ---------- §5 guarded patch of the two refresh RPCs (wrapper = legacy while OFF) ----------
do $$
declare
  v_oid regprocedure; v_def text; v_new text; v_cnt int; r record;
begin
  for r in select * from (values
      ('costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint)', '3087b71eda32e09a8b13ee12700fcdd6', '9a87d9275b36b81602a4ba7c5833c9d2'),
      ('costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint)', '3b68b6aaef95a68764a0627ff97c72e2', '653f851c52e840d2431cf523775a68c8')) x(fn, md5_orig, md5_new)
  loop
    v_oid := r.fn::regprocedure; v_def := pg_get_functiondef(v_oid);
    if md5(v_def) = r.md5_new then continue; end if;   -- already patched (idempotent)
    if md5(v_def) <> r.md5_orig then raise exception 'AU9-G4: % changed since review', r.fn; end if;
    v_new := v_def;
    if r.fn like '%production_overhead%' then
      v_cnt := (length(v_new) - length(replace(v_new, $g4o$costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)$g4o$, ''))) / length($g4o$costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)$g4o$);
      if v_cnt <> 2 then raise exception 'AU9-G4: patch anchor poh_calls found % times (expected 2)', v_cnt; end if;
      v_new := replace(v_new, $g4o$costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)$g4o$, $g4n$costing.fn_au9_g4_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, e.base_step_id, e.override_id, e.activity_id)$g4n$);
      v_cnt := (length(v_new) - length(replace(v_new, $g4o$as e(sequence_no numeric, resource_class_code text)$g4o$, ''))) / length($g4o$as e(sequence_no numeric, resource_class_code text)$g4o$);
      if v_cnt <> 1 then raise exception 'AU9-G4: patch anchor poh_detail_cols found % times (expected 1)', v_cnt; end if;
      v_new := replace(v_new, $g4o$as e(sequence_no numeric, resource_class_code text)$g4o$, $g4n$as e(sequence_no numeric, resource_class_code text, base_step_id bigint, override_id bigint, activity_id integer)$g4n$);
      v_cnt := (length(v_new) - length(replace(v_new, $g4o$    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
$g4o$, ''))) / length($g4o$    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
$g4o$);
      if v_cnt <> 1 then raise exception 'AU9-G4: patch anchor poh_provenance found % times (expected 1)', v_cnt; end if;
      v_new := replace(v_new, $g4o$    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
$g4o$, $g4n$    -- AU-9 G4: per-step load provenance and labour/overhead consistency (only when plant-aware loads are on).
    if costing.fn_au9_g4_load_mode(p_valuation_date) is not null then
      perform costing.fn_au9_g4_capture_provenance(p_refresh_run_id, v_period_start, p_valuation_date, 'PRODUCTION_OVERHEAD',
                t.product_id, ch.solid_kg, ch.output_qty, ch.output_uom, f.step_evidence)
         from tmp_po_product t
         join tmp_po_charge ch on ch.product_id = t.product_id
         join tmp_po_foundation f on f.product_id = t.product_id
        where t.raw_route_factor is not null;
      if exists (select 1 from costing.route_step_load_provenance_snapshot d
                   join costing.route_step_load_provenance_snapshot p on p.refresh_run_id = d.refresh_run_id and p.product_id = d.product_id
                    and p.effective_step_key = d.effective_step_key
                  where d.refresh_run_id = p_refresh_run_id and d.allocation_pool = 'MANUFACTURING_LABOUR' and p.allocation_pool = 'PRODUCTION_OVERHEAD'
                    and (d.loads is distinct from p.loads or d.resolution_basis is distinct from p.resolution_basis)) then
        raise exception 'AU-9 G4: Manufacturing Labour and Production Overhead resolved the same route step differently in run %', p_refresh_run_id;
      end if;
    end if;

    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
$g4n$);
      v_cnt := (length(v_new) - length(replace(v_new, $g4o$'route_load_scaling',v_rl,$g4o$, ''))) / length($g4o$'route_load_scaling',v_rl,$g4o$);
      if v_cnt <> 1 then raise exception 'AU9-G4: patch anchor poh_result found % times (expected 1)', v_cnt; end if;
      v_new := replace(v_new, $g4o$'route_load_scaling',v_rl,$g4o$, $g4n$'route_load_scaling',v_rl,'plant_aware_load_switch_id',costing.fn_au9_g4_load_mode(p_valuation_date),$g4n$);
    else
      v_cnt := (length(v_new) - length(replace(v_new, $g4o$costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)$g4o$, ''))) / length($g4o$costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)$g4o$);
      if v_cnt <> 2 then raise exception 'AU9-G4: patch anchor dl_calls found % times (expected 2)', v_cnt; end if;
      v_new := replace(v_new, $g4o$costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)$g4o$, $g4n$costing.fn_au9_g4_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, nullif(e->>'base_step_id','')::bigint, nullif(e->>'override_id','')::bigint, nullif(e->>'activity_id','')::integer)$g4n$);
      v_cnt := (length(v_new) - length(replace(v_new, $g4o$      from tmp_dl_scale s;
$g4o$, ''))) / length($g4o$      from tmp_dl_scale s;
$g4o$);
      if v_cnt <> 1 then raise exception 'AU9-G4: patch anchor dl_provenance found % times (expected 1)', v_cnt; end if;
      v_new := replace(v_new, $g4o$      from tmp_dl_scale s;
$g4o$, $g4n$      from tmp_dl_scale s;
    -- AU-9 G4: per-step load provenance (only when plant-aware loads are on).
    if costing.fn_au9_g4_load_mode(p_valuation_date) is not null then
      perform costing.fn_au9_g4_capture_provenance(p_refresh_run_id, v_period_start, p_valuation_date, 'MANUFACTURING_LABOUR',
                s.product_id, s.solid_kg, s.output_qty, s.output_uom, t.labour_step_evidence)
         from tmp_dl_scale s join tmp_dl_product t on t.product_id = s.product_id;
    end if;
$g4n$);
    end if;
    if md5(v_new) <> r.md5_new then raise exception 'AU9-G4: patched text of % differs from the reviewed patch (md5 %)', r.fn, md5(v_new); end if;
    execute v_new;
    if md5(pg_get_functiondef(v_oid)) <> r.md5_new then raise exception 'AU9-G4: % did not install as reviewed', r.fn; end if;
  end loop;
end $$;
revoke all on function costing.rpc_refresh_production_overhead_workload_snapshot(date,date,bigint),
  costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint) from public, anon, authenticated, service_role;

-- ---------- §9 post-checks ----------
do $$
declare v text; v_n int;
begin
  if (select count(*) from costing.route_step_capacity_rule where effective_to is null) <> 9 then raise exception 'AU9-G4: expected 9 open step rules'; end if;
  if exists (select 1 from costing.plant_aware_load_switch where is_enabled and created_at = now()) then
    raise exception 'AU9-G4: this package must not switch plant-aware loads on'; end if;
  if costing.fn_au9_g4_load_mode(date '2026-10-31') is not null then raise exception 'AU9-G4: switch effective before 1 Nov 2026'; end if;
  -- no time basis in any G4 function
  if exists (select 1 from pg_proc p where p.pronamespace = 'costing'::regnamespace and p.proname like 'fn_au9_g4%'
              and p.prosrc ~* '(hours_per_load|duration_days|hour|minute)') then
    raise exception 'AU9-G4: a G4 function references a time field'; end if;
  -- wrapper equals the legacy function for every class default today and while OFF in November
  select count(*) into v_n
    from costing.route_equipment_load_capacity c
    cross join (values (date '2026-10-16'), (date '2026-11-30')) dd(d)
    cross join (values (0.5::numeric, 0.5::numeric, 'Kg'), (123.4, 567, 'L'), (1026.1333, 2000, 'L'), (3.3, 10, 'Nos')) q(s, o, u)
   where c.is_resource_class_default and costing.fn_au9_g4_load_mode(dd.d) is null
     and costing.fn_au9_g4_route_step_loads(c.resource_class_code, q.s, q.o, q.u, dd.d, null, null, null)
         is distinct from costing.fn_route_step_loads(c.resource_class_code, q.s, q.o, q.u, dd.d);
  if v_n > 0 then raise exception 'AU9-G4: wrapper differs from legacy loads while OFF (% cases)', v_n; end if;
  select md5(string_agg(x.k || x.v, '|' order by x.k)) into v from (
    select p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('costing','public') and p.prokind in ('f','p') and p.proname not like 'fn_au9%'
       and p.proname not in ('rpc_refresh_production_overhead_workload_snapshot','rpc_refresh_sku_direct_labour_component_split_snapshot')
    union all
    select c.oid::regclass::text, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('costing','public') and c.relkind = 'v') x;
  if v is distinct from (select b.v from au9_g4_base b where b.k = 'fn_view') then raise exception 'AU9-G4: other functions/views changed'; end if;
  if md5(costing.fn_compute_run_fingerprint(122)::text) is distinct from (select b.v from au9_g4_base b where b.k = 'run122')
     or md5(costing.fn_compute_run_fingerprint(128)::text) is distinct from (select b.v from au9_g4_base b where b.k = 'run128') then
    raise exception 'AU9-G4: run 122/128 fingerprints changed'; end if;
  if exists (select 1 from costing.route_step_load_provenance_snapshot where valuation_date < date '2026-11-01') then
    raise exception 'AU9-G4: provenance before 1 Nov 2026'; end if;
end $$;
