-- SEC-A1 ROLLBACK — PREPARED ONLY, NOT APPLIED, NOT A MIGRATION.
-- Source captured from live costing routines 4 Nov 2026, project qhmoqtxpeasamtlxaoak.
-- Requires separate owner approval, preflight review, approved maintenance window and isolated authorization tests.
-- Do not execute directly from repository as part of a client merge/deploy. Server execution only via governed migration workflow.
-- Full function bodies preserved from pg_get_functiondef. Exactly one CCC edit-permission call added on apply.
-- Guarded by all three source MD5s; fail closed on any drift.

begin;
do $sec_a1_precheck$
begin
  if (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text,text,text,text)')) is distinct from '50712d2cbbf09b1be0764966d604f092' then
    raise exception 'SEC_A1_SOURCE_DRIFT: costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text,text,text,text) expected 50712d2cbbf09b1be0764966d604f092';
  end if;
  if (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text)')) is distinct from '326211fd5e811bdab52aa6ce421d56b7' then
    raise exception 'SEC_A1_SOURCE_DRIFT: costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text) expected 326211fd5e811bdab52aa6ce421d56b7';
  end if;
  if (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('costing.rpc_close_material_review_acceptance(bigint,text)')) is distinct from '32077cdd5599de73d7d8867211820f24' then
    raise exception 'SEC_A1_SOURCE_DRIFT: costing.rpc_close_material_review_acceptance(bigint,text) expected 32077cdd5599de73d7d8867211820f24';
  end if;
end;
$sec_a1_precheck$;

