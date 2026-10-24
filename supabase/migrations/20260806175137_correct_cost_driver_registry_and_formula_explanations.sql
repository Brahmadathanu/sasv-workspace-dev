-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_cost_driver_policy_registry as
with latest_envelope as (
  select distinct on (e.cost_element_code)
    e.*
  from costing.cost_driver_policy_envelope e
  order by e.cost_element_code,
    case e.lifecycle_status
      when 'APPROVED' then 1
      when 'REVIEW_REQUIRED' then 2
      when 'DRAFT' then 3
      else 4
    end,
    e.policy_version desc,
    e.id desc
),
latest_dl as (
  select p.*
  from costing.direct_labour_workload_policy p
  order by p.policy_version desc, p.id desc
  limit 1
),
latest_poh as (
  select p.*
  from costing.production_overhead_workload_policy p
  order by p.policy_version desc, p.id desc
  limit 1
)
select
  c.cost_element_code,
  c.cost_element_label,
  c.allocation_pool,
  c.driver_domain,
  c.specialised_policy_table as catalog_specialised_policy_table,
  c.requires_workload,
  c.requires_route_coverage,
  c.sort_order,
  case
    when c.cost_element_code='DIRECT_LABOUR' then null::bigint
    when c.cost_element_code='PRODUCTION_OVERHEAD' then null::bigint
    else e.id
  end as envelope_id,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.policy_code
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_code
    else e.policy_code
  end as policy_code,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.policy_version
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_version
    else e.policy_version
  end as policy_version,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.status
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.status
    else e.lifecycle_status
  end as lifecycle_status,
  case
    when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD')
      then 'FINAL_SERVER_PENDING_CUTOVER'::text
    else e.maturity_status
  end as maturity_status,
  case
    when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD')
      then 'SHADOW_READY'::text
    else e.cutover_status
  end as cutover_status,
  case
    when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD')
      then 'CLIENT_PENDING'::text
    else e.client_status
  end as client_status,
  case
    when c.cost_element_code in ('DIRECT_LABOUR','PRODUCTION_OVERHEAD')
      then 'DATA_QUALITY_READY'::text
    else e.data_quality_status
  end as data_quality_status,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.formula_type
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.formula_type
    else e.formula_type
  end as formula_type,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.effective_from
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.effective_from
    else e.effective_from
  end as effective_from,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.effective_to
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.effective_to
    else e.effective_to
  end as effective_to,
  case
    when c.cost_element_code='DIRECT_LABOUR' then 'costing'::text
    when c.cost_element_code='PRODUCTION_OVERHEAD' then 'costing'::text
    else e.specialised_policy_schema
  end as specialised_policy_schema,
  case
    when c.cost_element_code='DIRECT_LABOUR' then 'direct_labour_workload_policy'::text
    when c.cost_element_code='PRODUCTION_OVERHEAD' then 'production_overhead_workload_policy'::text
    else e.specialised_policy_table
  end as specialised_policy_table,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.id
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.id
    else e.specialised_policy_id
  end as specialised_policy_id,
  e.supersedes_envelope_id,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.approval_reference
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.approval_reference
    else e.approval_reference
  end as approval_reference,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.policy_note
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.policy_note
    else e.policy_note
  end as policy_note,
  e.validation_note,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.created_at
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.created_at
    else e.created_at
  end as created_at,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.updated_at
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.updated_at
    else e.updated_at
  end as updated_at,
  case
    when c.cost_element_code='DIRECT_LABOUR' and dl.status in ('REVIEW_REQUIRED','APPROVED') then dl.updated_at
    when c.cost_element_code='PRODUCTION_OVERHEAD' and poh.status in ('REVIEW_REQUIRED','APPROVED') then poh.updated_at
    else e.submitted_at
  end as submitted_at,
  case
    when c.cost_element_code='DIRECT_LABOUR' then dl.approved_at
    when c.cost_element_code='PRODUCTION_OVERHEAD' then poh.approved_at
    else e.approved_at
  end as approved_at,
  case
    when c.cost_element_code='DIRECT_LABOUR' then
      case
        when dl.id is null then 'UNREGISTERED'
        when dl.status='APPROVED' then 'APPROVED_NOT_CUT_OVER'
        when dl.status='REVIEW_REQUIRED' then 'POLICY_REVIEW_REQUIRED'
        when dl.status='DRAFT' then 'POLICY_DRAFT'
        else dl.status
      end
    when c.cost_element_code='PRODUCTION_OVERHEAD' then
      case
        when poh.id is null then 'UNREGISTERED'
        when poh.status='APPROVED' then 'APPROVED_NOT_CUT_OVER'
        when poh.status='REVIEW_REQUIRED' then 'POLICY_REVIEW_REQUIRED'
        when poh.status='DRAFT' then 'POLICY_DRAFT'
        else poh.status
      end
    else
      case
        when e.id is null then 'UNREGISTERED'
        when e.lifecycle_status='APPROVED' and e.cutover_status='CUTOVER_ACTIVE' then 'ACTIVE_FINAL_POLICY'
        when e.lifecycle_status='APPROVED' then 'APPROVED_NOT_CUT_OVER'
        when e.lifecycle_status='REVIEW_REQUIRED' then 'POLICY_REVIEW_REQUIRED'
        when e.lifecycle_status='DRAFT' then 'POLICY_DRAFT'
        else e.lifecycle_status
      end
  end as registry_status,
  false as stage03_cutover_authorised
