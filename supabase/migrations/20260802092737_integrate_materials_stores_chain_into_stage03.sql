-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.rpc_refresh_manufacturing_cop_chain(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(
    refreshed_period_start date,
    inserted_row_count bigint,
    blocked_count bigint,
    review_required_count bigint,
    ready_count bigint,
    refresh_status text
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $$
declare
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_lock_key bigint;
    v_lock_acquired boolean := false;
    v_log_id bigint;
    v_result record;
begin
    if p_period_start is null then raise exception 'Costing period is required'; end if;
    if p_valuation_date is null then raise exception 'Valuation date is required'; end if;
    if p_refresh_run_id is null then raise exception 'Refresh run ID is required'; end if;

    select * into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;

    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date then
        raise exception 'Stage 03 context does not match refresh run %',p_refresh_run_id;
    end if;
    if v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Refresh run % is not based on captured valuation context',p_refresh_run_id;
    end if;

    v_lock_key:=hashtext('costing_stage03_'||p_refresh_run_id::text)::bigint;
    v_lock_acquired:=pg_try_advisory_lock(v_lock_key);
    if not v_lock_acquired then
        return query select v_period_start,0::bigint,0::bigint,0::bigint,0::bigint,'SKIPPED'::text;
        return;
    end if;

    insert into costing.costing_refresh_log(period_start,status,refresh_scope)
    values(v_period_start,'RUNNING','COST_BUILD_TO_SCHEME') returning id into v_log_id;

    begin
        perform * from costing.rpc_ensure_cost_period(v_period_start);
        perform * from costing.rpc_refresh_sku_sales_allocation_basis_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_marketing_signed_billed_sales_evidence_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_marketing_regional_sales_evidence_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_regional_marketing_allocation_basis_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_direct_labour_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_cost_pool_monthly_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        -- Canonical QC chain: effective-spec workload, Product monetary allocation, SKU conversion.
        perform * from costing.rpc_refresh_product_qc_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_qc_monetary_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        -- Canonical Materials / Stores chain: governed RM/PM workload and whole-pool monetary allocation.
        perform * from costing.rpc_refresh_materials_stores_workload_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_materials_stores_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        -- Combined overhead consumes canonical QC and Materials / Stores allocations.
        -- Production Overhead remains on its current provisional formula pending its own driver workstream.
        perform * from costing.rpc_refresh_sku_overhead_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        perform * from costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_marketing_expense_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_regional_marketing_expense_allocation_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_prime_cost_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_manufacturing_cop_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_internal_loaded_cost_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_pricing_bridge_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_selling_price_bridge_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_scheme_master_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);
        perform * from costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        select * into v_result
        from costing.rpc_refresh_sku_scheme_viability_snapshot(v_period_start,p_valuation_date,p_refresh_run_id);

        update costing.costing_refresh_log
        set status='SUCCESS',refresh_finished_at=now(),
            inserted_row_count=v_result.inserted_row_count,
            blocked_count=v_result.blocked_count,
            review_required_count=v_result.review_required_count,
            ready_count=v_result.ready_count
        where id=v_log_id;

        perform pg_advisory_unlock(v_lock_key);
        return query select v_result.refreshed_period_start,v_result.inserted_row_count,
                            v_result.blocked_count,v_result.review_required_count,
                            v_result.ready_count,'SUCCESS'::text;
        return;
    exception when others then
        update costing.costing_refresh_log
        set status='FAILED',refresh_finished_at=now(),error_message=sqlerrm
        where id=v_log_id;
        perform pg_advisory_unlock(v_lock_key);
        raise;
    end;
end;
$$;