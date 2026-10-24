-- PREPARED_DVS1_demand_volume_selection.sql
-- PREPARED ONLY. NOT APPLIED. Apply only after explicit user approval, via Supabase MCP apply_migration (name dvs1_demand_volume_selection).
-- Effect at install: NONE on costs. Policy v1 is seeded as DRAFT, which keeps DVS-1 OFF; the refresh RPC then runs the
-- unchanged SALES-01 logic (proved byte-identical to the live RPC on the run-128 replay in the isolated test bed).
-- Activation (later, separate approval): update costing.demand_volume_selection_policy set status='APPROVED',
--   effective_from='<first period, >= 2026-11-01>', approval_reference='<ref>' where policy_code='DVS-1' and version=1;
-- Changes: 5 new tables (empty except the DRAFT policy + Kanji seed), 1 new function, the refresh RPC replaced
-- (patched from the live definition md5 09c3d22c6154d8eacf099ada57f60007), and the monthly_driver_method CHECK widened
-- with 5 DVS1_* labels (no existing row changes; the basis snapshot gets no new columns, so approved run hashes are unaffected).
-- Not attached: the WP04 readiness-epoch trigger on the new lineage table (not registered as a readiness source).

-- PRE-GUARDS
do $$ begin
  if md5(pg_get_functiondef('costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint)'::regprocedure)) <> '09c3d22c6154d8eacf099ada57f60007'
    then raise exception 'DVS1 GUARD: live refresh RPC differs from the tested definition'; end if;
  if to_regclass('costing.demand_volume_selection_policy') is not null then raise exception 'DVS1 GUARD: already installed'; end if;
  if not exists (select 1 from public.product_skus where id = 878) then raise exception 'DVS1 GUARD: SKU 878 missing'; end if;
end $$;

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

-- ---------------------------------------------------------------------------
-- costing.fn_dvs1_select: one row per active basis SKU with the DVS-1 rule, candidates and lineage.
-- Inputs are the same as the refresh RPC (SALES-01 costing feed, frozen 12-month lookback).
-- Rule order: 1 override, 2 launch average, 3 confirmed events (supply constraint -> in-stock
-- average; else max month after event treatment), 4 approved DEMAND_SEASONAL -> 12-month average,
-- 5 max positive month (legacy). Diagnostic flag: top-3 share >= threshold and rule 5 applied.
-- ---------------------------------------------------------------------------
create or replace function costing.fn_dvs1_select(p_period_start date, p_valuation_date date, p_policy_id bigint)
returns table (
  sku_id bigint, product_id bigint, method text, selected_monthly_units numeric,
  dvs_selected_units numeric, dvs_source_month date, dvs_tied_month_count bigint,
  dvs_method_label text, dvs_note_text text,
  candidate_max_month numeric, candidate_12m_avg numeric, candidate_in_stock_avg numeric,
  candidate_since_launch_avg numeric, candidate_max_excl_events numeric,
  diagnostic_top3_share numeric, diagnostic_flag boolean, demand_pattern text,
  first_sale_month date, event_ids bigint[], override_id bigint)
language plpgsql stable security definer
set search_path to 'costing', 'public', 'pg_temp'
as $fn$
declare
  v_ps date := date_trunc('month', p_period_start)::date;
  v_lb_start date := (date_trunc('month', p_period_start) - interval '12 months')::date;
  v_par jsonb; v_ver int;
  v_launch int; v_minm int; v_thr numeric; v_amb int;
