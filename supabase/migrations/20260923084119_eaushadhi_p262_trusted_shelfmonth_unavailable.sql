-- Product 262 controlled-flow verification acceptability for a trusted,
-- bounded shelfmonth reread-unavailable result. This does not assert portal
-- shelfmonth retention, DOM equality, or any mapping from month diagnostics.

create or replace function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(
  p_run_id uuid,
  p_expected_workflow_row_version bigint,
  p_expected_content_hash text,
  p_portal_product_ref text,
  p_recovery_evidence jsonb
) returns jsonb
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
  v_current_hash text;
  v_payload jsonb;
  v_special boolean := false;
  v_exception_count integer := 0;
  v_shelfmonth_count integer := 0;
  v_item_evidence jsonb;
  v_save jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  if jsonb_typeof(p_recovery_evidence) <> 'object' then
    raise exception using errcode='22023', message='Recovery evidence object is required';
  end if;
  v_portal_ref := nullif(btrim(coalesce(p_portal_product_ref,'')), '');
  if v_portal_ref is null or v_portal_ref in ('0','-1','262') then
    raise exception using errcode='22023', message='Adoption requires a valid portal product ref distinct from Product 262';
  end if;

  v_source := coalesce(p_recovery_evidence->>'source','');
  v_duplicate_outcome := upper(coalesce(p_recovery_evidence->>'duplicate_outcome',''));
  v_coverage_complete := coalesce((p_recovery_evidence->>'coverage_complete')::boolean,false);
  v_exact_match_count := coalesce((p_recovery_evidence->>'exact_match_count')::integer,0);
  v_evidence_portal_ref := nullif(btrim(coalesce(p_recovery_evidence->>'portal_product_ref','')), '');
  v_reread_source := coalesce(p_recovery_evidence->>'reread_source','');
  v_reread_id_match := coalesce((p_recovery_evidence->>'reread_id_match')::boolean,false);
  v_compare_equal := coalesce((p_recovery_evidence->>'compare_equal')::boolean,false);
  v_compare_report := coalesce(p_recovery_evidence->'compare_report','{}'::jsonb);
  if v_source <> 'LoadProductDataforLegacy'
     or v_duplicate_outcome <> 'EXACT_ONE'
     or v_coverage_complete is not true
     or v_exact_match_count <> 1
     or v_evidence_portal_ref is distinct from v_portal_ref
     or v_reread_source <> 'GetproductDataUpdate'
     or v_reread_id_match is not true then
    raise exception using errcode='22023', message='Adoption requires coverage-complete EXACT_ONE recovery evidence with matching reread';
  end if;

  if jsonb_typeof(v_compare_report) <> 'object' then
    raise exception using errcode='22023', message='Adoption compare report object is required';
  end if;
  v_special := coalesce(v_compare_report->>'overall','') = 'MATCH_WITH_TRUSTED_UNAVAILABLE';
  if v_special then
    if jsonb_typeof(p_recovery_evidence->'compare_equal') <> 'boolean'
       or v_compare_equal is not false
       or coalesce(p_recovery_evidence->>'compare_overall','') <> 'MATCH_WITH_TRUSTED_UNAVAILABLE'
       or jsonb_typeof(p_recovery_evidence->'compare_verification_acceptable') <> 'boolean'
       or (p_recovery_evidence->>'compare_verification_acceptable')::boolean is not true
       or jsonb_typeof(v_compare_report->'equal') <> 'boolean'
       or (v_compare_report->>'equal')::boolean is not false
       or jsonb_typeof(v_compare_report->'verificationAcceptable') <> 'boolean'
       or (v_compare_report->>'verificationAcceptable')::boolean is not true then
      raise exception using errcode='22023', message='Special adoption compare summary is invalid';
    end if;
  elsif v_compare_equal is not true
     or coalesce((v_compare_report->>'equal')::boolean,false) is not true then
    raise exception using errcode='22023', message='Ordinary adoption compare report must be equal=true';
  end if;

  v_items := v_compare_report->'items';
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items)=0 then
    raise exception using errcode='22023', message='Adoption compare report items are required';
  end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce(v_item->>'path','') = 'shelfmonth' then
      v_shelfmonth_count := v_shelfmonth_count + 1;
    end if;
    if coalesce(v_item->>'result','') = 'PORTAL_REREAD_UNAVAILABLE_TRUSTED' then
      v_exception_count := v_exception_count + 1;
      v_item_evidence := v_item->'evidence';
      if not v_special
         or coalesce(v_item->>'path','') <> 'shelfmonth'
         or coalesce(v_item->>'expected','') <> 'RegularAsPerClause'
         or not (v_item ? 'actual')
         or jsonb_typeof(v_item->'actual') <> 'null'
         or jsonb_typeof(v_item_evidence) <> 'object'
         or (select array_agg(k order by k) from jsonb_object_keys(v_item_evidence) k)
              is distinct from array['domCheckedValue','domMonth','responseMonth','responseValue','source']::text[]
         or v_item_evidence->>'source' <> 'GetproductDataUpdate_response'
         or jsonb_typeof(v_item_evidence->'responseValue') <> 'null'
         or jsonb_typeof(v_item_evidence->'domCheckedValue') <> 'null'
         or coalesce(jsonb_typeof(v_item_evidence->'responseMonth'),'null') not in ('null','string','number')
         or coalesce(jsonb_typeof(v_item_evidence->'domMonth'),'null') not in ('null','string','number')
         or (jsonb_typeof(v_item_evidence->'responseMonth')='string' and length(v_item_evidence->>'responseMonth')>128)
         or (jsonb_typeof(v_item_evidence->'domMonth')='string' and length(v_item_evidence->>'domMonth')>128) then
        raise exception using errcode='22023', message='Trusted shelfmonth unavailable item is invalid';
      end if;
    elsif coalesce(v_item->>'result','') <> 'MATCH' then
      raise exception using errcode='22023', message='Compare report contains an unaccepted result';
    end if;
  end loop;
  if (v_special and (v_exception_count<>1 or v_shelfmonth_count<>1))
     or (not v_special and v_exception_count<>0) then
    raise exception using errcode='22023', message='Compare report exceptional item count is invalid';
  end if;

  select * into v_run from regulatory.eaushadhi_worker_run where run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  if v_run.product_id<>262 then raise exception using errcode='42501', message='Ambiguous-save identity adoption is restricted to Product 262 during the controlled pilot'; end if;
  if v_run.run_status<>'RUNNING' or v_run.portal_product_ref is not null or v_run.entered_at is not null then
    raise exception using errcode='55000', message='Only an unentered RUNNING worker run can adopt an ambiguous-save portal identity';
  end if;
  if v_run.last_save_outcome is distinct from 'AMBIGUOUS' or v_run.last_save_observed_at is null then
    raise exception using errcode='55000', message='Adoption requires server-recorded SAVE_AMBIGUOUS on the same run';
  end if;
  if v_special then
    v_save := v_run.last_save_evidence;
    if jsonb_typeof(v_save)<>'object'
       or upper(coalesce(v_save->>'outcome',''))<>'AMBIGUOUS'
       or jsonb_typeof(v_save->'invoked')<>'boolean' or (v_save->>'invoked')::boolean is not true
       or jsonb_typeof(v_save->'invokeCount')<>'number' or (v_save->>'invokeCount')::numeric<>1
       or jsonb_typeof(v_save->'settled')<>'boolean' or (v_save->>'settled')::boolean is not true
       or jsonb_typeof(v_save->'businessSuccess')<>'boolean' or (v_save->>'businessSuccess')::boolean is not true
       or coalesce(v_save->>'phase','') not in ('SAVE_CONFIRMED','RUN_RESUME') then
      raise exception using errcode='22023', message='Trusted shelfmonth unavailable mode requires strong same-run save evidence';
    end if;
  end if;
  if p_expected_content_hash is distinct from v_run.start_content_hash then
    raise exception using errcode='40001', message='Adoption content hash does not match run authority';
  end if;

  select * into v_workflow from regulatory.eaushadhi_product_workflow where product_id=v_run.product_id for update;
  if not found then raise exception using errcode='P0002', message='Workflow row not found'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001', message='Stale workflow row version'; end if;
  if v_workflow.entry_status<>'IN_PROGRESS' or v_workflow.portal_product_ref is not null or v_workflow.entered_at is not null then
    raise exception using errcode='55000', message='Workflow is not eligible for ambiguous-save identity adoption';
  end if;
  v_payload := public.rpc_eaushadhi_worker_content_get(v_run.product_id,v_workflow.row_version);
  v_current_hash := v_payload->>'content_hash';
  if v_current_hash is null or v_current_hash is distinct from v_run.start_content_hash or v_current_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Adoption refused: fresh governed content hash does not match run start and expected hash';
  end if;

  update regulatory.eaushadhi_worker_run set
    run_status='ENTERED', portal_product_ref=v_portal_ref,
    current_workflow_row_version=v_workflow.row_version+1,
    entered_by=v_actor, entered_at=v_now, updated_at=v_now
  where run_id=p_run_id;
  update regulatory.eaushadhi_product_workflow set
    entry_status='ENTERED', portal_product_ref=v_portal_ref,
    entered_by=v_actor, entered_at=v_now, row_version=v_workflow.row_version+1,
    updated_by=v_actor, updated_at=v_now
  where product_id=v_run.product_id;
  insert into regulatory.audit_event(entity_schema,entity_table,entity_key,action,old_data,new_data,actor_user_id,application_name,occurred_at)
  values('regulatory','eaushadhi_worker_run',p_run_id::text,'UPDATE',
    jsonb_build_object('event_kind','ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY','run_status',v_run.run_status,'portal_product_ref',v_run.portal_product_ref,'last_save_outcome',v_run.last_save_outcome),
    jsonb_build_object('event_kind','ADOPT_AMBIGUOUS_SAVE_PORTAL_IDENTITY','run_status','ENTERED','portal_product_ref',v_portal_ref,'last_save_outcome','AMBIGUOUS','recovery_evidence',p_recovery_evidence,'current_workflow_row_version',v_workflow.row_version+1,'content_hash',v_current_hash),
    v_actor,'e-aushadhi-automation',v_now);
  return jsonb_build_object('run_id',p_run_id,'product_id',v_run.product_id,'run_status','ENTERED','entry_status','ENTERED','portal_product_ref',v_portal_ref,'workflow_row_version',v_workflow.row_version+1,'content_hash',v_current_hash,'last_save_outcome','AMBIGUOUS');
