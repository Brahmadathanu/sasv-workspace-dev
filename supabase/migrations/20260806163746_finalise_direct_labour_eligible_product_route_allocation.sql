-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.product_direct_labour_workload_snapshot (
  id bigserial primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id) on delete restrict,
  policy_id bigint not null references costing.direct_labour_workload_policy(id) on delete restrict,
  product_id bigint not null references public.products(id) on delete restrict,
  product_name text,
  product_base_uom text,
  route_family_id bigint,
  family_route_id bigint,
  product_route_id bigint,
  effective_route_source text,
  monthly_product_base_qty numeric,
  monthly_driver_status text,
  standard_batch_count bigint,
  direct_labour_route_intensity numeric,
  direct_labour_workload_units numeric,
  workload_status text not null,
  workload_reason_code text,
  workload_note text,
  recipient_product_count integer not null,
  eligible_product_count integer not null,
  blocked_product_count integer not null,
  eligible_coverage_ratio numeric,
  company_eligible_workload_units numeric,
  direct_labour_pool_amount numeric,
  product_workload_share numeric,
  product_direct_labour_allocation numeric,
  created_at timestamptz not null default clock_timestamp(),
  unique(refresh_run_id, product_id)
);

create index if not exists idx_product_direct_labour_workload_snapshot_context
  on costing.product_direct_labour_workload_snapshot(period_start,valuation_date,refresh_run_id);
create index if not exists idx_product_direct_labour_workload_snapshot_status
  on costing.product_direct_labour_workload_snapshot(workload_status);

create table if not exists costing.product_direct_labour_step_snapshot (
  id bigserial primary key,
  period_start date not null,
  valuation_date date not null,
  refresh_run_id bigint not null references costing.costing_refresh_run(id) on delete restrict,
  policy_id bigint not null references costing.direct_labour_workload_policy(id) on delete restrict,
  product_workload_snapshot_id bigint not null references costing.product_direct_labour_workload_snapshot(id) on delete restrict,
  product_id bigint not null references public.products(id) on delete restrict,
  sequence_no numeric,
  effective_step_key text not null,
  source_type text,
  activity_id bigint,
  cost_centre_id bigint,
  direct_labour_scope text,
  scope_factor numeric,
  behaviour_code text,
  attendance_factor numeric,
  expected_occurrence_count numeric,
  standard_cycle_count numeric,
  step_labour_factor numeric,
  resource_class_code text,
  created_at timestamptz not null default clock_timestamp(),
  unique(refresh_run_id, product_id, effective_step_key, sequence_no)
);

create index if not exists idx_product_direct_labour_step_snapshot_context
  on costing.product_direct_labour_step_snapshot(period_start,valuation_date,refresh_run_id);

alter table costing.sku_direct_labour_allocation_snapshot
  add column if not exists policy_id bigint references costing.direct_labour_workload_policy(id) on delete restrict,
  add column if not exists product_workload_snapshot_id bigint references costing.product_direct_labour_workload_snapshot(id) on delete restrict,
  add column if not exists standard_batch_count bigint,
  add column if not exists direct_labour_route_intensity numeric,
  add column if not exists direct_labour_workload_units numeric,
  add column if not exists product_workload_share numeric,
  add column if not exists sku_within_product_share numeric,
  add column if not exists allocation_reason_code text;

create or replace function costing.fn_resolve_direct_labour_workload_policy(p_as_of_date date)
returns costing.direct_labour_workload_policy
language plpgsql
stable
security definer
set search_path=costing,public,pg_temp
as $$
declare v_policy costing.direct_labour_workload_policy%rowtype; v_count integer;
begin
  if p_as_of_date is null then raise exception 'as_of_date is required'; end if;
  select count(*) into v_count
  from costing.direct_labour_workload_policy p
  where p.status='APPROVED'
    and p.effective_from<=p_as_of_date
    and (p.effective_to is null or p.effective_to>=p_as_of_date);
  if v_count<>1 then
    raise exception 'Exactly one approved Direct Labour workload policy must resolve for %, found %',p_as_of_date,v_count;
  end if;
  select * into v_policy
  from costing.direct_labour_workload_policy p
  where p.status='APPROVED'
    and p.effective_from<=p_as_of_date
    and (p.effective_to is null or p.effective_to>=p_as_of_date)
  order by p.effective_from desc,p.policy_version desc,p.id desc
  limit 1;
  return v_policy;
end;
$$;

