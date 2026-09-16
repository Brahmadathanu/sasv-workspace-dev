do $$
begin
  if exists (select 1 from cron.job where jobid in (60,61) and active) then
    raise exception 'S2A precondition failed: costing cron jobs 60/61 must remain inactive during hardening';
  end if;
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('QUEUED','RUNNING')) then
    raise exception 'S2A precondition failed: no costing refresh run may be QUEUED/RUNNING during hardening';
  end if;
  if not exists (
    select 1 from costing.costing_refresh_run
    where id=108
      and overall_status='SUCCESS'
      and final_blocked_count=0
      and final_review_required_count=0
      and final_ready_count=672
      and valuation_date=date '2026-09-10'
      and valuation_context_source='CAPTURED_AT_REQUEST'
  ) then
    raise exception 'S2A precondition failed: immutable Run108 baseline is not in the expected state';
  end if;
  if has_function_privilege('authenticated','costing.fn_process_next_costing_refresh_stage_internal(bigint)','EXECUTE') then
    raise exception 'S2A precondition failed: canonical internal stage processor must already be owner-only';
  end if;
  if has_function_privilege('authenticated','costing.rpc_refresh_manufacturing_cop_chain(date,date,bigint)','EXECUTE') then
    raise exception 'S2A precondition failed: canonical Stage03 chain must already be owner-only';
  end if;
end $$;

