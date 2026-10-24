-- backfilled from live schema_migrations on 2026-10-24, CI-016
begin;

create table if not exists costing.marketing_allocation_policy (
  id bigserial primary key,
  policy_code text not null,
  policy_version integer not null,
  effective_from date not null,
  effective_to date,
  lookback_months integer not null default 12,
  monetary_basis text not null,
  common_allocation_level text not null,
  regional_decomposition_mode text not null,
  actual_precedence boolean not null default true,
  retain_signed_returns boolean not null default true,
  assumption_fallback_mode text not null,
  regional_physical_basis_hierarchy jsonb not null,
  governed_region_codes jsonb not null,
  policy_note text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(policy_code,policy_version),
  check(effective_to is null or effective_to>=effective_from),
  check(lookback_months>0),
  check(monetary_basis='SIGNED_TAX_EXCLUSIVE_BILLED_SALES_VALUE'),
  check(common_allocation_level='PRODUCT'),
  check(regional_decomposition_mode='SAME_POOL_PRODUCT_REGION_MONETARY_SHARE'),
  check(assumption_fallback_mode='APPROVED_ONLY_WHEN_NO_ELIGIBLE_ACTUAL_HISTORY')
);

create or replace function costing.fn_guard_marketing_allocation_policy()
returns trigger language plpgsql
set search_path='costing','public','pg_temp'
as $$
begin
  if tg_op='DELETE' then
    raise exception 'Marketing allocation policies are append-only and cannot be deleted';
  end if;
  if old.is_active and new is distinct from old then
    raise exception 'Active Marketing allocation policy is immutable; create a new version';
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_guard_marketing_allocation_policy on costing.marketing_allocation_policy;
create trigger trg_guard_marketing_allocation_policy
before update or delete on costing.marketing_allocation_policy
for each row execute function costing.fn_guard_marketing_allocation_policy();

insert into costing.marketing_allocation_policy(
  policy_code,policy_version,effective_from,lookback_months,monetary_basis,
  common_allocation_level,regional_decomposition_mode,actual_precedence,
  retain_signed_returns,assumption_fallback_mode,regional_physical_basis_hierarchy,
  governed_region_codes,policy_note,is_active
)
select
  'MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1',1,date '2026-08-06',12,
  'SIGNED_TAX_EXCLUSIVE_BILLED_SALES_VALUE','PRODUCT',
  'SAME_POOL_PRODUCT_REGION_MONETARY_SHARE',true,true,
  'APPROVED_ONLY_WHEN_NO_ELIGIBLE_ACTUAL_HISTORY',
  jsonb_build_array('REGIONAL_ACTUAL_UNITS','REGIONAL_ASSUMPTION_UNITS','REGION_SCALED_COMMON_BASIS'),
  jsonb_build_array('IK','OK'),
  'One company Marketing pool is allocated by 12-month signed tax-exclusive billed sales value. Actual recipient-linked evidence has precedence; approved assumptions are permitted only where no eligible actual Product history exists. Signed returns remain in the monetary denominator. The same pool may be decomposed by Product × Region signed billed value for regional pricing/analysis; this is not a second regional cost pool. SKU absorption uses governed base quantities, with regional physical basis precedence of positive regional actual units, then approved regional assumption, then region-scaled common basis. Unresolved contexts remain Review Required or Blocked and are corrected only through future exact runs.',
  true
where not exists (
  select 1 from costing.marketing_allocation_policy
  where policy_code='MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1' and policy_version=1
);

alter table costing.sku_marketing_expense_allocation_snapshot
  add column if not exists marketing_policy_id bigint references costing.marketing_allocation_policy(id),
  add column if not exists marketing_policy_envelope_id bigint references costing.cost_driver_policy_envelope(id),
  add column if not exists marketing_pool_snapshot_id bigint references costing.cost_pool_monthly_snapshot(id);

alter table costing.sku_regional_marketing_expense_allocation_snapshot
  add column if not exists marketing_policy_id bigint references costing.marketing_allocation_policy(id),
  add column if not exists marketing_policy_envelope_id bigint references costing.cost_driver_policy_envelope(id),
  add column if not exists marketing_pool_snapshot_id bigint references costing.cost_pool_monthly_snapshot(id);

