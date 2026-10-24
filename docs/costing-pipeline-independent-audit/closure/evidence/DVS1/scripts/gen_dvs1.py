# Generates PREPARED_DVS1_install.sql from the live RPC definition (md5 09c3d22c...) by targeted, asserted replacements.
import hashlib,re
L=open('live_rpc_sales_basis.sql').read()
assert hashlib.md5(L.encode()).hexdigest()=='09c3d22c6154d8eacf099ada57f60007', hashlib.md5(L.encode()).hexdigest()
def rep(s,a,b,n=1):
    assert s.count(a)==n,(a[:80],s.count(a)); return s.replace(a,b)
R=L
R=rep(R,"""    v_sf boolean;
begin""","""    v_sf boolean;

    -- DVS-1 demand-volume selection (off unless one APPROVED policy version is effective for the period).
    v_dvs_policy_id bigint;
    v_dvs boolean := false;
    v_dvs_n int;
begin""")
R=rep(R,"""    v_sf := v_sf_thr is not null;
""","""    v_sf := v_sf_thr is not null;

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
""")
# replace the driver expressions in actual_monthly_driver_qty
old_amd=R[R.index("    actual_monthly_driver_qty as materialized ("):R.index("    actual_product_monthly as materialized (")]
new_amd=old_amd
new_amd=rep(new_amd,"""            case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end
                as actual_monthly_units,
            case when sd.is_seasonal then null::date else d.actual_monthly_source_month end
                as actual_monthly_source_month,
            case when sd.is_seasonal then null::bigint else d.tied_month_count end
                as tied_month_count,
            coalesce(sd.is_seasonal, false) as is_seasonal_average,
""","""            case when v_dvs then coalesce(dv.dvs_selected_units, d.actual_monthly_units)
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
""")
new_amd=rep(new_amd,"""                when (case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end) is null
                    then null::numeric
                else
                    (case when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end)
                    * u.sku_base_qty_per_unit""","""                when (case when v_dvs then coalesce(dv.dvs_selected_units, d.actual_monthly_units)
                           when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end) is null
                    then null::numeric
                else
                    (case when v_dvs then coalesce(dv.dvs_selected_units, d.actual_monthly_units)
                          when sd.is_seasonal then sd.avg_units else d.actual_monthly_units end)
                    * u.sku_base_qty_per_unit""")
new_amd=rep(new_amd,"""        ) sd on v_sf
""","""        ) sd on v_sf

        -- DVS-1: rows only for SKUs whose rule is not the plain max month (rule 5 keeps the legacy max exactly).
        left join pg_temp.dvs1_selection dv
          on v_dvs
         and dv.sku_id = u.sku_id
         and dv.product_id = u.product_id
         and dv.method <> 'MAX_MONTH'
""")
R=R.replace(old_amd,new_amd)
# notes and method labels (two case blocks)
R=rep(R,"""                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then format(""","""                when r.actual_monthly_units > 0 and r.dvs_note_text is not null
                    then r.dvs_note_text

                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then format(""")
R=rep(R,"""                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then 'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH'""","""                when r.actual_monthly_units > 0 and r.dvs_method_label is not null
                    then r.dvs_method_label

                when r.actual_monthly_units > 0 and r.is_seasonal_average
                    then 'SEASONAL_12M_AVERAGE_COMPANY_WIDE_NET_SKU_MONTH'""")
# lineage rows after the main insert
R=rep(R,"""    return query
    select
        v_period_start,""","""    if v_dvs then
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
        v_period_start,""")
R=rep(R,"""    -- Exact-run replacement only.
    delete
    from costing.sku_sales_allocation_basis_snapshot s
    where s.refresh_run_id = p_refresh_run_id;
""","""    -- Exact-run replacement only.
    delete
    from costing.sku_sales_allocation_basis_snapshot s
    where s.refresh_run_id = p_refresh_run_id;

    delete
    from costing.sku_demand_volume_selection_snapshot s
    where s.refresh_run_id = p_refresh_run_id;
""")
open('out/patched_rpc.sql','w').write(R)
print('patched rpc', len(R), hashlib.md5(R.encode()).hexdigest())
