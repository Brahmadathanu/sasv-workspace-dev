-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_get_cost_period_valuation_context(
    p_period_start date
)
returns table(
    period_start date,
    period_end date,
    period_status text,
    remarks text,
    valuation_date date,
    valuation_date_source text,
    valuation_date_status text,
    valuation_date_change_reason text,
    valuation_date_approval_reference text,
    valuation_date_set_at timestamptz,
    valuation_date_set_by uuid,
    locked_at timestamptz,
    lock_reason text,
    closed_at timestamptz,
    close_reason text,
    queued_or_running_refresh_count bigint
)
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
    v_period_start date;
begin
    perform public.require_permission(
        'module:costing-control-center',
        false
    );

    if p_period_start is null then
        raise exception 'Costing period start is required';
    end if;

    v_period_start := date_trunc('month', p_period_start::timestamp)::date;

    return query
    select
        cp.period_start,
        cp.period_end,
        cp.status,
        cp.remarks,
        cp.valuation_date,
        cp.valuation_date_source,
        cp.valuation_date_status,
        cp.valuation_date_change_reason,
        cp.valuation_date_approval_reference,
        cp.valuation_date_set_at,
        cp.valuation_date_set_by,
        cp.locked_at,
        cp.lock_reason,
        cp.closed_at,
        cp.close_reason,
        (
            select count(*)::bigint
            from costing.costing_refresh_run r
            where r.period_start = cp.period_start
              and r.overall_status in ('QUEUED','RUNNING')
        )
    from costing.cost_periods cp
    where cp.period_start = v_period_start;
end;
$function$;

create or replace function public.rpc_get_cost_period_governance_history(
    p_period_start date
)
returns table(
    audit_id bigint,
    period_start date,
    event_type text,
    previous_status text,
    new_status text,
    previous_valuation_date date,
    new_valuation_date date,
    previous_valuation_date_status text,
    new_valuation_date_status text,
    reason text,
    approval_reference text,
    event_source text,
    actor_user_id uuid,
    evidence_json jsonb,
    occurred_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public','costing','pg_temp'
as $function$
begin
    perform public.require_permission(
        'module:costing-control-center',
        false
    );

    if p_period_start is null then
        raise exception 'Costing period start is required';
    end if;

    return query
    select
        a.audit_id,
        a.period_start,
        a.event_type,
        a.previous_status,
        a.new_status,
        a.previous_valuation_date,
        a.new_valuation_date,
        a.previous_valuation_date_status,
        a.new_valuation_date_status,
        a.reason,
        a.approval_reference,
        a.event_source,
        a.actor_user_id,
        a.evidence_json,
        a.occurred_at
    from costing.cost_period_governance_audit a
    where a.period_start = date_trunc('month', p_period_start::timestamp)::date
    order by a.occurred_at desc, a.audit_id desc;
end;
$function$;

revoke all on function public.rpc_get_cost_period_valuation_context(date) from public, anon;
grant execute on function public.rpc_get_cost_period_valuation_context(date) to authenticated, service_role;

revoke all on function public.rpc_get_cost_period_governance_history(date) from public, anon;
grant execute on function public.rpc_get_cost_period_governance_history(date) to authenticated, service_role;

revoke all on function public.rpc_set_cost_period_valuation_date(date,date,text,text) from public, anon;
grant execute on function public.rpc_set_cost_period_valuation_date(date,date,text,text) to authenticated, service_role;
