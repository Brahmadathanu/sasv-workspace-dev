-- AU-6 default-volume rule v2 (PREPARED, NOT APPLIED). Requires the user's combined approval with the October rerun.
-- Hierarchy: actual monthly max > manual SKU assumption > governed new-product plan > smart default > blocked.
-- Smart default: new product = least(10 packs, 1 batch_size_ref per 12 months / default SKUs);
--                new pack size = least(10 packs, 10% of the product's actual monthly base qty).
-- Default-driven workload is capped at 2% of each pool (scaled pro rata; full pool still absorbed).
-- A SKU more than 12 months on a default becomes BLOCKED. The flat-10 policies 1 and 2 close on 2026-09-30.
-- Sep (valuation 2026-09-10) still resolves policies 1 and 2, so closed run 122 is reproducible.

-- 1. Policy parameters
alter table costing.sales_allocation_default_policy
  add column if not exists default_basis text not null default 'FLAT_UNITS',
  add column if not exists batch_interval_months numeric,
  add column if not exists new_sku_max_share_of_product numeric,
  add column if not exists pool_cap_share numeric,
  add column if not exists default_max_age_months integer;
alter table costing.sales_allocation_default_policy
  drop constraint if exists sales_allocation_default_policy_basis_chk,
  add constraint sales_allocation_default_policy_basis_chk check (
    default_basis in ('FLAT_UNITS','SMART_V2')
    and (batch_interval_months is null or batch_interval_months > 0)
    and (new_sku_max_share_of_product is null or (new_sku_max_share_of_product > 0 and new_sku_max_share_of_product <= 1))
    and (pool_cap_share is null or (pool_cap_share > 0 and pool_cap_share < 1))
    and (default_max_age_months is null or default_max_age_months > 0));

-- 2. Governed new-product volume plan (hierarchy step 3)
create table if not exists costing.new_product_volume_plan (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products(id),
  sku_id bigint references public.product_skus(id),
  planned_monthly_base_qty numeric check (planned_monthly_base_qty > 0),
  planned_batches_per_year numeric check (planned_batches_per_year > 0),
  basis_note text not null check (length(btrim(basis_note)) > 0),
  owner_user_id uuid not null,
  approval_reference text not null check (length(btrim(approval_reference)) > 0),
  effective_from date not null,
  expires_on date not null,
  status text not null default 'APPROVED' check (status in ('APPROVED','CLOSED','CANCELLED')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check ((planned_monthly_base_qty is null) <> (planned_batches_per_year is null)),
  check (expires_on > effective_from and expires_on <= (effective_from + interval '12 months')::date)
);
create unique index if not exists new_product_volume_plan_one_open
  on costing.new_product_volume_plan (product_id, coalesce(sku_id, 0), effective_from) where status = 'APPROVED';
alter table costing.new_product_volume_plan enable row level security;

-- 3. Snapshot lineage
alter table costing.sku_sales_allocation_basis_snapshot add column if not exists monthly_driver_plan_id bigint;
alter table costing.sku_sales_allocation_basis_snapshot drop constraint if exists sku_sales_allocation_basis_monthly_method_chk;
alter table costing.sku_sales_allocation_basis_snapshot add constraint sku_sales_allocation_basis_monthly_method_chk check (
  monthly_driver_method is null or monthly_driver_method = any (array[
    'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK','GOVERNED_SKU_ASSUMPTION',
    'GOVERNED_NEW_PRODUCT_PLAN','GOVERNED_SCENARIO_DEFAULT','UNRESOLVED']));

-- 4. Cap log + helper
create table if not exists costing.default_volume_cap_log (
  refresh_run_id bigint not null,
  allocation_pool text not null,
  pool_cap_share numeric not null,
  eligible_workload numeric not null,
  default_workload_before numeric not null,
  scale_factor numeric not null,
  default_workload_after numeric not null,
  created_at timestamptz not null default now(),
  primary key (refresh_run_id, allocation_pool)
);
alter table costing.default_volume_cap_log enable row level security;

create or replace function costing.fn_default_volume_cap(p_refresh_run_id bigint, p_valuation_date date, p_pool text, p_items jsonb)
returns table(product_id bigint, new_workload numeric)
language plpgsql security definer set search_path to 'costing','public','pg_temp' as $f$
declare v_cap numeric; v_tot numeric; v_def numeric; v_k numeric := 1;
begin
  select max(p.pool_cap_share) into v_cap
    from costing.sales_allocation_default_policy p
   where p.default_basis = 'SMART_V2' and p.status in ('APPROVED','CLOSED')
     and p.effective_from <= p_valuation_date and (p.effective_to is null or p.effective_to >= p_valuation_date);
  if v_cap is null or p_items is null then return; end if;

  create temporary table if not exists tmp_dvc(product_id bigint, w numeric, dw numeric) on commit drop;
  truncate tmp_dvc;
  insert into tmp_dvc
  select (i->>'product_id')::bigint, (i->>'workload')::numeric,
         (i->>'workload')::numeric * least(1, coalesce(d.dq, 0) / nullif((i->>'base_qty')::numeric, 0))
    from jsonb_array_elements(p_items) i
    left join (select s.product_id, sum(s.monthly_allocation_base_qty) dq
                 from costing.sku_sales_allocation_basis_snapshot s
                where s.refresh_run_id = p_refresh_run_id
                  and s.monthly_driver_source in ('DEFAULT_NEW_SKU_EXISTING_PRODUCT','DEFAULT_NEW_PRODUCT_NO_HISTORY')
                group by s.product_id) d on d.product_id = (i->>'product_id')::bigint;

  select sum(w), coalesce(sum(dw), 0) into v_tot, v_def from tmp_dvc;
  if v_def > 0 and v_def > v_cap * v_tot then
    v_k := (v_cap * (v_tot - v_def) / (1 - v_cap)) / v_def;   -- post-scale default share = cap exactly
  end if;

  insert into costing.default_volume_cap_log(refresh_run_id, allocation_pool, pool_cap_share, eligible_workload, default_workload_before, scale_factor, default_workload_after)
  values (p_refresh_run_id, p_pool, v_cap, v_tot, v_def, v_k, v_def * v_k)
  on conflict (refresh_run_id, allocation_pool) do update set pool_cap_share = excluded.pool_cap_share,
    eligible_workload = excluded.eligible_workload, default_workload_before = excluded.default_workload_before,
    scale_factor = excluded.scale_factor, default_workload_after = excluded.default_workload_after, created_at = now();

  if v_k < 1 then
    return query select t.product_id, t.w - t.dw * (1 - v_k) from tmp_dvc t where t.dw > 0;
  end if;
end $f$;
revoke all on function costing.fn_default_volume_cap(bigint,date,text,jsonb) from public, anon, authenticated;

-- 5. Policy succession: flat 10 closes; SMART_V2 from 2026-10-01 (default_sales_units = 10-pack ceiling)
update costing.sales_allocation_default_policy
   set effective_to = '2026-09-30', status = 'CLOSED', closed_at = now(),
       closed_by = 'dff17104-c02a-4bca-95b1-e8ddff46a9b6'
 where id in (1, 2) and effective_to is null;
insert into costing.sales_allocation_default_policy
  (scenario_code, default_sales_units, effective_from, status, reason, approval_reference, previous_policy_id, created_by,
   default_basis, batch_interval_months, new_sku_max_share_of_product, pool_cap_share, default_max_age_months)
values
  ('NEW_PRODUCT_NO_HISTORY', 10, '2026-10-01', 'APPROVED',
   'AU-6 smart default: least(10 packs, 1 batch_size_ref per 12 months); 2% pool cap; 12-month expiry.',
   'USER-APPROVAL-AU6-DEFAULT-V2-<DATE>', 2, 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'SMART_V2', 12, null, 0.02, 12),
  ('NEW_SKU_EXISTING_PRODUCT', 10, '2026-10-01', 'APPROVED',
   'AU-6 smart default: least(10 packs, 10% of product actual monthly base qty); 2% pool cap; 12-month expiry.',
   'USER-APPROVAL-AU6-DEFAULT-V2-<DATE>', 1, 'dff17104-c02a-4bca-95b1-e8ddff46a9b6', 'SMART_V2', null, 0.10, 0.02, 12);

-- 6. Functions

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

    perform *
    from costing.rpc_ensure_cost_period(
        v_period_start
    );

    -- Exact-run replacement only.
    delete
    from costing.sku_sales_allocation_basis_snapshot s
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

        from public.fn_sales_monthly_clean_as_of(
            p_valuation_date
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

    actual_monthly_driver_qty as materialized (
        select
            u.*,

            d.actual_monthly_units,
            d.actual_monthly_source_month,
            d.tied_month_count,

            case
                when d.actual_monthly_units is null
                    then null::numeric
                else
                    d.actual_monthly_units
                    * u.sku_base_qty_per_unit
            end as actual_monthly_base_qty

        from basis_universe u

        left join actual_monthly_driver d
          on d.sku_id = u.sku_id
         and d.product_id = u.product_id
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

CREATE OR REPLACE FUNCTION costing.rpc_refresh_production_overhead_workload_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.production_overhead_workload_policy%rowtype;
  v_pool_snapshot_id bigint;
  v_pool numeric;
  v_foundation jsonb;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_count integer;
  v_coverage numeric;
  v_company_workload numeric;
  v_allocated_pool numeric;
  v_bt boolean;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run
  from costing.costing_refresh_run
  where id=p_refresh_run_id;

  if not found then
    raise exception 'Costing refresh run % not found',p_refresh_run_id;
  end if;

  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Production Overhead snapshot context does not match refresh run %',p_refresh_run_id;
  end if;

  if not (
      v_run.overall_status='SUCCESS'
      or (
        v_run.overall_status='RUNNING'
        and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
        and exists (
          select 1
          from costing.costing_refresh_run_stage s
          where s.refresh_run_id=p_refresh_run_id
            and s.stage_code='03_COST_BUILD_TO_SCHEME'
            and s.stage_status='RUNNING'
        )
      )
  ) then
    raise exception 'Production Overhead snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  if exists(select 1 from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Production Overhead snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select * into v_policy
  from costing.fn_resolve_production_overhead_workload_policy(p_valuation_date);

  if v_policy.id is null then
    raise exception 'No uniquely resolvable approved Production Overhead policy exists for valuation date %',p_valuation_date;
  end if;

  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5

  select p.id,p.total_pool_amount
  into v_pool_snapshot_id,v_pool
  from costing.cost_pool_monthly_snapshot p
  where p.period_start=v_period_start
    and p.valuation_date=p_valuation_date
    and p.refresh_run_id=p_refresh_run_id
    and p.allocation_pool='PRODUCTION_OVERHEAD';

  if v_pool_snapshot_id is null or v_pool is null then
    raise exception 'Production Overhead frozen pool is missing for exact run %',p_refresh_run_id;
  end if;

  -- Reuse the canonical shared exact-run route/batch foundation rather than
  -- resolving and validating Product routes repeatedly inside POH.
  v_foundation := costing.fn_preview_shared_standard_batch_route_foundation(
    v_period_start,p_valuation_date,p_refresh_run_id,null
  );

  create temporary table tmp_po_foundation on commit drop as
  select *
  from jsonb_to_recordset(coalesce(v_foundation->'rows','[]'::jsonb)) as f(
    product_id bigint,
    product_name text,
    product_base_uom text,
    recipient_sku_count integer,
    monthly_product_base_qty numeric,
    monthly_driver_status text,
    actual_source_sku_count integer,
    assumption_source_sku_count integer,
    default_source_sku_count integer,
    sku_quantity_evidence jsonb,
    batch_size_ref_id bigint,
    preferred_batch_size numeric,
    min_batch_size numeric,
    max_batch_size numeric,
    batch_size_effective_from date,
    raw_batch_requirement numeric,
    standard_batch_count bigint,
    route_family_id bigint,
    family_route_id bigint,
    product_route_id bigint,
    effective_route_source text,
    route_validation jsonb,
    effective_step_count integer,
    direct_labour_include_step_count integer,
    direct_labour_supervision_step_count integer,
    direct_labour_excluded_step_count integer,
    production_overhead_include_step_count integer,
    production_overhead_passive_step_count integer,
    production_overhead_excluded_step_count integer,
    step_evidence jsonb,
    foundation_status text,
    foundation_note text
  );

  create temporary table tmp_po_product on commit drop as
  with sf as (
    select f.product_id,
           count(*)::integer effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE')::integer included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE')::integer passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor
    from tmp_po_foundation f
    cross join lateral jsonb_to_recordset(
      case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
    ) as e(
      effective_step_key text,
      sequence_no numeric,
      activity_id integer,
      cost_centre_id bigint,
      behaviour_code text,
      resource_class_code text,
      expected_occurrence_count numeric,
      standard_cycle_count numeric,
      direct_labour_scope text,
      production_overhead_scope text,
      source_type text,
      base_step_id bigint,
      override_id bigint
    )
    left join costing.production_overhead_scope_factor sc
      on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
    left join costing.production_overhead_behaviour_factor bh
      on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    group by f.product_id
  )
  select
    f.product_id,
    f.product_name,
    f.product_base_uom,
    f.monthly_product_base_qty,
    f.monthly_driver_status,
    f.route_family_id,
    f.family_route_id,
    f.product_route_id,
    f.effective_route_source,
    f.batch_size_ref_id,
    f.preferred_batch_size,
    sf.effective_step_count,
    sf.included_step_count,
    sf.passive_step_count,
    sf.excluded_step_count,
    sf.route_factor,
    case when f.preferred_batch_size>0 then f.monthly_product_base_qty/f.preferred_batch_size end monthly_batch_equivalents,
    case when f.preferred_batch_size>0 and f.monthly_product_base_qty>0
         then ceil(f.monthly_product_base_qty/f.preferred_batch_size)::integer end rounded_batch_count,
    case when f.preferred_batch_size>0 and f.monthly_product_base_qty>0 and sf.route_factor is not null
         then (case when v_bt then f.monthly_product_base_qty/f.preferred_batch_size else ceil(f.monthly_product_base_qty/f.preferred_batch_size) end)*sf.route_factor end workload_units, -- AU-5: batch-equivalent (unrounded) when batch-true effective
    case
      when f.family_route_id is null then 'BLOCKED_NO_APPROVED_EFFECTIVE_ROUTE'
      when (sf.route_factor is null or sf.route_factor<=0)
           and f.foundation_status not like 'BLOCKED%'
           and coalesce(sf.effective_step_count,0)>0
           and coalesce(sf.included_step_count,0)=0
           and coalesce(sf.passive_step_count,0)=0
           and coalesce(sf.excluded_step_count,0)=coalesce(sf.effective_step_count,0)
        then 'READY_ZERO_PRODUCTION_OVERHEAD'
      when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'
      when f.batch_size_ref_id is null or f.preferred_batch_size<=0 then 'BLOCKED_NO_ACTIVE_BATCH_SIZE'
      when f.monthly_product_base_qty is null or f.monthly_product_base_qty<=0 then 'BLOCKED_NO_MONTHLY_PRODUCT_BASE_QTY'
      when f.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_DRIVER'
      when f.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_DRIVER'
      else 'READY'
    end workload_status
  from tmp_po_foundation f
  left join sf on sf.product_id=f.product_id;

    -- AU-6: default-volume cap (default-driven workload <= policy pool_cap_share of eligible workload).
  update tmp_po_product t
     set workload_units = c.new_workload
    from costing.fn_default_volume_cap(
           p_refresh_run_id, p_valuation_date, 'PRODUCTION_OVERHEAD',
           (select jsonb_agg(jsonb_build_object('product_id',x.product_id,'workload',x.workload_units,'base_qty',x.monthly_product_base_qty))
              from tmp_po_product x
             where x.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
               and x.workload_units > 0)) c
   where c.product_id = t.product_id;

  select count(*),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')),
         count(*) filter(where workload_status like 'BLOCKED%'),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD'))::numeric/nullif(count(*),0),
         sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD'))
  into v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_workload,0)<=0 then
    raise exception 'Production Overhead allocation requires at least one eligible Product with positive workload';
  end if;

  insert into costing.product_production_overhead_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,batch_size_ref_id,preferred_batch_size,
    monthly_product_base_qty,monthly_driver_status,monthly_batch_equivalents,rounded_batch_count,effective_step_count,included_step_count,
    passive_step_count,excluded_step_count,route_factor,workload_units,workload_status,workload_reason_code,workload_note,
    recipient_product_count,ready_product_count,blocked_product_count,workload_coverage_ratio,company_ready_workload_units)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,t.product_id,t.product_name,t.product_base_uom,
         t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.batch_size_ref_id,t.preferred_batch_size,
         t.monthly_product_base_qty,t.monthly_driver_status,t.monthly_batch_equivalents,t.rounded_batch_count,coalesce(t.effective_step_count,0),
         coalesce(t.included_step_count,0),coalesce(t.passive_step_count,0),coalesce(t.excluded_step_count,0),t.route_factor,t.workload_units,
         t.workload_status,t.workload_status,
         case when t.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route contains effective steps, all explicitly excluded from Production Overhead. Production Overhead is validly zero and non-blocking.'
              when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'
              when t.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Production Overhead workload is eligible using a governed monthly quantity requiring review.'
              else 'Production Overhead workload is individually blocked with zero allocation: '||t.workload_status end,
         v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product t;

  -- Step lineage comes from the same once-resolved shared foundation.
  insert into costing.product_production_overhead_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,sequence_no,effective_step_key,
    source_type,base_step_id,override_id,production_overhead_scope,scope_factor,behaviour_code,behaviour_factor,
    resource_class_code,resource_factor,expected_occurrence_count,standard_cycle_count,step_factor)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,s.id,s.product_id,e.sequence_no,e.effective_step_key,
         e.source_type,e.base_step_id,e.override_id,e.production_overhead_scope,sc.factor,e.behaviour_code,bh.factor,
         e.resource_class_code,rs.factor,e.expected_occurrence_count,e.standard_cycle_count,
         sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
  from costing.product_production_overhead_workload_snapshot s
  join tmp_po_foundation f on f.product_id=s.product_id
  cross join lateral jsonb_to_recordset(
    case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
  ) as e(
    effective_step_key text,
    sequence_no numeric,
    activity_id integer,
    cost_centre_id bigint,
    behaviour_code text,
    resource_class_code text,
    expected_occurrence_count numeric,
    standard_cycle_count numeric,
    direct_labour_scope text,
    production_overhead_scope text,
    source_type text,
    base_step_id bigint,
    override_id bigint
  )
  join costing.production_overhead_scope_factor sc
    on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
  join costing.production_overhead_behaviour_factor bh
    on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
  join costing.production_overhead_resource_factor rs
    on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  insert into costing.sku_production_overhead_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_workload_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,monthly_product_base_qty,sku_within_product_share,
    production_overhead_pool_amount,product_workload_share,product_production_overhead_allocation,
    production_overhead_cost_per_base_uom,production_overhead_cost_per_sku,allocation_status,allocation_reason_code,allocation_note)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,pw.id,b.sku_id,b.product_id,b.product_name,
         b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,pw.monthly_product_base_qty,
         case when pw.monthly_product_base_qty>0 then b.monthly_allocation_base_qty/pw.monthly_product_base_qty end,
         v_pool,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') then pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') then v_pool*pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') and pw.monthly_product_base_qty>0
              then (v_pool*pw.workload_units/v_company_workload)/pw.monthly_product_base_qty end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') and pw.monthly_product_base_qty>0
              then ((v_pool*pw.workload_units/v_company_workload)/pw.monthly_product_base_qty)*b.sku_base_qty_per_unit end,
         case when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'REVIEW_REQUIRED'
              when pw.workload_status in ('READY','READY_ZERO_PRODUCTION_OVERHEAD') then 'READY' else 'BLOCKED' end,
         pw.workload_status,
         case when pw.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route is explicitly outside the Production Overhead pool; this SKU receives valid zero Production Overhead while the full pool remains allocated across positive-workload eligible Products.'
              when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Full Production Overhead pool is allocated across current eligible Products; this Product uses a monthly quantity requiring review.'
              else 'Product is individually blocked and receives zero Production Overhead in this exact run. A later governed run may redistribute the pool after the blocker is resolved.' end
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_production_overhead_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  select coalesce(sum(x.product_allocation),0)
    + coalesce((select sum(v_pool*w.workload_units/nullif(w.company_ready_workload_units,0))
                from costing.product_production_overhead_workload_snapshot w
                where w.refresh_run_id=p_refresh_run_id
                  and w.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
                  and not exists (select 1 from costing.sku_sales_allocation_basis_snapshot b where b.refresh_run_id=p_refresh_run_id and b.product_id=w.product_id)),0)
    into v_allocated_pool
    from (
      select product_id,max(product_production_overhead_allocation) product_allocation
      from costing.sku_production_overhead_allocation_snapshot
      where refresh_run_id=p_refresh_run_id
      group by product_id
    ) x;

  if abs(coalesce(v_pool,0)-coalesce(v_allocated_pool,0)) > 0.000001 then
    raise exception 'Production Overhead exact-run allocation does not reconcile to frozen pool for refresh run %: pool %, allocated %',
      p_refresh_run_id,v_pool,v_allocated_pool;
  end if;

  if exists (
    select 1
    from costing.sku_production_overhead_allocation_snapshot s
    where s.refresh_run_id=p_refresh_run_id
      and (s.pool_snapshot_id is distinct from v_pool_snapshot_id
           or s.production_overhead_pool_amount is distinct from v_pool)
  ) then
    raise exception 'Production Overhead SKU snapshot pool lineage mismatch for refresh run %',p_refresh_run_id;
  end if;

  if v_bt then
    insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
    values(p_refresh_run_id,'PRODUCTION_OVERHEAD',v_pool,v_allocated_pool,v_pool-v_allocated_pool,v_eligible_count,v_recipient_count-v_eligible_count,v_pool/nullif(v_company_workload,0),'NORMAL_VOLUME_RATE')
    on conflict (refresh_run_id,allocation_pool) do nothing;
  end if;

  return jsonb_build_object(
    'period_start',v_period_start,'batch_true',v_bt,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
    'pool_snapshot_id',v_pool_snapshot_id,
    'allocation_mode','FULL_POOL_TO_CURRENT_ELIGIBLE_PRODUCTS','recipient_product_count',v_recipient_count,
    'eligible_product_count',v_eligible_count,'blocked_product_count',v_blocked_count,'eligible_coverage_ratio',v_coverage,
    'company_eligible_workload_units',v_company_workload,'pool_amount',v_pool,'allocated_pool_amount',v_allocated_pool,
    'unallocated_pool_amount',v_pool-v_allocated_pool,'monetary_allocation_enabled',true,
    'product_snapshot_count',(select count(*) from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id),
    'step_snapshot_count',(select count(*) from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id),
    'sku_snapshot_count',(select count(*) from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION costing.rpc_refresh_sku_direct_labour_component_split_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date := date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.direct_labour_workload_policy%rowtype;
  v_preview jsonb;
  v_total_pool numeric;
  v_mfg_component_id bigint;
  v_pack_component_id bigint;
  v_mfg_pool numeric;
  v_pack_pool numeric;
  v_mfg_staff_count bigint;
  v_pack_staff_count bigint;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_product_count integer;
  v_company_mfg_workload numeric;
  v_company_pack_units numeric;
  v_bt boolean;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Direct Labour component snapshot context does not match refresh run %',p_refresh_run_id;
  end if;
  if not (
    v_run.overall_status='SUCCESS'
    or (
      v_run.overall_status='RUNNING'
      and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
      and exists (
        select 1 from costing.costing_refresh_run_stage s
        where s.refresh_run_id=p_refresh_run_id
          and s.stage_code='03_COST_BUILD_TO_SCHEME'
          and s.stage_status='RUNNING'
      )
    )
  ) then
    raise exception 'Direct Labour component snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  select * into v_policy from costing.fn_resolve_direct_labour_workload_policy(p_valuation_date);
  if v_policy.formula_type is distinct from 'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS' then
    raise exception 'Resolved Direct Labour policy %/% is not component-split and cannot use this writer',v_policy.policy_code,v_policy.policy_version;
  end if;

  if exists(select 1 from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_direct_labour_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_direct_labour_allocation_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Direct Labour snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select total_pool_amount into v_total_pool
  from costing.cost_pool_monthly_snapshot
  where period_start=v_period_start
    and valuation_date=p_valuation_date
    and refresh_run_id=p_refresh_run_id
    and allocation_pool='DIRECT_LABOUR';
  if v_total_pool is null then raise exception 'Direct Labour frozen pool is missing for exact run %',p_refresh_run_id; end if;

  select id,component_pool_amount,staff_count
    into v_mfg_component_id,v_mfg_pool,v_mfg_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='MANUFACTURING_LABOUR';

  select id,component_pool_amount,staff_count
    into v_pack_component_id,v_pack_pool,v_pack_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='PACKING_LABOUR';

  if v_mfg_component_id is null or v_pack_component_id is null then
    raise exception 'Frozen Direct Labour component pools are incomplete for run %',p_refresh_run_id;
  end if;
  if (v_mfg_pool+v_pack_pool) is distinct from v_total_pool then
    raise exception 'Frozen Direct Labour component pools do not reconcile for run %: manufacturing %, packing %, total %',p_refresh_run_id,v_mfg_pool,v_pack_pool,v_total_pool;
  end if;

  v_preview:=costing.fn_preview_direct_labour_shadow_workload(v_policy.id,v_period_start,p_valuation_date,p_refresh_run_id,null);

  create temporary table tmp_dl_product on commit drop as
  select x.*,
    case when x.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and x.direct_labour_workload_units>0 then true else false end as is_eligible
  from jsonb_to_recordset(v_preview->'rows') as x(
    product_id bigint,product_name text,product_base_uom text,recipient_sku_count integer,
    monthly_product_base_qty numeric,monthly_driver_status text,standard_batch_count bigint,
    route_family_id bigint,family_route_id bigint,product_route_id bigint,effective_route_source text,
    foundation_status text,foundation_note text,workload_status text,workload_note text,
    direct_labour_route_intensity numeric,direct_labour_workload_units numeric,labour_step_evidence jsonb
  );

  create temporary table tmp_packing_responsibility on commit drop as
  select t.product_id,t.route_family_id,pr.rule_id,pr.responsibility_code,pr.resolution_source,pr.rationale
  from tmp_dl_product t
  cross join lateral costing.fn_resolve_packing_labour_responsibility(t.route_family_id,p_valuation_date) pr;

  update tmp_dl_product t
  set workload_status = case
          when t.foundation_status like 'REVIEW_REQUIRED%' then 'REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR'
          else 'READY_ZERO_MANUFACTURING_LABOUR'
      end,
      workload_note = case
          when t.foundation_status like 'REVIEW_REQUIRED%' then
              'The governed route intentionally contains no Manufacturing-Labour steps; Manufacturing Labour is zero, while the quantity foundation requires review. Packing Labour remains separate.'
          else
              'The governed route intentionally contains no Manufacturing-Labour steps. Manufacturing Labour is validly zero and Packing Labour remains separate.'
      end
  where t.workload_status='BLOCKED_NO_POSITIVE_DIRECT_LABOUR_ROUTE_INTENSITY'
    and coalesce(t.direct_labour_route_intensity,0)=0
    and t.foundation_status not like 'BLOCKED%'
    and jsonb_typeof(t.labour_step_evidence)='array'
    and jsonb_array_length(t.labour_step_evidence)>0
    and not exists (
        select 1
        from jsonb_array_elements(t.labour_step_evidence) e
        where coalesce(e->>'direct_labour_scope','') <> 'EXCLUDE_OTHER_POOL'
    )
    and (
      not exists (
        select 1 from costing.production_route_family rf
        where rf.id=t.route_family_id and rf.family_code='OUTSOURCED_SOFT_GEL_JOB_WORK'
      )
      or exists (
        select 1 from tmp_packing_responsibility pr
        where pr.product_id=t.product_id
          and pr.responsibility_code='EXTERNAL_FULLY_PACKED'
          and pr.rule_id is not null
      )
    );

  -- AU-5 batch-true: manufacturing-labour workload on unrounded normal batch equivalents (route intensity x qty / batch_size_ref)
  v_bt := costing.fn_batch_true_effective(p_valuation_date);
  if v_bt then
    update tmp_dl_product t
       set direct_labour_workload_units = t.direct_labour_route_intensity * t.monthly_product_base_qty / br.preferred_batch_size
      from (select distinct on (b.product_id) b.product_id,b.preferred_batch_size
              from public.production_batch_size_ref b
             where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
             order by b.product_id,b.effective_from desc,b.id desc) br
     where br.product_id=t.product_id and br.preferred_batch_size>0
       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;
  end if;

    -- AU-6: default-volume cap (default-driven workload <= policy pool_cap_share of eligible workload).
  update tmp_dl_product t
     set direct_labour_workload_units = c.new_workload
    from costing.fn_default_volume_cap(
           p_refresh_run_id, p_valuation_date, 'MANUFACTURING_LABOUR',
           (select jsonb_agg(jsonb_build_object('product_id',x.product_id,'workload',x.direct_labour_workload_units,'base_qty',x.monthly_product_base_qty))
              from tmp_dl_product x
             where x.is_eligible and x.direct_labour_workload_units > 0)) c
   where c.product_id = t.product_id;

  select count(*),count(*) filter(where is_eligible),count(*) filter(where workload_status like 'BLOCKED%'),
         sum(direct_labour_workload_units) filter(where is_eligible)
    into v_recipient_count,v_eligible_count,v_blocked_product_count,v_company_mfg_workload
  from tmp_dl_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_mfg_workload,0)<=0 then
    raise exception 'Manufacturing Labour allocation has no eligible positive route workload for refresh run %',p_refresh_run_id;
  end if;

  select sum(b.monthly_allocation_units)
    into v_company_pack_units
  from costing.sku_sales_allocation_basis_snapshot b
  join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
  where b.period_start=v_period_start
    and b.valuation_date=p_valuation_date
    and b.refresh_run_id=p_refresh_run_id
    and b.monthly_allocation_units>0
    and pr.responsibility_code='SASV_INTERNAL_PACKING';

  if coalesce(v_company_pack_units,0)<=0 then
    raise exception 'Packing Labour allocation has no positive frozen monthly package units for SASV-packed recipient SKUs in refresh run %',p_refresh_run_id;
  end if;

  insert into costing.product_direct_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,monthly_product_base_qty,
    monthly_driver_status,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    workload_status,workload_reason_code,workload_note,recipient_product_count,eligible_product_count,
    blocked_product_count,eligible_coverage_ratio,company_eligible_workload_units,direct_labour_pool_amount,
    product_workload_share,product_direct_labour_allocation,direct_labour_pool_snapshot_id,
    manufacturing_labour_component_pool_snapshot_id
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
    t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.monthly_product_base_qty,
    t.monthly_driver_status,t.standard_batch_count,t.direct_labour_route_intensity,t.direct_labour_workload_units,
    t.workload_status,t.workload_status,
    case when t.workload_status='READY' then 'Manufacturing Labour workload is ready under the component-split Direct Labour policy.'
         when t.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'Manufacturing Labour is validly zero because the governed route contains no Manufacturing-Labour steps; Packing Labour responsibility is resolved separately.'
         when t.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'Manufacturing Labour workload is calculated but the governed quantity foundation requires review.'
         when t.workload_status='REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR' then 'Manufacturing Labour is validly zero under the governed route, while the quantity foundation requires review; Packing Labour responsibility is resolved separately.'
         else t.workload_note end,
    v_recipient_count,v_eligible_count,v_blocked_product_count,
    v_eligible_count::numeric/nullif(v_recipient_count,0),v_company_mfg_workload,v_mfg_pool,
    case when t.is_eligible then t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    case when t.is_eligible then v_mfg_pool*t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    (select id from costing.cost_pool_monthly_snapshot where refresh_run_id=p_refresh_run_id and allocation_pool='DIRECT_LABOUR'),
    v_mfg_component_id
  from tmp_dl_product t;

  insert into costing.product_direct_labour_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,
    sequence_no,effective_step_key,source_type,activity_id,cost_centre_id,direct_labour_scope,scope_factor,
    behaviour_code,attendance_factor,expected_occurrence_count,standard_cycle_count,step_labour_factor,resource_class_code
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,pw.id,pw.product_id,
    nullif(e->>'sequence_no','')::numeric,e->>'effective_step_key',e->>'source_type',
    nullif(e->>'activity_id','')::bigint,nullif(e->>'cost_centre_id','')::bigint,e->>'direct_labour_scope',
    nullif(e->>'scope_factor','')::numeric,e->>'behaviour_code',nullif(e->>'attendance_factor','')::numeric,
    nullif(e->>'expected_occurrence_count','')::numeric,nullif(e->>'standard_cycle_count','')::numeric,
    nullif(e->>'step_labour_factor','')::numeric,e->>'resource_class_code'
  from costing.product_direct_labour_workload_snapshot pw
  join tmp_dl_product t on t.product_id=pw.product_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end)e
  where pw.refresh_run_id=p_refresh_run_id;

  insert into costing.sku_packing_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,expected_package_units,
    company_expected_package_units,package_workload_share,packing_labour_component_pool_snapshot_id,
    packing_labour_pool_amount,packing_labour_allocation,packing_labour_cost_per_sku_unit,
    packing_responsibility_rule_id,packing_responsibility_code,packing_responsibility_resolution_source,
    workload_status,workload_reason_code,workload_note,source_method,created_at
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0 else b.monthly_allocation_units end,
    v_company_pack_units,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then b.monthly_allocation_units/v_company_pack_units else 0 end,
    v_pack_component_id,v_pack_pool,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then v_pack_pool*(b.monthly_allocation_units/v_company_pack_units) else 0 end,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then v_pack_pool/v_company_pack_units else 0 end,
    pr.rule_id,pr.responsibility_code,pr.resolution_source,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'READY'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED'
      when ar.effective_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'READY_EXTERNAL_FULLY_PACKED'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED_NO_POSITIVE_EXPECTED_PACKAGE_UNITS'
      when ar.effective_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_PACKING_QUANTITY_FOUNDATION'
      else 'READY'
    end,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'SASV Packing Labour is validly zero because the approved route-family responsibility rule governs this finished SKU as externally fully packed.'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'Packing Labour cannot be allocated because frozen monthly package units are not positive.'
      when ar.effective_status='REVIEW_REQUIRED' then 'Packing Labour is calculable from frozen monthly package units, but the quantity foundation requires review.'
      else 'Packing Labour workload is ready from frozen exact-run monthly package units.'
    end,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null
         then 'PACKING_LABOUR_RESPONSIBILITY_RULE.EXTERNAL_FULLY_PACKED'
         else 'SKU_SALES_ALLOCATION_BASIS_SNAPSHOT.MONTHLY_ALLOCATION_UNITS' end,
    clock_timestamp()
  from costing.sku_sales_allocation_basis_snapshot b
  join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  create temporary table tmp_dl_product_pack on commit drop as
  select product_id,sum(packing_labour_allocation) as product_packing_labour_allocation
  from costing.sku_packing_labour_workload_snapshot
  where refresh_run_id=p_refresh_run_id
  group by product_id;

  -- These exact-run snapshots are populated immediately before the large SKU join.
  -- Refresh planner statistics so the current run is not mis-estimated as a one-row slice,
  -- which otherwise causes catastrophic nested-loop rescans of the same run snapshots.
  execute 'analyze costing.sku_sales_allocation_basis_snapshot';
  execute 'analyze costing.product_direct_labour_workload_snapshot';
  execute 'analyze costing.sku_packing_labour_workload_snapshot';

  insert into costing.sku_direct_labour_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    product_base_uom,pack_size,pack_uom,sku_base_qty_per_unit,direct_labour_pool_amount,direct_labour_staff_count,
    sales_units_12m,sales_base_qty_12m,product_sales_units_12m,product_sales_base_qty_12m,company_sales_units_12m,
    product_allocation_share,resolved_sales_units,resolved_sales_base_qty,resolved_product_sales_units,
    resolved_product_sales_base_qty,resolved_company_sales_units,resolved_product_allocation_share,
    product_direct_labour_allocation,direct_labour_cost_per_base_uom,direct_labour_cost_per_sku,
    allocation_basis_status,allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
    direct_labour_allocation_status,direct_labour_allocation_note,refreshed_at,policy_id,
    product_workload_snapshot_id,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    product_workload_share,sku_within_product_share,allocation_reason_code,direct_labour_pool_snapshot_id,
    manufacturing_direct_labour_pool_amount,packing_labour_pool_amount,
    manufacturing_direct_labour_allocation,packing_labour_allocation,
    manufacturing_direct_labour_cost_per_sku,packing_labour_cost_per_sku,
    packing_labour_workload_snapshot_id,direct_labour_component_model_code
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.product_base_uom,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,v_total_pool,coalesce(v_mfg_staff_count,0)+coalesce(v_pack_staff_count,0),
    b.actual_sales_units_12m,b.actual_sales_base_qty_12m,b.actual_product_sales_units_12m,
    b.actual_product_sales_base_qty_12m,b.actual_company_sales_units_12m,b.product_allocation_share,
    b.resolved_sales_units,b.resolved_sales_base_qty,b.resolved_product_sales_units,
    b.resolved_product_sales_base_qty,b.resolved_company_sales_units,b.resolved_product_allocation_share,
    pw.product_direct_labour_allocation+coalesce(pp.product_packing_labour_allocation,0),
    case when b.sku_base_qty_per_unit>0 then
      ((case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0))/b.sku_base_qty_per_unit else 0 end,
    case when b.monthly_allocation_units>0 then
      ((case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0))/b.monthly_allocation_units else 0 end,
    b.allocation_basis_status,'DIRECT_LABOUR_COMPONENT_SPLIT',b.allocation_resolution_status,b.allocation_resolution_note,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='BLOCKED' then 'BLOCKED'
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') then 'Direct Labour is blocked because the Manufacturing Labour component is blocked by Product route/foundation readiness. Packing Labour evidence is retained separately.'
      when pk.workload_status='BLOCKED' then 'Direct Labour is blocked because the Packing Labour quantity basis is blocked.'
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'Direct Labour is calculated from Manufacturing Labour plus Packing Labour, with one or more quantity foundations requiring review.'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' and pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED' then 'Direct Labour is ready with valid zero SASV Manufacturing Labour and zero SASV Packing Labour under the approved externally fully-packed responsibility rule.'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'Direct Labour is ready with a valid zero Manufacturing-Labour component plus the governed Packing-Labour component.'
      else 'Direct Labour is ready as Manufacturing Labour plus Packing Labour under the approved component-split policy.'
    end,
    clock_timestamp(),v_policy.id,pw.id,pw.standard_batch_count,pw.direct_labour_route_intensity,
    pw.direct_labour_workload_units,pw.product_workload_share,
    case when pw.monthly_product_base_qty>0 then b.monthly_allocation_base_qty/pw.monthly_product_base_qty end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') then pw.workload_status
      when pk.workload_status='BLOCKED' then pk.workload_reason_code
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' and pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED' then 'READY_ZERO_SASV_MANUFACTURING_AND_PACKING_LABOUR'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'READY_ZERO_MANUFACTURING_LABOUR_PACKING_ONLY'
      else 'READY'
    end,
    pw.direct_labour_pool_snapshot_id,
    v_mfg_pool,v_pack_pool,
    case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
         then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end,
    coalesce(pk.packing_labour_allocation,0),
    case when b.monthly_allocation_units>0 then
      (case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
            then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)/b.monthly_allocation_units else 0 end,
    coalesce(pk.packing_labour_cost_per_sku_unit,0),
    pk.id,'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS'
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_direct_labour_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  join costing.sku_packing_labour_workload_snapshot pk
    on pk.refresh_run_id=b.refresh_run_id and pk.sku_id=b.sku_id
  left join tmp_dl_product_pack pp on pp.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  if abs((select coalesce(sum(product_direct_labour_allocation),0) from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_mfg_pool)>0.000001 then
    raise exception 'Manufacturing Labour Product allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;
  if abs((select coalesce(sum(packing_labour_allocation),0) from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_pack_pool)>0.000001 then
    raise exception 'Packing Labour allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;

  if v_bt then
    insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
    select p_refresh_run_id,'MANUFACTURING_LABOUR',v_mfg_pool,sum(product_direct_labour_allocation),v_mfg_pool-sum(product_direct_labour_allocation),v_eligible_count,v_recipient_count-v_eligible_count,v_mfg_pool/nullif(v_company_mfg_workload,0),'NORMAL_VOLUME_RATE'
      from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id
    on conflict (refresh_run_id,allocation_pool) do nothing;
  end if;

  return query
  select v_period_start,count(*)::bigint,
    count(*) filter(where s.direct_labour_allocation_status='BLOCKED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='READY')::bigint
  from costing.sku_direct_labour_allocation_snapshot s
  where s.refresh_run_id=p_refresh_run_id;
end;
$function$
;