insert into costing.cost_driver_policy_envelope(
  cost_element_code,policy_code,policy_version,lifecycle_status,maturity_status,
  cutover_status,client_status,data_quality_status,formula_type,effective_from,
  specialised_policy_schema,specialised_policy_table,specialised_policy_id,
  policy_note,created_by
)
select
  'MARKETING_EXPENSE',p.policy_code,p.policy_version,'DRAFT','PROVISIONAL_OPERATIONAL',
  'PREVIEW_ONLY','CLIENT_READY','DATA_QUALITY_READY','SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION',
  p.effective_from,'costing','marketing_allocation_policy',p.id,
  p.policy_note,null
from costing.marketing_allocation_policy p
where p.policy_code='MARKETING_SIGNED_BILLED_VALUE_REGIONAL_DECOMPOSITION_V1'
  and p.policy_version=1
  and not exists (
    select 1 from costing.cost_driver_policy_envelope e
    where e.cost_element_code='MARKETING_EXPENSE'
      and e.policy_code=p.policy_code and e.policy_version=p.policy_version
  );

create or replace function costing.fn_resolve_marketing_allocation_policy(p_valuation_date date)
returns costing.marketing_allocation_policy
language plpgsql stable security definer
set search_path='costing','public','pg_temp'
as $$
declare v_policy costing.marketing_allocation_policy%rowtype; v_count integer;
begin
  if p_valuation_date is null then raise exception 'valuation_date is required'; end if;
  select count(*)::integer into v_count
  from costing.marketing_allocation_policy p
  join costing.cost_driver_policy_envelope e
    on e.specialised_policy_schema='costing'
   and e.specialised_policy_table='marketing_allocation_policy'
   and e.specialised_policy_id=p.id
   and e.cost_element_code='MARKETING_EXPENSE'
   and e.lifecycle_status='APPROVED'
   and e.effective_from<=p_valuation_date
   and (e.effective_to is null or e.effective_to>=p_valuation_date)
  where p.is_active and p.effective_from<=p_valuation_date
    and (p.effective_to is null or p.effective_to>=p_valuation_date);
  if v_count<>1 then raise exception 'Exactly one approved Marketing allocation policy must resolve for %, found %',p_valuation_date,v_count; end if;
  select p.* into v_policy
  from costing.marketing_allocation_policy p
  join costing.cost_driver_policy_envelope e
    on e.specialised_policy_schema='costing'
   and e.specialised_policy_table='marketing_allocation_policy'
   and e.specialised_policy_id=p.id
   and e.cost_element_code='MARKETING_EXPENSE'
   and e.lifecycle_status='APPROVED'
   and e.effective_from<=p_valuation_date
   and (e.effective_to is null or e.effective_to>=p_valuation_date)
  where p.is_active and p.effective_from<=p_valuation_date
    and (p.effective_to is null or p.effective_to>=p_valuation_date)
  order by p.policy_version desc,p.id desc limit 1;
  return v_policy;
end;
$$;

-- Governance detail: add specialised Marketing payload and manager-readable logic.
create or replace function public.rpc_get_cost_driver_governance_detail(p_cost_element_code text)
returns jsonb
language plpgsql security definer
set search_path='public','costing','pg_temp'
as $$
declare
  v_code text := upper(btrim(p_cost_element_code));
  v_catalog costing.cost_element_driver_catalog%rowtype;
  v_registry jsonb; v_detail jsonb; v_actions jsonb := '[]'::jsonb;
  v_owner_module text; v_status text; v_id bigint; v_policy_id bigint;
