create or replace function public.rpc_eaushadhi_composition_execution_preflight(
  p_product_id integer
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
  v_stage_found boolean := false;
  v_predecessor_verified boolean := false;
  v_active_run_exists boolean := false;
begin
  v_actor := public.rpc_eaushadhi_require_permission(false);

  if p_product_id <> 262 then
    raise exception using errcode='42501', message='Composition execution V1 is restricted to Product 262';
  end if;

  select * into v_workflow
  from regulatory.eaushadhi_product_workflow
  where product_id=p_product_id;

  if not found then
    raise exception using errcode='P0002', message='e-Aushadhi product workflow not found';
  end if;

  v_snapshot := regulatory.eaushadhi_composition_snapshot_v1(p_product_id,v_workflow.row_version);

  select * into v_stage
  from regulatory.eaushadhi_composition_stage
  where product_id=p_product_id;
  v_stage_found := found;

  select exists (
    select 1
    from regulatory.eaushadhi_composition_run r
    where r.product_id=p_product_id
      and r.target_source_composition_line_id=930
      and r.run_status='ROW_VERIFIED'
      and r.save_outcome='CONFIRMED'
      and r.row_verified_at is not null
  )
  into v_predecessor_verified;

  select exists (
    select 1
    from regulatory.eaushadhi_composition_run r
    where r.product_id=p_product_id
      and r.run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS')
  )
  into v_active_run_exists;

  return jsonb_build_object(
    'product_id',p_product_id,
    'workflow_row_version',v_workflow.row_version,
    'product_entry_status',v_workflow.entry_status,
    'portal_product_ref',v_workflow.portal_product_ref,
    'ready',v_snapshot->'ready',
    'reasons',v_snapshot->'reasons',
    'content_hash',v_snapshot->>'content_hash',
    'governed_line_count',(v_snapshot->>'governed_line_count')::integer,
    'source_line_ids',v_snapshot->'source_line_ids',
    'stage',case when v_stage_found then jsonb_build_object(
      'stage_status',v_stage.stage_status,
      'row_version',v_stage.row_version,
      'content_hash',v_stage.content_hash,
      'workflow_row_version',v_stage.workflow_row_version,
      'governed_line_count',v_stage.governed_line_count,
      'portal_match_count',v_stage.portal_match_count
    ) else null end,
    'phase2_line_931',jsonb_build_object(
      'target_source_composition_line_id',931,
      'predecessor_source_composition_line_id',930,
      'predecessor_row_verified_confirmed',v_predecessor_verified,
      'stage_partial',coalesce(v_stage_found and v_stage.stage_status='PARTIAL',false),
      'stage_portal_match_count',case when v_stage_found then v_stage.portal_match_count else null end,
      'server_gate_ready',coalesce(
        v_stage_found
        and v_stage.stage_status='PARTIAL'
        and v_stage.governed_line_count=3
        and v_stage.portal_match_count=2
        and v_stage.workflow_row_version=v_workflow.row_version
        and v_predecessor_verified
        and not v_active_run_exists,
        false
      )
    ),
    'active_run',(
      select to_jsonb(r)
      from (
        select run_id,target_source_composition_line_id,run_status,current_stage_row_version,
               workflow_row_version,content_hash,armed_at
        from regulatory.eaushadhi_composition_run
        where product_id=p_product_id
          and run_status in ('SAVE_ARMED','SAVE_CONFIRMED','SAVE_AMBIGUOUS')
        order by armed_at desc
        limit 1
      ) r
    )
  );
end
$function$;

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
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);

  if p_product_id <> 262 then
    raise exception using errcode='42501', message='Composition execution V1 is restricted to Product 262';
  end if;
  if p_target_source_composition_line_id <> 931 then
    raise exception using errcode='42501', message='Composition controlled Phase 2 accepts only Product 262 line 931';
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
  if (v_snapshot->>'governed_line_count')::integer <> 3 then
    raise exception using errcode='55000', message='Controlled Phase 2 requires exactly three governed Composition lines';
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

  if v_match_ids is distinct from array[929,930]::bigint[]
     or v_missing_ids is distinct from array[931]::bigint[]
     or v_match_count<>2
     or v_missing_count<>1
     or (p_planner_report->>'portalCount')::integer<>2
  then
    raise exception using errcode='55000', message='Controlled Phase 2 requires matched lines 929/930 and missing line 931 only';
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

  if not found then
    raise exception using errcode='55000', message='Controlled Phase 2 requires an existing Composition stage';
  end if;
  if p_expected_stage_row_version is null or v_stage.row_version is distinct from p_expected_stage_row_version then
    raise exception using errcode='40001', message='Stale Composition stage row version';
  end if;
  if v_stage.stage_status<>'PARTIAL'
     or v_stage.governed_line_count<>3
     or v_stage.portal_match_count<>2
     or v_stage.workflow_row_version is distinct from v_workflow.row_version
     or v_stage.content_hash is distinct from p_expected_content_hash
  then
    raise exception using errcode='55000', message='Controlled Phase 2 stage authority is not satisfied';
  end if;

  if not exists (
    select 1
    from regulatory.eaushadhi_composition_run r
    where r.product_id=p_product_id
      and r.target_source_composition_line_id=930
      and r.run_status='ROW_VERIFIED'
      and r.save_outcome='CONFIRMED'
      and r.row_verified_at is not null
  ) then
    raise exception using errcode='55000', message='Controlled Phase 2 requires durable line 930 ROW_VERIFIED/CONFIRMED predecessor evidence';
  end if;

  update regulatory.eaushadhi_composition_stage s
  set stage_status='PARTIAL',
      content_hash=p_expected_content_hash,
      workflow_row_version=v_workflow.row_version,
      governed_line_count=(v_snapshot->>'governed_line_count')::integer,
      portal_match_count=v_match_count,
      latest_evidence=jsonb_build_object(
        'event_kind','RUN_ARMED',
        'execution_phase','CONTROLLED_PHASE_2',
        'target_source_composition_line_id',p_target_source_composition_line_id,
        'predecessor_source_composition_line_id',930,
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
      'execution_phase','CONTROLLED_PHASE_2',
      'product_id',p_product_id,
      'target_source_composition_line_id',p_target_source_composition_line_id,
      'predecessor_source_composition_line_id',930,
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
    'execution_phase','CONTROLLED_PHASE_2',
    'stage_status',v_stage.stage_status,
    'stage_row_version',v_stage.row_version,
    'workflow_row_version',v_workflow.row_version,
    'content_hash',p_expected_content_hash,
    'portal_product_ref',v_workflow.portal_product_ref,
    'target_projection',v_target
  );
end
$function$;

comment on function public.rpc_eaushadhi_composition_execution_preflight(integer)
is 'Product 262 Composition execution preflight with bounded Phase-2 line-931 predecessor authority evidence.';

comment on function public.rpc_eaushadhi_composition_run_arm(integer,bigint,bigint,text,bigint,jsonb,jsonb,jsonb)
is 'Product 262 Composition controlled Phase-2 arm: line 931 only, requiring matched 929/930, durable line-930 ROW_VERIFIED/CONFIRMED predecessor evidence, and fresh stage/planner authority.';