CREATE OR REPLACE FUNCTION costing.rpc_accept_material_review_action(p_period_start date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date, p_stock_item_id bigint DEFAULT NULL::bigint, p_material_area text DEFAULT NULL::text, p_action_severity text DEFAULT 'REVIEW_REQUIRED'::text, p_recommended_ui_route text DEFAULT NULL::text, p_issue_codes text DEFAULT NULL::text, p_warning_codes text DEFAULT NULL::text, p_action_required_summary text DEFAULT NULL::text, p_acceptance_reason text DEFAULT NULL::text, p_acceptance_note text DEFAULT NULL::text)
 RETURNS TABLE(acceptance_id bigint, period_start date, stock_item_id bigint, stock_item_name text, material_area text, action_severity text, recommended_ui_route text, issue_codes text, warning_codes text, action_required_summary text, acceptance_status text, accepted_by uuid, accepted_at timestamp with time zone, action_result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public'
AS $function$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_period_start date := coalesce(
    date_trunc('month', p_period_start)::date,
    date_trunc('month', current_date)::date
  );
  v_reason text := nullif(trim(coalesce(p_acceptance_reason, '')), '');
  v_note text := nullif(trim(coalesce(p_acceptance_note, '')), '');
  v_material_area text := nullif(trim(coalesce(p_material_area, '')), '');
  v_action_severity text := upper(trim(coalesce(p_action_severity, 'REVIEW_REQUIRED')));
  v_recommended_ui_route text := nullif(trim(coalesce(p_recommended_ui_route, '')), '');
  v_issue_codes text := nullif(trim(coalesce(p_issue_codes, '')), '');
  v_warning_codes text := nullif(trim(coalesce(p_warning_codes, '')), '');
  v_action_required_summary text := nullif(trim(coalesce(p_action_required_summary, '')), '');
  v_action record;
  v_acceptance_id bigint;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_stock_item_id is null then
    raise exception 'stock_item_id is required';
  end if;

  if v_material_area is null then
    raise exception 'material_area is required';
  end if;

  if v_recommended_ui_route is null then
    raise exception 'recommended_ui_route is required';
  end if;

  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Acceptance reason must be at least 5 characters';
  end if;

  if v_action_severity <> 'REVIEW_REQUIRED' then
    raise exception 'Only REVIEW_REQUIRED material actions can be accepted. Requested severity: %', v_action_severity;
  end if;

  if coalesce(v_issue_codes, '') ilike '%MISSING_REQUIRED_RM_RATE%'
     or coalesce(v_issue_codes, '') ilike '%MISSING_REQUIRED_PM_RATE%' then
    raise exception 'Hard blocker issue codes cannot be accepted as review: %', v_issue_codes;
  end if;

  select
    q.period_start,
    q.snapshot_refreshed_at,
    q.stock_item_id,
    q.stock_item_code,
    q.stock_item_name,
    q.material_area,
    q.action_severity,
    q.recommended_ui_route,
    q.bom_sources,
    q.material_line_statuses,
    q.issue_codes,
    q.warning_codes,
    q.action_required_summary,
    q.action_note_summary,
    q.affected_line_count,
    q.affected_product_count,
    q.affected_sku_count,
    q.approval_blocking_line_count,
    q.approval_blocking_sku_count,
    q.review_line_count,
    q.review_sku_count
  into v_action
  from costing.material_costing_action_queue_snapshot q
  where q.period_start = v_period_start
    and q.stock_item_id = p_stock_item_id
    and upper(q.material_area) = upper(v_material_area)
    and upper(q.action_severity) = 'REVIEW_REQUIRED'
    and upper(q.recommended_ui_route) = upper(v_recommended_ui_route)
    and coalesce(q.issue_codes, '') = coalesce(v_issue_codes, '')
    and coalesce(q.warning_codes, '') = coalesce(v_warning_codes, '')
    and coalesce(q.action_required_summary, '') = coalesce(v_action_required_summary, '')
  limit 1;

  if not found then
    raise exception 'Matching REVIEW_REQUIRED material action queue row was not found for this period/material/route/issue summary';
  end if;

  if coalesce(v_action.issue_codes, '') ilike '%MISSING_REQUIRED_RM_RATE%'
     or coalesce(v_action.issue_codes, '') ilike '%MISSING_REQUIRED_PM_RATE%' then
    raise exception 'Hard blocker issue codes cannot be accepted as review: %', v_action.issue_codes;
  end if;

  insert into costing.material_review_acceptance_register (
    period_start,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    material_area,
    material_issue_code,
    recommended_ui_route,
    action_severity,
    issue_codes,
    warning_codes,
    action_required_summary,
    action_note_summary,
    bom_sources,
    material_line_statuses,
    affected_line_count,
    affected_product_count,
    affected_sku_count,
    approval_blocking_line_count,
    approval_blocking_sku_count,
    review_line_count,
    review_sku_count,
    acceptance_scope,
    acceptance_status,
    accepted_by,
    accepted_at,
    effective_from,
    effective_to,
    source_snapshot_refreshed_at,
    acceptance_reason,
    acceptance_note,
    created_at,
    updated_at
  )
  values (
    v_period_start,
    v_action.stock_item_id,
    v_action.stock_item_code,
    v_action.stock_item_name,
    v_action.material_area,
    coalesce(v_action.issue_codes, 'REVIEW_REQUIRED'),
    v_action.recommended_ui_route,
    v_action.action_severity,
    v_action.issue_codes,
    v_action.warning_codes,
    v_action.action_required_summary,
    v_action.action_note_summary,
    v_action.bom_sources,
    v_action.material_line_statuses,
    v_action.affected_line_count,
    v_action.affected_product_count,
    v_action.affected_sku_count,
    v_action.approval_blocking_line_count,
    v_action.approval_blocking_sku_count,
    v_action.review_line_count,
    v_action.review_sku_count,
    'MATERIAL_ACTION',
    'ACTIVE',
    v_user_id,
    now(),
    v_period_start,
    null,
    v_action.snapshot_refreshed_at,
    v_reason,
    v_note,
    now(),
    now()
  )
  on conflict (
    period_start,
    stock_item_id,
    material_area,
    recommended_ui_route,
    coalesce(issue_codes, ''),
    coalesce(warning_codes, ''),
    coalesce(action_required_summary, '')
  )
  where acceptance_status = 'ACTIVE'
  do update set
    stock_item_code = excluded.stock_item_code,
    stock_item_name = excluded.stock_item_name,
    action_severity = excluded.action_severity,
    issue_codes = excluded.issue_codes,
    warning_codes = excluded.warning_codes,
    action_required_summary = excluded.action_required_summary,
    action_note_summary = excluded.action_note_summary,
    bom_sources = excluded.bom_sources,
    material_line_statuses = excluded.material_line_statuses,
    affected_line_count = excluded.affected_line_count,
    affected_product_count = excluded.affected_product_count,
    affected_sku_count = excluded.affected_sku_count,
    approval_blocking_line_count = excluded.approval_blocking_line_count,
    approval_blocking_sku_count = excluded.approval_blocking_sku_count,
    review_line_count = excluded.review_line_count,
    review_sku_count = excluded.review_sku_count,
    accepted_by = excluded.accepted_by,
    accepted_at = excluded.accepted_at,
    source_snapshot_refreshed_at = excluded.source_snapshot_refreshed_at,
    acceptance_reason = excluded.acceptance_reason,
    acceptance_note = excluded.acceptance_note,
    updated_at = now()
  returning material_review_acceptance_register.acceptance_id
  into v_acceptance_id;

  return query
  select
    r.acceptance_id,
    r.period_start,
    r.stock_item_id,
    r.stock_item_name,
    r.material_area,
    r.action_severity,
    r.recommended_ui_route,
    r.issue_codes,
    r.warning_codes,
    r.action_required_summary,
    r.acceptance_status,
    r.accepted_by,
    r.accepted_at,
    'ACCEPTED'::text as action_result
  from costing.material_review_acceptance_register r
  where r.acceptance_id = v_acceptance_id;
end;
$function$;

CREATE OR REPLACE FUNCTION costing.rpc_accept_material_review_action(p_period_start date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date, p_stock_item_id bigint DEFAULT NULL::bigint, p_material_area text DEFAULT NULL::text, p_material_issue_code text DEFAULT NULL::text, p_recommended_ui_route text DEFAULT NULL::text, p_acceptance_reason text DEFAULT NULL::text, p_acceptance_note text DEFAULT NULL::text)
 RETURNS TABLE(acceptance_id bigint, period_start date, stock_item_id bigint, stock_item_name text, material_area text, material_issue_code text, recommended_ui_route text, acceptance_status text, accepted_by uuid, accepted_at timestamp with time zone, action_result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_period_start date := coalesce(
    date_trunc('month', p_period_start)::date,
    date_trunc('month', current_date)::date
  );
  v_reason text := nullif(trim(coalesce(p_acceptance_reason, '')), '');
  v_note text := nullif(trim(coalesce(p_acceptance_note, '')), '');
  v_action record;
  v_acceptance_id bigint;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_stock_item_id is null then
    raise exception 'stock_item_id is required';
  end if;

  if nullif(trim(coalesce(p_material_area, '')), '') is null then
    raise exception 'material_area is required';
  end if;

  if nullif(trim(coalesce(p_material_issue_code, '')), '') is null then
    raise exception 'material_issue_code is required';
  end if;

  if nullif(trim(coalesce(p_recommended_ui_route, '')), '') is null then
    raise exception 'recommended_ui_route is required';
  end if;

  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Acceptance reason must be at least 5 characters';
  end if;

  if upper(trim(p_material_issue_code)) in (
    'MISSING_REQUIRED_RM_RATE',
    'MISSING_REQUIRED_PM_RATE'
  ) then
    raise exception 'Hard blocker issue % cannot be accepted as review', p_material_issue_code;
  end if;

  select
    q.period_start,
    q.stock_item_id,
    q.stock_item_code,
    q.stock_item_name,
    q.material_area,
    q.material_issue_code,
    q.action_severity,
    q.recommended_ui_route,
    q.snapshot_refreshed_at
  into v_action
  from costing.material_costing_action_queue_snapshot q
  where q.period_start = v_period_start
    and q.stock_item_id = p_stock_item_id
    and upper(q.material_area) = upper(trim(p_material_area))
    and upper(q.material_issue_code) = upper(trim(p_material_issue_code))
    and upper(q.recommended_ui_route) = upper(trim(p_recommended_ui_route))
  limit 1;

  if not found then
    raise exception 'Matching material action queue row was not found for this period/material/issue/route';
  end if;

  if upper(coalesce(v_action.action_severity, '')) <> 'REVIEW_REQUIRED' then
    raise exception 'Only REVIEW_REQUIRED material actions can be accepted. Current severity: %', v_action.action_severity;
  end if;

  insert into costing.material_review_acceptance_register (
    period_start,
    stock_item_id,
    stock_item_code,
    stock_item_name,
    material_area,
    material_issue_code,
    recommended_ui_route,
    acceptance_scope,
    acceptance_status,
    accepted_by,
    accepted_at,
    effective_from,
    effective_to,
    source_snapshot_refreshed_at,
    acceptance_reason,
    acceptance_note,
    created_at,
    updated_at
  )
  values (
    v_period_start,
    v_action.stock_item_id,
    v_action.stock_item_code,
    v_action.stock_item_name,
    v_action.material_area,
    v_action.material_issue_code,
    v_action.recommended_ui_route,
    'MATERIAL_ACTION',
    'ACTIVE',
    v_user_id,
    now(),
    v_period_start,
    null,
    v_action.snapshot_refreshed_at,
    v_reason,
    v_note,
    now(),
    now()
  )
  on conflict (
    period_start,
    stock_item_id,
    material_area,
    material_issue_code,
    recommended_ui_route
  )
  where acceptance_status = 'ACTIVE'
  do update set
    stock_item_code = excluded.stock_item_code,
    stock_item_name = excluded.stock_item_name,
    accepted_by = excluded.accepted_by,
    accepted_at = excluded.accepted_at,
    source_snapshot_refreshed_at = excluded.source_snapshot_refreshed_at,
    acceptance_reason = excluded.acceptance_reason,
    acceptance_note = excluded.acceptance_note,
    updated_at = now()
  returning material_review_acceptance_register.acceptance_id
  into v_acceptance_id;

  return query
  select
    r.acceptance_id,
    r.period_start,
    r.stock_item_id,
    r.stock_item_name,
    r.material_area,
    r.material_issue_code,
    r.recommended_ui_route,
    r.acceptance_status,
    r.accepted_by,
    r.accepted_at,
    'ACCEPTED'::text as action_result
  from costing.material_review_acceptance_register r
  where r.acceptance_id = v_acceptance_id;
end;
$function$;

CREATE OR REPLACE FUNCTION costing.rpc_close_material_review_acceptance(p_acceptance_id bigint, p_close_reason text DEFAULT NULL::text)
 RETURNS TABLE(acceptance_id bigint, period_start date, stock_item_id bigint, stock_item_name text, material_area text, action_severity text, recommended_ui_route text, issue_codes text, warning_codes text, action_required_summary text, acceptance_status text, closed_by uuid, closed_at timestamp with time zone, action_result text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public'
AS $function$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_close_reason text := nullif(trim(coalesce(p_close_reason, '')), '');
  v_row record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_acceptance_id is null then
    raise exception 'acceptance_id is required';
  end if;

  if v_close_reason is null or length(v_close_reason) < 5 then
    raise exception 'Close reason must be at least 5 characters';
  end if;

  select *
  into v_row
  from costing.material_review_acceptance_register r
  where r.acceptance_id = p_acceptance_id
  for update;

  if not found then
    raise exception 'Acceptance record % was not found', p_acceptance_id;
  end if;

  if v_row.acceptance_status <> 'ACTIVE' then
    raise exception 'Only ACTIVE acceptance records can be closed. Current status: %',
      v_row.acceptance_status;
  end if;

  update costing.material_review_acceptance_register r
  set
    acceptance_status = 'CLOSED',
    effective_to = current_date,
    acceptance_note = concat_ws(
      E'\n',
      nullif(r.acceptance_note, ''),
      concat(
        'Closed on ',
        now()::text,
        ' by ',
        v_user_id::text,
        '. Reason: ',
        v_close_reason
      )
    ),
    updated_at = now()
  where r.acceptance_id = p_acceptance_id;

  return query
  select
    r.acceptance_id,
    r.period_start,
    r.stock_item_id,
    r.stock_item_name,
    r.material_area,
    r.action_severity,
    r.recommended_ui_route,
    r.issue_codes,
    r.warning_codes,
    r.action_required_summary,
    r.acceptance_status,
    v_user_id as closed_by,
    now() as closed_at,
    'CLOSED'::text as action_result
  from costing.material_review_acceptance_register r
  where r.acceptance_id = p_acceptance_id;
end;
$function$;

do $sec_a1_postcheck$
begin
  if (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text,text,text,text)')) is distinct from '23d406a822ceb748f1ee272a48c2c589' then
    raise exception 'SEC_A1_SOURCE_DRIFT: costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text,text,text,text) expected 23d406a822ceb748f1ee272a48c2c589';
  end if;
  if (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text)')) is distinct from 'c2801c07767c615a1e46ca94b408cb0c' then
    raise exception 'SEC_A1_SOURCE_DRIFT: costing.rpc_accept_material_review_action(date,bigint,text,text,text,text,text) expected c2801c07767c615a1e46ca94b408cb0c';
  end if;
  if (select md5(p.prosrc) from pg_proc p where p.oid = to_regprocedure('costing.rpc_close_material_review_acceptance(bigint,text)')) is distinct from 'a6b13f1c7b6a2b2ca04cb295f54ee03d' then
    raise exception 'SEC_A1_SOURCE_DRIFT: costing.rpc_close_material_review_acceptance(bigint,text) expected a6b13f1c7b6a2b2ca04cb295f54ee03d';
  end if;
end;
$sec_a1_postcheck$;
commit;
