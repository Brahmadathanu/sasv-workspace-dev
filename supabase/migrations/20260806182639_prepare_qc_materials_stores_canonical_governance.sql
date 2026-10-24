-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_guard_materials_stores_workload_policy()
returns trigger
language plpgsql
set search_path to 'costing','public','pg_temp'
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Materials / Stores workload policies are append-only and cannot be deleted';
  end if;

  if old.is_active then
    if to_jsonb(new)-array['is_active','effective_to','updated_at']::text[]
       is distinct from to_jsonb(old)-array['is_active','effective_to','updated_at']::text[] then
      raise exception 'Active Materials / Stores policy core fields are immutable; create a new version';
    end if;
  end if;

  new.updated_at:=clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_guard_materials_stores_workload_policy on costing.materials_stores_workload_policy;
create trigger trg_guard_materials_stores_workload_policy
before update or delete on costing.materials_stores_workload_policy
for each row execute function costing.fn_guard_materials_stores_workload_policy();

do $$
declare
  v_qc_policy_id bigint;
  v_ms_policy_id bigint;
begin
  select id into v_qc_policy_id
  from costing.qc_workload_policy
  where policy_code='QC_METHOD_BASE_PLUS_INCREMENT_V1'
    and version_no=1
    and policy_status='ACTIVE'
  order by id desc
  limit 1;

  if v_qc_policy_id is null then
    raise exception 'Active QC policy QC_METHOD_BASE_PLUS_INCREMENT_V1 version 1 not found';
  end if;

  select id into v_ms_policy_id
  from costing.materials_stores_workload_policy
  where policy_code='MATERIALS_STORES_STANDARD_RM_PM_V1'
    and policy_version=1
    and is_active
  order by id desc
  limit 1;

  if v_ms_policy_id is null then
    raise exception 'Active Materials / Stores policy MATERIALS_STORES_STANDARD_RM_PM_V1 version 1 not found';
  end if;

  if not exists (
    select 1 from costing.cost_driver_policy_envelope
    where cost_element_code='QUALITY_CONTROL_OVERHEAD'
      and policy_code='QC_METHOD_BASE_PLUS_INCREMENT_V1'
      and policy_version=1
  ) then
    insert into costing.cost_driver_policy_envelope(
      cost_element_code,policy_code,policy_version,lifecycle_status,
      maturity_status,cutover_status,client_status,data_quality_status,
      formula_type,effective_from,effective_to,
      specialised_policy_schema,specialised_policy_table,specialised_policy_id,
      policy_note
    ) values (
      'QUALITY_CONTROL_OVERHEAD','QC_METHOD_BASE_PLUS_INCREMENT_V1',1,'DRAFT',
      'PROVISIONAL_OPERATIONAL','PREVIEW_ONLY','CLIENT_READY','DATA_QUALITY_READY',
      'METHOD_BASE_PLUS_INCREMENT','2026-08-06',null,
      'costing','qc_workload_policy',v_qc_policy_id,
      'Quality Control overhead is allocated across Products with resolved effective FG analytical specifications using one base workload unit per distinct analytical method plus 0.25 workload unit for every additional required parameter under that method. Products without governed FG protocol/specification evidence remain BLOCKED with zero allocation. The complete frozen pool is allocated among resolved eligible Products; later evidence changes redistribute only through a new exact run. Product allocation is absorbed to base UOM and converted to SKUs using governed monthly quantity and base-conversion evidence.'
    );
  end if;

  if not exists (
    select 1 from costing.cost_driver_policy_envelope
    where cost_element_code='MATERIALS_STORES_OVERHEAD'
      and policy_code='MATERIALS_STORES_STANDARD_RM_PM_V1'
      and policy_version=1
  ) then
    insert into costing.cost_driver_policy_envelope(
      cost_element_code,policy_code,policy_version,lifecycle_status,
      maturity_status,cutover_status,client_status,data_quality_status,
      formula_type,effective_from,effective_to,
      specialised_policy_schema,specialised_policy_table,specialised_policy_id,
      policy_note
    ) values (
      'MATERIALS_STORES_OVERHEAD','MATERIALS_STORES_STANDARD_RM_PM_V1',1,'DRAFT',
      'PROVISIONAL_OPERATIONAL','PREVIEW_ONLY','CLIENT_READY','DATA_QUALITY_READY',
      'STANDARD_RM_PM_WORKLOAD','2026-08-06',null,
      'costing','materials_stores_workload_policy',v_ms_policy_id,
      'Materials / Stores overhead is allocated by a unified SKU workload derived from governed standard RM and PM evidence. Product RM complexity is based on distinct required purchase items plus increments for repeated RM lines and form conversion, scaled by monthly SKU base quantity against Product RM reference output. SKU PM complexity is based on distinct PM items plus override increments, scaled by monthly SKU units against pack-format reference output. RM and PM workload are added, blocked rows retain zero allocation, and the frozen pool is distributed across eligible workload shares. Actual issue activity is intentionally excluded; later evidence changes redistribute only through a new exact run.'
    );
  end if;