create or replace function costing.rpc_accept_internal_source_material_review_action(
    p_period_start date,
    p_stock_item_id bigint,
    p_issue_codes text,
    p_warning_codes text,
    p_action_required_summary text,
    p_acceptance_reason text,
    p_acceptance_note text default null::text
)
returns table(
    acceptance_id bigint,
    period_start date,
    stock_item_id bigint,
    stock_item_name text,
    acceptance_status text,
    accepted_by uuid,
    accepted_at timestamptz,
    action_result text
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
#variable_conflict use_column
declare
    v_user_id uuid:=auth.uid();
    v_period_start date:=date_trunc('month',p_period_start)::date;
    v_reason text:=nullif(trim(coalesce(p_acceptance_reason,'')),'');
    v_note text:=nullif(trim(coalesce(p_acceptance_note,'')),'');
    v_action record;
    v_acceptance_id bigint;
begin
    if v_user_id is null then raise exception 'Not authenticated'; end if;
    perform public.require_permission('module:costing-control-center',true);
    if p_stock_item_id is null then raise exception 'stock_item_id is required'; end if;
    if v_reason is null or length(v_reason)<5 then raise exception 'Acceptance reason must be at least 5 characters'; end if;

    select s.* into v_action
    from costing.internal_source_material_review_queue_snapshot s
    where s.period_start=v_period_start
      and s.stock_item_id=p_stock_item_id
      and coalesce(s.issue_codes,'')=coalesce(p_issue_codes,'')
      and coalesce(s.warning_codes,'')=coalesce(p_warning_codes,'')
      and coalesce(s.action_required_summary,'')=coalesce(p_action_required_summary,'')
      and s.action_severity='REVIEW_REQUIRED'
    order by s.snapshot_refreshed_at desc
    limit 1;
    if not found then raise exception 'Matching internal-source material review action was not found'; end if;

    insert into costing.material_review_acceptance_register(
        period_start,stock_item_id,stock_item_code,stock_item_name,material_area,material_issue_code,recommended_ui_route,
        action_severity,issue_codes,warning_codes,action_required_summary,action_note_summary,bom_sources,material_line_statuses,
        affected_line_count,affected_product_count,affected_sku_count,approval_blocking_line_count,approval_blocking_sku_count,
        review_line_count,review_sku_count,acceptance_scope,acceptance_status,accepted_by,accepted_at,effective_from,effective_to,
        source_snapshot_refreshed_at,acceptance_reason,acceptance_note,created_at,updated_at
    ) values (
        v_period_start,v_action.stock_item_id,v_action.stock_item_code,v_action.stock_item_name,'RM',v_action.issue_codes,'MATERIAL_RATE_REVIEW',
        'REVIEW_REQUIRED',v_action.issue_codes,v_action.warning_codes,v_action.action_required_summary,v_action.action_note_summary,
        'INTERNAL_SOURCE_RM','REVIEW_REQUIRED',v_action.affected_root_lineage_count,v_action.affected_source_product_count,0,0,0,
        v_action.affected_root_lineage_count,0,'MATERIAL_ACTION','ACTIVE',v_user_id,now(),v_period_start,null,
        v_action.snapshot_refreshed_at,v_reason,v_note,now(),now()
    )
    on conflict (
        period_start,stock_item_id,material_area,recommended_ui_route,
        coalesce(issue_codes,''),coalesce(warning_codes,''),coalesce(action_required_summary,'')
    ) where acceptance_status='ACTIVE'
    do update set
        stock_item_code=excluded.stock_item_code,
        stock_item_name=excluded.stock_item_name,
        accepted_by=excluded.accepted_by,
        accepted_at=excluded.accepted_at,
        source_snapshot_refreshed_at=excluded.source_snapshot_refreshed_at,
        acceptance_reason=excluded.acceptance_reason,
        acceptance_note=excluded.acceptance_note,
        updated_at=now()
    returning material_review_acceptance_register.acceptance_id into v_acceptance_id;

    return query
    select r.acceptance_id,r.period_start,r.stock_item_id,r.stock_item_name,r.acceptance_status,r.accepted_by,r.accepted_at,'ACCEPTED'::text
    from costing.material_review_acceptance_register r where r.acceptance_id=v_acceptance_id;
end;
$function$;

revoke all on function costing.rpc_accept_internal_source_material_review_action(date,bigint,text,text,text,text,text) from public,anon,service_role;
grant execute on function costing.rpc_accept_internal_source_material_review_action(date,bigint,text,text,text,text,text) to authenticated,postgres;
comment on function costing.rpc_accept_internal_source_material_review_action(date,bigint,text,text,text,text,text) is
'Governed client-facing acceptance action for internal-source material review evidence. Requires module:costing-control-center edit permission.';

revoke all on function costing.fn_reprice_regional_marketing_after_insert() from public,anon,authenticated,service_role;
grant execute on function costing.fn_reprice_regional_marketing_after_insert() to postgres;
comment on function costing.fn_reprice_regional_marketing_after_insert() is
'Internal trigger function for regional Marketing repricing. Direct application execution is prohibited.';

revoke all on function costing.rpc_refresh_internal_source_material_review_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_internal_source_material_review_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_internal_material_conversion_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_internal_material_conversion_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_direct_labour_allocation_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_direct_labour_allocation_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_direct_labour_legacy_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_direct_labour_legacy_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_prime_cost_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_prime_cost_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_sku_internal_loaded_cost_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_sku_internal_loaded_cost_snapshot(date,date,bigint) to postgres;

revoke all on function costing.rpc_refresh_scheme_master_context_snapshot(date,date,bigint) from public,anon,authenticated,service_role;
grant execute on function costing.rpc_refresh_scheme_master_context_snapshot(date,date,bigint) to postgres;

comment on function costing.rpc_refresh_internal_source_material_review_snapshot(date,date,bigint) is 'Internal exact-run control-maintenance writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_internal_material_conversion_snapshot(date,date,bigint) is 'Internal exact-run Prime Cost child writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date,date,bigint) is 'Internal exact-run Stage03 writer. Direct application execution is prohibited; use the governed refresh request/stage processor.';
comment on function costing.rpc_refresh_sku_direct_labour_allocation_snapshot(date,date,bigint) is 'Internal exact-run Stage03 Direct Labour writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(date,date,bigint) is 'Internal exact-run Direct Labour component writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_direct_labour_legacy_snapshot(date,date,bigint) is 'Internal exact-run Direct Labour legacy comparison writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(date,date,bigint) is 'Internal exact-run Stage03 Admin/Finance writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_prime_cost_snapshot(date,date,bigint) is 'Internal exact-run Stage03 Prime Cost writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_sku_internal_loaded_cost_snapshot(date,date,bigint) is 'Internal exact-run Stage03 Internal Loaded Cost writer. Direct application execution is prohibited.';
comment on function costing.rpc_refresh_scheme_master_context_snapshot(date,date,bigint) is 'Internal exact-run Stage03 scheme-master context writer. Direct application execution is prohibited.';

comment on function costing.rpc_refresh_sku_sales_allocation_basis_snapshot(date) is 'DEPRECATED fail-closed compatibility overload. Explicit period_start, valuation_date and refresh_run_id are required by the canonical writer.';
comment on function costing.rpc_refresh_sku_direct_labour_allocation_snapshot(date) is 'DEPRECATED fail-closed compatibility overload. Explicit period_start, valuation_date and refresh_run_id are required by the canonical writer.';
comment on function costing.rpc_refresh_sku_admin_finance_overhead_allocation_snapshot(date) is 'DEPRECATED fail-closed compatibility overload. Explicit period_start, valuation_date and refresh_run_id are required by the canonical writer.';
comment on function costing.rpc_refresh_sku_prime_cost_snapshot(date) is 'DEPRECATED fail-closed compatibility overload. Explicit period_start, valuation_date and refresh_run_id are required by the canonical writer.';
comment on function costing.rpc_refresh_sku_internal_loaded_cost_snapshot(date) is 'DEPRECATED fail-closed compatibility overload. Explicit period_start, valuation_date and refresh_run_id are required by the canonical writer.';