create or replace function public.rpc_submit_direct_labour_workload_policy_for_review(p_policy_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare v_validation jsonb; v_row costing.direct_labour_workload_policy%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  select * into v_row from costing.direct_labour_workload_policy where id=p_policy_id for update;
  if not found then raise exception 'Direct Labour policy % not found',p_policy_id; end if;
  if v_row.status<>'DRAFT' then raise exception 'Only DRAFT Direct Labour policies may be submitted for review'; end if;
  v_validation:=costing.fn_validate_direct_labour_workload_policy(p_policy_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Direct Labour policy % is invalid: %',p_policy_id,v_validation->'errors';
  end if;
  update costing.direct_labour_workload_policy set status='REVIEW_REQUIRED' where id=p_policy_id;
  return jsonb_build_object('policy_id',p_policy_id,'status','REVIEW_REQUIRED','validation',v_validation);
end;
$$;

create or replace function public.rpc_approve_direct_labour_workload_policy(p_policy_id bigint,p_approval_reference text)
returns jsonb
language plpgsql
security definer
set search_path=public,costing,pg_temp
as $$
declare v_validation jsonb; v_row costing.direct_labour_workload_policy%rowtype;
begin
  perform public.require_permission('module:production-route-manager',true);
  if nullif(btrim(p_approval_reference),'') is null then raise exception 'approval_reference is required'; end if;
  select * into v_row from costing.direct_labour_workload_policy where id=p_policy_id for update;
  if not found then raise exception 'Direct Labour policy % not found',p_policy_id; end if;
  if v_row.status<>'REVIEW_REQUIRED' then raise exception 'Only REVIEW_REQUIRED Direct Labour policies may be approved'; end if;
  v_validation:=costing.fn_validate_direct_labour_workload_policy(p_policy_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Direct Labour policy % is invalid: %',p_policy_id,v_validation->'errors';
  end if;
  if exists(
    select 1 from costing.direct_labour_workload_policy p
    where p.id<>p_policy_id and p.status='APPROVED'
      and daterange(p.effective_from,coalesce(p.effective_to,'infinity'::date),'[]')
          && daterange(v_row.effective_from,coalesce(v_row.effective_to,'infinity'::date),'[]')
  ) then raise exception 'Approved Direct Labour policy effective dates overlap an existing approved policy'; end if;
  update costing.direct_labour_workload_policy
  set status='APPROVED',approval_reference=btrim(p_approval_reference),approved_by=auth.uid(),approved_at=clock_timestamp()
  where id=p_policy_id;
  return jsonb_build_object('policy_id',p_policy_id,'status','APPROVED','approval_reference',btrim(p_approval_reference),'validation',v_validation);
end;
$$;

revoke all on function public.rpc_submit_direct_labour_workload_policy_for_review(bigint) from public,anon;
revoke all on function public.rpc_approve_direct_labour_workload_policy(bigint,text) from public,anon;
grant execute on function public.rpc_submit_direct_labour_workload_policy_for_review(bigint) to authenticated;
grant execute on function public.rpc_approve_direct_labour_workload_policy(bigint,text) to authenticated;

do $$
declare v_policy_id bigint;
begin
  select id into v_policy_id
  from costing.direct_labour_workload_policy
  where policy_code='DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE' and policy_version=2;

  if v_policy_id is null then
    insert into costing.direct_labour_workload_policy(
      policy_code,policy_version,status,formula_type,effective_from,effective_to,policy_note,created_by
    ) values (
      'DIRECT_LABOUR_STANDARD_BATCH_ATTENDANCE',2,'DRAFT','STANDARD_BATCH_ROUTE_ATTENDANCE',date '2026-08-06',null,
      'Unified Direct Labour pool allocated across Products eligible in the exact run using rounded standard batches multiplied by effective route attendance intensity. Blocked Products retain zero allocation and their blocker; incomplete company route coverage does not suppress eligible Products. Redistribution occurs only in a later exact run.',
      null
    ) returning id into v_policy_id;

    insert into costing.direct_labour_scope_factor(policy_id,scope_code,factor,note)
    select v_policy_id,scope_code,factor,note from costing.direct_labour_scope_factor where policy_id=1;

    insert into costing.direct_labour_behaviour_factor(policy_id,behaviour_code,factor,note)
    select v_policy_id,behaviour_code,factor,note from costing.direct_labour_behaviour_factor where policy_id=1;
  end if;
end;
$$;

create or replace function costing.fn_preview_direct_labour_shadow_monetary_reconciliation(
  p_policy_id bigint,p_period_start date,p_valuation_date date,p_refresh_run_id bigint,
  p_reference_pool_amount numeric,p_route_family_id bigint default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=costing,public,pg_temp
as $$
declare v_period_start date; v_workload jsonb; v_result jsonb;
begin
  if p_policy_id is null or p_period_start is null or p_valuation_date is null or p_refresh_run_id is null or p_reference_pool_amount is null then
    raise exception 'policy_id, period_start, valuation_date, refresh_run_id and reference_pool_amount are required';
  end if;
  if p_reference_pool_amount<0 then raise exception 'reference_pool_amount cannot be negative'; end if;
  v_period_start:=date_trunc('month',p_period_start)::date;
  v_workload:=costing.fn_preview_direct_labour_shadow_workload(p_policy_id,v_period_start,p_valuation_date,p_refresh_run_id,p_route_family_id);

  with product_rows as (
    select x.* from jsonb_to_recordset(v_workload->'rows') as x(
      product_id bigint,product_name text,product_base_uom text,recipient_sku_count integer,
      monthly_product_base_qty numeric,monthly_driver_status text,standard_batch_count bigint,
      route_family_id bigint,family_route_id bigint,product_route_id bigint,effective_route_source text,
      foundation_status text,workload_status text,direct_labour_route_intensity numeric,
      direct_labour_workload_units numeric,sku_quantity_evidence jsonb
    )
  ), eligible_products as (
    select * from product_rows
    where workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and direct_labour_workload_units>0
  ), company as (
    select count(*)::bigint eligible_product_count,sum(direct_labour_workload_units) eligible_company_workload_units
    from eligible_products
  ), product_allocations as (
    select p.*,c.eligible_product_count,c.eligible_company_workload_units,
      p.direct_labour_workload_units/nullif(c.eligible_company_workload_units,0) product_workload_share,
      p_reference_pool_amount*p.direct_labour_workload_units/nullif(c.eligible_company_workload_units,0) shadow_product_allocation
    from eligible_products p cross join company c
  ), sku_basis as (
    select b.id allocation_basis_snapshot_id,b.sku_id,b.product_id,b.product_name,b.pack_size,b.pack_uom,
      b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,b.monthly_product_allocation_base_qty,
      b.monthly_driver_status,b.monthly_driver_source,b.assumption_id,b.default_policy_id
    from costing.sku_sales_allocation_basis_snapshot b
    where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id
  ), sku_allocations as (
    select s.*,p.workload_status product_workload_status,p.direct_labour_route_intensity,p.standard_batch_count,
      p.direct_labour_workload_units,p.product_workload_share,p.shadow_product_allocation,
      case when s.monthly_product_allocation_base_qty>0 then s.monthly_allocation_base_qty/s.monthly_product_allocation_base_qty end sku_within_product_share,
      case when s.monthly_product_allocation_base_qty>0 then p.shadow_product_allocation*s.monthly_allocation_base_qty/s.monthly_product_allocation_base_qty end shadow_sku_allocation_amount,
      case when s.monthly_product_allocation_base_qty>0 and s.sku_base_qty_per_unit>0 then
        (p.shadow_product_allocation/s.monthly_product_allocation_base_qty)*s.sku_base_qty_per_unit end shadow_direct_labour_cost_per_sku
    from sku_basis s join product_allocations p on p.product_id=s.product_id
  ), reconciliation as (
    select p_reference_pool_amount reference_pool_amount,
      coalesce(sum(distinct_product_allocation),0) product_allocation_total,
      coalesce((select sum(shadow_sku_allocation_amount) from sku_allocations),0) sku_allocation_total
    from (select distinct product_id,shadow_product_allocation distinct_product_allocation from product_allocations)p
  )
  select jsonb_build_object(
    'preview_only',true,'records_created',0,'monetary_snapshot_created',false,
    'stage03_cutover_status','NOT_AUTHORISED_BY_THIS_GATE','pool_authority','EXPLICIT_ANALYTICAL_REFERENCE_ONLY',
    'pool_authority_note','The supplied pool is used only for shadow reconciliation and is not persisted by this preview.',
    'coverage_policy','FULL_POOL_TO_CURRENT_ELIGIBLE_PRODUCTS',
    'blocked_product_treatment','ZERO_ALLOCATION_RETAIN_BLOCKER',
    'future_redistribution','NEW_EXACT_RUN_ONLY',
    'policy_id',p_policy_id,'period_start',v_period_start,'valuation_date',p_valuation_date,
    'refresh_run_id',p_refresh_run_id,'route_family_id',p_route_family_id,
    'workload_summary',v_workload->'summary',
    'reconciliation',(select jsonb_build_object(
      'reference_pool_amount',r.reference_pool_amount,'product_allocation_total',r.product_allocation_total,
      'sku_allocation_total',r.sku_allocation_total,'product_variance',r.reference_pool_amount-r.product_allocation_total,
      'sku_variance',r.reference_pool_amount-r.sku_allocation_total,
      'product_reconciled',abs(r.reference_pool_amount-r.product_allocation_total)<0.000001,
      'sku_reconciled',abs(r.reference_pool_amount-r.sku_allocation_total)<0.000001
    ) from reconciliation r),
    'product_allocations',coalesce((select jsonb_agg(to_jsonb(p) order by p.product_name,p.product_id) from product_allocations p),'[]'::jsonb),
    'sku_allocations',coalesce((select jsonb_agg(to_jsonb(s) order by s.product_name,s.product_id,s.sku_id) from sku_allocations s),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function costing.rpc_refresh_sku_direct_labour_allocation_snapshot(
  p_period_start date,p_valuation_date date,p_refresh_run_id bigint
) returns table(refreshed_period_start date,inserted_row_count bigint,blocked_count bigint,review_required_count bigint,ready_count bigint)
language plpgsql
security definer
set search_path=costing,public,pg_temp
as $$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.direct_labour_workload_policy%rowtype;
  v_pool numeric;
  v_preview jsonb;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_count integer;
  v_company_workload numeric;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;
  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Direct Labour snapshot context does not match refresh run %',p_refresh_run_id;
  end if;
  if v_run.overall_status<>'SUCCESS' then raise exception 'Direct Labour snapshots may be built only for a successful refresh run'; end if;
  if exists(select 1 from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_direct_labour_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_direct_labour_allocation_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Direct Labour snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select * into v_policy from costing.fn_resolve_direct_labour_workload_policy(p_valuation_date);
  select total_pool_amount into v_pool from costing.v_cost_pool_monthly_combined
  where period_start=v_period_start and allocation_pool='DIRECT_LABOUR';
  if v_pool is null then raise exception 'Direct Labour pool is missing for period %',v_period_start; end if;

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
  into v_recipient_count,v_eligible_count,v_blocked_count,v_company_workload
  from tmp_dl_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_workload,0)<=0 then
    raise exception 'Direct Labour allocation has no eligible positive workload for refresh run %',p_refresh_run_id;
  end if;

  insert into costing.product_direct_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,monthly_product_base_qty,
    monthly_driver_status,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    workload_status,workload_reason_code,workload_note,recipient_product_count,eligible_product_count,
    blocked_product_count,eligible_coverage_ratio,company_eligible_workload_units,direct_labour_pool_amount,
    product_workload_share,product_direct_labour_allocation
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
    t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.monthly_product_base_qty,
    t.monthly_driver_status,t.standard_batch_count,t.direct_labour_route_intensity,t.direct_labour_workload_units,
    t.workload_status,t.workload_status,t.workload_note,v_recipient_count,v_eligible_count,v_blocked_count,
    v_eligible_count::numeric/nullif(v_recipient_count,0),v_company_workload,v_pool,
    case when t.is_eligible then t.direct_labour_workload_units/v_company_workload else 0 end,
    case when t.is_eligible then v_pool*t.direct_labour_workload_units/v_company_workload else 0 end
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
    product_workload_share,sku_within_product_share,allocation_reason_code
  )
  select b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.product_base_uom,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,v_pool,null,
    b.actual_sales_units_12m,b.actual_sales_base_qty_12m,b.actual_product_sales_units_12m,
    b.actual_product_sales_base_qty_12m,b.actual_company_sales_units_12m,b.product_allocation_share,
    b.resolved_sales_units,b.resolved_sales_base_qty,b.resolved_product_sales_units,
    b.resolved_product_sales_base_qty,b.resolved_company_sales_units,b.resolved_product_allocation_share,
    pw.product_direct_labour_allocation,
    case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0
         then pw.product_direct_labour_allocation/b.monthly_product_allocation_base_qty else 0 end,
    case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and b.monthly_product_allocation_base_qty>0 and b.sku_base_qty_per_unit>0
         then (pw.product_direct_labour_allocation/b.monthly_product_allocation_base_qty)*b.sku_base_qty_per_unit else 0 end,
    b.allocation_basis_status,'DIRECT_LABOUR_ROUTE_ATTENDANCE',b.allocation_resolution_status,b.allocation_resolution_note,
    case when pw.workload_status='READY' then 'READY'
         when pw.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'REVIEW_REQUIRED'
         else 'BLOCKED' end,
    case when pw.workload_status='READY' then 'Direct Labour allocation is ready under the approved route-attendance policy.'
         when pw.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'Direct Labour allocation is calculated but the governed quantity foundation requires review.'
         else 'Direct Labour allocation is zero because the Product is blocked: '||pw.workload_status end,
    clock_timestamp(),v_policy.id,pw.id,pw.standard_batch_count,pw.direct_labour_route_intensity,
    pw.direct_labour_workload_units,pw.product_workload_share,
    case when b.monthly_product_allocation_base_qty>0 then b.monthly_allocation_base_qty/b.monthly_product_allocation_base_qty end,
    pw.workload_status
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_direct_labour_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  return query
  select v_period_start,count(*)::bigint,
    count(*) filter(where s.direct_labour_allocation_status='BLOCKED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='READY')::bigint
  from costing.sku_direct_labour_allocation_snapshot s where s.refresh_run_id=p_refresh_run_id;
end;
$$;