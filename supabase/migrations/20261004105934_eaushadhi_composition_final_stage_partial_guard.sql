create or replace function public.rpc_eaushadhi_composition_stage_mark_portal_verified(
  p_product_id integer,
  p_expected_stage_row_version bigint,
  p_expected_workflow_row_version bigint,
  p_expected_content_hash text,
  p_final_list_evidence jsonb,
  p_planner_report jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','regulatory','extensions','pg_temp'
as $function$
declare
  v_actor uuid;
  v_stage regulatory.eaushadhi_composition_stage%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_snapshot jsonb;
  v_count integer;
  v_old_stage_status text;
  v_now timestamptz := now();
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  if p_product_id<>262 then
    raise exception using errcode='42501', message='Composition execution V1 is restricted to Product 262';
  end if;

  select * into v_stage
  from regulatory.eaushadhi_composition_stage
  where product_id=p_product_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Composition stage not found';
  end if;

  if v_stage.row_version is distinct from p_expected_stage_row_version then
    raise exception using errcode='40001', message='Stale Composition stage row version';
  end if;

  if v_stage.stage_status is distinct from 'PARTIAL' then
    raise exception using errcode='55000', message='Composition final stage verification requires current stage PARTIAL';
  end if;

  v_old_stage_status := v_stage.stage_status;

  if exists (
    select 1
    from regulatory.eaushadhi_composition_run
    where product_id=p_product_id
      and run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS')
  ) then
    raise exception using errcode='55000', message='Active Composition run blocks final stage verification';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id=p_product_id;

  if not found then
    raise exception using errcode='P0002', message='e-Aushadhi product workflow not found';
  end if;

  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode='40001', message='Stale workflow row version';
  end if;

  v_snapshot := regulatory.eaushadhi_composition_snapshot_v1(p_product_id,v_workflow.row_version);

  if coalesce((v_snapshot->>'ready')::boolean,false) is not true then
    raise exception using errcode='55000', message='Composition READY v1 server contract is not satisfied';
  end if;

  if v_snapshot->>'content_hash' is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Composition content hash changed before final stage verification';
  end if;

  if jsonb_typeof(p_final_list_evidence)<>'object'
     or coalesce((p_final_list_evidence->>'settled')::boolean,false) is not true
     or coalesce((p_final_list_evidence->>'success')::boolean,false) is not true
     or coalesce((p_final_list_evidence->>'coverageComplete')::boolean,false) is not true
     or jsonb_typeof(p_final_list_evidence->'rows')<>'array'
  then
    raise exception using errcode='22023', message='Complete final Composition list evidence is required';
  end if;

  v_count := (v_snapshot->>'governed_line_count')::integer;

  if jsonb_typeof(p_planner_report)<>'object'
     or coalesce(p_planner_report->>'code','')<>'ALREADY_COMPLETE'
     or coalesce((p_planner_report->>'ok')::boolean,false) is not true
     or coalesce((p_planner_report->>'mutationAllowed')::boolean,true) is not false
     or (p_planner_report->>'governedCount')::integer is distinct from v_count
     or (p_planner_report->>'portalCount')::integer is distinct from v_count
     or jsonb_array_length(p_final_list_evidence->'rows')<>v_count
     or jsonb_typeof(p_planner_report->'matches')<>'array'
     or jsonb_array_length(p_planner_report->'matches')<>v_count
     or jsonb_typeof(p_planner_report->'missing')<>'array'
     or jsonb_array_length(p_planner_report->'missing')<>0
     or jsonb_typeof(p_planner_report->'conflicts')<>'array'
     or jsonb_array_length(p_planner_report->'conflicts')<>0
     or jsonb_typeof(p_planner_report->'duplicates')<>'array'
     or jsonb_array_length(p_planner_report->'duplicates')<>0
     or jsonb_typeof(p_planner_report->'extras')<>'array'
     or jsonb_array_length(p_planner_report->'extras')<>0
     or jsonb_typeof(p_planner_report->'blockers')<>'array'
     or jsonb_array_length(p_planner_report->'blockers')<>0
  then
    raise exception using errcode='22023', message='Final Composition exact-set planner proof is invalid';
  end if;

  update regulatory.eaushadhi_composition_stage s
  set stage_status='PORTAL_VERIFIED',
      content_hash=p_expected_content_hash,
      workflow_row_version=v_workflow.row_version,
      governed_line_count=v_count,
      portal_match_count=v_count,
      latest_evidence=jsonb_build_object(
        'event_kind','STAGE_PORTAL_VERIFIED',
        'final_list',p_final_list_evidence,
        'planner',p_planner_report
      ),
      portal_verified_by=v_actor,
      portal_verified_at=v_now,
      row_version=s.row_version+1,
      updated_by=v_actor,
      updated_at=v_now
  where product_id=p_product_id
  returning * into v_stage;

  insert into regulatory.audit_event(
    entity_schema,entity_table,entity_key,action,old_data,new_data,
    actor_user_id,application_name,occurred_at
  ) values (
    'regulatory','eaushadhi_composition_stage',p_product_id::text,'UPDATE',
    jsonb_build_object('stage_status',v_old_stage_status),
    jsonb_build_object(
      'event_kind','COMPOSITION_STAGE_PORTAL_VERIFIED',
      'stage_status','PORTAL_VERIFIED',
      'content_hash',p_expected_content_hash,
      'planner',p_planner_report
    ),
    v_actor,'e-aushadhi-automation',v_now
  );

  return jsonb_build_object(
    'product_id',p_product_id,
    'stage_status','PORTAL_VERIFIED',
    'stage_row_version',v_stage.row_version,
    'workflow_row_version',v_workflow.row_version,
    'content_hash',p_expected_content_hash,
    'portal_match_count',v_count,
    'governed_line_count',v_count,
    'portal_verified_at',v_now
  );
end
$function$;

comment on function public.rpc_eaushadhi_composition_stage_mark_portal_verified(integer,bigint,bigint,text,jsonb,jsonb)
is 'Marks Product 262 Composition stage PORTAL_VERIFIED only from current PARTIAL state after fresh exact-set proof, no active run, and optimistic-concurrency checks.';