from costing.cost_element_driver_catalog c
left join latest_envelope e on e.cost_element_code=c.cost_element_code
left join latest_dl dl on c.cost_element_code='DIRECT_LABOUR'
left join latest_poh poh on c.cost_element_code='PRODUCTION_OVERHEAD'
where c.is_active;

create or replace function public.rpc_get_cost_driver_governance_detail(p_cost_element_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','costing','pg_temp'
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
  v_explanation jsonb;
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
    v_explanation:=jsonb_build_object(
      'title','Rounded standard batches × effective Direct Labour route-attendance intensity',
      'purpose','Allocate the unified Direct Labour and packing-labour pool according to the labour attendance required by each Product’s governed production route, rather than by sales value or simple output quantity alone.',
      'equation','Product DL workload = rounded standard batch count × Σ(scope factor × attendance factor × expected occurrences × standard cycles). Product DL allocation = total DL pool × Product workload ÷ total eligible Product workload.',
      'calculation_steps',jsonb_build_array(
        'Resolve the governed monthly Product quantity from actual, assumption or default evidence.',
        'Divide by the preferred batch size and round upward to obtain the standard batch count.',
        'Resolve the effective Product route and each applicable process step.',
        'Apply Direct Labour scope and attendance factors to every step, including occurrence and cycle counts.',
        'Sum step factors to obtain route-attendance intensity per batch.',
        'Multiply rounded batches by route-attendance intensity to obtain Product labour workload.',
        'Allocate the full Direct Labour pool among eligible Products in proportion to workload.',
        'Distribute each Product allocation to its SKUs using governed within-Product quantity shares.'
      ),
      'evidence_basis',jsonb_build_array('Monthly Product quantity evidence','Preferred batch-size reference','Effective Product/Route Family steps','Direct Labour scope factors','Attendance behaviour factors','SKU within-Product quantity shares'),
      'status_treatment','Products with valid workload are allocated. Quantity assumptions/defaults remain REVIEW_REQUIRED. Products lacking valid route, batch-size or positive workload remain BLOCKED with zero allocation.',
      'redistribution_rule','When blocked Products later become eligible, the pool is redistributed only in a new exact run. Historical runs are never rewritten.',
      'interpretation','High per-unit labour for a very low-volume Product can be valid because even a small monthly requirement may still require one complete production batch.',
      'future_improvements','Future versions may incorporate verified crew-size or standard-hour evidence, but version 2 intentionally avoids unproven multipliers.'
    );
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.direct_labour_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.direct_labour_workload_policy p where p.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_direct_labour_workload_policy(v_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.direct_labour_scope_factor f where f.policy_id=v_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.direct_labour_behaviour_factor f where f.policy_id=v_id),'[]'::jsonb),
      'formula_display',v_explanation->>'title',
      'formula_explanation',v_explanation,
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
    v_explanation:=jsonb_build_object(
      'title','Rounded standard batches × effective Production Overhead route factor',
      'purpose','Allocate the unified Production Overhead pool according to the production-route workload generated by each eligible Product.',
      'equation','Product POH workload = rounded standard batch count × Σ(scope factor × behaviour factor × resource factor × expected occurrences × standard cycles). Product POH allocation = total POH pool × Product workload ÷ total eligible Product workload.',
      'calculation_steps',jsonb_build_array(
        'Resolve monthly Product quantity and preferred batch size.',
        'Round the required batch count upward.',
        'Resolve effective route steps and POH scope.',
        'Apply the policy’s behaviour and resource factors with occurrences and cycles.',
        'Sum step factors to obtain the route factor per batch.',
        'Multiply rounded batches by route factor.',
        'Allocate the full POH pool among eligible Products by workload share.',
        'Distribute Product allocation to SKUs using governed within-Product quantity shares.'
      ),
      'evidence_basis',jsonb_build_array('Monthly Product quantity','Preferred batch-size reference','Effective route steps','POH scope factors','Behaviour factors','Resource factors','SKU within-Product quantity shares'),
      'status_treatment','Eligible Products receive allocation. Blocked Products remain zero and keep their blocker; one blocked Product does not suppress valid Products.',
      'redistribution_rule','Eligibility changes redistribute the pool prospectively in a new exact run only.',
      'interpretation','Rounded batches recognise that fixed production overhead is incurred by running a batch even when monthly demand is below one full batch.',
      'future_improvements','Behaviour and resource dimensions are retained for future versions; the currently approved policy keeps their factors neutral unless explicitly governed.'
    );
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.production_overhead_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.production_overhead_workload_policy p where p.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_production_overhead_workload_policy(v_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.production_overhead_scope_factor f where f.policy_id=v_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.production_overhead_behaviour_factor f where f.policy_id=v_id),'[]'::jsonb),
      'resource_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.resource_class_code) from costing.production_overhead_resource_factor f where f.policy_id=v_id),'[]'::jsonb),
      'formula_display',v_explanation->>'title',
      'formula_explanation',v_explanation,
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
    if v_code in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD') then
      v_explanation:=jsonb_build_object(
        'title','Governed Product sales-unit share',
        'purpose',case when v_code='ADMIN_OVERHEAD'
          then 'Allocate the unified Administration pool across Products according to their share of governed sales units because these costs support the overall commercial operation rather than a specific manufacturing route or batch.'
          else 'Allocate the separate Finance/Admin pool across Products using the same governed sales-unit-share driver because finance and administrative processing are broad organisational support activities rather than batch-specific manufacturing activities.' end,
        'equation','Product allocation = total pool × resolved Product sales units ÷ resolved company sales units. SKU cost = Product allocation distributed through governed SKU-within-Product quantity shares.',
        'calculation_steps',jsonb_build_array(
          'Resolve sales units for every SKU using actual evidence, governed assumptions or default policy.',
          'Aggregate SKU sales units to Product level.',
          'Calculate each Product’s share of total company sales units.',
          'Multiply the pool by the Product share.',
          'Distribute the Product allocation to its SKUs using governed within-Product quantity shares.'
        ),
        'evidence_basis',jsonb_build_array('Resolved SKU sales units','Resolved Product sales units','Resolved company sales units','SKU within-Product quantity shares'),
        'status_treatment','Actual-supported rows are READY. Assumption/default-supported rows remain REVIEW_REQUIRED. Invalid quantity evidence remains BLOCKED.',
        'redistribution_rule','Changes in sales evidence or eligibility redistribute the pool only in a new exact run.',
        'interpretation','The driver is a practical common organisational-support basis; it deliberately avoids false manufacturing precision for costs not caused by routes, batches or machines.',
        'future_improvements','The driver may be reviewed if reliable transaction-count, document-volume or service-consumption evidence becomes available, but any replacement requires a new governed policy version.'
      );
    else
      v_explanation:=jsonb_build_object(
        'title',coalesce(v_registry->>'formula_type','Policy not yet registered'),
        'purpose','Policy architecture is not yet registered in the canonical governance envelope.',
        'equation',null,
        'calculation_steps','[]'::jsonb,
        'evidence_basis','[]'::jsonb,
        'status_treatment','No lifecycle action is available until a governed policy is created.',
        'redistribution_rule',null,
        'interpretation',null,
        'future_improvements','Complete the dedicated policy-discovery and registration gate.'
      );
    end if;
    select jsonb_build_object(
      'envelope_history',coalesce((select jsonb_agg(to_jsonb(e) order by e.policy_version desc,e.id desc) from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code),'[]'::jsonb),
      'current_envelope',(select to_jsonb(e) from costing.cost_driver_policy_envelope e where e.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_cost_driver_policy_envelope(v_id) end,
      'formula_display',v_explanation->>'title',
      'formula_explanation',v_explanation,
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

revoke all on function public.rpc_get_cost_driver_governance_detail(text) from public, anon;
grant execute on function public.rpc_get_cost_driver_governance_detail(text) to authenticated, service_role;