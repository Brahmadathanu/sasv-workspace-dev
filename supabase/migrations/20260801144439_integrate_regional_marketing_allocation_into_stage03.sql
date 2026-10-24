-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
    v_oid oid;
    v_definition text;
    v_anchor text;
    v_insert text;
begin
    select p.oid, pg_get_functiondef(p.oid)
    into v_oid, v_definition
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='costing'
      and p.proname='rpc_refresh_manufacturing_cop_chain'
      and pg_get_function_identity_arguments(p.oid)='p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

    if v_oid is null then
        raise exception 'Canonical Stage 03 function not found.';
    end if;

    if (length(v_definition)-length(replace(v_definition,'rpc_refresh_sku_regional_marketing_expense_allocation_snapshot','')))
       / length('rpc_refresh_sku_regional_marketing_expense_allocation_snapshot') > 0 then
        return;
    end if;

    v_anchor := E'        perform *\r\n        from costing.rpc_refresh_sku_marketing_expense_allocation_snapshot(\r\n            v_period_start,\r\n            p_valuation_date,\r\n            p_refresh_run_id\r\n        );\r\n';

    if position(v_anchor in v_definition)=0 then
        v_anchor := E'        perform *\n        from costing.rpc_refresh_sku_marketing_expense_allocation_snapshot(\n            v_period_start,\n            p_valuation_date,\n            p_refresh_run_id\n        );\n';
    end if;

    if position(v_anchor in v_definition)=0 then
        raise exception 'Exact common Marketing allocation anchor not found.';
    end if;

    v_insert := v_anchor ||
        case when position(E'\r\n' in v_anchor)>0 then
            E'\r\n\r\n        -- Canonical regional Marketing monetary allocation.\r\n        perform *\r\n        from costing.rpc_refresh_sku_regional_marketing_expense_allocation_snapshot(\r\n            v_period_start,\r\n            p_valuation_date,\r\n            p_refresh_run_id\r\n        );\r\n'
        else
            E'\n\n        -- Canonical regional Marketing monetary allocation.\n        perform *\n        from costing.rpc_refresh_sku_regional_marketing_expense_allocation_snapshot(\n            v_period_start,\n            p_valuation_date,\n            p_refresh_run_id\n        );\n'
        end;

    v_definition := replace(v_definition, v_anchor, v_insert);
    execute v_definition;
end;
$migration$;

alter function costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint) owner to postgres;
revoke all on function costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint) from public, anon, authenticated, service_role;
grant execute on function costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint) to postgres;