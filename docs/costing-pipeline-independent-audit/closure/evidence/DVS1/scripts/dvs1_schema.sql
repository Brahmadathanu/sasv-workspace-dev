-- ---------------------------------------------------------------------------
-- DVS-1 tables. Nothing here changes an existing row; all new tables start empty
-- except one DRAFT policy version (DRAFT = switch OFF) and the Kanji seasonality seed.
-- ---------------------------------------------------------------------------
create table costing.product_demand_seasonality (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id),
  demand_pattern text not null check (demand_pattern in ('DEMAND_SEASONAL','NON_SEASONAL','UNDER_REVIEW')),
  peak_months int[] check (peak_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]),
  evidence text not null,
  effective_from date not null,
  effective_to date,
  approval_reference text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (effective_to is null or effective_to > effective_from));

create table costing.demand_volume_selection_policy (
  id bigint generated always as identity primary key,
  policy_code text not null check (policy_code = 'DVS-1'),
  version int not null,
  params jsonb not null,
  effective_from date not null check (effective_from = date_trunc('month', effective_from)::date),
  effective_to date,
  approval_reference text,
  status text not null check (status in ('DRAFT','APPROVED','RETIRED')),
  created_at timestamptz not null default now(),
  unique (policy_code, version),
  check (status <> 'APPROVED' or approval_reference is not null),
  check (effective_to is null or effective_to > effective_from),
  check (params ?& array['launch_window_months','min_months_for_seasonal','diagnostic_threshold']));

create table costing.demand_event_register (
  id bigint generated always as identity primary key,
  sku_id bigint not null,
  event_month date not null check (event_month = date_trunc('month', event_month)::date),
  event_date date,
  event_type text not null check (event_type in
      ('BULK_INSTITUTIONAL_ORDER','PROMOTION_SCHEME','SUPPLY_CONSTRAINT','LAUNCH_STOCKING',
       'EXHIBITION_FESTIVAL','PRICE_CHANGE_PREBUY','DATA_CORRECTION','OTHER')),
  units_affected numeric check (units_affected is null or units_affected >= 0),
  treatment text not null check (treatment in ('EXCLUDE_UNITS','EXCLUDE_MONTH','CAP_AT_BASELINE','INFORMATION_ONLY')),
  evidence_reference text not null,
  status text not null check (status in ('PROPOSED','CONFIRMED','REJECTED')),
  approval_reference text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (status <> 'CONFIRMED' or approval_reference is not null),
  check (treatment <> 'EXCLUDE_UNITS' or units_affected is not null));

create table costing.sku_demand_volume_override (
  id bigint generated always as identity primary key,
  sku_id bigint not null,
  effective_from date not null,
  effective_to date,
  override_method text not null check (override_method in ('FIXED_MONTHLY_UNITS','AVERAGE_OF_MONTHS','MAX_MONTH','PLAN_FORECAST')),
  monthly_units numeric check (monthly_units is null or monthly_units > 0),
  reason text not null,
  approval_reference text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (effective_to is null or effective_to > effective_from),
  check (override_method not in ('FIXED_MONTHLY_UNITS','PLAN_FORECAST') or monthly_units is not null));

-- Per-run lineage of the selection (separate table: the basis snapshot gets NO new columns,
-- so the row hashes of approved runs 122/128 cannot change).
create table costing.sku_demand_volume_selection_snapshot (
  id bigint generated always as identity primary key,
  refresh_run_id bigint not null references costing.costing_refresh_run(id),
  period_start date not null,
  valuation_date date not null,
  sku_id bigint not null,
  product_id bigint not null,
  policy_id bigint not null references costing.demand_volume_selection_policy(id),
  method text not null check (method in ('OVERRIDE','LAUNCH_AVERAGE','MAX_EXCLUDING_EVENTS','IN_STOCK_AVERAGE','DEMAND_SEASONAL_12M_AVERAGE','MAX_MONTH')),
  candidate_max_month numeric,
  candidate_12m_avg numeric,
  candidate_in_stock_avg numeric,
  candidate_since_launch_avg numeric,
  candidate_max_excl_events numeric,
  diagnostic_top3_share numeric,
  diagnostic_flag boolean not null default false,
  demand_pattern text,
  first_sale_month date,
  event_ids bigint[],
  override_id bigint,
  selected_monthly_units numeric not null check (selected_monthly_units > 0),
  applied_to_basis boolean not null,
  created_at timestamptz not null default now(),
  unique (refresh_run_id, sku_id));

create trigger trg_au2_designated_run_guard before insert or delete or update on costing.sku_demand_volume_selection_snapshot
  for each row execute function costing.fn_guard_designated_run_rows();
create trigger trg_au2_snapshot_truncate_guard before truncate on costing.sku_demand_volume_selection_snapshot
  for each statement execute function costing.fn_guard_snapshot_truncate();
create trigger trg_dvs1_selection_mutable_run before insert or delete or update on costing.sku_demand_volume_selection_snapshot
  for each row execute function costing.fn_enforce_mutable_refresh_run_snapshot();

-- Access: internal costing tables. No anon/authenticated access (reads go through security-definer RPCs).
do $$ declare t text; begin
  foreach t in array array['product_demand_seasonality','demand_volume_selection_policy','demand_event_register',
                           'sku_demand_volume_override','sku_demand_volume_selection_snapshot'] loop
    execute format('alter table costing.%I enable row level security', t);
    execute format('revoke all on costing.%I from public', t);
    if exists (select 1 from pg_roles where rolname='anon') then execute format('revoke all on costing.%I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname='authenticated') then execute format('revoke all on costing.%I from authenticated', t); end if;
  end loop; end $$;

-- Seed: policy version 1 as DRAFT (switch OFF). Activation = a separate approved change setting status APPROVED + effective_from.
insert into costing.demand_volume_selection_policy (policy_code, version, params, effective_from, status, approval_reference)
values ('DVS-1', 1,
  '{"launch_window_months":12,"min_months_for_seasonal":2,"diagnostic_threshold":0.6,
    "bulk_day_share_of_peak":0.5,"bulk_day_share_12m":0.25,"stockout_days":10,
    "note":"bulk-day and stockout-day parameters are screening aids for proposing events; the engine acts only on CONFIRMED events"}'::jsonb,
  date '2026-11-01', 'DRAFT', 'USER-APPROVAL-20261018-AU9-DVS1 (in principle)');

-- Seed: Karkkidaka Kanji (product of SKU 878) demand-seasonal Jun-Aug; manufacture season unchanged.
insert into costing.product_demand_seasonality (product_id, demand_pattern, peak_months, evidence, effective_from, approval_reference)
select s.product_id, 'DEMAND_SEASONAL', array[6,7,8],
       'Karkkidaka month demand (Jun-Aug); user-confirmed 18 Oct 2026', date '2026-11-01', 'USER-APPROVAL-20261018-AU9-KANJI'
  from public.product_skus s where s.id = 878;
do $$ begin if (select count(*) from costing.product_demand_seasonality) <> 1 then
  raise exception 'DVS1 GUARD: Kanji seed must insert exactly 1 row'; end if; end $$;
