-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.direct_labour_workload_policy
  drop constraint if exists direct_labour_workload_policy_formula_type_check;

alter table costing.direct_labour_workload_policy
  add constraint direct_labour_workload_policy_formula_type_check
  check (formula_type in (
    'STANDARD_BATCH_ROUTE_ATTENDANCE',
    'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS'
  ));

do $$
declare
  v_new_policy_id bigint;
  v_source_policy_id bigint;
begin
  select id into v_source_policy_id
  from costing.direct_labour_workload_policy
  where policy_code='DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE'
    and policy_version=2;

  if v_source_policy_id is null then
    raise exception 'Source Direct Labour policy v2 not found';
  end if;

  insert into costing.direct_labour_workload_policy(
    policy_code,policy_version,status,effective_from,effective_to,
    formula_type,approval_reference,policy_note,approved_by,approved_at,created_by,created_at,updated_at
  )
  select
    'DIRECT_LABOUR_COMPONENT_SPLIT',
    3,
    'REVIEW_REQUIRED',
    date '2026-08-11',
    null,
    'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS',
    null,
    'Prospective Direct Labour component model. Manufacturing Labour is allocated from the DIRECT_LABOUR staff-class component using route-attendance workload. Packing Labour is allocated from the PACKING_LABOUR staff-class component using frozen exact-run monthly allocation units. Combined Direct Labour remains the downstream commercial line. REVIEW_REQUIRED: no monetary cutover authorised until explicit approval.',
    null,null,null,clock_timestamp(),clock_timestamp()
  where not exists (
    select 1 from costing.direct_labour_workload_policy
    where policy_code='DIRECT_LABOUR_COMPONENT_SPLIT' and policy_version=3
  );

  select id into v_new_policy_id
  from costing.direct_labour_workload_policy
  where policy_code='DIRECT_LABOUR_COMPONENT_SPLIT'
    and policy_version=3;

  if v_new_policy_id is null then
    raise exception 'Prospective Direct Labour component policy v3 not found after insert';
  end if;

  insert into costing.direct_labour_scope_factor(policy_id,scope_code,factor,note)
  select v_new_policy_id,scope_code,factor,note
  from costing.direct_labour_scope_factor
  where policy_id=v_source_policy_id
  on conflict (policy_id,scope_code) do nothing;

  insert into costing.direct_labour_behaviour_factor(policy_id,behaviour_code,factor,note)
  select v_new_policy_id,behaviour_code,factor,note
  from costing.direct_labour_behaviour_factor
  where policy_id=v_source_policy_id
  on conflict (policy_id,behaviour_code) do nothing;
end $$;

