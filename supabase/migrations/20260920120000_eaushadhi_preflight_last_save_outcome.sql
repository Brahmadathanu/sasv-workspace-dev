-- Sync already-applied live server delta: expose durable save-outcome markers
-- on the single preflight active_run object for post-restart recovery visibility.
-- No table DDL. No Start/Resume eligibility change.
-- Does not expose bounded save-evidence blobs on active_run.

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
    v_active_run := jsonb_build_object(
      'run_id', v_run.run_id,
      'run_status', v_run.run_status,
      'start_content_hash', v_run.start_content_hash,
      'start_payload_hash', v_run.start_payload_hash,
      'current_workflow_row_version', v_run.current_workflow_row_version,
      'portal_product_ref', v_run.portal_product_ref,
      'started_at', v_run.started_at,
      'last_save_outcome', v_run.last_save_outcome,
      'last_save_observed_at', v_run.last_save_observed_at
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