end;
$$;

create or replace function public.rpc_get_cost_driver_governance_detail(p_cost_element_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
as $$
declare
  v_code text := upper(btrim(p_cost_element_code));
  v_catalog costing.cost_element_driver_catalog%rowtype;
  v_registry jsonb;
  v_detail jsonb;
  v_actions jsonb := '[]'::jsonb;
  v_owner_module text;
  v_status text;
  v_id bigint;
  v_policy_id bigint;
begin
  perform public.require_permission('module:cost-build-manager', false);
  if nullif(v_code,'') is null then raise exception 'cost_element_code is required'; end if;
  select * into v_catalog from costing.cost_element_driver_catalog where cost_element_code=v_code;
  if not found then raise exception 'Cost element % is not registered',v_code; end if;
  select to_jsonb(r) into v_registry from costing.v_cost_driver_policy_registry r where r.cost_element_code=v_code;

  if v_code='DIRECT_LABOUR' then
    v_owner_module:='module:production-route-manager';
    select p.id,p.status into v_policy_id,v_status
    from costing.direct_labour_workload_policy p
    order by p.policy_version desc,p.id desc limit 1;
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.direct_labour_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.direct_labour_workload_policy p where p.id=v_policy_id),
      'validation',case when v_policy_id is null then null else costing.fn_validate_direct_labour_workload_policy(v_policy_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.direct_labour_scope_factor f where f.policy_id=v_policy_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.direct_labour_behaviour_factor f where f.policy_id=v_policy_id),'[]'::jsonb),
      'formula_display','Rounded standard batches × effective Direct Labour route-attendance intensity',
      'canonical_source_module','module:production-route-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:production-route-manager','rpc','rpc_submit_direct_labour_workload_policy_for_review','record_id',v_policy_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:production-route-manager','rpc','rpc_approve_direct_labour_workload_policy','record_id',v_policy_id)
    );
  elsif v_code='PRODUCTION_OVERHEAD' then
    v_owner_module:='module:production-route-manager';
    select p.id,p.status into v_policy_id,v_status
    from costing.production_overhead_workload_policy p
    order by p.policy_version desc,p.id desc limit 1;
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.production_overhead_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.production_overhead_workload_policy p where p.id=v_policy_id),
      'validation',case when v_policy_id is null then null else costing.fn_validate_production_overhead_workload_policy(v_policy_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.production_overhead_scope_factor f where f.policy_id=v_policy_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.production_overhead_behaviour_factor f where f.policy_id=v_policy_id),'[]'::jsonb),
      'resource_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.resource_class_code) from costing.production_overhead_resource_factor f where f.policy_id=v_policy_id),'[]'::jsonb),
      'formula_display','Rounded standard batches × effective Production Overhead route factor',
      'canonical_source_module','module:production-route-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:production-route-manager','rpc','rpc_submit_production_overhead_workload_policy_for_review','record_id',v_policy_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:production-route-manager','rpc','rpc_approve_production_overhead_workload_policy','record_id',v_policy_id)
    );
  elsif v_code='QUALITY_CONTROL_OVERHEAD' then
    v_owner_module:='module:cost-build-manager';
    select e.id,e.lifecycle_status,e.specialised_policy_id into v_id,v_status,v_policy_id
    from costing.cost_driver_policy_envelope e
    where e.cost_element_code=v_code
    order by e.policy_version desc,e.id desc limit 1;
    select jsonb_build_object(
      'envelope_history',coalesce((select jsonb_agg(to_jsonb(e) order by e.policy_version desc,e.id desc) from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code),'[]'::jsonb),
      'current_envelope',(select to_jsonb(e) from costing.cost_driver_policy_envelope e where e.id=v_id),
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.version_no desc,p.id desc) from costing.qc_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.qc_workload_policy p where p.id=v_policy_id),
      'validation',case when v_id is null then null else costing.fn_validate_cost_driver_policy_envelope(v_id) end,
      'specialised_validation',jsonb_build_object(
        'valid',v_policy_id is not null and exists(select 1 from costing.qc_workload_policy p where p.id=v_policy_id and p.policy_status='ACTIVE'),
        'unique_active_policy_2026_08_06',(select count(*) from costing.qc_workload_policy p where p.policy_status='ACTIVE' and p.effective_from<='2026-08-06' and (p.effective_to is null or p.effective_to>='2026-08-06'))=1,
        'run80_recipient_products',(select count(*) from costing.product_qc_workload_snapshot where refresh_run_id=80),
        'run80_resolved_products',(select count(*) from costing.product_qc_workload_snapshot where refresh_run_id=80 and workload_status='READY'),
        'run80_blocked_products',(select count(*) from costing.product_qc_workload_snapshot where refresh_run_id=80 and workload_status='BLOCKED'),
        'run80_pool_reconciled',abs((select coalesce(sum(product_qc_allocation_amount),0)-max(quality_control_pool_amount) from costing.product_qc_allocation_snapshot where refresh_run_id=80))<=0.000001
      ),
      'formula_display','Distinct analytical-method base workload + additional required-parameter increment',
      'formula_explanation',jsonb_build_object(
        'title','Effective-spec analytical method workload',
        'purpose','Allocate Quality Control overhead according to the analytical workload required by each Product’s governed effective finished-goods specification.',
        'equation','Product QC workload = Σ[1.00 base unit per distinct analytical method + 0.25 × additional required specification lines under that method]. Product allocation = frozen QC pool × Product workload ÷ total resolved eligible Product workload.',
        'calculation_steps',jsonb_build_array(
          'Resolve the effective FG protocol and base specification for every costing-recipient Product.',
          'Keep required analytical specification lines only.',
          'Group those required lines by analytical method.',
          'Assign one base workload unit to each distinct method.',
          'Add 0.25 workload unit for every required line after the first under the same method.',
          'Sum method workloads to obtain Product QC workload.',
          'Allocate the complete frozen QC pool across Products with resolved positive workload.',
          'Absorb Product allocation to Product base UOM using governed monthly Product quantity.',
          'Convert the Product base-UOM rate to each SKU using governed SKU base quantity per unit.'
        ),
        'evidence_basis',jsonb_build_array(
          'Effective FG protocol mapping and effective FG base specification.',
          'Required analytical tests and their resolved analytical methods.',
          'Frozen exact-run Quality Control pool.',
          'Governed monthly Product quantity and SKU base-UOM conversion.'
        ),
        'status_treatment','Products missing protocol/specification/method evidence remain BLOCKED with zero allocation. Products with valid QC workload but assumed/default absorption quantity remain REVIEW_REQUIRED. Resolved Products receive the complete frozen pool according to workload share.',
        'redistribution_rule','When blocked evidence is later corrected, redistribution occurs only through a new exact run; historical runs remain immutable.',
        'interpretation','Products requiring more distinct analytical methods or more parameters under those methods receive a larger share of Quality Control overhead.',
        'future_improvements','Future policy versions may incorporate validated method-specific time, equipment intensity, external testing cost or sampling-frequency evidence after reliable operational data becomes available.'
      ),
      'canonical_source_module','module:cost-build-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:cost-build-manager','rpc','rpc_submit_cost_driver_policy_envelope_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:cost-build-manager','rpc','rpc_approve_cost_driver_policy_envelope','record_id',v_id)
    );
  elsif v_code='MATERIALS_STORES_OVERHEAD' then
    v_owner_module:='module:cost-build-manager';
    select e.id,e.lifecycle_status,e.specialised_policy_id into v_id,v_status,v_policy_id
    from costing.cost_driver_policy_envelope e
    where e.cost_element_code=v_code
    order by e.policy_version desc,e.id desc limit 1;
    select jsonb_build_object(
      'envelope_history',coalesce((select jsonb_agg(to_jsonb(e) order by e.policy_version desc,e.id desc) from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code),'[]'::jsonb),
      'current_envelope',(select to_jsonb(e) from costing.cost_driver_policy_envelope e where e.id=v_id),
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.materials_stores_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.materials_stores_workload_policy p where p.id=v_policy_id),
      'validation',case when v_id is null then null else costing.fn_validate_cost_driver_policy_envelope(v_id) end,
      'specialised_validation',jsonb_build_object(
        'valid',v_policy_id is not null and exists(select 1 from costing.materials_stores_workload_policy p where p.id=v_policy_id and p.is_active),
        'unique_active_policy_2026_08_06',(select count(*) from costing.materials_stores_workload_policy p where p.is_active and p.effective_from<='2026-08-06' and (p.effective_to is null or p.effective_to>='2026-08-06'))=1,
        'run80_sku_rows',(select count(*) from costing.sku_materials_stores_workload_snapshot where refresh_run_id=80),
        'run80_ready_rows',(select count(*) from costing.sku_materials_stores_workload_snapshot where refresh_run_id=80 and allocation_status='READY'),
        'run80_review_rows',(select count(*) from costing.sku_materials_stores_workload_snapshot where refresh_run_id=80 and allocation_status='REVIEW_REQUIRED'),
        'run80_blocked_rows',(select count(*) from costing.sku_materials_stores_workload_snapshot where refresh_run_id=80 and allocation_status='BLOCKED'),
        'run80_pool_reconciled',abs((select coalesce(sum(monthly_sku_allocation_amount),0)-max(frozen_pool_amount) from costing.sku_materials_stores_allocation_snapshot where refresh_run_id=80))<=0.000001,
        'active_component_classification_count',(select count(*) from costing.materials_stores_component_classification where is_active)
      ),
      'formula_display','Unified standard RM workload + standard PM workload',
      'formula_explanation',jsonb_build_object(
        'title','Standard RM and PM material-handling workload',
        'purpose','Allocate Materials / Stores overhead according to the standard material-definition and handling complexity attributable to each SKU, without using volatile actual issue activity.',
        'equation','RM workload = [distinct required RM items + 0.25 × repeated RM lines + 0.25 × RM form-conversion lines] × monthly SKU base quantity ÷ Product RM reference output. PM workload = [distinct required PM items + 0.25 × PM override lines] × monthly SKU units ÷ SKU pack-format reference output. Unified workload = RM workload + PM workload. Allocation = frozen Stores pool × SKU unified workload ÷ company eligible unified workload.',
        'calculation_steps',jsonb_build_array(
          'Resolve governed monthly SKU units and monthly SKU base quantity.',
          'Read required Product RM standard lines and distinct purchase-item identities.',
          'Add increments for repeated RM lines and RM form-conversion lines.',
          'Scale Product RM complexity by monthly SKU base quantity against Product RM reference output.',
          'Read required SKU PM standard lines and distinct packaging-item identities.',
          'Add increments for PM override lines and apply the governed PM multiplier.',
          'Scale SKU PM complexity by monthly SKU units against pack-format reference output.',
          'Add RM and PM workload to obtain unified SKU workload.',
          'Allocate the complete frozen Materials / Stores pool across nonblocked SKU workload shares.',
          'Divide each monthly allocation by governed monthly SKU units to obtain per-SKU overhead.'
        ),
        'evidence_basis',jsonb_build_array(
          'Governed Product RM material-cost-line standards.',
          'Governed SKU PM material-cost-line standards.',
          'Product RM reference output and SKU pack-format reference output.',
          'Governed monthly SKU quantity and base quantity.',
          'Frozen exact-run Materials / Stores pool.'
        ),
        'status_treatment','Rows with missing reference output, incompatible RM UOM or no RM/PM evidence remain BLOCKED with zero allocation. Assumed/default monthly quantities and unclassified zero-RM/zero-PM cases remain REVIEW_REQUIRED. The complete pool is allocated among nonblocked positive-workload rows.',
        'redistribution_rule','When standards, reference outputs, classifications or monthly evidence are corrected, redistribution occurs only through a new exact run; historical runs remain immutable.',
        'interpretation','SKUs with more material definitions, repeated/form-converted RM handling, PM overrides or higher monthly throughput receive a larger share of Materials / Stores overhead.',
        'future_improvements','Future policy versions may incorporate governed handling-frequency, storage-zone, temperature-control, hazardous-material or verified issue-transaction evidence once reliable operational data is available.'
      ),
      'canonical_source_module','module:cost-build-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:cost-build-manager','rpc','rpc_submit_cost_driver_policy_envelope_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:cost-build-manager','rpc','rpc_approve_cost_driver_policy_envelope','record_id',v_id)
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
$$;

revoke all on function public.rpc_get_cost_driver_governance_detail(text) from public,anon;
grant execute on function public.rpc_get_cost_driver_governance_detail(text) to authenticated;