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
