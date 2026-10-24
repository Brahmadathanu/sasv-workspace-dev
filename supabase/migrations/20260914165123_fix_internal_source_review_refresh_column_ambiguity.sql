-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.rpc_refresh_internal_source_material_review_snapshot(
    p_period_start date,
    p_valuation_date date,
    p_refresh_run_id bigint
)
returns table(refreshed_period_start date, valuation_date date, refresh_run_id bigint, inserted_row_count bigint, refresh_status text)
language plpgsql
security definer
set search_path='costing','public','pg_temp'
as $function$
#variable_conflict use_column
declare
    v_period_start date := date_trunc('month',p_period_start)::date;
    v_run costing.costing_refresh_run%rowtype;
    v_refreshed_at timestamptz := clock_timestamp();
    v_rows bigint := 0;
begin
    if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
        raise exception 'period_start, valuation_date and refresh_run_id are required';
    end if;

    select r.* into v_run from costing.costing_refresh_run r where r.id=p_refresh_run_id;
    if not found then raise exception 'Costing refresh run % does not exist',p_refresh_run_id; end if;
    if v_run.period_start is distinct from v_period_start
       or v_run.valuation_date is distinct from p_valuation_date
       or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
        raise exception 'Internal-source material review context does not match refresh run %',p_refresh_run_id;
    end if;

    perform pg_advisory_xact_lock(hashtext('internal_source_material_review|'||p_refresh_run_id::text)::bigint);

    delete from costing.internal_source_material_review_queue_snapshot s
    where s.period_start=v_period_start
      and s.valuation_date=p_valuation_date
      and s.refresh_run_id=p_refresh_run_id;

    insert into costing.internal_source_material_review_queue_snapshot(
        period_start,valuation_date,refresh_run_id,snapshot_refreshed_at,
        stock_item_id,stock_item_code,stock_item_name,material_area,action_severity,recommended_ui_route,
        issue_codes,warning_codes,action_required_summary,action_note_summary,
        selected_rate,rate_source,rate_date,selected_manual_rate_id,selected_purchase_fact_id,selected_stock_valuation_source,
        source_evidence_fingerprint,source_product_ids,root_lineage_ids,root_consume_stock_item_ids,
        affected_source_product_count,affected_root_lineage_count
    )
    select
        v_period_start,p_valuation_date,p_refresh_run_id,v_refreshed_at,
        a.stock_item_id,a.stock_item_code,a.stock_item_name,a.material_area,a.action_severity,a.recommended_ui_route,
        a.issue_codes,a.warning_codes,a.action_required_summary,a.action_note_summary,
        a.selected_rate,a.rate_source,a.rate_date,a.selected_manual_rate_id,a.selected_purchase_fact_id,a.selected_stock_valuation_source,
        a.source_evidence_fingerprint,a.source_product_ids,a.root_lineage_ids,a.root_consume_stock_item_ids,
        a.affected_source_product_count,a.affected_root_lineage_count
    from costing.fn_build_internal_source_material_review_actions_as_of(v_period_start,p_valuation_date) a;

    get diagnostics v_rows=row_count;
    return query select v_period_start,p_valuation_date,p_refresh_run_id,v_rows,'SUCCESS'::text;
end;
$function$;