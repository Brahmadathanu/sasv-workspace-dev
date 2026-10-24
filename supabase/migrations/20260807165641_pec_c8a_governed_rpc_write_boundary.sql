-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $do$
declare
  r record;
  v_internal text;
  v_call_args text;
  v_args text;
  v_result text;
  v_body text;
  v_need_edit boolean;
begin
  for r in
    with targets(name, need_edit) as (values
      ('create_pr_from_mrp_plan', true),
      ('proc_pr_rebuild_from_mrp', true),
      ('proc_pr_add_line', true),
      ('proc_pr_set_manual_delta', true),
      ('proc_pr_set_manual_reason', true),
      ('proc_pr_set_status', true),
      ('proc_pr_delete_draft', true),
      ('proc_pr_create_revision_from_active', true),
      ('proc_indent_create', true),
      ('proc_indent_create_from_pr', true),
      ('proc_indent_add_line', true),
      ('proc_indent_set_source_pr', true),
      ('proc_indent_resync_from_pr', true),
      ('proc_indent_set_status', true),
      ('proc_indent_issue', true),
      ('proc_indent_close_strict', true),
      ('proc_indent_close_with_override', true),
      ('proc_indent_delete_draft', true),
      ('proc_indent_recommend_and_accept_vendors_step', true),
      ('proc_indent_recommend_vendor', true),
      ('proc_indent_set_vendor_selection', true),
      ('proc_indent_clear_vendor_assignment', true),
      ('proc_apply_vendor_to_same_item_lines', true),
      ('proc_clear_vendor_assignment_for_same_item_lines', true),
      ('proc_indent_accept_excess', true),
      ('proc_request_snapshot_refresh', true),
      ('proc_get_snapshot_refresh_status', false),
      ('proc_preview_same_item_vendor_action', false),
      ('proc_procurement_action_queue_paged', false),
      ('proc_vendorwise_buylist_filtered', false),
      ('proc_vendorwise_buylist_split_items', false)
    )
    select p.oid, p.proname, t.need_edit, p.proretset,
           pg_get_function_identity_arguments(p.oid) identity_args,
           pg_get_function_arguments(p.oid) full_args,
           pg_get_function_result(p.oid) result_type,
           p.proargnames,
           p.pronargs
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    join targets t on t.name=p.proname
    where n.nspname='public' and p.prokind='f'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_internal := r.proname || '_pec_internal';
    if exists (
      select 1 from pg_proc p2 join pg_namespace n2 on n2.oid=p2.pronamespace
      where n2.nspname='public' and p2.proname=v_internal
        and pg_get_function_identity_arguments(p2.oid)=r.identity_args
    ) then
      raise exception 'Internal function already exists: %(%)', v_internal, r.identity_args;
    end if;

    select string_agg(format('%I', x.name), ', ' order by x.ord)
    into v_call_args
    from unnest(r.proargnames[1:r.pronargs]) with ordinality as x(name,ord);
    v_call_args := coalesce(v_call_args,'');
    v_args := r.full_args;
    v_result := r.result_type;
    v_need_edit := r.need_edit;

    execute format('alter function public.%I(%s) rename to %I', r.proname, r.identity_args, v_internal);

    if v_result = 'void' then
      v_body := format($f$
        begin
          perform public.require_permission('module:procurement-execution-console', %L);
          perform public.%I(%s);
          return;
        end
      $f$, v_need_edit, v_internal, v_call_args);
    elsif r.proretset then
      v_body := format($f$
        begin
          perform public.require_permission('module:procurement-execution-console', %L);
          return query select * from public.%I(%s);
        end
      $f$, v_need_edit, v_internal, v_call_args);
    else
      v_body := format($f$
        begin
          perform public.require_permission('module:procurement-execution-console', %L);
          return public.%I(%s);
        end
      $f$, v_need_edit, v_internal, v_call_args);
    end if;

    execute format(
      'create function public.%I(%s) returns %s language plpgsql security definer set search_path to ''public'' as %L',
      r.proname, v_args, v_result, v_body
    );

    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.identity_args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.identity_args);

    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', v_internal, r.identity_args);
  end loop;
end
$do$;

-- The stage processor is server-owned canonically, but the current PEC manual-refresh
-- loop still invokes it. Block anonymous/PUBLIC access now; retain authenticated only
-- as a temporary compatibility grant until the client polling cutover.
revoke execute on function public.proc_process_snapshot_refresh_next_stage() from public, anon;
grant execute on function public.proc_process_snapshot_refresh_next_stage() to authenticated, service_role;

-- Generic vendor lookup is shared beyond PEC; preserve authenticated use but remove anon/PUBLIC.
revoke execute on function public.proc_vendor_lookup(text, boolean, text, integer) from public, anon;
grant execute on function public.proc_vendor_lookup(text, boolean, text, integer) to authenticated, service_role;

-- PEC performs no direct proc_* mutations. Remove browser DML while retaining SELECT
-- compatibility for current direct-read views/PDF enrichment.
revoke insert, update, delete, truncate, references, trigger on table
  public.proc_pr_header,
  public.proc_pr_line,
  public.proc_indent_header,
  public.proc_indent_line,
  public.proc_indent_line_sourcing_decision,
  public.proc_indent_priority_override,
  public.proc_indent_excess_acceptance,
  public.proc_snapshot_refresh_run,
  public.proc_snapshot_refresh_run_stage,
  public.proc_snapshot_refresh_log,
  public.proc_vendor_item_candidate_snapshot,
  public.proc_indent_line_balance_snapshot,
  public.proc_indent_line_priority_snapshot,
  public.proc_vendor_item_candidate_generation,
  public.proc_indent_line_balance_generation,
  public.proc_indent_line_priority_generation
from anon, authenticated;