begin
  select p.params, p.version into v_par, v_ver from costing.demand_volume_selection_policy p where p.id = p_policy_id;
  if not found then raise exception 'DVS-1 policy % not found', p_policy_id; end if;
  v_launch := (v_par->>'launch_window_months')::int;
  v_minm := (v_par->>'min_months_for_seasonal')::int;
  v_thr := (v_par->>'diagnostic_threshold')::numeric;

  select count(*) into v_amb from (
    select o.sku_id from costing.sku_demand_volume_override o
     where o.effective_from <= p_valuation_date and (o.effective_to is null or o.effective_to > p_valuation_date)
     group by o.sku_id having count(*) > 1) z;
  if v_amb > 0 then raise exception 'DVS-1: % SKU(s) have overlapping effective overrides on %', v_amb, p_valuation_date; end if;
  select count(*) into v_amb from (
    select d.product_id from costing.product_demand_seasonality d
     where d.effective_from <= p_valuation_date and (d.effective_to is null or d.effective_to > p_valuation_date)
     group by d.product_id having count(*) > 1) z;
  if v_amb > 0 then raise exception 'DVS-1: % product(s) have overlapping demand-seasonality rows on %', v_amb, p_valuation_date; end if;

  return query
  with u as materialized (
    select b.sku_id::bigint sku_id, b.product_id::bigint product_id
      from costing.v_sku_sales_volume_allocation_basis b where b.period_start = v_ps),
  m as materialized (   -- company-wide SKU-month, identical to the RPC's company_sku_month
    select c.sku_id::bigint sku_id, c.product_id::bigint product_id, c.month_start, sum(c.qty_clean) filter (where c.qty_clean is not null) q
      from costing.fn_costing_sales_monthly_as_of(p_valuation_date) c
      join u on u.sku_id = c.sku_id and u.product_id = c.product_id
     where c.month_start >= v_lb_start and c.month_start < v_ps
     group by 1,2,3),
  months as (select g::date month_start from generate_series(v_lb_start, (v_ps - interval '1 month')::date, interval '1 month') g),
  fs as (   -- first positive company-wide month in the full history before the period
    select x.sku_id::bigint sku_id, min(x.month_start) first_month from (
      select s.sku_id, s.month_start, sum(s.qty_units) q from public.sales_monthly s
       where s.month_start < v_ps group by 1,2) x where x.q > 0 group by 1),
  ev as (
    select e.* from costing.demand_event_register e
     where e.status = 'CONFIRMED' and e.treatment <> 'INFORMATION_ONLY'
       and e.event_month >= v_lb_start and e.event_month < v_ps),
  grid as (   -- every lookback month per SKU, with event treatment applied
    select u.sku_id, u.product_id, mo.month_start, coalesce(m.q, 0) q,
           bool_or(ev.event_type = 'SUPPLY_CONSTRAINT') supply_constrained,
           bool_or(ev.event_type <> 'SUPPLY_CONSTRAINT' and ev.treatment = 'EXCLUDE_MONTH') excl_month,
           coalesce(sum(ev.units_affected) filter (where ev.event_type <> 'SUPPLY_CONSTRAINT' and ev.treatment = 'EXCLUDE_UNITS'), 0) excl_units,
           bool_or(ev.event_type <> 'SUPPLY_CONSTRAINT' and ev.treatment = 'CAP_AT_BASELINE') cap,
           array_agg(ev.id) filter (where ev.id is not null) ev_ids
      from u cross join months mo
      left join m on m.sku_id = u.sku_id and m.product_id = u.product_id and m.month_start = mo.month_start
      left join ev on ev.sku_id = u.sku_id and ev.event_month = mo.month_start
     group by 1,2,3,4),
  base as (
    select g.sku_id, g.product_id,
           max(g.q) filter (where g.q > 0) max_q,
           sum(g.q) filter (where g.q > 0) pos_12m,
           count(*) filter (where g.q > 0) pos_months,
           bool_or(g.ev_ids is not null) has_events,
           bool_or(g.supply_constrained) has_supply,
           (select array_agg(distinct x order by x) from grid g2, unnest(g2.ev_ids) x where g2.sku_id = g.sku_id) ev_ids,
           max(g.q) filter (where g.q > 0 and g.ev_ids is null) baseline_q
      from grid g group by 1,2),
  adj as (
    select g.*, case when g.excl_month then null
                     when g.cap then least(greatest(g.q - g.excl_units, 0), coalesce(b.baseline_q, 0))
                     else greatest(g.q - g.excl_units, 0) end aq
      from grid g join base b on b.sku_id = g.sku_id),
  cand as (
    select b.*, f.first_month,
      (select sum(x.q) from (select g.q from grid g where g.sku_id = b.sku_id and g.q > 0 order by g.q desc limit 3) x) top3,
      (select max(a.aq) filter (where a.aq > 0 and not coalesce(a.supply_constrained,false)) from adj a where a.sku_id = b.sku_id) max_excl,
      (select sum(greatest(a.aq,0)) / nullif(count(*),0) from adj a
        where a.sku_id = b.sku_id and a.aq is not null and not coalesce(a.supply_constrained,false)
          and (f.first_month is null or a.month_start >= f.first_month)) in_stock_avg,
      case when f.first_month >= (v_ps - make_interval(months => v_launch))::date
           then (select sum(g.q) filter (where g.q > 0) from grid g where g.sku_id = b.sku_id and g.month_start >= f.first_month)
                / ((extract(year from age(v_ps, f.first_month)) * 12 + extract(month from age(v_ps, f.first_month)))::numeric) end launch_avg,
      o.id ov_id, o.override_method, o.monthly_units ov_units,
      ds.demand_pattern dpat, ds.approval_reference dpat_appr
    from base b
    left join fs f on f.sku_id = b.sku_id
    left join costing.sku_demand_volume_override o on o.sku_id = b.sku_id
         and o.effective_from <= p_valuation_date and (o.effective_to is null or o.effective_to > p_valuation_date)
    left join costing.product_demand_seasonality ds on ds.product_id = b.product_id
         and ds.effective_from <= p_valuation_date and (ds.effective_to is null or ds.effective_to > p_valuation_date)),
  pick as (
    select c.*,
      case when c.ov_id is not null then 'OVERRIDE'
           when c.max_q is null then null
           when c.launch_avg is not null then 'LAUNCH_AVERAGE'
           when c.has_supply and c.in_stock_avg > 0 then 'IN_STOCK_AVERAGE'
           when c.has_events and c.max_excl > 0 then 'MAX_EXCLUDING_EVENTS'
           when c.dpat = 'DEMAND_SEASONAL' and c.dpat_appr is not null and c.pos_months >= v_minm then 'DEMAND_SEASONAL_12M_AVERAGE'
           else 'MAX_MONTH' end meth
    from cand c),
  sel as (
    select p.*,
      case p.meth
        when 'OVERRIDE' then case p.override_method when 'FIXED_MONTHLY_UNITS' then p.ov_units when 'PLAN_FORECAST' then p.ov_units
                                                   when 'AVERAGE_OF_MONTHS' then p.pos_12m / 12.0 when 'MAX_MONTH' then p.max_q end
        when 'LAUNCH_AVERAGE' then p.launch_avg
        when 'IN_STOCK_AVERAGE' then p.in_stock_avg
        when 'MAX_EXCLUDING_EVENTS' then p.max_excl
        when 'DEMAND_SEASONAL_12M_AVERAGE' then p.pos_12m / 12.0
        when 'MAX_MONTH' then p.max_q end units
    from pick p)
  select s.sku_id, s.product_id, s.meth, s.units,
         case when s.meth is distinct from 'MAX_MONTH' then s.units end,
         case when s.meth = 'MAX_EXCLUDING_EVENTS' then (select max(a.month_start) from adj a where a.sku_id = s.sku_id and a.aq = s.max_excl)
              when s.meth = 'OVERRIDE' and s.override_method = 'MAX_MONTH' then (select max(g.month_start) from grid g where g.sku_id = s.sku_id and g.q = s.max_q) end,
         case when s.meth = 'MAX_EXCLUDING_EVENTS' then (select count(*) from adj a where a.sku_id = s.sku_id and a.aq = s.max_excl)
              when s.meth = 'OVERRIDE' and s.override_method = 'MAX_MONTH' then (select count(*) from grid g where g.sku_id = s.sku_id and g.q = s.max_q) end,
         case s.meth when 'OVERRIDE' then 'DVS1_OVERRIDE'
                     when 'LAUNCH_AVERAGE' then 'DVS1_LAUNCH_AVERAGE_SINCE_FIRST_SALE'
                     when 'IN_STOCK_AVERAGE' then 'DVS1_IN_STOCK_MONTH_AVERAGE'
                     when 'MAX_EXCLUDING_EVENTS' then 'DVS1_MAX_MONTH_EXCLUDING_CONFIRMED_EVENTS'
                     when 'DEMAND_SEASONAL_12M_AVERAGE' then 'DVS1_DEMAND_SEASONAL_12M_AVERAGE' end,
         case s.meth
           when 'OVERRIDE' then format('DVS-1 v%s rule 1: approved override %s (%s) = %s units/month.', v_ver, s.ov_id, s.override_method, round(s.units, 4))
           when 'LAUNCH_AVERAGE' then format('DVS-1 v%s rule 2: launched %s (within %s months); average since first sale = %s units/month.', v_ver, s.first_month, v_launch, round(s.units, 4))
           when 'IN_STOCK_AVERAGE' then format('DVS-1 v%s rule 3: confirmed supply constraint (events %s); average of in-stock months = %s units/month.', v_ver, s.ev_ids, round(s.units, 4))
           when 'MAX_EXCLUDING_EVENTS' then format('DVS-1 v%s rule 3: confirmed demand events %s treated; max remaining month = %s units.', v_ver, s.ev_ids, round(s.units, 4))
           when 'DEMAND_SEASONAL_12M_AVERAGE' then format('DVS-1 v%s rule 4: product approved DEMAND_SEASONAL; 12-month average = %s units/month.', v_ver, round(s.units, 4))
         end,
         s.max_q, s.pos_12m / 12.0, s.in_stock_avg, s.launch_avg, s.max_excl,
         round(s.top3 / nullif(s.pos_12m, 0), 6),
         coalesce(s.meth = 'MAX_MONTH' and s.top3 / nullif(s.pos_12m, 0) >= v_thr, false),
         s.dpat, s.first_month, s.ev_ids, s.ov_id
    from sel s;
