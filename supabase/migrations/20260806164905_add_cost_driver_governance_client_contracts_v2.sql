-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function public.rpc_approve_cost_driver_policy_envelope(
  p_envelope_id bigint,
  p_approval_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
declare
  v_row costing.cost_driver_policy_envelope%rowtype;
  v_validation jsonb;
  v_overlap_count bigint;
begin
  perform public.require_permission('module:cost-build-manager', true);
  if nullif(btrim(p_approval_reference),'') is null then
    raise exception 'approval_reference is required';
  end if;
  select * into v_row
  from costing.cost_driver_policy_envelope
  where id = p_envelope_id
  for update;
  if not found then raise exception 'Driver policy envelope % not found', p_envelope_id; end if;
  if v_row.lifecycle_status <> 'REVIEW_REQUIRED' then
    raise exception 'Only REVIEW_REQUIRED driver policy envelopes may be approved';
  end if;
  v_validation := costing.fn_validate_cost_driver_policy_envelope(p_envelope_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Driver policy envelope % is invalid: %', p_envelope_id, v_validation->'errors';
  end if;
  select count(*) into v_overlap_count
  from costing.cost_driver_policy_envelope x
  where x.id <> p_envelope_id
    and x.cost_element_code = v_row.cost_element_code
    and x.lifecycle_status = 'APPROVED'
    and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
        && daterange(v_row.effective_from,coalesce(v_row.effective_to,'infinity'::date),'[]');
  if v_overlap_count > 0 then raise exception 'Approved effective period overlaps another approved envelope'; end if;
  update costing.cost_driver_policy_envelope
  set lifecycle_status='APPROVED',
      approval_reference=btrim(p_approval_reference),
      approved_by=auth.uid(),
      approved_at=clock_timestamp()
  where id=p_envelope_id;
  return jsonb_build_object(
    'envelope_id',p_envelope_id,
    'status','APPROVED',
    'approval_reference',btrim(p_approval_reference),
    'validation',v_validation,
    'stage03_cutover_authorised',false
  );
end;
$function$;

create or replace function public.rpc_get_cost_driver_governance_detail(
  p_cost_element_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing, pg_temp
as $function$
declare
  v_code text := upper(btrim(p_cost_element_code));
  v_catalog costing.cost_element_driver_catalog%rowtype;
  v_registry jsonb;
  v_detail jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_owner_module text;
  v_status text;
  v_id bigint;
begin
  perform public.require_permission('module:cost-build-manager', false);
  if nullif(v_code,'') is null then raise exception 'cost_element_code is required'; end if;
  select * into v_catalog from costing.cost_element_driver_catalog where cost_element_code=v_code;
  if not found then raise exception 'Cost element % is not registered',v_code; end if;
  select to_jsonb(r) into v_registry from costing.v_cost_driver_policy_registry r where r.cost_element_code=v_code;

  if v_code='DIRECT_LABOUR' then
    v_owner_module:='module:production-route-manager';
    select p.id,p.status into v_id,v_status
    from costing.direct_labour_workload_policy p
    order by p.policy_version desc,p.id desc limit 1;
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.direct_labour_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.direct_labour_workload_policy p where p.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_direct_labour_workload_policy(v_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.direct_labour_scope_factor f where f.policy_id=v_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.direct_labour_behaviour_factor f where f.policy_id=v_id),'[]'::jsonb),
      'formula_display','Rounded standard batches × effective Direct Labour route-attendance intensity',
      'canonical_source_module','module:production-route-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:production-route-manager','rpc','rpc_submit_direct_labour_workload_policy_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:production-route-manager','rpc','rpc_approve_direct_labour_workload_policy','record_id',v_id)
    );
  elsif v_code='PRODUCTION_OVERHEAD' then
    v_owner_module:='module:production-route-manager';
    select p.id,p.status into v_id,v_status
    from costing.production_overhead_workload_policy p
    order by p.policy_version desc,p.id desc limit 1;
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.production_overhead_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.production_overhead_workload_policy p where p.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_production_overhead_workload_policy(v_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.production_overhead_scope_factor f where f.policy_id=v_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.production_overhead_behaviour_factor f where f.policy_id=v_id),'[]'::jsonb),
      'resource_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.resource_class_code) from costing.production_overhead_resource_factor f where f.policy_id=v_id),'[]'::jsonb),
      'formula_display','Rounded standard batches × effective Production Overhead route factor',
      'canonical_source_module','module:production-route-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:production-route-manager','rpc','rpc_submit_production_overhead_workload_policy_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:production-route-manager','rpc','rpc_approve_production_overhead_workload_policy','record_id',v_id)
    );
  else
    v_owner_module:='module:cost-build-manager';
    select e.id,e.lifecycle_status into v_id,v_status
    from costing.cost_driver_policy_envelope e
    where e.cost_element_code=v_code
    order by e.policy_version desc,e.id desc limit 1;
    select jsonb_build_object(
      'envelope_history',coalesce((select jsonb_agg(to_jsonb(e) order by e.policy_version desc,e.id desc) from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code),'[]'::jsonb),
      'current_envelope',(select to_jsonb(e) from costing.cost_driver_policy_envelope e where e.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_cost_driver_policy_envelope(v_id) end,
      'formula_display',case when v_code in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD') then 'Governed Product sales-unit share' else coalesce(v_registry->>'formula_type','Not registered') end,
      'canonical_source_module','module:cost-build-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:cost-build-manager','rpc','rpc_submit_cost_driver_policy_envelope_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:cost-build-manager','rpc','rpc_approve_cost_driver_policy_envelope','record_id',v_id)
    );
  end if;

  return jsonb_build_object(
    'cost_element',to_jsonb(v_catalog),
    'registry',v_registry,
    'detail',v_detail,
    'actions',v_actions,
    'owner_module',v_owner_module,
    'stage03_cutover_authorised',false
  );
end;
$function$;

revoke all on function public.rpc_approve_cost_driver_policy_envelope(bigint,text) from public,anon;
revoke all on function public.rpc_get_cost_driver_governance_detail(text) from public,anon;
grant execute on function public.rpc_approve_cost_driver_policy_envelope(bigint,text) to authenticated,service_role;
grant execute on function public.rpc_get_cost_driver_governance_detail(text) to authenticated,service_role;