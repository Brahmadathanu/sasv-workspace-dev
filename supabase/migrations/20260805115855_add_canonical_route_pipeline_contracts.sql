-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_costing_recipient_products(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns table(
  product_id integer,
  product_name text,
  product_base_uom text,
  sku_count bigint,
  monthly_product_base_qty numeric,
  monthly_driver_status text
)
language plpgsql
stable security definer
set search_path=costing,public,pg_temp
as $$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;
  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Recipient context does not match refresh run %',p_refresh_run_id;
  end if;
  return query
  select b.product_id::integer,
         max(b.product_name)::text,
         max(b.product_base_uom)::text,
         count(*)::bigint,
         max(b.monthly_product_allocation_base_qty)::numeric,
         case
           when count(distinct b.monthly_driver_status)=1 then max(b.monthly_driver_status)::text
           when bool_or(b.monthly_driver_status='BLOCKED') then 'BLOCKED'::text
           when bool_or(b.monthly_driver_status='REVIEW_REQUIRED') then 'REVIEW_REQUIRED'::text
           else max(b.monthly_driver_status)::text
         end
  from costing.sku_sales_allocation_basis_snapshot b
  where b.period_start=v_period_start
    and b.valuation_date=p_valuation_date
    and b.refresh_run_id=p_refresh_run_id
  group by b.product_id;
end;
$$;

revoke all on function costing.fn_costing_recipient_products(date,date,bigint) from public,anon,authenticated;
grant execute on function costing.fn_costing_recipient_products(date,date,bigint) to service_role;

create or replace function costing.fn_product_process_route_readiness(p_as_of_date date default current_date)
returns table(
  product_id integer,
  product_name text,
  category_id integer,
  category_name text,
  sub_category_id integer,
  subcategory_name text,
  product_group_id integer,
  product_group_name text,
  route_family_id bigint,
  route_family_code text,
  route_family_name text,
  product_route_id bigint,
  route_version integer,
  route_status text,
  effective_from date,
  effective_to date,
  evidence_status text,
  base_route_family_route_id bigint,
  batch_size_ref_id bigint,
  readiness_status text,
  validation jsonb,
  effective_family_route_id bigint,
  effective_route_source text,
  route_family_assignment_source text,
  product_route_family_assignment_id bigint,
  product_group_route_family_mapping_id bigint,
  route_family_assignment_basis text,
  route_family_assignment_approval_reference text
)
language sql
stable security definer
set search_path=costing,public,pg_temp
as $$
with ctx as (select coalesce(p_as_of_date,current_date) as as_of_date),
base as (
  select p.id product_id,p.item product_name,c.id category_id,c.category_name,
         sc.id sub_category_id,sc.subcategory_name,pg.id product_group_id,pg.group_name product_group_name,
         costing.fn_resolve_route_family_for_product(p.id,(select as_of_date from ctx)) route_family_id
  from public.products p
  join public.sub_groups sg on sg.id=p.sub_group_id
  join public.product_groups pg on pg.id=sg.product_group_id
  join public.sub_categories sc on sc.id=pg.sub_category_id
  join public.categories c on c.id=sc.category_id
  where upper(coalesce(p.status,''))='ACTIVE'
), resolved as (
  select b.*,
         pa.id product_assignment_id,pa.assignment_basis product_assignment_basis,pa.approval_reference product_assignment_approval_reference,
         gm.id group_mapping_id,gm.mapping_basis group_mapping_basis,gm.approval_reference group_mapping_approval_reference,
         rf.family_code,rf.family_name,
         fr.id family_route_id,
         pr.id product_route_id,pr.route_version,pr.status route_status,pr.effective_from,pr.effective_to,
         pr.evidence_status,pr.base_route_family_route_id,pr.batch_size_ref_id,
         costing.fn_validate_effective_product_process_route(b.product_id,(select as_of_date from ctx)) validation
  from base b
  left join lateral (
    select m.* from costing.production_route_family_product_map m
    where m.product_id=b.product_id and m.status='APPROVED'
      and m.effective_from<=(select as_of_date from ctx)
      and (m.effective_to is null or m.effective_to>=(select as_of_date from ctx))
    order by m.effective_from desc,m.id desc limit 1
  ) pa on true
  left join lateral (
    select m.* from costing.production_route_family_product_group_map m
    where m.product_group_id=b.product_group_id and m.status='APPROVED'
      and m.effective_from<=(select as_of_date from ctx)
      and (m.effective_to is null or m.effective_to>=(select as_of_date from ctx))
    order by m.effective_from desc,m.id desc limit 1
  ) gm on true
  left join costing.production_route_family rf on rf.id=b.route_family_id
  left join lateral (
    select r.id from costing.production_route_family_route r
    where r.route_family_id=b.route_family_id and r.status='APPROVED'
      and r.effective_from<=(select as_of_date from ctx)
      and (r.effective_to is null or r.effective_to>=(select as_of_date from ctx))
    order by r.effective_from desc,r.route_version desc,r.id desc limit 1
  ) fr on true
  left join lateral (
    select r.* from costing.product_process_route r
    where r.product_id=b.product_id and r.status='APPROVED'
      and r.effective_from<=(select as_of_date from ctx)
      and (r.effective_to is null or r.effective_to>=(select as_of_date from ctx))
    order by r.effective_from desc,r.route_version desc,r.id desc limit 1
  ) pr on true
)
select product_id,product_name,category_id,category_name,sub_category_id,subcategory_name,product_group_id,product_group_name,
       route_family_id,family_code,family_name,product_route_id,route_version,route_status,effective_from,effective_to,evidence_status,
       base_route_family_route_id,batch_size_ref_id,
       case
         when route_family_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'
         when family_route_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'
         when not coalesce((validation->>'valid')::boolean,false) then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'
         else 'READY'
       end readiness_status,
       validation,family_route_id,
       case when product_route_id is null then 'ROUTE_FAMILY_INHERITED' else 'PRODUCT_ROUTE' end effective_route_source,
       case when product_assignment_id is not null then 'PRODUCT_ASSIGNMENT'
            when group_mapping_id is not null then 'PRODUCT_GROUP_FALLBACK' else 'NONE' end,
       product_assignment_id,group_mapping_id,
       coalesce(product_assignment_basis,group_mapping_basis),
       coalesce(product_assignment_approval_reference,group_mapping_approval_reference)
from resolved;
$$;

revoke all on function costing.fn_product_process_route_readiness(date) from public,anon,authenticated;
grant execute on function costing.fn_product_process_route_readiness(date) to service_role;

create or replace view costing.v_product_process_route_readiness as
select * from costing.fn_product_process_route_readiness(current_date);

revoke all on costing.v_product_process_route_readiness from public,anon,authenticated;
grant select on costing.v_product_process_route_readiness to service_role;

create or replace function public.rpc_get_production_route_manager_readiness(
  p_as_of_date date default current_date,
  p_search text default null,
  p_readiness_status text default null,
  p_route_family_id bigint default null,
  p_product_group_id integer default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql security definer
set search_path=public,costing,pg_temp
as $$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,100),500));
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_as_of date:=coalesce(p_as_of_date,current_date);
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  with filtered as (
    select r.* from costing.fn_product_process_route_readiness(v_as_of) r
    where (p_route_family_id is null or r.route_family_id=p_route_family_id)
      and (p_product_group_id is null or r.product_group_id=p_product_group_id)
      and (p_readiness_status is null or r.readiness_status=p_readiness_status)
      and (nullif(btrim(p_search),'') is null
        or r.product_name ilike '%'||btrim(p_search)||'%'
        or r.product_group_name ilike '%'||btrim(p_search)||'%'
        or r.route_family_name ilike '%'||btrim(p_search)||'%'
        or r.category_name ilike '%'||btrim(p_search)||'%'
        or r.subcategory_name ilike '%'||btrim(p_search)||'%'
        or r.product_id::text=btrim(p_search))
  ), page as (
    select * from filtered
    order by category_name,subcategory_name,product_group_name,product_name,product_id
    limit v_limit offset v_offset
  )
  select jsonb_build_object(
    'as_of_date',v_as_of,
    'total_count',(select count(*) from filtered),
    'limit',v_limit,'offset',v_offset,
    'data_quality_gate_status','DEFERRED_UNTIL_PIPELINE_COMPLETE',
    'rows',coalesce((select jsonb_agg(to_jsonb(page) order by category_name,subcategory_name,product_group_name,product_name,product_id) from page),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.rpc_get_production_route_manager_readiness(date,text,text,bigint,integer,integer,integer) from public,anon;
grant execute on function public.rpc_get_production_route_manager_readiness(date,text,text,bigint,integer,integer,integer) to authenticated,service_role;

create or replace function costing.fn_production_route_pipeline_status(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns jsonb
language plpgsql
stable security definer
set search_path=costing,public,pg_temp
as $$
declare
  v_recipient_count integer;
  v_resolved_count integer;
  v_valid_count integer;
begin
  select count(*) into v_recipient_count
  from costing.fn_costing_recipient_products(p_period_start,p_valuation_date,p_refresh_run_id);
  select count(*) filter(where costing.fn_resolve_route_family_for_product(r.product_id,p_valuation_date) is not null),
         count(*) filter(where coalesce((costing.fn_validate_effective_product_process_route(r.product_id,p_valuation_date)->>'valid')::boolean,false))
  into v_resolved_count,v_valid_count
  from costing.fn_costing_recipient_products(p_period_start,p_valuation_date,p_refresh_run_id) r;
  return jsonb_build_object(
    'period_start',date_trunc('month',p_period_start)::date,
    'valuation_date',p_valuation_date,
    'refresh_run_id',p_refresh_run_id,
    'recipient_product_count',v_recipient_count,
    'resolved_route_family_count',v_resolved_count,
    'valid_effective_route_count',v_valid_count,
    'route_coverage_ratio',v_valid_count::numeric/nullif(v_recipient_count,0),
    'architecture_status',case when v_valid_count=v_recipient_count then 'PIPELINE_ROUTE_COVERAGE_COMPLETE' else 'PIPELINE_ROUTE_COVERAGE_IN_PROGRESS' end,
    'monetary_allocation_gate',case when v_valid_count=v_recipient_count then 'ELIGIBLE_FOR_WORKLOAD_GATE_EVALUATION' else 'BLOCKED_INCOMPLETE_COMPANY_ROUTE_COVERAGE' end,
    'data_quality_gate_status','DEFERRED_UNTIL_PIPELINE_COMPLETE',
    'data_quality_blocks_architecture',false
  );
end;
$$;

revoke all on function costing.fn_production_route_pipeline_status(date,date,bigint) from public,anon,authenticated;
grant execute on function costing.fn_production_route_pipeline_status(date,date,bigint) to service_role;

create or replace function public.rpc_get_production_route_pipeline_status(
  p_period_start date,
  p_valuation_date date,
  p_refresh_run_id bigint
)
returns jsonb
language plpgsql security definer
set search_path=public,costing,pg_temp
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_production_route_pipeline_status(p_period_start,p_valuation_date,p_refresh_run_id);
end;
$$;
revoke all on function public.rpc_get_production_route_pipeline_status(date,date,bigint) from public,anon;
grant execute on function public.rpc_get_production_route_pipeline_status(date,date,bigint) to authenticated,service_role;