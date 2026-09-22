-- Adopt portal identity after AMBIGUOUS Save when blank-list EXACT_ONE proves hid*.
-- Does not weaken rpc_eaushadhi_worker_mark_entered.
-- Idempotent create-or-replace.

begin;

create or replace function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(
  p_run_id uuid,
  p_expected_workflow_row_version bigint,
  p_expected_content_hash text,
  p_portal_product_ref text,
  p_recovery_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'extensions', 'auth', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_now timestamptz := now();
  v_portal_ref text;
  v_source text;
  v_duplicate_outcome text;
  v_coverage_complete boolean;
  v_exact_match_count integer;
  v_evidence_portal_ref text;
  v_reread_source text;
  v_reread_id_match boolean;
  v_compare_equal boolean;
  v_compare_report jsonb;
  v_items jsonb;
  v_item jsonb;
  v_all_match boolean := true;
  v_current_hash text;
  v_payload jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  if jsonb_typeof(p_recovery_evidence) <> 'object' then
    raise exception using errcode = '22023',
      message = 'Recovery evidence object is required';
  end if;

  v_portal_ref := nullif(btrim(coalesce(p_portal_product_ref, '')), '');
  if v_portal_ref is null
     or v_portal_ref in ('0', '-1', '262') then
    raise exception using errcode = '22023',
      message = 'Adoption requires a valid portal product ref distinct from Product 262';
  end if;

  v_source := coalesce(p_recovery_evidence->>'source', '');
  v_duplicate_outcome := upper(coalesce(p_recovery_evidence->>'duplicate_outcome', ''));
  v_coverage_complete := coalesce((p_recovery_evidence->>'coverage_complete')::boolean, false);
  v_exact_match_count := coalesce((p_recovery_evidence->>'exact_match_count')::integer, 0);
  v_evidence_portal_ref := nullif(btrim(coalesce(p_recovery_evidence->>'portal_product_ref', '')), '');
  v_reread_source := coalesce(p_recovery_evidence->>'reread_source', '');
  v_reread_id_match := coalesce((p_recovery_evidence->>'reread_id_match')::boolean, false);
  v_compare_equal := coalesce((p_recovery_evidence->>'compare_equal')::boolean, false);
  v_compare_report := coalesce(p_recovery_evidence->'compare_report', '{}'::jsonb);

  if v_source <> 'LoadProductDataforLegacy'
     or v_duplicate_outcome <> 'EXACT_ONE'
     or v_coverage_complete is not true
     or v_exact_match_count <> 1
     or v_evidence_portal_ref is distinct from v_portal_ref
     or v_reread_source <> 'GetproductDataUpdate'
     or v_reread_id_match is not true
     or v_compare_equal is not true then
    raise exception using errcode = '22023',
      message = 'Adoption requires coverage-complete EXACT_ONE recovery evidence with matching reread and compare';
  end if;

  if coalesce((v_compare_report->>'equal')::boolean, false) is not true then
    raise exception using errcode = '22023',
      message = 'Adoption compare report must be equal=true';
  end if;

  v_items := coalesce(v_compare_report->'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception using errcode = '22023',
      message = 'Adoption compare report items are required';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if upper(coalesce(v_item->>'result', '')) <> 'MATCH' then
      v_all_match := false;
      exit;
    end if;
  end loop;
  if v_all_match is not true then
    raise exception using errcode = '22023',
      message = 'Adoption requires every compare item to be MATCH';
  end if;

  select * into v_run
  from regulatory.eaushadhi_worker_run
  where run_id = p_run_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Worker run not found';
  end if;
  if v_run.product_id <> 262 then
    raise exception using errcode = '42501',
      message = 'Ambiguous-save identity adoption is restricted to Product 262 during the controlled pilot';
  end if;
  if v_run.run_status <> 'RUNNING'
     or v_run.portal_product_ref is not null
     or v_run.entered_at is not null then
    raise exception using errcode = '55000',
      message = 'Only an unentered RUNNING worker run can adopt an ambiguous-save portal identity';
  end if;
  if v_run.last_save_outcome is distinct from 'AMBIGUOUS'
     or v_run.last_save_observed_at is null then
    raise exception using errcode = '55000',
      message = 'Adoption requires server-recorded SAVE_AMBIGUOUS on the same run';
  end if;
  if p_expected_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode = '40001',
      message = 'Adoption content hash does not match run authority';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id = v_run.product_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Workflow row not found';
  end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode = '40001', message = 'Stale workflow row version';
  end if;
  if v_workflow.entry_status <> 'IN_PROGRESS'
     or v_workflow.portal_product_ref is not null
     or v_workflow.entered_at is not null then
    raise exception using errcode = '55000',
      message = 'Workflow is not eligible for ambiguous-save identity adoption';
  end if;

  -- Fresh governed content hash (never assign current hash from start_content_hash alone).
  v_payload := public.rpc_eaushadhi_worker_content_get(
    v_run.product_id,
    v_workflow.row_version
  );
  v_current_hash := v_payload->>'content_hash';
  if v_current_hash is null
     or v_current_hash is distinct from v_run.start_content_hash
     or v_current_hash is distinct from p_expected_content_hash then
    raise exception using errcode = '40001',
      message = 'Adoption refused: fresh governed content hash does not match run start and expected hash';
  end if;

  update regulatory.eaushadhi_worker_run
  set run_status = 'ENTERED',
      portal_product_ref = v_portal_ref,
      current_workflow_row_version = v_workflow.row_version + 1,
      entered_by = v_actor,
      entered_at = v_now,
      updated_at = v_now
      -- Retain historical last_save_outcome = AMBIGUOUS intentionally.
  where run_id = p_run_id;

  update regulatory.eaushadhi_product_workflow
  set entry_status = 'ENTERED',
      portal_product_ref = v_portal_ref,
      entered_by = v_actor,
      entered_at = v_now,
      updated_by = v_actor,
      updated_at = v_now,
      row_version = v_workflow.row_version + 1
  where product_id = v_run.product_id;

  insert into regulatory.audit_event(
    entity_schema, entity_table, entity_key, action,
    old_data, new_data, actor_user_id, application_name, occurred_at
  )
  values(
    'regulatory', 'eaushadhi_worker_run', p_run_id::text, 'UPDATE',
    jsonb_build_object(
      'event_kind', 'ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY',
      'run_status', v_run.run_status,
      'portal_product_ref', v_run.portal_product_ref,
      'last_save_outcome', v_run.last_save_outcome
    ),
    jsonb_build_object(
      'event_kind', 'ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY',
      'run_status', 'ENTERED',
      'portal_product_ref', v_portal_ref,
      'last_save_outcome', 'AMBIGUOUS',
      'recovery_evidence', p_recovery_evidence,
      'current_workflow_row_version', v_workflow.row_version + 1,
      'content_hash', v_current_hash
    ),
    v_actor, 'e-aushadhi-automation', v_now
  );

  return jsonb_build_object(
    'run_id', p_run_id,
    'product_id', v_run.product_id,
    'run_status', 'ENTERED',
    'entry_status', 'ENTERED',
    'portal_product_ref', v_portal_ref,
    'workflow_row_version', v_workflow.row_version + 1,
    'content_hash', v_current_hash,
    'last_save_outcome', 'AMBIGUOUS'
  );
end;
$function$;

revoke all on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid, bigint, text, text, jsonb)
  from public;
grant execute on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid, bigint, text, text, jsonb)
  to authenticated, service_role;

