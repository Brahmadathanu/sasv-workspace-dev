-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
    v_definition text;
begin
    select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'costing'
      and p.proname = 'fn_preview_shared_standard_batch_route_foundation'
      and pg_get_function_identity_arguments(p.oid) = 'p_period_start date, p_valuation_date date, p_refresh_run_id bigint, p_route_family_id bigint';

    if v_definition is null then
        raise exception 'Shared standard batch-route foundation function was not found';
    end if;

    v_definition := replace(
        v_definition,
        $$where b.monthly_driver_source = 'ACTUAL_MONTHLY_SALES'$$,
        $$where b.assumption_id is null
                  and b.default_policy_id is null$$
    );

    execute v_definition;
end;
$migration$;