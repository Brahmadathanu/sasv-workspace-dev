-- AU-3: Tally period-interpretation fix. Approved for live apply by Dr. Brahmadathan U, 2026-10-15 22:26 IST (D-023). Additive; no consumer switched.
-- Problem (audit A3/A11): public.tally_expenses_snapshot rows are cumulative balances whose window
-- silently changed from FYTD to a reset window on 2026-08-08, 2026-09-04 and 2026-10-06 (plus a
-- partial pull on 2026-03-17). costing.v_expense_head_monthly_provision treats every month-end
-- value as FYTD and divides it by elapsed FY months, so post-reset month-ends are understated.
-- Fix: (1) classify every snapshot date into a regime (FYTD | RESET_WINDOW) with the window start
-- and its basis; (2) derive per-head calendar-month movements by differencing within a regime and
-- stitching regimes, with explicit completeness and lineage; (3) a side-by-side corrected
-- provision view. The live provision view is NOT replaced here - that is a costing-number change.
-- Additive only; no data is modified.

-- 1. User-confirmed window starts (append-only). Data alone cannot prove where a reset window starts.
create table if not exists costing.tally_snapshot_window_override (
  id bigserial primary key,
  as_of_date_from date not null,
  as_of_date_to date not null,
  window_start date not null,
  confirmed_by text not null,
  reason text not null check (length(btrim(reason)) >= 10),
  confirmed_at timestamptz not null default now(),
  check (as_of_date_from <= as_of_date_to and window_start <= as_of_date_from)
);
create or replace function costing.fn_au3_append_only() returns trigger language plpgsql as $$
begin raise exception 'AU3_APPEND_ONLY: % on %.% is prohibited', tg_op, tg_table_schema, tg_table_name; end $$;
drop trigger if exists trg_au3_append_only on costing.tally_snapshot_window_override;
create trigger trg_au3_append_only before update or delete on costing.tally_snapshot_window_override
  for each row execute function costing.fn_au3_append_only();
revoke all on costing.tally_snapshot_window_override from anon, authenticated;

create or replace function costing.fn_fy_start(d date) returns date language sql immutable as $$
  select case when extract(month from d) >= 4 then make_date(extract(year from d)::int,4,1)
              else make_date(extract(year from d)::int-1,4,1) end $$;

-- 2. Date regimes. A date opens a new regime when it is the first snapshot of its FY, or when, against
-- the previous snapshot date, the absolute total over common heads falls below p_drop_ratio and at
-- least p_head_share of common heads fall. A FYTD-level total (>= p_drop_ratio x running FY max)
-- after a window returns the regime to FYTD (e.g. 2026-03-19 after the partial 2026-03-17 pull).
create or replace function costing.fn_tally_snapshot_regimes(p_drop_ratio numeric default 0.5, p_head_share numeric default 0.6)
returns table(as_of_date date, fy_start date, regime_seq int, basis text, window_start date,
              window_start_basis text, heads int, abs_total numeric, evidence jsonb)
language plpgsql stable set search_path = public, costing as $$
declare
  r record; v_prev date; v_fy date; v_seq int := 0; v_basis text; v_wstart date; v_fymax numeric := 0;
  v_ratio numeric; v_share numeric; v_common int; v_new boolean; v_ov date;