end $fn$;
revoke all on function costing.fn_dvs1_select(date, date, bigint) from public;

alter table costing.sku_sales_allocation_basis_snapshot drop constraint sku_sales_allocation_basis_monthly_method_chk;
alter table costing.sku_sales_allocation_basis_snapshot add constraint sku_sales_allocation_basis_monthly_method_chk
  CHECK (((monthly_driver_method IS NULL) OR (monthly_driver_method = ANY (ARRAY['MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK'::text, 'MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK'::text, 'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH'::text, 'GOVERNED_SKU_ASSUMPTION'::text, 'GOVERNED_NEW_PRODUCT_PLAN'::text, 'GOVERNED_SCENARIO_DEFAULT'::text, 'UNRESOLVED'::text, 'DVS1_OVERRIDE'::text, 'DVS1_LAUNCH_AVERAGE_SINCE_FIRST_SALE'::text, 'DVS1_IN_STOCK_MONTH_AVERAGE'::text, 'DVS1_MAX_MONTH_EXCLUDING_CONFIRMED_EVENTS'::text, 'DVS1_DEMAND_SEASONAL_12M_AVERAGE'::text]))));

CREATE OR REPLACE FUNCTION costing.rpc_refresh_sku_sales_allocation_basis_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
    v_period_start date :=
        date_trunc(
            'month',
            p_period_start
        )::date;

    v_driver_lookback_start date;
    v_driver_lookback_end date;

    v_run costing.costing_refresh_run%rowtype;

    -- SALES-01 costing-only sales feed (null = off).
    v_sf_appr text;
    v_sf_thr numeric;
    v_sf boolean;

    -- DVS-1 demand-volume selection (off unless one APPROVED policy version is effective for the period).
    v_dvs_policy_id bigint;
    v_dvs boolean := false;
    v_dvs_n int;
