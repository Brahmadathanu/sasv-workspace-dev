def rep(s,a,b,cnt=1):
    assert s.count(a)==cnt,(a[:90],s.count(a)); return s.replace(a,b)
s=open('live_rpc_refresh_sku_sales_allocation_basis_snapshot.sql').read()
s=rep(s,"    v_run costing.costing_refresh_run%rowtype;\nbegin",
"    v_run costing.costing_refresh_run%rowtype;\n\n    -- SALES-01 costing-only sales feed (null = off).\n    v_sf_appr text;\n    v_sf_thr numeric;\n    v_sf boolean;\nbegin")
s=rep(s,"""    v_driver_lookback_end :=
        v_period_start;
""","""    v_driver_lookback_end :=
        v_period_start;

    select m.approval_reference, m.seasonal_top3_share_threshold
      into v_sf_appr, v_sf_thr
      from costing.fn_costing_sales_feed_mode(v_period_start) m;
    v_sf := v_sf_thr is not null;
""")
s=rep(s,"""        from public.fn_sales_monthly_clean_as_of(
            p_valuation_date
        ) c
""","""        from (
            select * from public.fn_sales_monthly_clean_as_of(p_valuation_date)
             where not v_sf
            union all
            select * from costing.fn_costing_sales_monthly_as_of(p_valuation_date)
             where v_sf
        ) c
""")
s=rep(s,"""    actual_monthly_driver_qty as materialized (
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
""","""    -- SALES-01: seasonal SKUs (top-3 company-wide months >= threshold of the 12-month volume) use the 12-month average.
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

            case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end
                as actual_monthly_units,
            case when sd.is_seasonal then null::date else d.actual_monthly_source_month end
                as actual_monthly_source_month,
            case when sd.is_seasonal then null::bigint else d.tied_month_count end
                as tied_month_count,
            coalesce(sd.is_seasonal, false) as is_seasonal_average,

            case
                when (case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end) is null
                    then null::numeric
                else
                    (case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end)
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
    ),
""")
s=rep(s,"""                when r.actual_monthly_units > 0
                    then
                        'Allocation basis uses the maximum positive company-wide cleaned SKU-month quantity in the frozen 12-month lookback.'
""","""                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then format(
                        'SALES-01 seasonal SKU (top-3 months >= %s of 12-month volume): allocation basis uses the 12-month average company-wide net monthly quantity.',
                        v_sf_thr)

                when r.actual_monthly_units > 0 and v_sf
                    then
                        'SALES-01: allocation basis uses the maximum positive company-wide net SKU-month quantity (no per-godown outlier filter) in the frozen 12-month lookback.'

                when r.actual_monthly_units > 0
                    then
                        'Allocation basis uses the maximum positive company-wide cleaned SKU-month quantity in the frozen 12-month lookback.'
""")
s=rep(s,"""                when r.actual_monthly_units > 0
                    then
                        'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK'
""","""                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then 'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH'

                when r.actual_monthly_units > 0 and v_sf
                    then 'MAX_POSITIVE_COMPANY_WIDE_NET_SKU_MONTH_IN_12M_LOOKBACK'

                when r.actual_monthly_units > 0
                    then
                        'MAX_POSITIVE_COMPANY_WIDE_CLEANED_SKU_MONTH_IN_12M_LOOKBACK'
""")
open('new_sales.sql','w').write(s)
print('ok')
