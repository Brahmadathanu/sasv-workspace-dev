-- ============================== D. SALES-01 costing-only sales feed ==============================
-- Costing basis only (public.v_sales_monthly_clean / fn_sales_monthly_clean_as_of stay untouched for forecasting):
--   company-wide monthly net qty_units per SKU (all godowns), negative months set to 0, no per-godown IQR filter;
--   monthly driver = max positive company-wide month, EXCEPT seasonal SKUs (top-3 months >= threshold of the 12-month volume)
--   which use the 12-month average monthly volume (user decision 2026-10-18). Own switch, period >= 2026-10-01 (Sep run 122 never).
create table if not exists costing.costing_sales_feed_switch(
  id boolean primary key default true check (id),
  is_enabled boolean not null default false,
  effective_from date not null default date '2026-10-01'
    check (effective_from >= date '2026-10-01' and effective_from = date_trunc('month', effective_from)::date),
  seasonal_top3_share_threshold numeric not null default 0.60 check (seasonal_top3_share_threshold > 0.25 and seasonal_top3_share_threshold <= 1),
  approval_reference text, changed_by text, changed_at timestamptz default now(), note text);
revoke all on costing.costing_sales_feed_switch from anon, authenticated;
grant select on costing.costing_sales_feed_switch to authenticated;

create or replace function costing.fn_costing_sales_feed_mode(p_period_start date)
returns table(approval_reference text, seasonal_top3_share_threshold numeric)
language sql stable security definer set search_path to 'costing','pg_temp' as $$
  select coalesce(s.approval_reference,'(none)'), s.seasonal_top3_share_threshold from costing.costing_sales_feed_switch s
   where s.is_enabled and p_period_start >= s.effective_from
$$;
revoke all on function costing.fn_costing_sales_feed_mode(date) from public, anon, authenticated;

-- Same signature as public.fn_sales_monthly_clean_as_of; one company-wide row per SKU-month (region/godown null).
create or replace function costing.fn_costing_sales_monthly_as_of(p_as_of_date date)
returns table(sku_id integer, product_id bigint, region_id integer, godown_id integer, month_start date, qty_clean numeric)
language sql stable security definer set search_path to 'public','pg_temp' as $$
  select m.sku_id, m.product_id, null::integer, null::integer, m.month_start,
         greatest(coalesce(sum(m.qty_units), 0), 0)::numeric
    from public.sales_monthly m
   where p_as_of_date is not null
     and m.month_start >= (date_trunc('month', p_as_of_date) - interval '12 months')::date
     and m.month_start <  date_trunc('month', p_as_of_date)::date
   group by m.sku_id, m.product_id, m.month_start
$$;
revoke all on function costing.fn_costing_sales_monthly_as_of(date) from public, anon, authenticated;

-- Allowed monthly-driver methods: superset (existing rows unaffected).
alter table costing.sku_sales_allocation_basis_snapshot drop constraint if exists sku_sales_allocation_basis_monthly_method_chk;
alter table costing.sku_sales_allocation_basis_snapshot add constraint sku_sales_allocation_basis_monthly_method_chk
  check (monthly_driver_method is null or monthly_driver_method = any (array[
    'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK','MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK',
    'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH','GOVERNED_SKU_ASSUMPTION','GOVERNED_NEW_PRODUCT_PLAN','GOVERNED_SCENARIO_DEFAULT','UNRESOLVED']));
comment on table costing.costing_sales_feed_switch is 'SALES-01: costing-only sales feed (company-wide net units, negatives 0, no per-godown IQR) + seasonal 12-month-average driver. Off or period < effective_from = pre-SALES-01 behaviour.';