begin
  for r in select s.as_of_date d, count(*)::int h, sum(abs(coalesce(s.net_cb_value,0))) t
             from public.tally_expenses_snapshot s group by 1 order by 1 loop
    v_ratio := null; v_share := null; v_common := 0; v_new := false;
    if v_fy is distinct from costing.fn_fy_start(r.d) then
      v_fy := costing.fn_fy_start(r.d); v_fymax := 0; v_new := true; v_basis := 'FYTD'; v_wstart := v_fy;
    else
      select count(*), sum(abs(coalesce(c.net_cb_value,0)))/nullif(sum(abs(coalesce(p.net_cb_value,0))),0),
             avg((abs(coalesce(c.net_cb_value,0)) < abs(coalesce(p.net_cb_value,0)) - 0.005)::int)
        into v_common, v_ratio, v_share
        from public.tally_expenses_snapshot c join public.tally_expenses_snapshot p
          on p.as_of_date = v_prev and p.expense_group = c.expense_group and p.head_name = c.head_name
       where c.as_of_date = r.d;
      if v_basis = 'RESET_WINDOW' and r.t >= p_drop_ratio * v_fymax then
        v_new := true; v_basis := 'FYTD'; v_wstart := v_fy;
      elsif coalesce(v_ratio,1) < p_drop_ratio and coalesce(v_share,0) >= p_head_share then
        v_new := true; v_basis := 'RESET_WINDOW'; v_wstart := r.d;
      end if;
    end if;
    if v_new then v_seq := v_seq + 1; end if;
    if v_basis = 'FYTD' then v_fymax := greatest(v_fymax, r.t); end if;
    select o.window_start into v_ov from costing.tally_snapshot_window_override o
     where r.d between o.as_of_date_from and o.as_of_date_to order by o.confirmed_at desc, o.id desc limit 1;
    as_of_date := r.d; fy_start := v_fy; regime_seq := v_seq; basis := v_basis; heads := r.h; abs_total := r.t;
    window_start := coalesce(v_ov, v_wstart);
    window_start_basis := case when v_ov is not null then 'USER_CONFIRMED' when v_basis='FYTD' then 'FY_START' else 'INFERRED_RESET_DATE' end;
    evidence := jsonb_build_object('prev_date',v_prev,'common_heads',v_common,'total_ratio_vs_prev',round(v_ratio,4),
                                   'share_heads_fell',round(v_share,4),'opens_regime',v_new,
                                   -- AMBIGUOUS: exactly one of the two reset signals fired (or too few heads to judge a drop);
                                   -- months touching such a date can never be COMPLETE.
                                   'signal', case when v_new or v_prev is null then 'CLEAR'
                                                  when (coalesce(v_ratio,1) < p_drop_ratio) <> (coalesce(v_share,0) >= p_head_share) then 'AMBIGUOUS'
                                                  when coalesce(v_ratio,1) < p_drop_ratio and v_common < 3 then 'AMBIGUOUS'
                                                  else 'CLEAR' end);
    return next; v_prev := r.d;
  end loop;
end $$;
create or replace view costing.v_tally_snapshot_regime as select * from costing.fn_tally_snapshot_regimes();