create or replace function costing.fn_preview_direct_labour_component_split(
  p_policy_id bigint,
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint,
  p_product_id bigint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period_start date := date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.direct_labour_workload_policy%rowtype;
  v_policy_validation jsonb;
  v_total_dl_pool numeric;
  v_mfg_pool numeric;
  v_pack_pool numeric;
  v_component_source text;
  v_company_mfg_workload numeric;
  v_company_pack_units numeric;
  v_result jsonb;
begin
  if p_policy_id is null or p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'policy_id, period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Direct Labour component preview context does not match refresh run %',p_refresh_run_id;
  end if;

  select * into v_policy from costing.direct_labour_workload_policy where id=p_policy_id;
  if not found then raise exception 'Direct Labour policy % not found',p_policy_id; end if;

  v_policy_validation:=costing.fn_validate_direct_labour_workload_policy(p_policy_id);
  if not coalesce((v_policy_validation->>'valid')::boolean,false) then
    raise exception 'Direct Labour policy % is invalid: %',p_policy_id,v_policy_validation->'errors';
  end if;

  select total_pool_amount into v_total_dl_pool
  from costing.cost_pool_monthly_snapshot
  where refresh_run_id=p_refresh_run_id
    and period_start=v_period_start
    and valuation_date=p_valuation_date
    and allocation_pool='DIRECT_LABOUR';
  if v_total_dl_pool is null then raise exception 'Frozen Direct Labour pool missing for run %',p_refresh_run_id; end if;

  if exists(select 1 from costing.direct_labour_component_pool_snapshot where refresh_run_id=p_refresh_run_id) then
    select
      max(component_pool_amount) filter(where component_code='MANUFACTURING_LABOUR'),
      max(component_pool_amount) filter(where component_code='PACKING_LABOUR')
    into v_mfg_pool,v_pack_pool
    from costing.direct_labour_component_pool_snapshot
    where refresh_run_id=p_refresh_run_id;
    v_component_source:='FROZEN_COMPONENT_SNAPSHOT';
  else
    select
      max(pool_amount) filter(where costing_class='DIRECT_LABOUR'),
      max(pool_amount) filter(where costing_class='PACKING_LABOUR')
    into v_mfg_pool,v_pack_pool
    from costing.v_staff_cost_pool_monthly
    where period_start=v_period_start and allocation_pool='DIRECT_LABOUR';
    v_component_source:='LIVE_STAFF_POOL_PREVIEW_ONLY';
  end if;

  if v_mfg_pool is null or v_pack_pool is null then
    raise exception 'Manufacturing/Packing Direct Labour component amounts are incomplete for period %',v_period_start;
  end if;
  if (v_mfg_pool+v_pack_pool) is distinct from v_total_dl_pool then
    raise exception 'Component preview does not reconcile to frozen Direct Labour pool: manufacturing %, packing %, total %',v_mfg_pool,v_pack_pool,v_total_dl_pool;
  end if;

  select coalesce(sum(direct_labour_workload_units),0)
    into v_company_mfg_workload
  from costing.product_direct_labour_workload_snapshot
  where refresh_run_id=p_refresh_run_id
    and workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION')
    and direct_labour_workload_units>0;

  select coalesce(sum(monthly_allocation_units),0)
    into v_company_pack_units
  from costing.sku_sales_allocation_basis_snapshot
  where refresh_run_id=p_refresh_run_id
    and monthly_allocation_units>0;

  if v_company_mfg_workload<=0 then raise exception 'No positive manufacturing workload in run %',p_refresh_run_id; end if;
  if v_company_pack_units<=0 then raise exception 'No positive expected package units in run %',p_refresh_run_id; end if;

  with sku_rows as materialized (
    select
      b.sku_id,b.product_id,b.product_name,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,
      b.monthly_allocation_units as expected_package_units,
      v_company_pack_units as company_expected_package_units,
      b.monthly_allocation_units/nullif(v_company_pack_units,0) as package_workload_share,
      p.standard_batch_count,p.direct_labour_route_intensity,p.direct_labour_workload_units,
      p.workload_status as manufacturing_workload_status,
      p.workload_reason_code as manufacturing_reason_code,
      case when p.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and p.direct_labour_workload_units>0
           then p.direct_labour_workload_units/v_company_mfg_workload else 0 end as prospective_manufacturing_product_share,
      case when p.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and p.direct_labour_workload_units>0
           then v_mfg_pool*(p.direct_labour_workload_units/v_company_mfg_workload) else 0 end as prospective_manufacturing_product_allocation,
      case when p.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0
           then (v_mfg_pool*(p.direct_labour_workload_units/v_company_mfg_workload))
                *(b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty)
           else 0 end as manufacturing_labour_allocation,
      v_pack_pool*(b.monthly_allocation_units/v_company_pack_units) as packing_labour_allocation,
      case when p.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_allocation_units>0
           then ((v_mfg_pool*(p.direct_labour_workload_units/v_company_mfg_workload))
                *(b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty))/b.monthly_allocation_units
           else 0 end as manufacturing_labour_cost_per_sku,
      case when b.monthly_allocation_units>0
           then (v_pack_pool*(b.monthly_allocation_units/v_company_pack_units))/b.monthly_allocation_units
           else 0 end as packing_labour_cost_per_sku,
      case
        when p.workload_status='READY' then 'READY'
        when p.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'REVIEW_REQUIRED'
        else 'BLOCKED'
      end as combined_direct_labour_status
    from costing.sku_sales_allocation_basis_snapshot b
    left join costing.product_direct_labour_workload_snapshot p
      on p.refresh_run_id=b.refresh_run_id and p.product_id=b.product_id
    where b.refresh_run_id=p_refresh_run_id
      and (p_product_id is null or b.product_id=p_product_id)
  ), all_rows as materialized (
    select
      b.sku_id,b.product_id,b.monthly_allocation_units,
      p.workload_status,p.direct_labour_workload_units,
      b.monthly_allocation_base_qty,b.monthly_product_allocation_base_qty
    from costing.sku_sales_allocation_basis_snapshot b
    left join costing.product_direct_labour_workload_snapshot p
      on p.refresh_run_id=b.refresh_run_id and p.product_id=b.product_id
    where b.refresh_run_id=p_refresh_run_id
  ), recon as (
    select
      sum(case when workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and direct_labour_workload_units>0
               then v_mfg_pool*(direct_labour_workload_units/v_company_mfg_workload)
                    *(monthly_allocation_base_qty/nullif(monthly_product_allocation_base_qty,0)) else 0 end) as manufacturing_allocation_sum,
      sum(v_pack_pool*(monthly_allocation_units/v_company_pack_units)) as packing_allocation_sum,
      count(*) as sku_count,
      count(*) filter(where monthly_allocation_units>0) as packing_eligible_sku_count,
      count(*) filter(where workload_status='READY') as manufacturing_ready_sku_count,
      count(*) filter(where workload_status='REVIEW_REQUIRED_FOUNDATION') as manufacturing_review_sku_count,
      count(*) filter(where workload_status is null or workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION')) as manufacturing_blocked_sku_count
    from all_rows
  )
  select jsonb_build_object(
    'preview_only',true,
    'records_created',0,
    'monetary_cutover_authorised',false,
    'historical_snapshot_mutated',false,
    'context',jsonb_build_object(
      'period_start',v_period_start,'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,
      'run_status',v_run.overall_status,'component_source',v_component_source
    ),
    'policy',to_jsonb(v_policy),
    'policy_validation',v_policy_validation,
    'model',jsonb_build_object(
      'model_code','MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS',
      'manufacturing_driver','ROUNDED_STANDARD_BATCHES × ROUTE_ATTENDANCE_INTENSITY',
      'packing_driver','FROZEN_MONTHLY_ALLOCATION_UNITS',
      'combined_direct_labour','MANUFACTURING_LABOUR + PACKING_LABOUR'
    ),
    'pools',jsonb_build_object(
      'direct_labour_total_pool',v_total_dl_pool,
      'manufacturing_labour_pool',v_mfg_pool,
      'packing_labour_pool',v_pack_pool,
      'component_sum',v_mfg_pool+v_pack_pool,
      'component_delta',(v_mfg_pool+v_pack_pool)-v_total_dl_pool
    ),
    'denominators',jsonb_build_object(
      'company_manufacturing_workload_units',v_company_mfg_workload,
      'company_expected_package_units',v_company_pack_units,
      'neutral_packing_labour_cost_per_package',v_pack_pool/nullif(v_company_pack_units,0)
    ),
    'reconciliation',(select jsonb_build_object(
      'sku_count',sku_count,
      'packing_eligible_sku_count',packing_eligible_sku_count,
      'manufacturing_ready_sku_count',manufacturing_ready_sku_count,
      'manufacturing_review_sku_count',manufacturing_review_sku_count,
      'manufacturing_blocked_sku_count',manufacturing_blocked_sku_count,
      'manufacturing_allocation_sum',manufacturing_allocation_sum,
      'packing_allocation_sum',packing_allocation_sum,
      'manufacturing_pool_delta',manufacturing_allocation_sum-v_mfg_pool,
      'packing_pool_delta',packing_allocation_sum-v_pack_pool,
      'combined_component_allocation_sum',manufacturing_allocation_sum+packing_allocation_sum,
      'combined_pool_delta',(manufacturing_allocation_sum+packing_allocation_sum)-v_total_dl_pool
    ) from recon),
    'rows',coalesce((select jsonb_agg(to_jsonb(sku_rows) order by product_name,sku_id) from sku_rows),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;