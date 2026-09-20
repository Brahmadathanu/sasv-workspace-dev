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

  -- Current content hash must equal run.start_content_hash and the expected arg.
  v_current_hash := v_run.start_content_hash;
  if v_current_hash is distinct from p_expected_content_hash then
    raise exception using errcode = '40001',
      message = 'Adoption refused: current content hash drift';
  end if;

  update regulatory.eaushadhi_worker_run
  set run_status = 'ENTERED',
      portal_product_ref = v_portal_ref,
      entered_at = v_now,
      updated_at = v_now
      -- Retain historical last_save_outcome = AMBIGUOUS intentionally.
  where run_id = p_run_id;

  update regulatory.eaushadhi_product_workflow
  set entry_status = 'ENTERED',
      portal_product_ref = v_portal_ref,
      entered_at = v_now,
      row_version = v_workflow.row_version + 1,
      updated_at = v_now
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
      'recovery_evidence', p_recovery_evidence
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
    'content_hash', v_run.start_content_hash,
    'last_save_outcome', 'AMBIGUOUS'
  );
end;
$function$;

revoke all on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid, bigint, text, text, jsonb)
  from public;
grant execute on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid, bigint, text, text, jsonb)
  to authenticated, service_role;

commit;