begin
  perform public.require_permission('module:cost-build-manager', false);
  if nullif(v_code,'') is null then raise exception 'cost_element_code is required'; end if;
  select * into v_catalog from costing.cost_element_driver_catalog where cost_element_code=v_code;
  if not found then raise exception 'Cost element % is not registered',v_code; end if;
  select to_jsonb(r) into v_registry from costing.v_cost_driver_policy_registry r where r.cost_element_code=v_code;

  if v_code='DIRECT_LABOUR' then
    v_owner_module:='module:production-route-manager';
    select p.id,p.status into v_id,v_status from costing.direct_labour_workload_policy p order by p.policy_version desc,p.id desc limit 1;
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.direct_labour_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.direct_labour_workload_policy p where p.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_direct_labour_workload_policy(v_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.direct_labour_scope_factor f where f.policy_id=v_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.direct_labour_behaviour_factor f where f.policy_id=v_id),'[]'::jsonb),
      'formula_display','Rounded standard batches × effective Direct Labour route-attendance intensity',
      'formula_explanation',jsonb_build_object(
        'title','Direct Labour — rounded-batch route attendance',
        'purpose','Allocate the unified Direct Labour and Packing Labour pool according to governed production-route attendance workload.',
        'equation','Product workload = rounded standard batches × Σ(scope factor × attendance factor × expected occurrences × standard cycles); Product allocation = Direct Labour pool × Product workload ÷ total eligible Product workload.',
        'calculation_steps',jsonb_build_array('Resolve governed monthly Product quantity.','Resolve preferred batch size and round upward to standard batches.','Resolve effective Product route and steps.','Apply Direct Labour scope and attendance factors to each step.','Sum step workload into route intensity per batch.','Multiply route intensity by rounded batches.','Allocate the full pool among eligible Products by workload share.','Distribute Product allocation to SKUs using governed within-Product quantity shares.'),
        'evidence_basis',jsonb_build_array('Governed monthly Product/SKU quantity basis.','Preferred batch-size governance.','Effective Product route and route-step evidence.','Direct Labour scope and attendance behaviour factors.'),
        'status_treatment','Eligible Products receive allocation; assumption/default quantity remains REVIEW_REQUIRED; missing route, batch size or positive workload remains BLOCKED with zero allocation.',
        'redistribution_rule','Later evidence changes redistribute only through a new exact run; historical runs remain immutable.',
        'interpretation','The driver measures standard labour attendance burden rather than sales volume or actual payroll hours.',
        'future_improvements','Future versions may incorporate validated activity time or crew evidence without rewriting historical policy versions.'
      ),
      'canonical_source_module','module:production-route-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:production-route-manager','rpc','rpc_submit_direct_labour_workload_policy_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:production-route-manager','rpc','rpc_approve_direct_labour_workload_policy','record_id',v_id)
    );
  elsif v_code='PRODUCTION_OVERHEAD' then
    v_owner_module:='module:production-route-manager';
    select p.id,p.status into v_id,v_status from costing.production_overhead_workload_policy p order by p.policy_version desc,p.id desc limit 1;
    select jsonb_build_object(
      'policy_rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.policy_version desc,p.id desc) from costing.production_overhead_workload_policy p),'[]'::jsonb),
      'current_policy',(select to_jsonb(p) from costing.production_overhead_workload_policy p where p.id=v_id),
      'validation',case when v_id is null then null else costing.fn_validate_production_overhead_workload_policy(v_id) end,
      'scope_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.scope_code) from costing.production_overhead_scope_factor f where f.policy_id=v_id),'[]'::jsonb),
      'behaviour_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.behaviour_code) from costing.production_overhead_behaviour_factor f where f.policy_id=v_id),'[]'::jsonb),
      'resource_factors',coalesce((select jsonb_agg(to_jsonb(f) order by f.resource_class_code) from costing.production_overhead_resource_factor f where f.policy_id=v_id),'[]'::jsonb),
      'formula_display','Rounded standard batches × effective Production Overhead route factor',
      'formula_explanation',jsonb_build_object(
        'title','Production Overhead — rounded-batch route workload','purpose','Allocate the unified Production Overhead pool according to governed production-route overhead workload.','equation','Product workload = rounded standard batches × Σ(scope × behaviour × resource × occurrences × cycles); Product allocation = POH pool × Product workload ÷ total eligible workload.','calculation_steps',jsonb_build_array('Resolve monthly Product quantity.','Resolve rounded standard batches.','Resolve effective route and POH-scoped steps.','Apply behaviour/resource factors.','Sum route factor and multiply by rounded batches.','Allocate pool by eligible workload share.'),'evidence_basis',jsonb_build_array('Monthly Product quantity','Preferred batch size','Effective production route','POH scope/behaviour/resource factors'),'status_treatment','Blocked Products retain zero; valid Products continue to absorb the full pool under partial coverage.','redistribution_rule','Future evidence changes apply only through a later exact run.','interpretation','Measures standard production-overhead burden created by batch/route complexity.','future_improvements','Future versions may use validated machine-time or utility evidence where reliably available.'
      ),
      'canonical_source_module','module:production-route-manager'
    ) into v_detail;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:production-route-manager','rpc','rpc_submit_production_overhead_workload_policy_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:production-route-manager','rpc','rpc_approve_production_overhead_workload_policy','record_id',v_id)
    );
  else
    v_owner_module:='module:cost-build-manager';
    select e.id,e.lifecycle_status,e.specialised_policy_id into v_id,v_status,v_policy_id
    from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code
    order by e.policy_version desc,e.id desc limit 1;
    if v_code='MARKETING_EXPENSE' then
      select jsonb_build_object(
        'envelope_history',coalesce((select jsonb_agg(to_jsonb(e) order by e.policy_version desc,e.id desc) from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code),'[]'::jsonb),
        'current_envelope',(select to_jsonb(e) from costing.cost_driver_policy_envelope e where e.id=v_id),
        'current_policy',(select to_jsonb(p) from costing.marketing_allocation_policy p where p.id=v_policy_id),
        'validation',case when v_id is null then null else costing.fn_validate_cost_driver_policy_envelope(v_id) end,
        'formula_display','12-month signed billed-value share with same-pool regional decomposition',
        'formula_explanation',jsonb_build_object(
          'title','Marketing — signed billed-value allocation with regional decomposition',
          'purpose','Allocate one company Marketing expense pool by commercial value generated, while preserving IK/OK regional traceability for pricing and analysis without inventing separate regional cost pools.',
          'equation','Common Product allocation = Marketing pool × resolved Product signed billed sales value ÷ resolved company signed billed sales value. Regional Product×Region allocation = same Marketing pool × resolved Product×Region signed billed sales value ÷ resolved company signed billed sales value.',
          'calculation_steps',jsonb_build_array('Freeze 12 months of recipient-linked signed tax-exclusive billed sales evidence at the exact-run source cutoff.','Exclude sample SKUs, RM sales, unmapped SKU/godown rows and historical Products with no current recipient from the eligible monetary denominator.','Resolve Product monetary value from actual signed billed sales; use an approved monetary assumption only when the Product has no eligible actual history.','Retain zero and negative signed history rather than clipping returns.','Allocate the single Marketing pool across Products by resolved monetary share.','Absorb Product allocation to SKUs using governed Product base quantity and SKU base conversion.','For regional analysis, decompose the same pool by Product×Region signed billed value.','Within each Product×Region, use positive regional actual units, then approved regional assumption, then region-scaled common physical basis; otherwise block the regional absorption context.'),
          'evidence_basis',jsonb_build_array('Tally signed billed sales rows frozen at exact-run cutoff.','Canonical SKU aliases and Product hierarchy.','Godown aliases and governed IK/OK regions.','Governed monthly SKU/Product quantity basis.','Approved Product and regional commercial-sales assumptions only where actual history is absent.','Frozen Marketing pool snapshot in future exact runs.'),
          'status_treatment','Positive actual evidence may be READY; approved assumptions, no-history, zero/negative signed history or fallback physical bases remain REVIEW_REQUIRED; unresolved regional monetary/physical contexts remain BLOCKED.',
          'redistribution_rule','Any later sales, mapping or assumption change redistributes only in a new exact run. Historical snapshots remain immutable.',
          'interpretation','Marketing is one common company cost pool. Regional values are a decomposition of that same pool for regional pricing/analysis, not additional regional cost pools.',
          'future_improvements','Future policy versions may introduce governed region-tagged expense pools only if accounting evidence itself gains reliable regional attribution. Additional commercial dimensions may be added without rewriting this version.'
        ),
        'operational_evidence',jsonb_build_object(
          'reference_run_id',80,'reference_pool_amount',2931523.2475,'common_rows',678,'common_ready',592,'common_review_required',86,'common_blocked',0,
          'resolved_company_sales_value',196789958.38666666,'regional_rows',1356,'regional_ready',1093,'regional_review_required',137,'regional_blocked',126,
          'ik_monetary_share',0.8010871305075078,'ok_monetary_share',0.1989128694924922,'negative_product_region_contexts',8,'negative_signed_value',-5553.32,
          'stage03_cutover_authorised',false
        ),
        'canonical_source_module','module:cost-build-manager'
      ) into v_detail;
    else
      select jsonb_build_object(
        'envelope_history',coalesce((select jsonb_agg(to_jsonb(e) order by e.policy_version desc,e.id desc) from costing.cost_driver_policy_envelope e where e.cost_element_code=v_code),'[]'::jsonb),
        'current_envelope',(select to_jsonb(e) from costing.cost_driver_policy_envelope e where e.id=v_id),
        'validation',case when v_id is null then null else costing.fn_validate_cost_driver_policy_envelope(v_id) end,
        'formula_display',case when v_code in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD') then 'Governed Product sales-unit share' else coalesce(v_registry->>'formula_type','Not registered') end,
        'formula_explanation',case when v_code in ('ADMIN_OVERHEAD','FINANCE_ADMIN_OVERHEAD') then jsonb_build_object(
          'title',case when v_code='ADMIN_OVERHEAD' then 'Administration — Product sales-unit share' else 'Finance/Admin — Product sales-unit share' end,
          'purpose','Allocate this non-manufacturing support pool across Products using governed resolved Product sales units, then distribute within Product using governed SKU quantity shares.',
          'equation','Product allocation = pool × Product resolved sales units ÷ company resolved sales units; SKU allocation = Product allocation × governed SKU-within-Product quantity share.',
          'calculation_steps',jsonb_build_array('Resolve governed monthly Product/SKU sales units.','Calculate each Product share of company resolved sales units.','Allocate the full pool to Products by that share.','Distribute each Product allocation to its SKUs using governed within-Product quantity shares.'),
          'evidence_basis',jsonb_build_array('Governed monthly sales-unit basis','Approved/default/assumption status lineage','Separate frozen pool for this cost element'),'status_treatment','Actual-supported rows may be READY; assumed/default-supported rows remain REVIEW_REQUIRED.','redistribution_rule','Changes apply only through future exact runs.','interpretation','The driver is intentionally non-manufacturing and avoids false route/batch precision for organisational support costs.','future_improvements','Future versions may test transaction/document-volume drivers if reliable causal evidence becomes available.'
        ) else null end,
        'canonical_source_module','module:cost-build-manager'
      ) into v_detail;
    end if;
    v_actions:=jsonb_build_array(
      jsonb_build_object('action_code','SUBMIT_FOR_REVIEW','enabled',v_status='DRAFT','required_module','module:cost-build-manager','rpc','rpc_submit_cost_driver_policy_envelope_for_review','record_id',v_id),
      jsonb_build_object('action_code','APPROVE','enabled',v_status='REVIEW_REQUIRED','required_module','module:cost-build-manager','rpc','rpc_approve_cost_driver_policy_envelope','record_id',v_id)
    );
  end if;
  return jsonb_build_object('cost_element',to_jsonb(v_catalog),'registry',v_registry,'detail',v_detail,'actions',v_actions,'owner_module',v_owner_module,'stage03_cutover_authorised',false);
end;
$$;

revoke all on costing.marketing_allocation_policy from public,anon,authenticated;
grant select on costing.marketing_allocation_policy to service_role,postgres;
revoke all on function costing.fn_resolve_marketing_allocation_policy(date) from public,anon,authenticated;
grant execute on function costing.fn_resolve_marketing_allocation_policy(date) to service_role,postgres;

commit;