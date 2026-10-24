-- backfilled from live schema_migrations on 2026-10-24, CI-016
alter table costing.product_direct_labour_workload_snapshot
  add column if not exists manufacturing_labour_component_pool_snapshot_id bigint null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='fk_product_dl_workload_manufacturing_component_pool'
      and conrelid='costing.product_direct_labour_workload_snapshot'::regclass
  ) then
    alter table costing.product_direct_labour_workload_snapshot
      add constraint fk_product_dl_workload_manufacturing_component_pool
      foreign key (manufacturing_labour_component_pool_snapshot_id)
      references costing.direct_labour_component_pool_snapshot(id);
  end if;
end $$;

create or replace function costing.rpc_refresh_sku_direct_labour_component_split_snapshot(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns table(
  refreshed_period_start date,
  inserted_row_count bigint,
  blocked_count bigint,
  review_required_count bigint,
  ready_count bigint
)
language plpgsql
security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_period_start date := date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.direct_labour_workload_policy%rowtype;
  v_preview jsonb;
  v_total_pool numeric;
  v_mfg_component_id bigint;
  v_pack_component_id bigint;
  v_mfg_pool numeric;
  v_pack_pool numeric;
  v_mfg_staff_count bigint;
  v_pack_staff_count bigint;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_product_count integer;
  v_company_mfg_workload numeric;
  v_company_pack_units numeric;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Direct Labour component snapshot context does not match refresh run %',p_refresh_run_id;
  end if;
  if not (
    v_run.overall_status='SUCCESS'
    or (
      v_run.overall_status='RUNNING'
      and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
      and exists (
        select 1 from costing.costing_refresh_run_stage s
        where s.refresh_run_id=p_refresh_run_id
          and s.stage_code='03_COST_BUILD_TO_SCHEME'
          and s.stage_status='RUNNING'
      )
    )
  ) then
    raise exception 'Direct Labour component snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  select * into v_policy from costing.fn_resolve_direct_labour_workload_policy(p_valuation_date);
  if v_policy.formula_type is distinct from 'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS' then
    raise exception 'Resolved Direct Labour policy %/% is not component-split and cannot use this writer',v_policy.policy_code,v_policy.policy_version;
  end if;

  if exists(select 1 from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_direct_labour_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_direct_labour_allocation_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Direct Labour snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select total_pool_amount into v_total_pool
  from costing.cost_pool_monthly_snapshot
  where period_start=v_period_start
    and valuation_date=p_valuation_date
    and refresh_run_id=p_refresh_run_id
    and allocation_pool='DIRECT_LABOUR';
  if v_total_pool is null then raise exception 'Direct Labour frozen pool is missing for exact run %',p_refresh_run_id; end if;

  select id,component_pool_amount,staff_count
    into v_mfg_component_id,v_mfg_pool,v_mfg_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='MANUFACTURING_LABOUR';

  select id,component_pool_amount,staff_count
    into v_pack_component_id,v_pack_pool,v_pack_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='PACKING_LABOUR';

  if v_mfg_component_id is null or v_pack_component_id is null then
    raise exception 'Frozen Direct Labour component pools are incomplete for run %',p_refresh_run_id;
  end if;
  if (v_mfg_pool+v_pack_pool) is distinct from v_total_pool then
    raise exception 'Frozen Direct Labour component pools do not reconcile for run %: manufacturing %, packing %, total %',p_refresh_run_id,v_mfg_pool,v_pack_pool,v_total_pool;
  end if;

  v_preview:=costing.fn_preview_direct_labour_shadow_workload(v_policy.id,v_period_start,p_valuation_date,p_refresh_run_id,null);

  create temporary table tmp_dl_product on commit drop as
  select x.*,
    case when x.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and x.direct_labour_workload_units>0 then true else false end as is_eligible
  from jsonb_to_recordset(v_preview->'rows') as x(
    product_id bigint,product_name text,product_base_uom text,recipient_sku_count integer,
    monthly_product_base_qty numeric,monthly_driver_status text,standard_batch_count bigint,
    route_family_id bigint,family_route_id bigint,product_route_id bigint,effective_route_source text,
    foundation_status text,foundation_note text,workload_status text,workload_note text,
    direct_labour_route_intensity numeric,direct_labour_workload_units numeric,labour_step_evidence jsonb
  );

  select count(*),count(*) filter(where is_eligible),count(*) filter(where not is_eligible),
         sum(direct_labour_workload_units) filter(where is_eligible)
    into v_recipient_count,v_eligible_count,v_blocked_product_count,v_company_mfg_workload
  from tmp_dl_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_mfg_workload,0)<=0 then
    raise exception 'Manufacturing Labour allocation has no eligible positive route workload for refresh run %',p_refresh_run_id;
  end if;

  select sum(monthly_allocation_units)
    into v_company_pack_units
  from costing.sku_sales_allocation_basis_snapshot
  where period_start=v_period_start
    and valuation_date=p_valuation_date
    and refresh_run_id=p_refresh_run_id
    and monthly_allocation_units>0;

  if coalesce(v_company_pack_units,0)<=0 then
    raise exception 'Packing Labour allocation has no positive frozen monthly package units for refresh run %',p_refresh_run_id;
  end if;

  insert into costing.product_direct_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,monthly_product_base_qty,
    monthly_driver_status,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    workload_status,workload_reason_code,workload_note,recipient_product_count,eligible_product_count,
    blocked_product_count,eligible_coverage_ratio,company_eligible_workload_units,direct_labour_pool_amount,
    product_workload_share,product_direct_labour_allocation,direct_labour_pool_snapshot_id,
    manufacturing_labour_component_pool_snapshot_id
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
    t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.monthly_product_base_qty,
    t.monthly_driver_status,t.standard_batch_count,t.direct_labour_route_intensity,t.direct_labour_workload_units,
    t.workload_status,t.workload_status,
    case when t.workload_status='READY' then 'Manufacturing Labour workload is ready under the component-split Direct Labour policy.'
         when t.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'Manufacturing Labour workload is calculated but the governed quantity foundation requires review.'
         else t.workload_note end,
    v_recipient_count,v_eligible_count,v_blocked_product_count,
    v_eligible_count::numeric/nullif(v_recipient_count,0),v_company_mfg_workload,v_mfg_pool,
    case when t.is_eligible then t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    case when t.is_eligible then v_mfg_pool*t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    (select id from costing.cost_pool_monthly_snapshot where refresh_run_id=p_refresh_run_id and allocation_pool='DIRECT_LABOUR'),
    v_mfg_component_id
  from tmp_dl_product t;

  insert into costing.product_direct_labour_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,
    sequence_no,effective_step_key,source_type,activity_id,cost_centre_id,direct_labour_scope,scope_factor,
    behaviour_code,attendance_factor,expected_occurrence_count,standard_cycle_count,step_labour_factor,resource_class_code
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,pw.id,pw.product_id,
    nullif(e->>'sequence_no','')::numeric,e->>'effective_step_key',e->>'source_type',
    nullif(e->>'activity_id','')::bigint,nullif(e->>'cost_centre_id','')::bigint,e->>'direct_labour_scope',
    nullif(e->>'scope_factor','')::numeric,e->>'behaviour_code',nullif(e->>'attendance_factor','')::numeric,
    nullif(e->>'expected_occurrence_count','')::numeric,nullif(e->>'standard_cycle_count','')::numeric,
    nullif(e->>'step_labour_factor','')::numeric,e->>'resource_class_code'
  from costing.product_direct_labour_workload_snapshot pw
  join tmp_dl_product t on t.product_id=pw.product_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end)e
  where pw.refresh_run_id=p_refresh_run_id;

  insert into costing.sku_packing_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,expected_package_units,
    company_expected_package_units,package_workload_share,packing_labour_component_pool_snapshot_id,
    packing_labour_pool_amount,packing_labour_allocation,packing_labour_cost_per_sku_unit,
    workload_status,workload_reason_code,workload_note,source_method,created_at
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,b.monthly_allocation_units,
    v_company_pack_units,
    case when b.monthly_allocation_units>0 then b.monthly_allocation_units/v_company_pack_units else 0 end,
    v_pack_component_id,v_pack_pool,
    case when b.monthly_allocation_units>0 then v_pack_pool*(b.monthly_allocation_units/v_company_pack_units) else 0 end,
    case when b.monthly_allocation_units>0 then v_pack_pool/v_company_pack_units else 0 end,
    case
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED'
      when b.monthly_driver_status='REVIEW_REQUIRED' or b.allocation_resolution_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED_NO_POSITIVE_EXPECTED_PACKAGE_UNITS'
      when b.monthly_driver_status='REVIEW_REQUIRED' or b.allocation_resolution_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_PACKING_QUANTITY_FOUNDATION'
      else 'READY'
    end,
    case
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'Packing Labour cannot be allocated because frozen monthly package units are not positive.'
      when b.monthly_driver_status='REVIEW_REQUIRED' or b.allocation_resolution_status='REVIEW_REQUIRED' then 'Packing Labour is calculable from frozen monthly package units, but the quantity foundation requires review.'
      else 'Packing Labour workload is ready from frozen exact-run monthly package units.'
    end,
    'SKU_SALES_ALLOCATION_BASIS_SNAPSHOT.MONTHLY_ALLOCATION_UNITS',clock_timestamp()
  from costing.sku_sales_allocation_basis_snapshot b
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  create temporary table tmp_dl_product_pack on commit drop as
  select product_id,sum(packing_labour_allocation) as product_packing_labour_allocation
  from costing.sku_packing_labour_workload_snapshot
  where refresh_run_id=p_refresh_run_id
  group by product_id;

  insert into costing.sku_direct_labour_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    product_base_uom,pack_size,pack_uom,sku_base_qty_per_unit,direct_labour_pool_amount,direct_labour_staff_count,
    sales_units_12m,sales_base_qty_12m,product_sales_units_12m,product_sales_base_qty_12m,company_sales_units_12m,
    product_allocation_share,resolved_sales_units,resolved_sales_base_qty,resolved_product_sales_units,
    resolved_product_sales_base_qty,resolved_company_sales_units,resolved_product_allocation_share,
    product_direct_labour_allocation,direct_labour_cost_per_base_uom,direct_labour_cost_per_sku,
    allocation_basis_status,allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
    direct_labour_allocation_status,direct_labour_allocation_note,refreshed_at,policy_id,
    product_workload_snapshot_id,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    product_workload_share,sku_within_product_share,allocation_reason_code,direct_labour_pool_snapshot_id,
    manufacturing_direct_labour_pool_amount,packing_labour_pool_amount,
    manufacturing_direct_labour_allocation,packing_labour_allocation,
    manufacturing_direct_labour_cost_per_sku,packing_labour_cost_per_sku,
    packing_labour_workload_snapshot_id,direct_labour_component_model_code
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.product_base_uom,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,v_total_pool,coalesce(v_mfg_staff_count,0)+coalesce(v_pack_staff_count,0),
    b.actual_sales_units_12m,b.actual_sales_base_qty_12m,b.actual_product_sales_units_12m,
    b.actual_product_sales_base_qty_12m,b.actual_company_sales_units_12m,b.product_allocation_share,
    b.resolved_sales_units,b.resolved_sales_base_qty,b.resolved_product_sales_units,
    b.resolved_product_sales_base_qty,b.resolved_company_sales_units,b.resolved_product_allocation_share,
    pw.product_direct_labour_allocation+coalesce(pp.product_packing_labour_allocation,0),
    case when b.sku_base_qty_per_unit>0 then
      (
        (case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0)
      )/b.sku_base_qty_per_unit else 0 end,
    case when b.monthly_allocation_units>0 then
      (
        (case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0)
      )/b.monthly_allocation_units else 0 end,
    b.allocation_basis_status,'DIRECT_LABOUR_COMPONENT_SPLIT',b.allocation_resolution_status,b.allocation_resolution_note,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION') or pk.workload_status='BLOCKED' then 'BLOCKED'
      when pw.workload_status='REVIEW_REQUIRED_FOUNDATION' or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION') then 'Direct Labour is blocked because the Manufacturing Labour component is blocked by Product route/foundation readiness. Packing Labour evidence is retained separately.'
      when pk.workload_status='BLOCKED' then 'Direct Labour is blocked because the Packing Labour quantity basis is blocked.'
      when pw.workload_status='REVIEW_REQUIRED_FOUNDATION' or pk.workload_status='REVIEW_REQUIRED' then 'Direct Labour is calculated from Manufacturing Labour plus Packing Labour, with one or more quantity foundations requiring review.'
      else 'Direct Labour is ready as Manufacturing Labour plus Packing Labour under the approved component-split policy.'
    end,
    clock_timestamp(),v_policy.id,pw.id,pw.standard_batch_count,pw.direct_labour_route_intensity,
    pw.direct_labour_workload_units,pw.product_workload_share,
    case when b.monthly_product_allocation_base_qty>0 then b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION') then pw.workload_status
      when pk.workload_status='BLOCKED' then pk.workload_reason_code
      when pw.workload_status='REVIEW_REQUIRED_FOUNDATION' or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION'
      else 'READY'
    end,
    pw.direct_labour_pool_snapshot_id,
    v_mfg_pool,v_pack_pool,
    case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0
         then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty) else 0 end,
    coalesce(pk.packing_labour_allocation,0),
    case when b.monthly_allocation_units>0 then
      (case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0
            then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty) else 0 end)/b.monthly_allocation_units else 0 end,
    coalesce(pk.packing_labour_cost_per_sku_unit,0),
    pk.id,'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS'
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_direct_labour_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  join costing.sku_packing_labour_workload_snapshot pk
    on pk.refresh_run_id=b.refresh_run_id and pk.sku_id=b.sku_id
  left join tmp_dl_product_pack pp on pp.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  if abs((select coalesce(sum(product_direct_labour_allocation),0) from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_mfg_pool)>0.000001 then
    raise exception 'Manufacturing Labour Product allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;
  if abs((select coalesce(sum(packing_labour_allocation),0) from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_pack_pool)>0.000001 then
    raise exception 'Packing Labour allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;

  return query
  select v_period_start,count(*)::bigint,
    count(*) filter(where s.direct_labour_allocation_status='BLOCKED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='READY')::bigint
  from costing.sku_direct_labour_allocation_snapshot s
  where s.refresh_run_id=p_refresh_run_id;
end;
$function$;