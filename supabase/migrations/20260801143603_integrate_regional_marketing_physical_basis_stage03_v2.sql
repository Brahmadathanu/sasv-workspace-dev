-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
    v_oid oid;
    v_definition text;
    v_anchor text := E'        perform *\r\n        from costing.rpc_refresh_marketing_regional_sales_evidence_snapshot(\r\n            v_period_start,\r\n            p_valuation_date,\r\n            p_refresh_run_id\r\n        );';
    v_replacement text := E'        perform *\r\n        from costing.rpc_refresh_marketing_regional_sales_evidence_snapshot(\r\n            v_period_start,\r\n            p_valuation_date,\r\n            p_refresh_run_id\r\n        );\r\n\r\n\r\n        -- Canonical immutable SKU × Region physical basis for regional Marketing.\r\n        perform *\r\n        from costing.rpc_refresh_sku_regional_marketing_allocation_basis_snapshot(\r\n            v_period_start,\r\n            p_valuation_date,\r\n            p_refresh_run_id\r\n        );';
    v_anchor_count integer;
begin
    select p.oid
    into v_oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'costing'
      and p.proname = 'rpc_refresh_manufacturing_cop_chain'
      and pg_get_function_identity_arguments(p.oid) =
          'p_period_start date, p_valuation_date date, p_refresh_run_id bigint';

    if v_oid is null then
        raise exception 'Exact three-argument Stage 03 function was not found.';
    end if;

    v_definition := pg_get_functiondef(v_oid);

    v_anchor_count :=
        (length(v_definition) - length(replace(v_definition, v_anchor, '')))
        / nullif(length(v_anchor), 0);

    if v_anchor_count <> 1 then
        raise exception
            'Expected exactly one literal regional-evidence call in Stage 03; found %.',
            v_anchor_count;
    end if;

    if position(
        'rpc_refresh_sku_regional_marketing_allocation_basis_snapshot'
        in v_definition
    ) > 0 then
        raise exception
            'Regional Marketing physical-basis writer is already integrated.';
    end if;

    execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;