-- 3. Per head x calendar month movement, stitched across regimes, with completeness and lineage.
-- Within a regime a value is cumulative from window_start; a head missing on a date counts as 0.
-- A regime contributes (last value in month before the next regime's window_start) - (baseline),
-- baseline = last value before month start in the same regime, or 0 when the window starts in/after the month.
create or replace function costing.fn_tally_head_month_normalised()
returns table(month_start date, expense_group text, head_name text, month_value numeric,
              completeness text, quality_flags text[], lineage jsonb)
language plpgsql stable set search_path = public, costing as $$
declare m record; h record; g record; v_end date; v_base date; v_ev numeric; v_bv numeric; v_next date;
  v_sum numeric; v_flags text[]; v_lin jsonb; v_covered_start boolean; v_covered_end boolean; v_prev_last date;
  v_reg costing.v_tally_snapshot_regime[];
begin
  select array_agg(x order by x.as_of_date) into v_reg from costing.v_tally_snapshot_regime x;
  for m in select gs::date ms, (gs + interval '1 month - 1 day')::date me
             from generate_series(date_trunc('month',(select min(r.as_of_date) from unnest(v_reg) r)),
                                  date_trunc('month',(select max(r.as_of_date) from unnest(v_reg) r)), interval '1 month') gs loop
    for h in select distinct s.expense_group eg, s.head_name hn from public.tally_expenses_snapshot s loop
      v_sum := 0; v_flags := '{}'; v_lin := '[]'; v_covered_start := false; v_covered_end := false; v_prev_last := null;
      for g in select r.regime_seq, min(r.basis) basis, min(r.window_start) ws, min(r.window_start_basis) wsb,
                      min(r.as_of_date) first_d, max(r.as_of_date) last_d
                 from unnest(v_reg) r group by r.regime_seq
               having max(r.as_of_date) >= m.ms - 1 and min(r.window_start) <= m.me order by r.regime_seq loop
        select min(r.window_start) into v_next from unnest(v_reg) r where r.regime_seq > g.regime_seq;
        select max(r.as_of_date) into v_end from unnest(v_reg) r where r.regime_seq = g.regime_seq
           and r.as_of_date between m.ms and m.me and (v_next is null or r.as_of_date < v_next);
        continue when v_end is null;
        if g.ws >= m.ms then v_base := null; v_bv := 0; v_covered_start := v_covered_start or g.ws = m.ms
                                 or (v_prev_last is not null and v_prev_last >= g.ws - 1);
        else
          select max(r.as_of_date) into v_base from unnest(v_reg) r where r.regime_seq = g.regime_seq and r.as_of_date < m.ms;
          if v_base is null then v_bv := 0; v_flags := array_append(v_flags, 'NO_BASELINE_IN_REGIME');
          else select coalesce(sum(s.net_cb_value),0) into v_bv from public.tally_expenses_snapshot s
                 where s.as_of_date = v_base and s.expense_group = h.eg and s.head_name = h.hn;
               v_covered_start := v_covered_start or v_base = m.ms - 1;
               if v_base <> m.ms - 1 then v_flags := array_append(v_flags, 'BASELINE_NOT_AT_MONTH_END'); end if;
          end if;
        end if;
        if v_prev_last is not null and g.ws > v_prev_last + 1 then v_flags := array_append(v_flags, 'GAP_BETWEEN_REGIMES'); end if;
        select coalesce(sum(s.net_cb_value),0) into v_ev from public.tally_expenses_snapshot s
         where s.as_of_date = v_end and s.expense_group = h.eg and s.head_name = h.hn;
        if g.wsb = 'INFERRED_RESET_DATE' then v_flags := array_append(v_flags, 'WINDOW_START_INFERRED'); end if;
        v_sum := v_sum + (v_ev - v_bv); v_prev_last := v_end;
        v_covered_end := (v_end = m.me) or (v_next is not null and v_end = v_next - 1);
        v_lin := v_lin || jsonb_build_object('regime_seq',g.regime_seq,'basis',g.basis,'window_start',g.ws,
                   'window_start_basis',g.wsb,'end_date',v_end,'end_value',v_ev,'baseline_date',v_base,
                   'baseline_value',v_bv,'contribution',v_ev - v_bv);
      end loop;
      continue when jsonb_array_length(v_lin) = 0;
      if not v_covered_start then v_flags := array_append(v_flags, 'MONTH_START_NOT_COVERED'); end if;
      if exists (select 1 from unnest(v_reg) r where r.as_of_date between m.ms and m.me and r.evidence->>'signal' = 'AMBIGUOUS') then
        v_flags := array_append(v_flags, 'AMBIGUOUS_REGIME_SIGNAL'); end if;
      if not v_covered_end then v_flags := array_append(v_flags, 'NO_MONTH_END_SNAPSHOT'); end if;
      month_start := m.ms; expense_group := h.eg; head_name := h.hn; month_value := v_sum;
      quality_flags := (select coalesce(array_agg(distinct f order by f), '{}') from unnest(v_flags) f);
      completeness := case when cardinality(quality_flags) = 0 then 'COMPLETE' else 'PROVISIONAL' end;
      lineage := v_lin; return next;
    end loop;
  end loop;
end $$;
create or replace view costing.v_tally_expense_head_month_normalised as select * from costing.fn_tally_head_month_normalised();

-- 4. Corrected provision (side by side with the live view; same selection policy: the highest monthly
-- equivalent among completed-FY and running-FY candidates), but only snapshots VERIFIED as FYTD are divided
-- by elapsed months; reset-window month-ends are never read as FYTD; COMPLETE stitched months extend the FYTD base.
create or replace view costing.v_expense_head_monthly_provision_au3 as
with periods as (select cp.period_start from costing.cost_periods cp where cp.status in ('OPEN','LOCKED')),
mapped as (select m.allocation_pool, m.expense_group, m.head_name from costing.expense_head_costing_map m
           where m.is_active and m.include_in_costing and m.allocation_pool <> 'EXCLUDED'),
fy_end as (  -- completed FY: FY-end snapshot that is verified FYTD by regime classification
  select p.period_start, mp.allocation_pool, mp.expense_group, mp.head_name, r.fy_start fy,
         abs(coalesce(s.net_cb_value,0)) fy_value, 12 months, abs(coalesce(s.net_cb_value,0))/12 monthly_equivalent,
         jsonb_build_object('basis','COMPLETED_FINANCIAL_YEAR','snapshot_as_of_date',s.as_of_date,'regime_basis',r.basis) lineage
    from periods p cross join mapped mp
    join public.tally_expenses_snapshot s on s.expense_group = mp.expense_group and s.head_name = mp.head_name and s.as_of_date < p.period_start
    join costing.v_tally_snapshot_regime r on r.as_of_date = s.as_of_date and r.basis = 'FYTD'
   where s.as_of_date = (r.fy_start + interval '1 year - 1 day')::date),
fytd_me as (  -- running FY, candidate A: verified-FYTD month-end snapshots only (reset-window month-ends excluded)
  select p.period_start, mp.allocation_pool, mp.expense_group, mp.head_name, r.fy_start fy, s.as_of_date d0,
         abs(coalesce(s.net_cb_value,0)) v0,
         ((extract(year from age(date_trunc('month',s.as_of_date), r.fy_start))*12 + extract(month from age(date_trunc('month',s.as_of_date), r.fy_start)))::int + 1) m0
    from periods p cross join mapped mp
    join public.tally_expenses_snapshot s on s.expense_group = mp.expense_group and s.head_name = mp.head_name and s.as_of_date < p.period_start
    join costing.v_tally_snapshot_regime r on r.as_of_date = s.as_of_date and r.basis = 'FYTD'
   where s.as_of_date = (date_trunc('month', s.as_of_date) + interval '1 month - 1 day')::date
     and r.fy_start = costing.fn_fy_start((p.period_start - 1))),
running as (  -- candidate B extends A with contiguous COMPLETE normalised months after d0 (e.g. once window starts are confirmed)
  select f.period_start, f.allocation_pool, f.expense_group, f.head_name, f.fy,
         f.v0 + coalesce(sum(abs(n.month_value)),0) fy_value, f.m0 + count(n.month_start)::int months,
         (f.v0 + coalesce(sum(abs(n.month_value)),0)) / (f.m0 + count(n.month_start)) monthly_equivalent,
         jsonb_build_object('basis', case when count(n.month_start)=0 then 'RUNNING_FY_VERIFIED_FYTD_MONTH_END' else 'RUNNING_FY_FYTD_PLUS_COMPLETE_MONTHS' end,
                            'fytd_snapshot_as_of_date', f.d0, 'fytd_value', f.v0,
                            'complete_months_after', coalesce(jsonb_agg(jsonb_build_object('month',n.month_start,'value',n.month_value) order by n.month_start) filter (where n.month_start is not null),'[]')) lineage
    from fytd_me f
    left join costing.v_tally_expense_head_month_normalised n
      on n.expense_group = f.expense_group and n.head_name = f.head_name and n.month_start > f.d0 and n.month_start < f.period_start
     and n.completeness = 'COMPLETE'
     and not exists (select 1 from costing.v_tally_expense_head_month_normalised g
                      where g.expense_group = f.expense_group and g.head_name = f.head_name
                        and g.month_start > f.d0 and g.month_start <= n.month_start and g.completeness <> 'COMPLETE')
   group by f.period_start, f.allocation_pool, f.expense_group, f.head_name, f.fy, f.d0, f.v0, f.m0),
fytd_plain as (select f.period_start, f.allocation_pool, f.expense_group, f.head_name, f.fy, f.v0 fy_value, f.m0 months, f.v0 / f.m0 monthly_equivalent,
         jsonb_build_object('basis','RUNNING_FY_VERIFIED_FYTD_MONTH_END','fytd_snapshot_as_of_date',f.d0,'fytd_value',f.v0) lineage from fytd_me f),
cand as (select * from fy_end union all select * from fytd_plain
         union all select * from running where lineage->>'basis' = 'RUNNING_FY_FYTD_PLUS_COMPLETE_MONTHS'),
ranked as (select c.*, row_number() over (partition by period_start, allocation_pool, expense_group, head_name
                                          order by monthly_equivalent desc, fy desc, (lineage->>'fytd_snapshot_as_of_date') desc nulls last) rn from cand c)
select period_start, allocation_pool, expense_group, head_name, monthly_equivalent standard_monthly_provision,
       fy selected_financial_year_start, fy_value selected_fy_value, lineage || jsonb_build_object('months',months) lineage
  from ranked where rn = 1;

revoke all on function costing.fn_tally_snapshot_regimes(numeric,numeric), costing.fn_tally_head_month_normalised() from public, anon;
