-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_cost_sheet_rm_explain_summary(
    p_period_start date,
    p_product_id bigint,
    p_sku_id bigint
)
returns table(
    period_start date,
    product_id bigint,
    sku_id bigint,
    rm_total numeric,
    contribution_line_count bigint,
    review_line_count bigint,
    blocked_line_count bigint,
    ok_line_count bigint,
    calculation_warning_line_count bigint,
    largest_contribution_share_percent numeric,
    summary_status text,
    confidential_detail_available boolean,
    snapshot_refreshed_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $$
declare
    v_confidential_detail_available boolean := false;
    v_period_start date;
    v_current_run_id bigint;
    v_valuation_date date;
begin
    perform public.require_permission('module:cost-sheet-review', false);

    if p_period_start is null then raise exception 'p_period_start is required'; end if;
    if p_product_id is null then raise exception 'p_product_id is required'; end if;
    if p_sku_id is null then raise exception 'p_sku_id is required'; end if;

    v_period_start := date_trunc('month', p_period_start::timestamp)::date;

    select r.refresh_run_id, r.valuation_date
      into v_current_run_id, v_valuation_date
    from costing.v_current_successful_costing_refresh_run r
    where r.period_start = v_period_start;

    select
        exists (
            select 1 from public.user_permissions_canonical upc
            where upc.user_id = auth.uid()
              and upc.target = 'module:material-cost-manager'
              and upc.can_view = true
        )
        and exists (
            select 1 from public.user_permissions_canonical upc
            where upc.user_id = auth.uid()
              and upc.target = 'role:material-cost-rm-trace'
              and upc.can_view = true
        )
      into v_confidential_detail_available;

    if v_current_run_id is null then
        return query
        select v_period_start,p_product_id,p_sku_id,
               0::numeric,0::bigint,0::bigint,0::bigint,0::bigint,0::bigint,
               null::numeric,'NO_CURRENT_SUCCESSFUL_RUN'::text,
               v_confidential_detail_available,null::timestamptz;
        return;
    end if;

    return query
    select
        v_period_start,
        p_product_id,
        p_sku_id,
        coalesce(sum(s.rm_cost_per_sku_line),0::numeric),
        count(*)::bigint,
        count(*) filter (
            where s.review_state_label='Review rate'
               or s.action_required='REVIEW_RATE'
               or s.rate_warning_flag=true
        )::bigint,
        count(*) filter (
            where s.approval_block_flag=true
               or s.review_state_label='Blocked'
        )::bigint,
        count(*) filter (where s.review_state_label='OK')::bigint,
        count(*) filter (where s.calculation_warning_flag=true)::bigint,
        max(s.rm_cost_share_percent),
        case
            when count(*)=0 then 'NO_TRACE_DATA'
            when bool_or(s.approval_block_flag=true or s.review_state_label='Blocked') then 'BLOCKED'
            when bool_or(s.calculation_warning_flag=true) then 'CALCULATION_WARNING'
            when bool_or(s.review_state_label='Review rate' or s.action_required='REVIEW_RATE' or s.rate_warning_flag=true) then 'REVIEW_REQUIRED'
            else 'READY'
        end,
        v_confidential_detail_available,
        max(s.snapshot_refreshed_at)
    from costing.cost_sheet_rm_line_traceability_snapshot s
    where s.period_start = v_period_start
      and s.valuation_date = v_valuation_date
      and s.refresh_run_id = v_current_run_id
      and s.product_id = p_product_id
      and s.sku_id = p_sku_id;
end;
$$;

revoke all on function public.rpc_get_cost_sheet_rm_explain_summary(date,bigint,bigint) from public, anon;
grant execute on function public.rpc_get_cost_sheet_rm_explain_summary(date,bigint,bigint) to authenticated, service_role;