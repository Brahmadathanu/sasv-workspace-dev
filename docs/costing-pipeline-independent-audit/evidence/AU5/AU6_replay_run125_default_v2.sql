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

        where b.period_start = date '2026-10-01'
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
            date '2026-10-16'
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
         and c.month_start >= date '2025-10-01'
         and c.month_start < date '2026-10-01'

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
         and c.month_start >= date '2025-10-01'
         and c.month_start < date '2026-10-01'

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
                date '2026-10-01',
                d.sku_id,
                date '2026-10-16'
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
                date '2026-10-16'
            ) d
          on a.required_default_scenario is not null

        left join (values ('NEW_PRODUCT_NO_HISTORY','SMART_V2',12::numeric,null::numeric,12),('NEW_SKU_EXISTING_PRODUCT','SMART_V2',null,0.10,12)) pol(scenario_code,default_basis,batch_interval_months,new_sku_max_share_of_product,default_max_age_months)
          on pol.scenario_code = d.scenario_code and d.resolution_status='RESOLVED'

        left join actual_product_monthly apm
          on apm.product_id = a.product_id

        left join default_sku_count dsc
          on dsc.product_id = a.product_id

        -- batch_size_ref is the standard reference (same resolution as the AU-5 writers).
        left join lateral (
            select b.preferred_batch_size
            from public.production_batch_size_ref b
            where b.product_id = a.product_id
              and b.effective_from <= date '2026-10-16'
              and (b.effective_to is null or b.effective_to >= date '2026-10-16')
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
            from (values (900001::bigint,54::bigint,null::bigint,0.33::numeric,null::numeric,'APPROVED',date '2026-10-01',date '2027-09-30')) p(id,product_id,sku_id,planned_monthly_base_qty,planned_batches_per_year,status,effective_from,expires_on)
            where p.product_id = a.product_id
              and (p.sku_id = a.sku_id or p.sku_id is null)
              and p.status = 'APPROVED'
              and p.effective_from <= date '2026-10-16'
              and p.expires_on > date '2026-10-16'
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
                and date '2026-10-01' >= (w.first_default_period
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

select json_build_object(
 'by_src',(select json_agg(z) from (select resolved_source, resolved_status, count(*) n, round(sum(resolved_monthly_base_qty),3) bq from resolved_sku_qty group by 1,2 order by 1,2) z),
 'ex',(select json_agg(z) from (select sku_id, product_id, left(product_name,24) pn, resolved_source, round(resolved_monthly_units,4) u, round(resolved_monthly_base_qty,4) bq, std_batch_size, left(resolved_note,140) note from resolved_sku_qty where product_id in (54,1340,468,210,772,696,1350,190) order by product_id) z),
 'diff_actual',(select count(*) from resolved_sku_qty r join costing.sku_sales_allocation_basis_snapshot b on b.sku_id=r.sku_id and b.refresh_run_id=125 where b.monthly_driver_source='ACTUAL_MONTHLY_MAX' and (r.resolved_source<>'ACTUAL_MONTHLY_MAX' or r.resolved_monthly_base_qty<>b.monthly_allocation_base_qty)),
 'n',(select count(*) from resolved_sku_qty))