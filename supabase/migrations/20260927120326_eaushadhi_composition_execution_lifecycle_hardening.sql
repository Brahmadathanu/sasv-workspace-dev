
create or replace function public.rpc_eaushadhi_composition_run_arm(
  p_product_id integer,
  p_target_source_composition_line_id bigint,
  p_expected_workflow_row_version bigint,
  p_expected_content_hash text,
  p_expected_stage_row_version bigint,
  p_page_identity_evidence jsonb,
  p_before_list_evidence jsonb,
  p_planner_report jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','regulatory','extensions','pg_temp'
as $function$
declare
  v_actor uuid;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_stage regulatory.eaushadhi_composition_stage%rowtype;
  v_snapshot jsonb;
  v_target jsonb;
  v_matches jsonb;
  v_missing jsonb;
  v_match_ids bigint[];
  v_missing_ids bigint[];
  v_all_ids bigint[];
  v_target_count integer;
  v_run_id uuid;
  v_now timestamptz := now();
  v_match_count integer;
  v_missing_count integer;
  v_stage_status text;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  if p_product_id <> 262 then
    raise exception using errcode='42501', message='Composition execution V1 is restricted to Product 262';
  end if;
  if p_target_source_composition_line_id is null or p_target_source_composition_line_id <= 0 then
    raise exception using errcode='22023', message='Target source Composition line ID must be positive';
  end if;
  if p_expected_workflow_row_version is null or p_expected_workflow_row_version <= 0 then
    raise exception using errcode='22023', message='Expected workflow row version must be positive';
  end if;
  if p_expected_content_hash is null or p_expected_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='Expected Composition content hash is required';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id=p_product_id
  for update;
  if not found then
    raise exception using errcode='P0002', message='e-Aushadhi product workflow not found';
  end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then
    raise exception using errcode='40001', message='Stale workflow row version';
  end if;
  if nullif(btrim(coalesce(v_workflow.portal_product_ref,'')),'') is null then
    raise exception using errcode='55000', message='Portal product identity is required for Composition execution';
  end if;

  v_snapshot := regulatory.eaushadhi_composition_snapshot_v1(p_product_id,v_workflow.row_version);
  if coalesce((v_snapshot->>'ready')::boolean,false) is not true then
    raise exception using errcode='55000', message='Composition READY v1 server contract is not satisfied';
  end if;
  if v_snapshot->>'content_hash' is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Composition content hash changed before run arm';
  end if;

  if jsonb_typeof(p_page_identity_evidence)<>'object'
     or coalesce(p_page_identity_evidence->>'actualRoute','')<>'/admin/addcomposition'
     or coalesce(p_page_identity_evidence->>'expectedRoute','')<>'/admin/addcomposition'
     or coalesce(p_page_identity_evidence->>'actualProductId','')<>p_product_id::text
     or coalesce(p_page_identity_evidence->>'expectedProductId','')<>p_product_id::text
     or coalesce(p_page_identity_evidence->>'actualPortalProductRef','')<>v_workflow.portal_product_ref
     or coalesce(p_page_identity_evidence->>'expectedPortalProductRef','')<>v_workflow.portal_product_ref
  then
    raise exception using errcode='22023', message='Composition page identity evidence is invalid';
  end if;

  if jsonb_typeof(p_before_list_evidence)<>'object'
     or coalesce((p_before_list_evidence->>'settled')::boolean,false) is not true
     or coalesce((p_before_list_evidence->>'success')::boolean,false) is not true
     or coalesce((p_before_list_evidence->>'coverageComplete')::boolean,false) is not true
     or jsonb_typeof(p_before_list_evidence->'rows')<>'array'
  then
    raise exception using errcode='22023', message='Complete before-list evidence is required';
  end if;

  if jsonb_typeof(p_planner_report)<>'object'
     or coalesce(p_planner_report->>'code','')<>'OFFLINE_MISSING'
     or coalesce((p_planner_report->>'ok')::boolean,false) is not true
     or coalesce((p_planner_report->>'mutationAllowed')::boolean,true) is not false
     or jsonb_typeof(p_planner_report->'matches')<>'array'
     or jsonb_typeof(p_planner_report->'missing')<>'array'
     or jsonb_typeof(p_planner_report->'conflicts')<>'array'
     or jsonb_typeof(p_planner_report->'duplicates')<>'array'
     or jsonb_typeof(p_planner_report->'extras')<>'array'
     or jsonb_typeof(p_planner_report->'blockers')<>'array'
     or jsonb_array_length(p_planner_report->'conflicts')<>0
     or jsonb_array_length(p_planner_report->'duplicates')<>0
     or jsonb_array_length(p_planner_report->'extras')<>0
     or jsonb_array_length(p_planner_report->'blockers')<>0
  then
    raise exception using errcode='22023', message='Offline Composition planner report is not arm-eligible';
  end if;

  if (p_planner_report->>'governedCount')::integer is distinct from (v_snapshot->>'governed_line_count')::integer
     or (p_planner_report->>'portalCount')::integer is distinct from jsonb_array_length(p_before_list_evidence->'rows')
  then
    raise exception using errcode='40001', message='Planner counts do not match current server/list evidence';
  end if;

  v_matches := p_planner_report->'matches';
  v_missing := p_planner_report->'missing';
  v_match_count := jsonb_array_length(v_matches);
  v_missing_count := jsonb_array_length(v_missing);

  select coalesce(array_agg((x.value->>'sourceCompositionLineId')::bigint order by (x.value->>'sourceCompositionLineId')::bigint),array[]::bigint[])
  into v_match_ids
  from jsonb_array_elements(v_matches) x(value);

  select coalesce(array_agg((x.value->>'sourceCompositionLineId')::bigint order by (x.value->>'sourceCompositionLineId')::bigint),array[]::bigint[])
  into v_missing_ids
  from jsonb_array_elements(v_missing) x(value);

  select coalesce(array_agg((x.value)::bigint order by (x.value)::bigint),array[]::bigint[])
  into v_all_ids
  from jsonb_array_elements(v_snapshot->'source_line_ids') x(value);

  if cardinality(v_match_ids)+cardinality(v_missing_ids)<>cardinality(v_all_ids)
     or (select count(distinct z) from unnest(v_match_ids||v_missing_ids) z)<>cardinality(v_all_ids)
     or not (select coalesce(bool_and(z=any(v_all_ids)),true) from unnest(v_match_ids||v_missing_ids) z)
  then
    raise exception using errcode='22023', message='Planner match/missing IDs are not an exact governed partition';
  end if;

  select count(*) into v_target_count
  from unnest(v_missing_ids) z
  where z=p_target_source_composition_line_id;
  if v_target_count<>1 then
    raise exception using errcode='22023', message='Target source line must appear exactly once in planner missing set';
  end if;

  select value into v_target
  from jsonb_array_elements(v_snapshot->'composition') x(value)
  where (value->>'source_composition_line_id')::bigint=p_target_source_composition_line_id;
  if v_target is null then
    raise exception using errcode='P0002', message='Target governed Composition line not found';
  end if;

  if exists (
    select 1 from regulatory.eaushadhi_composition_run
    where product_id=p_product_id
      and run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS')
  ) then
    raise exception using errcode='23505', message='An active Composition run already exists for this product';
  end if;

  select * into v_stage
  from regulatory.eaushadhi_composition_stage
  where product_id=p_product_id
  for update;

  if found then
    if p_expected_stage_row_version is null or v_stage.row_version is distinct from p_expected_stage_row_version then
      raise exception using errcode='40001', message='Stale Composition stage row version';
    end if;
  else
    if p_expected_stage_row_version is not null then
      raise exception using errcode='40001', message='Composition stage does not yet exist';
    end if;
    insert into regulatory.eaushadhi_composition_stage(
      product_id,stage_status,row_version,content_hash,workflow_row_version,
      governed_line_count,portal_match_count,latest_evidence,
      created_by,created_at,updated_by,updated_at
    ) values (
      p_product_id,'NOT_STARTED',1,p_expected_content_hash,v_workflow.row_version,
      (v_snapshot->>'governed_line_count')::integer,0,'{}'::jsonb,
      v_actor,v_now,v_actor,v_now
    )
    returning * into v_stage;
  end if;

  v_stage_status := case when v_match_count>0 then 'PARTIAL' else 'NOT_STARTED' end;

  update regulatory.eaushadhi_composition_stage s
  set stage_status=v_stage_status,
      content_hash=p_expected_content_hash,
      workflow_row_version=v_workflow.row_version,
      governed_line_count=(v_snapshot->>'governed_line_count')::integer,
      portal_match_count=v_match_count,
      latest_evidence=jsonb_build_object(
        'event_kind','RUN_ARMED',
        'target_source_composition_line_id',p_target_source_composition_line_id,
        'page_identity',p_page_identity_evidence,
        'before_list',p_before_list_evidence,
        'planner',p_planner_report
      ),
      row_version=s.row_version+1,
      updated_by=v_actor,
      updated_at=v_now
  where s.product_id=p_product_id
  returning * into v_stage;

  insert into regulatory.eaushadhi_composition_run(
    product_id,target_source_composition_line_id,run_status,
    start_stage_row_version,current_stage_row_version,
    workflow_row_version,content_hash,portal_product_ref,
    page_identity_evidence,before_list_evidence,planner_report,target_projection,
    armed_by,armed_at,updated_at
  ) values (
    p_product_id,p_target_source_composition_line_id,'SAVE_ARMED',
    v_stage.row_version,v_stage.row_version,
    v_workflow.row_version,p_expected_content_hash,v_workflow.portal_product_ref,
    p_page_identity_evidence,p_before_list_evidence,p_planner_report,v_target,
    v_actor,v_now,v_now
  ) returning run_id into v_run_id;

  insert into regulatory.audit_event(
    entity_schema,entity_table,entity_key,action,old_data,new_data,
    actor_user_id,application_name,occurred_at
  ) values (
    'regulatory','eaushadhi_composition_run',v_run_id::text,'INSERT',null,
    jsonb_build_object(
      'event_kind','COMPOSITION_SAVE_ARMED',
      'product_id',p_product_id,
      'target_source_composition_line_id',p_target_source_composition_line_id,
      'content_hash',p_expected_content_hash,
      'stage_row_version',v_stage.row_version
    ),
    v_actor,'e-aushadhi-automation',v_now
  );

  return jsonb_build_object(
    'run_id',v_run_id,
    'product_id',p_product_id,
    'target_source_composition_line_id',p_target_source_composition_line_id,
    'run_status','SAVE_ARMED',
    'stage_status',v_stage.stage_status,
    'stage_row_version',v_stage.row_version,
    'workflow_row_version',v_workflow.row_version,
    'content_hash',p_expected_content_hash,
    'portal_product_ref',v_workflow.portal_product_ref,
    'target_projection',v_target
  );
end
$function$;

create or replace function public.rpc_eaushadhi_composition_run_verify_row(
  p_run_id uuid,
  p_expected_stage_row_version bigint,
  p_expected_content_hash text,
  p_after_list_evidence jsonb,
  p_reread_evidence jsonb,
  p_planner_report jsonb,
  p_resolved_portal_row_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','regulatory','extensions','pg_temp'
as $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_composition_run%rowtype;
  v_stage regulatory.eaushadhi_composition_stage%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_snapshot jsonb;
  v_target jsonb;
  v_matches jsonb;
  v_missing jsonb;
  v_target_match_count integer;
  v_target_missing_count integer;
  v_match_count integer;
  v_q_expected numeric;
  v_q_actual numeric;
  v_now timestamptz := now();
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  select * into v_run from regulatory.eaushadhi_composition_run where run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Composition run not found'; end if;
  if v_run.product_id<>262 then raise exception using errcode='42501', message='Composition execution V1 is restricted to Product 262'; end if;
  if v_run.run_status not in ('SAVE_CONFIRMED','SAVE_AMBIGUOUS') then
    raise exception using errcode='55000', message='Composition row verification requires CONFIRMED or AMBIGUOUS Save evidence';
  end if;
  if p_expected_content_hash is distinct from v_run.content_hash then
    raise exception using errcode='40001', message='Row verification content hash does not match run authority';
  end if;

  select * into v_stage from regulatory.eaushadhi_composition_stage where product_id=v_run.product_id for update;
  if not found then raise exception using errcode='P0002', message='Composition stage not found'; end if;
  if v_stage.row_version is distinct from p_expected_stage_row_version
     or v_stage.row_version is distinct from v_run.current_stage_row_version then
    raise exception using errcode='40001', message='Stale Composition stage row version';
  end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow where product_id=v_run.product_id;
  if not found then raise exception using errcode='P0002', message='e-Aushadhi product workflow not found'; end if;
  if v_workflow.row_version is distinct from v_run.workflow_row_version then
    raise exception using errcode='40001', message='Workflow changed before Composition row verification';
  end if;
  v_snapshot := regulatory.eaushadhi_composition_snapshot_v1(v_run.product_id,v_workflow.row_version);
  if v_snapshot->>'content_hash' is distinct from v_run.content_hash then
    raise exception using errcode='40001', message='Composition content changed before row verification';
  end if;

  if jsonb_typeof(p_after_list_evidence)<>'object'
     or coalesce((p_after_list_evidence->>'settled')::boolean,false) is not true
     or coalesce((p_after_list_evidence->>'success')::boolean,false) is not true
     or coalesce((p_after_list_evidence->>'coverageComplete')::boolean,false) is not true
     or jsonb_typeof(p_after_list_evidence->'rows')<>'array'
  then
    raise exception using errcode='22023', message='Complete after-list evidence is required';
  end if;

  if nullif(btrim(coalesce(p_resolved_portal_row_id,'')),'') is null
     or p_resolved_portal_row_id !~ '^[A-Za-z0-9_-]{1,96}$' then
    raise exception using errcode='22023', message='Resolved portal row identity is invalid';
  end if;

  if jsonb_typeof(p_reread_evidence)<>'object'
     or coalesce(p_reread_evidence->>'id','')<>p_resolved_portal_row_id
     or coalesce(p_reread_evidence->>'status','')<>'1'
  then
    raise exception using errcode='22023', message='Native Composition reread identity/status is invalid';
  end if;

  if jsonb_typeof(p_planner_report)<>'object'
     or coalesce((p_planner_report->>'ok')::boolean,false) is not true
     or coalesce((p_planner_report->>'mutationAllowed')::boolean,true) is not false
     or coalesce(p_planner_report->>'code','') not in ('OFFLINE_MISSING','ALREADY_COMPLETE')
     or jsonb_typeof(p_planner_report->'matches')<>'array'
     or jsonb_typeof(p_planner_report->'missing')<>'array'
     or jsonb_typeof(p_planner_report->'conflicts')<>'array'
     or jsonb_typeof(p_planner_report->'duplicates')<>'array'
     or jsonb_typeof(p_planner_report->'extras')<>'array'
     or jsonb_typeof(p_planner_report->'blockers')<>'array'
     or jsonb_array_length(p_planner_report->'conflicts')<>0
     or jsonb_array_length(p_planner_report->'duplicates')<>0
     or jsonb_array_length(p_planner_report->'extras')<>0
     or jsonb_array_length(p_planner_report->'blockers')<>0
     or (p_planner_report->>'governedCount')::integer is distinct from (v_snapshot->>'governed_line_count')::integer
     or (p_planner_report->>'portalCount')::integer is distinct from jsonb_array_length(p_after_list_evidence->'rows')
  then
    raise exception using errcode='22023', message='Post-save Composition planner report is not verification-eligible';
  end if;

  v_matches := p_planner_report->'matches';
  v_missing := p_planner_report->'missing';

  select count(*) into v_target_match_count
  from jsonb_array_elements(v_matches) x(value)
  where (value->>'sourceCompositionLineId')::bigint=v_run.target_source_composition_line_id;

  select count(*) into v_target_missing_count
  from jsonb_array_elements(v_missing) x(value)
  where (value->>'sourceCompositionLineId')::bigint=v_run.target_source_composition_line_id;

  if v_target_match_count<>1 or v_target_missing_count<>0 then
    raise exception using errcode='22023', message='Target line is not exactly verified by the post-save planner';
  end if;

  select value into v_target
  from jsonb_array_elements(v_snapshot->'composition') x(value)
  where (value->>'source_composition_line_id')::bigint=v_run.target_source_composition_line_id;

  if v_target is null or v_target is distinct from v_run.target_projection then
    raise exception using errcode='40001', message='Server target projection changed after run arm';
  end if;

  if btrim(coalesce(p_reread_evidence->>'ingredientName','')) is distinct from btrim(coalesce(v_target->>'ingredient_name',''))
     or btrim(coalesce(p_reread_evidence->>'botanicalName','')) is distinct from btrim(coalesce(v_target->>'scientific_name',''))
     or coalesce(p_reread_evidence->>'ingredientTypeId','') is distinct from coalesce(v_target #>> '{ingredient_type,portal_option_value}','')
     or coalesce(p_reread_evidence->>'ingredientFormId','') is distinct from coalesce(v_target #>> '{ingredient_form,portal_option_value}','')
     or coalesce(p_reread_evidence->>'partuseId','') is distinct from coalesce(v_target #>> '{part_used,portal_option_value}','')
     or coalesce(p_reread_evidence->>'unitname','') is distinct from coalesce(v_target #>> '{measurement,portal_option_value}','')
     or coalesce(p_reread_evidence->>'referenceId','') is distinct from coalesce(v_target #>> '{reference,portal_value}','')
  then
    raise exception using errcode='22023', message='Native reread controlled fields do not match governed target';
  end if;

  begin
    v_q_expected := (v_target->>'quantity_value')::numeric;
    v_q_actual := (p_reread_evidence->>'quantity')::numeric;
  exception when others then
    raise exception using errcode='22023', message='Native reread quantity is not numeric';
  end;
  if v_q_expected is distinct from v_q_actual then
    raise exception using errcode='22023', message='Native reread quantity does not match governed target';
  end if;

  v_match_count := jsonb_array_length(v_matches);

  update regulatory.eaushadhi_composition_stage s
  set stage_status=case when v_match_count=(v_snapshot->>'governed_line_count')::integer then s.stage_status else 'PARTIAL' end,
      content_hash=v_run.content_hash,
      workflow_row_version=v_run.workflow_row_version,
      governed_line_count=(v_snapshot->>'governed_line_count')::integer,
      portal_match_count=v_match_count,
      latest_evidence=jsonb_build_object(
        'event_kind','ROW_VERIFIED',
        'run_id',p_run_id,
        'target_source_composition_line_id',v_run.target_source_composition_line_id,
        'portal_row_id',p_resolved_portal_row_id,
        'after_list',p_after_list_evidence,
        'reread',p_reread_evidence,
        'planner',p_planner_report
      ),
      row_version=s.row_version+1,
      updated_by=v_actor,
      updated_at=v_now
  where product_id=v_run.product_id
  returning * into v_stage;

  update regulatory.eaushadhi_composition_run r
  set run_status='ROW_VERIFIED',
      current_stage_row_version=v_stage.row_version,
      after_list_evidence=p_after_list_evidence,
      reread_evidence=p_reread_evidence,
      verify_report=p_planner_report,
      resolved_portal_row_id=p_resolved_portal_row_id,
      row_verified_by=v_actor,
      row_verified_at=v_now,
      updated_at=v_now
  where run_id=p_run_id;

  insert into regulatory.audit_event(
    entity_schema,entity_table,entity_key,action,old_data,new_data,
    actor_user_id,application_name,occurred_at
  ) values (
    'regulatory','eaushadhi_composition_run',p_run_id::text,'UPDATE',
    jsonb_build_object('run_status',v_run.run_status),
    jsonb_build_object('event_kind','COMPOSITION_ROW_VERIFIED','run_status','ROW_VERIFIED','portal_row_id',p_resolved_portal_row_id,'planner',p_planner_report),
    v_actor,'e-aushadhi-automation',v_now
  );

  return jsonb_build_object(
    'run_id',p_run_id,
    'product_id',v_run.product_id,
    'target_source_composition_line_id',v_run.target_source_composition_line_id,
    'run_status','ROW_VERIFIED',
    'stage_status',v_stage.stage_status,
    'stage_row_version',v_stage.row_version,
    'workflow_row_version',v_run.workflow_row_version,
    'content_hash',v_run.content_hash,
    'portal_match_count',v_stage.portal_match_count,
    'governed_line_count',v_stage.governed_line_count,
    'resolved_portal_row_id',p_resolved_portal_row_id
  );
end
$function$;

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

  select * into v_stage from regulatory.eaushadhi_composition_stage where product_id=p_product_id for update;
  if not found then raise exception using errcode='P0002', message='Composition stage not found'; end if;
  if v_stage.row_version is distinct from p_expected_stage_row_version then
    raise exception using errcode='40001', message='Stale Composition stage row version';
  end if;
  v_old_stage_status := v_stage.stage_status;

  if exists (
    select 1 from regulatory.eaushadhi_composition_run
    where product_id=p_product_id
      and run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS')
  ) then
    raise exception using errcode='55000', message='Active Composition run blocks final stage verification';
  end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow where product_id=p_product_id;
  if not found then raise exception using errcode='P0002', message='e-Aushadhi product workflow not found'; end if;
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
    jsonb_build_object('event_kind','COMPOSITION_STAGE_PORTAL_VERIFIED','stage_status','PORTAL_VERIFIED','content_hash',p_expected_content_hash,'planner',p_planner_report),
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
;\n