-- Bounded ambiguous-save proof on preflight active_run (not the full evidence blob).
-- Recovery attachment eligibility uses these category fields plus current V01 resolution.
CREATE OR REPLACE FUNCTION public.rpc_eaushadhi_worker_preflight(p_product_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'regulatory', 'pg_temp'
AS $function$
declare
  v_ready regulatory.v_eaushadhi_product_readiness%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_reasons text[] := array[]::text[];
  v_eligible boolean := false;
  v_has_readiness boolean := false;
  v_active_run_count integer := 0;
  v_active_run jsonb := null;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_ev jsonb;
begin
  perform public.rpc_eaushadhi_require_permission(true);
  if p_product_id is null or p_product_id <= 0 then
    raise exception using errcode='22023',message='p_product_id must be a positive integer';
  end if;
  select * into v_workflow from regulatory.eaushadhi_product_workflow w where w.product_id=p_product_id;
  if not found then raise exception using errcode='P0002',message='e-Aushadhi product workflow not found'; end if;
  select * into v_ready from regulatory.v_eaushadhi_product_readiness r where r.product_id=p_product_id;
  v_has_readiness := found;
  if not v_has_readiness then
    v_reasons := array_append(v_reasons,'Readiness row is missing');
  else
    if coalesce(v_ready.is_ready_for_entry,false) is not true then v_reasons := array_append(v_reasons,'Product is not ready for portal entry'); end if;
    if coalesce(v_ready.composition_review_complete,false) is not true then v_reasons := array_append(v_reasons,'Composition review is incomplete'); end if;
    if coalesce(v_ready.classification_review_complete,false) is not true then v_reasons := array_append(v_reasons,'Portal product classification review is incomplete'); end if;
    if coalesce(v_ready.dossier_ready,false) is not true then v_reasons := array_append(v_reasons,'Dossier is not ready'); end if;
    if coalesce(v_ready.open_blockers,0)>0 then v_reasons := array_append(v_reasons,format('Open blockers: %s',v_ready.open_blockers)); end if;
    if coalesce(v_ready.open_portal_issues,0)>0 then v_reasons := array_append(v_reasons,format('Open portal issues: %s',v_ready.open_portal_issues)); end if;
  end if;
  if coalesce(v_workflow.entry_status,'NOT_STARTED') is distinct from 'NOT_STARTED' then
    v_reasons := array_append(v_reasons,format('ENTRY_STATUS_NOT_STARTABLE: %s',coalesce(v_workflow.entry_status,'NOT_STARTED')));
  end if;

  select count(*)::integer into v_active_run_count
  from regulatory.eaushadhi_worker_run wr
  where wr.product_id = p_product_id
    and wr.run_status in ('RUNNING', 'ENTERED');

  if v_active_run_count = 1 then
    select * into v_run
    from regulatory.eaushadhi_worker_run wr
    where wr.product_id = p_product_id
      and wr.run_status in ('RUNNING', 'ENTERED');
    v_ev := coalesce(v_run.last_save_evidence, '{}'::jsonb);
    v_active_run := jsonb_build_object(
      'run_id', v_run.run_id,
      'run_status', v_run.run_status,
      'start_content_hash', v_run.start_content_hash,
      'start_payload_hash', v_run.start_payload_hash,
      'current_workflow_row_version', v_run.current_workflow_row_version,
      'portal_product_ref', v_run.portal_product_ref,
      'started_at', v_run.started_at,
      'last_save_outcome', v_run.last_save_outcome,
      'last_save_observed_at', v_run.last_save_observed_at,
      -- Bounded category fields only — never the full last_save_evidence blob.
      'last_save_evidence_outcome', v_ev->>'outcome',
      'last_save_invoked', case when jsonb_typeof(v_ev->'invoked') = 'boolean' then (v_ev->>'invoked')::boolean else null end,
      'last_save_invoke_count', case when (v_ev->>'invokeCount') ~ '^[0-9]+$' then (v_ev->>'invokeCount')::integer else null end,
      'last_save_settled', case when jsonb_typeof(v_ev->'settled') = 'boolean' then (v_ev->>'settled')::boolean else null end,
      'last_save_business_success', case when jsonb_typeof(v_ev->'businessSuccess') = 'boolean' then (v_ev->>'businessSuccess')::boolean else null end,
      'last_save_phase', v_ev->>'phase'
    );
  elsif v_active_run_count > 1 then
    v_active_run := null;
    v_reasons := array_append(v_reasons, 'ACTIVE_RUN_AMBIGUOUS');
  else
    v_active_run := null;
  end if;

  -- Ordinary Start eligibility unchanged: NOT_STARTED only.
  v_eligible := v_has_readiness and coalesce(v_ready.is_ready_for_entry,false) is true and coalesce(v_workflow.entry_status,'NOT_STARTED')='NOT_STARTED';
  return jsonb_build_object(
    'product_id',p_product_id,
    'eligible',v_eligible,
    'reasons',to_jsonb(v_reasons),
    'is_ready_for_entry',coalesce(v_ready.is_ready_for_entry,false),
    'review_status',coalesce(v_ready.review_status,v_workflow.review_status),
    'entry_status',v_workflow.entry_status,
    'composition_lines',v_ready.composition_lines,
    'verified_lines',v_ready.verified_lines,
    'pending_lines',v_ready.pending_lines,
    'open_blockers',v_ready.open_blockers,
    'open_portal_issues',v_ready.open_portal_issues,
    'dossier_ready',v_ready.dossier_ready,
    'composition_review_complete',v_ready.composition_review_complete,
    'classification_review_complete',v_ready.classification_review_complete,
    'classification_review_status',v_ready.classification_review_status,
    'workflow_row_version',v_workflow.row_version,
    'portal_product_ref',v_workflow.portal_product_ref,
    'active_run_count',v_active_run_count,
    'active_run',v_active_run
  );
end;
$function$;

commit;