begin
    if p_period_start is null then
        raise exception
            'Costing period is required.';
    end if;

    if p_valuation_date is null then
        raise exception
            'Valuation date is required.';
    end if;

    if p_refresh_run_id is null then
        raise exception
            'Refresh run ID is required.';
    end if;

    select *
    into v_run
    from costing.costing_refresh_run r
    where r.id = p_refresh_run_id;

    if not found then
        raise exception
            'Costing refresh run % does not exist.',
            p_refresh_run_id;
    end if;

    if v_run.period_start
       is distinct from v_period_start then
        raise exception
            'Allocation period % does not match refresh run % period %.',
            v_period_start,
            p_refresh_run_id,
            v_run.period_start;
    end if;

    if v_run.valuation_date
       is distinct from p_valuation_date then
        raise exception
            'Allocation valuation date % does not match refresh run % valuation date %.',
            p_valuation_date,
            p_refresh_run_id,
            v_run.valuation_date;
    end if;

    if v_run.valuation_context_source
       is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception
            'Refresh run % is not based on captured-at-request valuation context.',
            p_refresh_run_id;
    end if;

    if p_valuation_date < v_period_start
       or p_valuation_date >=
          (
              v_period_start
              + interval '1 month'
          )::date then
        raise exception
            'Valuation date % is outside costing period %.',
            p_valuation_date,
            v_period_start;
    end if;

    v_driver_lookback_start :=
        (
            v_period_start
            - interval '12 months'
        )::date;

    v_driver_lookback_end :=
        v_period_start;

    select m.approval_reference, m.seasonal_top3_share_threshold
      into v_sf_appr, v_sf_thr
      from costing.fn_costing_sales_feed_mode(v_period_start) m;
    v_sf := v_sf_thr is not null;

    select count(*), max(p.id)
      into v_dvs_n, v_dvs_policy_id
      from costing.demand_volume_selection_policy p
     where p.policy_code = 'DVS-1'
       and p.status = 'APPROVED'
       and p.effective_from <= v_period_start
       and (p.effective_to is null or p.effective_to > v_period_start);
    if v_dvs_n > 1 then
        raise exception 'DVS-1: % APPROVED policy versions overlap period %; refusing to refresh.', v_dvs_n, v_period_start;
    end if;
    v_dvs := v_dvs_n = 1;
    if v_dvs and not v_sf then
        raise exception 'DVS-1 is approved for period % but the SALES-01 costing sales feed is off; refusing to refresh.', v_period_start;
    end if;

    drop table if exists pg_temp.dvs1_selection;
    create temp table dvs1_selection on commit drop as
    select * from costing.fn_dvs1_select(v_period_start, p_valuation_date, v_dvs_policy_id)
     where v_dvs;

    perform *
    from costing.rpc_ensure_cost_period(
        v_period_start
    );

    -- Exact-run replacement only.
    delete
    from costing.sku_sales_allocation_basis_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    delete
    from costing.sku_demand_volume_selection_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    insert into costing.sku_sales_allocation_basis_snapshot (
        period_start,
        valuation_date,
        refresh_run_id,

        sku_id,
        product_id,
        product_name,

        product_base_uom,
        conversion_to_base,
        pack_size,
        pack_uom,
        sku_base_qty_per_unit,

        -- Historical annual evidence: meanings retained.
        sales_units_12m,
        sales_base_qty_12m,
        product_sales_units_12m,
        product_sales_base_qty_12m,
        company_sales_units_12m,
        product_allocation_share,

        actual_sales_units_12m,
        actual_sales_base_qty_12m,
        actual_product_sales_units_12m,
        actual_product_sales_base_qty_12m,
        actual_company_sales_units_12m,

        -- Existing downstream compatibility projection.
        resolved_sales_units,
        resolved_sales_base_qty,
        resolved_product_sales_units,
        resolved_product_sales_base_qty,
        resolved_company_sales_units,
        resolved_product_allocation_share,

        allocation_basis_status,
        allocation_basis_source,
        allocation_resolution_status,
        allocation_resolution_note,

        assumption_id,
        assumption_basis,
        assumption_effective_from,
        assumption_effective_to,

        default_policy_id,
        default_policy_scenario,
        default_policy_effective_from,
        default_policy_effective_to,

        lookback_start,
        lookback_end,

        -- Explicit monthly-driver contract.
        monthly_allocation_units,
        monthly_allocation_base_qty,
        monthly_product_allocation_units,
        monthly_product_allocation_base_qty,
        monthly_company_allocation_units,
        monthly_product_allocation_share,

        monthly_driver_method,
        monthly_driver_source,
        monthly_driver_source_month,
        monthly_driver_lookback_start,
        monthly_driver_lookback_end,
        monthly_driver_tied_month_count,
        monthly_driver_status,
                monthly_driver_note,
        monthly_driver_plan_id,
        refreshed_at
    )

    with
    -- Reuse the established active costing universe and diagnostic
    -- classification from the existing governed allocation-basis view.
    basis_universe as materialized (
        select
            b.period_start,
            b.sku_id,
            b.product_id,
            b.product_name,

            b.product_base_uom,
            b.conversion_to_base,
            b.pack_size,
            b.pack_uom,
            b.sku_base_qty_per_unit,

            b.allocation_basis_status

        from costing.v_sku_sales_volume_allocation_basis b

        where b.period_start = v_period_start
    ),

    cleaned_sales as materialized (
        select
            c.sku_id::bigint as sku_id,
            c.product_id,
            c.region_id,
            c.godown_id,
            c.month_start,
            c.qty_clean

        from (
            select * from public.fn_sales_monthly_clean_as_of(p_valuation_date)
             where not v_sf
            union all
            select * from costing.fn_costing_sales_monthly_as_of(p_valuation_date)
             where v_sf
        ) c

        join basis_universe u
          on u.sku_id = c.sku_id
         and u.product_id = c.product_id
    ),

    -- Annual historical evidence remains a 12-month sum.
    annual_sku as materialized (
        select
            u.sku_id,
            u.product_id,

            coalesce(
                sum(c.qty_clean)
                    filter (
                        where c.qty_clean is not null
                    ),
                0::numeric
            ) as actual_sales_units_12m

        from basis_universe u

        left join cleaned_sales c
          on c.sku_id = u.sku_id
         and c.product_id = u.product_id
         and c.month_start >= v_driver_lookback_start
         and c.month_start < v_driver_lookback_end

        group by
            u.sku_id,
            u.product_id
    ),

    annual_sku_qty as materialized (
        select
            u.sku_id,
            u.product_id,

            a.actual_sales_units_12m,

            a.actual_sales_units_12m
            * u.sku_base_qty_per_unit
                as actual_sales_base_qty_12m

        from basis_universe u

        join annual_sku a
          on a.sku_id = u.sku_id
         and a.product_id = u.product_id
    ),

    annual_product as materialized (
        select
            a.product_id,

            sum(a.actual_sales_units_12m)
                as actual_product_sales_units_12m,

            sum(a.actual_sales_base_qty_12m)
                as actual_product_sales_base_qty_12m

        from annual_sku_qty a

        group by a.product_id
    ),

    annual_company as materialized (
        select
            sum(a.actual_sales_units_12m)
                as actual_company_sales_units_12m

        from annual_sku_qty a
    ),

    -- First aggregate every location to one company-wide SKU-month.
    company_sku_month as materialized (
        select
            u.sku_id,
            u.product_id,
            c.month_start,

            sum(c.qty_clean)
                filter (
                    where c.qty_clean is not null
                ) as company_sku_month_qty

        from basis_universe u

        left join cleaned_sales c
          on c.sku_id = u.sku_id
         and c.product_id = u.product_id
         and c.month_start >= v_driver_lookback_start
         and c.month_start < v_driver_lookback_end

        group by
            u.sku_id,
            u.product_id,
            c.month_start
    ),

    monthly_maximum as materialized (
        select
            m.sku_id,
            m.product_id,

            max(m.company_sku_month_qty)
                filter (
                    where m.company_sku_month_qty > 0
                ) as maximum_positive_monthly_qty

        from company_sku_month m

        group by
            m.sku_id,
            m.product_id
    ),

    monthly_max_candidates as materialized (
        select
            m.sku_id,
            m.product_id,
            m.month_start,
            m.company_sku_month_qty,
            x.maximum_positive_monthly_qty

        from company_sku_month m

        join monthly_maximum x
          on x.sku_id = m.sku_id
         and x.product_id = m.product_id

        where x.maximum_positive_monthly_qty is not null
          and m.company_sku_month_qty =
              x.maximum_positive_monthly_qty
    ),

    actual_monthly_driver as materialized (
        select
            u.sku_id,
            u.product_id,

            c.maximum_positive_monthly_qty
                as actual_monthly_units,

            max(c.month_start)
                as actual_monthly_source_month,

            count(c.month_start)::bigint
                as tied_month_count

        from basis_universe u

        left join monthly_max_candidates c
          on c.sku_id = u.sku_id
         and c.product_id = u.product_id

        group by
            u.sku_id,
            u.product_id,
            c.maximum_positive_monthly_qty
    ),

    -- SALES-01: seasonal SKUs (top-3 company-wide months >= threshold of the 12-month volume) use the 12-month average.
    seasonal_driver as materialized (
        select
            m.sku_id,
            m.product_id,
            sum(m.company_sku_month_qty) filter (where m.company_sku_month_qty > 0) as positive_12m_units,
            (select sum(x.q) from (
                select m2.company_sku_month_qty q
                  from company_sku_month m2
                 where m2.sku_id = m.sku_id and m2.product_id = m.product_id and m2.company_sku_month_qty > 0
                 order by m2.company_sku_month_qty desc
                 limit 3) x) as top3_units
        from company_sku_month m
        where v_sf
        group by m.sku_id, m.product_id
    ),

    actual_monthly_driver_qty as materialized (
        select
            u.*,

            case when v_dvs then coalesce(dv.dvs_selected_units, d.actual_monthly_units)
                 when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end
                as actual_monthly_units,
            case when v_dvs then (case when dv.dvs_selected_units is null then d.actual_monthly_source_month else dv.dvs_source_month end)
                 when sd.is_seasonal then null::date else d.actual_monthly_source_month end
                as actual_monthly_source_month,
            case when v_dvs then (case when dv.dvs_selected_units is null then d.tied_month_count else dv.dvs_tied_month_count end)
                 when sd.is_seasonal then null::bigint else d.tied_month_count end
                as tied_month_count,
            case when v_dvs then false else coalesce(sd.is_seasonal, false) end as is_seasonal_average,
            dv.dvs_method_label,
            dv.dvs_note_text,

            case
                when (case when v_dvs then coalesce(dv.dvs_selected_units, d.actual_monthly_units)
                           when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end) is null
                    then null::numeric
                else
                    (case when v_dvs then coalesce(dv.dvs_selected_units, d.actual_monthly_units)
                          when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end)
                    * u.sku_base_qty_per_unit
            end as actual_monthly_base_qty

        from basis_universe u

        left join actual_monthly_driver d
          on d.sku_id = u.sku_id
         and d.product_id = u.product_id

        left join lateral (
            select
                (s.positive_12m_units > 0 and s.top3_units / s.positive_12m_units >= v_sf_thr) as is_seasonal,
                s.positive_12m_units / 12.0 as avg_units
            from seasonal_driver s
            where s.sku_id = u.sku_id and s.product_id = u.product_id
        ) sd on v_sf

        -- DVS-1: rows only for SKUs whose rule is not the plain max month (rule 5 keeps the legacy max exactly).
        left join pg_temp.dvs1_selection dv
          on v_dvs
         and dv.sku_id = u.sku_id
         and dv.product_id = u.product_id
         and dv.method <> 'MAX_MONTH'
    ),

    actual_product_monthly as materialized (
        select
            d.product_id,

            count(*) filter (
                where d.actual_monthly_units > 0
            )::bigint as positive_actual_sku_count,

            sum(d.actual_monthly_units)
                filter (
                    where d.actual_monthly_units > 0
                ) as actual_product_monthly_units,

            sum(d.actual_monthly_base_qty)
                filter (
                    where d.actual_monthly_base_qty > 0
                ) as actual_product_monthly_base_qty

        from actual_monthly_driver_qty d

        group by d.product_id
    ),

    with_assumption as materialized (
        select
            d.*,

            a.assumption_id,
            a.assumption_basis,
            a.assumed_sales_units,
            a.assumed_sales_value,
            a.remarks as assumption_remarks,
            a.approval_reference
                as assumption_approval_reference,
            a.effective_from
                as assumption_effective_from,
            a.effective_to
                as assumption_effective_to,
            a.resolution_status
                as assumption_resolution_status,
            a.qualifying_assumption_count,
            a.resolution_note
                as assumption_resolution_note,

            coalesce(
                p.positive_actual_sku_count,
                0
            ) as product_positive_actual_sku_count,

            case
                when d.actual_monthly_units > 0
                    then null::text

                when a.resolution_status in (
                    'AMBIGUOUS',
                    'RESOLVED'
                )
                    then null::text

                when coalesce(
                    p.positive_actual_sku_count,
                    0
                ) > 0
                    then 'NEW_SKU_EXISTING_PRODUCT'

                else 'NEW_PRODUCT_NO_HISTORY'
            end as required_default_scenario

        from actual_monthly_driver_qty d

        left join actual_product_monthly p
          on p.product_id = d.product_id

        cross join lateral
            costing.fn_resolve_sku_sales_assumption_as_of(
                v_period_start,
                d.sku_id,
                p_valuation_date
            ) a
    ),

    -- AU-6: SKUs needing a non-actual, non-assumption driver, per product.
    default_sku_count as materialized (
        select a.product_id, count(*)::numeric as n
        from with_assumption a
        where a.required_default_scenario is not null
        group by a.product_id
    ),

    with_default as materialized (
        select
            a.*,

            d.policy_id as default_policy_id,
            d.scenario_code
                as default_policy_scenario,
            d.default_sales_units,
            d.effective_from
                as default_policy_effective_from,
            d.effective_to
                as default_policy_effective_to,
            d.resolution_status
                as default_policy_resolution_status,
            d.qualifying_policy_count,
            d.resolution_note
                as default_policy_resolution_note,

            -- AU-6 smart-default parameters (governed policy row).
            pol.default_basis,
            pol.batch_interval_months,
            pol.new_sku_max_share_of_product,
            pol.default_max_age_months,
            apm.actual_product_monthly_base_qty as product_actual_monthly_base_qty,
            dsc.n as product_default_sku_count,
            br.preferred_batch_size as std_batch_size,
            pl.plan_id,
            pl.plan_monthly_base_qty,
            case
                when pl.plan_monthly_base_qty > 0 and a.sku_base_qty_per_unit > 0
                    then pl.plan_monthly_base_qty / a.sku_base_qty_per_unit
            end as plan_monthly_units,
            fd.first_default_period

        from with_assumption a

        left join lateral
            costing.fn_resolve_sales_allocation_default_policy_as_of(
                a.required_default_scenario,
                p_valuation_date
            ) d
          on a.required_default_scenario is not null

        left join costing.sales_allocation_default_policy pol
          on pol.id = d.policy_id

        left join actual_product_monthly apm
          on apm.product_id = a.product_id

        left join default_sku_count dsc
          on dsc.product_id = a.product_id

        -- batch_size_ref is the standard reference (same resolution as the AU-5 writers).
        left join lateral (
            select b.preferred_batch_size
            from public.production_batch_size_ref b
            where b.product_id = a.product_id
              and b.effective_from <= p_valuation_date
              and (b.effective_to is null or b.effective_to >= p_valuation_date)
              and coalesce(b.preferred_batch_size, 0) > 0
            order by b.effective_from desc, b.id desc
            limit 1
        ) br on true

        -- Step 3: governed new-product volume plan (owner, approval, expiry).
        left join lateral (
            select
                p.id as plan_id,
                coalesce(
                    p.planned_monthly_base_qty,
                    p.planned_batches_per_year * br.preferred_batch_size / 12.0
                ) / case when p.sku_id is null then nullif(dsc.n, 0) else 1 end
                    as plan_monthly_base_qty
            from costing.new_product_volume_plan p
            where p.product_id = a.product_id
              and (p.sku_id = a.sku_id or p.sku_id is null)
              and p.status = 'APPROVED'
              and p.effective_from <= p_valuation_date
              and p.expires_on > p_valuation_date
            order by (p.sku_id is null), p.effective_from desc, p.id desc
            limit 1
        ) pl on a.required_default_scenario is not null

        -- Default age for the 12-month expiry (successful runs only).
        left join lateral (
            select min(s.period_start) as first_default_period
            from costing.sku_sales_allocation_basis_snapshot s
            join costing.costing_refresh_run rr
              on rr.id = s.refresh_run_id
             and rr.overall_status = 'SUCCESS'
            where s.sku_id = a.sku_id
              and s.monthly_driver_source in (
                  'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                  'DEFAULT_NEW_PRODUCT_NO_HISTORY'
              )
        ) fd on a.required_default_scenario is not null
    ),

    with_smart as materialized (
        select
            w.*,

            case
                when coalesce(w.default_basis, 'FLAT_UNITS') <> 'SMART_V2'
                    then w.default_sales_units
                when w.required_default_scenario = 'NEW_PRODUCT_NO_HISTORY'
                    -- min(ceiling packs, one batch_size_ref per N months split over the product's default SKUs)
                    then least(
                        w.default_sales_units,
                        case
                            when w.std_batch_size > 0 and w.batch_interval_months > 0
                             and w.sku_base_qty_per_unit > 0 and w.product_default_sku_count > 0
                                then w.std_batch_size / w.batch_interval_months
                                     / w.product_default_sku_count / w.sku_base_qty_per_unit
                        end
                    )
                when w.required_default_scenario = 'NEW_SKU_EXISTING_PRODUCT'
                    -- min(ceiling packs, x% of the product's actual monthly base qty)
                    then least(
                        w.default_sales_units,
                        case
                            when w.new_sku_max_share_of_product > 0 and w.sku_base_qty_per_unit > 0
                             and w.product_actual_monthly_base_qty > 0
                                then w.new_sku_max_share_of_product
                                     * w.product_actual_monthly_base_qty / w.sku_base_qty_per_unit
                        end
                    )
                else w.default_sales_units
            end as smart_default_units,

            (
                w.default_max_age_months is not null
                and w.first_default_period is not null
                and v_period_start >= (w.first_default_period
                    + make_interval(months => w.default_max_age_months))::date
            ) as default_expired

        from with_default w
    ),

    resolved_sku as materialized (
        select
            r.*,

            case
                -- Ambiguous assumption remains a hard governance block.
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then null::numeric

                -- Positive actual monthly evidence has priority over
                -- a single resolved manual assumption.
                when r.actual_monthly_units > 0
                    then r.actual_monthly_units

                when r.assumption_resolution_status = 'RESOLVED'
                    then r.assumed_sales_units

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then r.plan_monthly_units

                when r.default_policy_resolution_status = 'RESOLVED'
                    then r.smart_default_units


                else null::numeric
            end as resolved_monthly_units,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then 'UNRESOLVED'

                when r.actual_monthly_units > 0
                    then 'ACTUAL_MONTHLY_MAX'

                when r.assumption_resolution_status = 'RESOLVED'
                    then r.assumption_basis

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then 'NEW_PRODUCT_ESTIMATE'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_SKU_EXISTING_PRODUCT'
                    then 'DEFAULT_NEW_SKU_EXISTING_PRODUCT'


                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_PRODUCT_NO_HISTORY'
                    then 'DEFAULT_NEW_PRODUCT_NO_HISTORY'

                else 'UNRESOLVED'
            end as resolved_source,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then 'BLOCKED'

                when r.actual_monthly_units > 0
                    then 'READY'

                when r.assumption_resolution_status = 'RESOLVED'
                    then 'REVIEW_REQUIRED'

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then 'READY'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.default_expired
                    then 'BLOCKED'

                when r.default_policy_resolution_status = 'RESOLVED'
                    then 'REVIEW_REQUIRED'

                else 'BLOCKED'
            end as resolved_status,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then
                        'Allocation basis is blocked because multiple active SKU assumptions overlap on the frozen valuation date.'

                when r.actual_monthly_units > 0 and r.dvs_note_text is not null
                    then r.dvs_note_text

                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then format(
                        'SALES-01 seasonal SKU (top-3 months >= %s of 12-month volume): allocation basis uses the 12-month average company-wide net monthly quantity.',
                        v_sf_thr)

                when r.actual_monthly_units > 0 and v_sf
                    then
                        'SALES-01: allocation basis uses the maximum positive company-wide net SKU-month quantity (no per-godown outlier filter) in the frozen 12-month lookback.'

                when r.actual_monthly_units > 0
                    then
                        'Allocation basis uses the maximum positive company-wide cleaned SKU-month quantity in the frozen 12-month lookback.'

                when r.assumption_resolution_status = 'RESOLVED'
                    then
                        'No positive actual monthly evidence exists; allocation basis uses one governed SKU-specific assumption effective on the frozen valuation date.'

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then format(
                        'No actual sales or SKU assumption; governed new-product volume plan %s is used (%s base qty/month).',
                        r.plan_id, round(r.plan_monthly_base_qty, 4))

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.default_expired
                    then format(
                        'Default driver older than %s months (first default %s); blocked until a volume plan, assumption or inactivation.',
                        r.default_max_age_months, r.first_default_period)

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.default_basis = 'SMART_V2'
                    then format(
                        'Smart default v2 (%s, policy %s): %s units = least(%s packs, %s).',
                        r.required_default_scenario, r.default_policy_id,
                        round(r.smart_default_units, 4), r.default_sales_units,
                        case when r.required_default_scenario = 'NEW_PRODUCT_NO_HISTORY'
                             then format('1 batch_size_ref %s per %s months / %s SKU(s)',
                                         r.std_batch_size, r.batch_interval_months, r.product_default_sku_count)
                             else format('%s of product actual monthly base qty %s',
                                         r.new_sku_max_share_of_product, round(r.product_actual_monthly_base_qty, 4)) end)

                when r.default_policy_resolution_status = 'AMBIGUOUS'
                    then

                        'Allocation basis is blocked because multiple governed default policies overlap on the frozen valuation date.'

                when r.default_policy_resolution_status = 'MISSING'
                    then
                        'Allocation basis is blocked because no governed default policy is effective on the frozen valuation date.'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_SKU_EXISTING_PRODUCT'
                    then
                        'SKU has no positive actual monthly evidence, while another active SKU of the product does; the governed new-SKU default is used.'

                when r.default_policy_resolution_status = 'RESOLVED'
                 and r.required_default_scenario =
                     'NEW_PRODUCT_NO_HISTORY'
                    then
                        'No active SKU of the product has positive actual monthly evidence; the governed new-product default is used.'

                else
                    'Allocation basis could not be resolved.'
            end as resolved_note,

            case
                when r.assumption_resolution_status = 'AMBIGUOUS'
                    then 'UNRESOLVED'

                when r.actual_monthly_units > 0 and r.dvs_method_label is not null
                    then r.dvs_method_label

                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then 'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH'

                when r.actual_monthly_units > 0 and v_sf
                    then 'MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK'

                when r.actual_monthly_units > 0
                    then
                        'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK'

                when r.assumption_resolution_status = 'RESOLVED'
                    then 'GOVERNED_SKU_ASSUMPTION'

                                when r.plan_id is not null
                 and r.plan_monthly_units > 0
                    then 'GOVERNED_NEW_PRODUCT_PLAN'

                when r.default_policy_resolution_status = 'RESOLVED'
                    then 'GOVERNED_SCENARIO_DEFAULT'

                else 'UNRESOLVED'
            end as resolved_method

                from with_smart r
    ),

    resolved_sku_qty as materialized (
        select
            r.*,

            case
                when r.resolved_monthly_units is null
                    then null::numeric
                else
                    r.resolved_monthly_units
                    * r.sku_base_qty_per_unit
            end as resolved_monthly_base_qty

        from resolved_sku r
    ),

    resolved_product as materialized (
        select
            r.product_id,

            sum(r.resolved_monthly_units)
                filter (
                    where r.resolved_monthly_units is not null
                ) as resolved_product_monthly_units,

            sum(r.resolved_monthly_base_qty)
                filter (
                    where r.resolved_monthly_base_qty is not null
                ) as resolved_product_monthly_base_qty

        from resolved_sku_qty r

        group by r.product_id
    ),

    resolved_company as materialized (
        select
            sum(r.resolved_monthly_units)
                filter (
                    where r.resolved_monthly_units is not null
                ) as resolved_company_monthly_units

        from resolved_sku_qty r
    )

    select
        r.period_start,
        p_valuation_date,
        p_refresh_run_id,

        r.sku_id,
        r.product_id,
        r.product_name,

        r.product_base_uom,
        r.conversion_to_base,
        r.pack_size,
        r.pack_uom,
        r.sku_base_qty_per_unit,

        -- Existing annual fields retain annual semantics.
        a.actual_sales_units_12m,
        a.actual_sales_base_qty_12m,
        ap.actual_product_sales_units_12m,
        ap.actual_product_sales_base_qty_12m,
        ac.actual_company_sales_units_12m,

        case
            when ac.actual_company_sales_units_12m > 0
                then
                    ap.actual_product_sales_units_12m
                    / ac.actual_company_sales_units_12m
            else null::numeric
        end,

        a.actual_sales_units_12m,
        a.actual_sales_base_qty_12m,
        ap.actual_product_sales_units_12m,
        ap.actual_product_sales_base_qty_12m,
        ac.actual_company_sales_units_12m,

        -- Existing resolved fields now project the canonical monthly
        -- resolution for unchanged downstream writers.
        r.resolved_monthly_units,
        r.resolved_monthly_base_qty,
        rp.resolved_product_monthly_units,
        rp.resolved_product_monthly_base_qty,
        rc.resolved_company_monthly_units,

        case
            when rc.resolved_company_monthly_units > 0
                then
                    rp.resolved_product_monthly_units
                    / rc.resolved_company_monthly_units
            else null::numeric
        end,

        r.allocation_basis_status,
        r.resolved_source,
        r.resolved_status,
        r.resolved_note,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_id
            else null::bigint
        end,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_basis
            else null::text
        end,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_effective_from
            else null::date
        end,

        case
            when r.resolved_source in (
                'MANUAL_ASSUMPTION',
                'NEW_SKU_ESTIMATE',
                'NEW_PRODUCT_ESTIMATE'
            )
                then r.assumption_effective_to
            else null::date
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_id
            else null::bigint
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_scenario
            else null::text
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_effective_from
            else null::date
        end,

        case
            when r.resolved_source in (
                'DEFAULT_NEW_SKU_EXISTING_PRODUCT',
                'DEFAULT_NEW_PRODUCT_NO_HISTORY'
            )
                then r.default_policy_effective_to
            else null::date
        end,

        v_driver_lookback_start,
        v_driver_lookback_end,

        r.resolved_monthly_units,
        r.resolved_monthly_base_qty,
        rp.resolved_product_monthly_units,
        rp.resolved_product_monthly_base_qty,
        rc.resolved_company_monthly_units,

        case
            when rc.resolved_company_monthly_units > 0
                then
                    rp.resolved_product_monthly_units
                    / rc.resolved_company_monthly_units
            else null::numeric
        end,

        r.resolved_method,
        r.resolved_source,

        case
            when r.resolved_source = 'ACTUAL_MONTHLY_MAX'
                then r.actual_monthly_source_month
            else null::date
        end,

        v_driver_lookback_start,
        v_driver_lookback_end,

        case
            when r.resolved_source = 'ACTUAL_MONTHLY_MAX'
                then r.tied_month_count
            else null::bigint
        end,

        r.resolved_status,
                r.resolved_note,

        r.plan_id,

        clock_timestamp()

    from resolved_sku_qty r

    join annual_sku_qty a
      on a.sku_id = r.sku_id
     and a.product_id = r.product_id

    join annual_product ap
      on ap.product_id = r.product_id

    cross join annual_company ac

    join resolved_product rp
      on rp.product_id = r.product_id

    cross join resolved_company rc;

    if v_dvs then
        insert into costing.sku_demand_volume_selection_snapshot (
            refresh_run_id, period_start, valuation_date, sku_id, product_id, policy_id, method,
            candidate_max_month, candidate_12m_avg, candidate_in_stock_avg, candidate_since_launch_avg,
            candidate_max_excl_events, diagnostic_top3_share, diagnostic_flag, demand_pattern,
            first_sale_month, event_ids, override_id, selected_monthly_units, applied_to_basis)
        select p_refresh_run_id, v_period_start, p_valuation_date, s.sku_id, s.product_id, v_dvs_policy_id, s.method,
               s.candidate_max_month, s.candidate_12m_avg, s.candidate_in_stock_avg, s.candidate_since_launch_avg,
               s.candidate_max_excl_events, s.diagnostic_top3_share, s.diagnostic_flag, s.demand_pattern,
               s.first_sale_month, s.event_ids, s.override_id, s.selected_monthly_units,
               exists (select 1 from costing.sku_sales_allocation_basis_snapshot b
                        where b.refresh_run_id = p_refresh_run_id and b.sku_id = s.sku_id
                          and b.monthly_driver_source = 'ACTUAL_MONTHLY_MAX')
          from pg_temp.dvs1_selection s
         where s.selected_monthly_units is not null;
    end if;

    return query
    select
        v_period_start,
        count(*)::bigint,

        count(*) filter (
            where s.allocation_resolution_status = 'BLOCKED'
        )::bigint,

        count(*) filter (
            where s.allocation_resolution_status =
                  'REVIEW_REQUIRED'
        )::bigint,

        count(*) filter (
            where s.allocation_resolution_status = 'READY'
        )::bigint

    from costing.sku_sales_allocation_basis_snapshot s

    where s.period_start = v_period_start
      and s.valuation_date = p_valuation_date
      and s.refresh_run_id = p_refresh_run_id;
end;
$function$
;

-- POST-GUARDS
do $$ begin
  if (select count(*) from costing.demand_volume_selection_policy where status = 'APPROVED') <> 0 then raise exception 'DVS1 GUARD: policy must start DRAFT (OFF)'; end if;
  if (select count(*) from costing.sku_demand_volume_selection_snapshot) <> 0 then raise exception 'DVS1 GUARD: lineage must start empty'; end if;
  if (select count(*) from costing.demand_event_register) + (select count(*) from costing.sku_demand_volume_override) <> 0 then raise exception 'DVS1 GUARD: registers must start empty'; end if;
end $$;