end;
$function$;

alter function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid,bigint,text,text,jsonb) owner to postgres;
revoke all on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid,bigint,text,text,jsonb) from anon;
revoke all on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid,bigint,text,text,jsonb) from public;
grant execute on function public.rpc_eaushadhi_worker_adopt_ambiguous_save_identity(uuid,bigint,text,text,jsonb) to authenticated, service_role;

create or replace function public.rpc_eaushadhi_worker_mark_portal_verified(
  p_run_id uuid,
  p_expected_workflow_row_version bigint,
  p_expected_content_hash text,
  p_compare_report jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'regulatory', 'extensions', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_run regulatory.eaushadhi_worker_run%rowtype;
  v_workflow regulatory.eaushadhi_product_workflow%rowtype;
  v_payload jsonb;
  v_content_hash text;
  v_now timestamptz := now();
  v_items jsonb;
  v_item jsonb;
  v_special boolean := false;
  v_exception_count integer := 0;
  v_shelfmonth_count integer := 0;
  v_item_evidence jsonb;
  v_save jsonb;
begin
  v_actor := public.rpc_eaushadhi_require_permission(true);
  select * into v_run from regulatory.eaushadhi_worker_run wr where wr.run_id=p_run_id for update;
  if not found then raise exception using errcode='P0002', message='Worker run not found'; end if;
  if v_run.product_id<>262 then raise exception using errcode='42501', message='First controlled worker run is restricted to product_id 262'; end if;
  if v_run.run_status<>'ENTERED' then raise exception using errcode='P0001', message='Worker run must be ENTERED before portal verification'; end if;
  select * into v_workflow from regulatory.eaushadhi_product_workflow w where w.product_id=v_run.product_id for update;
  if v_workflow.entry_status<>'ENTERED' then raise exception using errcode='P0001', message='Workflow must be ENTERED before portal verification'; end if;
  if v_workflow.row_version is distinct from p_expected_workflow_row_version then raise exception using errcode='40001', message='Stale workflow row version'; end if;
  v_payload := public.rpc_eaushadhi_worker_content_get(v_run.product_id,v_workflow.row_version);
  v_content_hash := v_payload->>'content_hash';
  if v_content_hash is distinct from v_run.start_content_hash or v_content_hash is distinct from p_expected_content_hash then
    raise exception using errcode='40001', message='Worker content changed before portal verification';
  end if;

  if jsonb_typeof(p_compare_report)<>'object' then raise exception using errcode='22023', message='Compare report object is required'; end if;
  v_special := coalesce(p_compare_report->>'overall','')='MATCH_WITH_TRUSTED_UNAVAILABLE';
  if v_special then
    if jsonb_typeof(p_compare_report->'equal')<>'boolean' or (p_compare_report->>'equal')::boolean is not false
       or jsonb_typeof(p_compare_report->'verificationAcceptable')<>'boolean'
       or (p_compare_report->>'verificationAcceptable')::boolean is not true then
      raise exception using errcode='22023', message='Special compare report summary is invalid';
    end if;
  elsif coalesce((p_compare_report->>'equal')::boolean,false) is not true then
    raise exception using errcode='22023', message='Compare report must declare equal=true';
  end if;
  v_items := p_compare_report->'items';
  if jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)=0 then raise exception using errcode='22023', message='Compare report items are required'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    if coalesce(v_item->>'path','')='shelfmonth' then v_shelfmonth_count:=v_shelfmonth_count+1; end if;
    if coalesce(v_item->>'result','')='PORTAL_REREAD_UNAVAILABLE_TRUSTED' then
      v_exception_count:=v_exception_count+1;
      v_item_evidence:=v_item->'evidence';
      if not v_special or coalesce(v_item->>'path','')<>'shelfmonth'
         or coalesce(v_item->>'expected','')<>'RegularAsPerClause'
         or not (v_item ? 'actual') or jsonb_typeof(v_item->'actual')<>'null'
         or jsonb_typeof(v_item_evidence)<>'object'
         or (select array_agg(k order by k) from jsonb_object_keys(v_item_evidence) k)
              is distinct from array['domCheckedValue','domMonth','responseMonth','responseValue','source']::text[]
         or v_item_evidence->>'source'<>'GetproductDataUpdate_response'
         or jsonb_typeof(v_item_evidence->'responseValue')<>'null'
         or jsonb_typeof(v_item_evidence->'domCheckedValue')<>'null'
         or coalesce(jsonb_typeof(v_item_evidence->'responseMonth'),'null') not in ('null','string','number')
         or coalesce(jsonb_typeof(v_item_evidence->'domMonth'),'null') not in ('null','string','number')
         or (jsonb_typeof(v_item_evidence->'responseMonth')='string' and length(v_item_evidence->>'responseMonth')>128)
         or (jsonb_typeof(v_item_evidence->'domMonth')='string' and length(v_item_evidence->>'domMonth')>128) then
        raise exception using errcode='22023', message='Trusted shelfmonth unavailable item is invalid';
      end if;
    elsif coalesce(v_item->>'result','')<>'MATCH' then
      raise exception using errcode='22023', message='Compare report contains MISMATCH or unaccepted results';
    end if;
  end loop;
  if (v_special and (v_exception_count<>1 or v_shelfmonth_count<>1)) or (not v_special and v_exception_count<>0) then
    raise exception using errcode='22023', message='Compare report exceptional item count is invalid';
  end if;
  if v_special then
    v_save:=v_run.last_save_evidence;
    if v_run.last_save_outcome is distinct from 'AMBIGUOUS'
       or v_run.last_save_observed_at is null
       or jsonb_typeof(v_save)<>'object'
       or upper(coalesce(v_save->>'outcome',''))<>'AMBIGUOUS'
       or jsonb_typeof(v_save->'invoked')<>'boolean' or (v_save->>'invoked')::boolean is not true
       or jsonb_typeof(v_save->'invokeCount')<>'number' or (v_save->>'invokeCount')::numeric<>1
       or jsonb_typeof(v_save->'settled')<>'boolean' or (v_save->>'settled')::boolean is not true
       or jsonb_typeof(v_save->'businessSuccess')<>'boolean' or (v_save->>'businessSuccess')::boolean is not true
       or coalesce(v_save->>'phase','') not in ('SAVE_CONFIRMED','RUN_RESUME') then
      raise exception using errcode='22023', message='Trusted shelfmonth unavailable mode requires strong same-run save evidence';
    end if;
  end if;

  update regulatory.eaushadhi_product_workflow w set entry_status='PORTAL_VERIFIED',portal_verified_by=v_actor,portal_verified_at=v_now,row_version=w.row_version+1,updated_by=v_actor,updated_at=v_now where w.product_id=v_run.product_id;
  update regulatory.eaushadhi_worker_run wr set run_status='PORTAL_VERIFIED',current_workflow_row_version=v_workflow.row_version+1,compare_report=p_compare_report,portal_verified_by=v_actor,portal_verified_at=v_now,updated_at=v_now where wr.run_id=p_run_id;
  return jsonb_build_object('run_id',p_run_id,'product_id',v_run.product_id,'run_status','PORTAL_VERIFIED','entry_status','PORTAL_VERIFIED','workflow_row_version',v_workflow.row_version+1,'content_hash',v_content_hash,'portal_product_ref',coalesce(v_workflow.portal_product_ref,v_run.portal_product_ref),'portal_verified_at',v_now);
end;
$function$;

alter function public.rpc_eaushadhi_worker_mark_portal_verified(uuid,bigint,text,jsonb) owner to postgres;
revoke all on function public.rpc_eaushadhi_worker_mark_portal_verified(uuid,bigint,text,jsonb) from anon;
revoke all on function public.rpc_eaushadhi_worker_mark_portal_verified(uuid,bigint,text,jsonb) from public;
grant execute on function public.rpc_eaushadhi_worker_mark_portal_verified(uuid,bigint,text,jsonb) to authenticated, service_role;
