-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace view costing.v_product_process_route_readiness as
with product_ctx as (
  select
    p.id as product_id,
    p.item as product_name,
    c.id as category_id,
    c.category_name,
    sc.id as sub_category_id,
    sc.subcategory_name,
    pg.id as product_group_id,
    pg.group_name as product_group_name
  from public.products p
  join public.sub_groups sg on sg.id=p.sub_group_id
  join public.product_groups pg on pg.id=sg.product_group_id
  join public.sub_categories sc on sc.id=pg.sub_category_id
  join public.categories c on c.id=sc.category_id
  where upper(coalesce(p.status,''))='ACTIVE'
)
select
  pc.product_id,
  pc.product_name,
  pc.category_id,
  pc.category_name,
  pc.sub_category_id,
  pc.subcategory_name,
  pc.product_group_id,
  pc.product_group_name,
  resolved.route_family_id,
  rf.family_code as route_family_code,
  rf.family_name as route_family_name,
  pr.id as product_route_id,
  pr.route_version,
  pr.status as route_status,
  pr.effective_from,
  pr.effective_to,
  pr.evidence_status,
  pr.base_route_family_route_id,
  pr.batch_size_ref_id,
  case
    when resolved.route_family_id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'::text
    when fr.id is null then 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE'::text
    when not coalesce((val.validation->>'valid')::boolean,false) then 'BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE'::text
    else 'READY'::text
  end as readiness_status,
  val.validation,
  fr.id as effective_family_route_id,
  case when pr.id is null then 'ROUTE_FAMILY_INHERITED'::text else 'PRODUCT_ROUTE'::text end as effective_route_source,
  case
    when pa.id is not null then 'PRODUCT_ASSIGNMENT'::text
    when gm.id is not null then 'PRODUCT_GROUP_FALLBACK'::text
    else 'NONE'::text
  end as route_family_assignment_source,
  pa.id as product_route_family_assignment_id,
  gm.id as product_group_route_family_mapping_id,
  coalesce(pa.assignment_basis,gm.mapping_basis) as route_family_assignment_basis,
  coalesce(pa.approval_reference,gm.approval_reference) as route_family_assignment_approval_reference
from product_ctx pc
left join lateral (
  select a.*
  from costing.production_route_family_product_map a
  where a.product_id=pc.product_id
    and a.status='APPROVED'
    and a.effective_from<=current_date
    and (a.effective_to is null or a.effective_to>=current_date)
  order by a.effective_from desc,a.id desc
  limit 1
) pa on true
left join lateral (
  select m.*
  from costing.production_route_family_product_group_map m
  where m.product_group_id=pc.product_group_id
    and m.status='APPROVED'
    and m.effective_from<=current_date
    and (m.effective_to is null or m.effective_to>=current_date)
  order by m.effective_from desc,m.id desc
  limit 1
) gm on true
left join lateral (
  select costing.fn_resolve_route_family_for_product(pc.product_id,current_date) as route_family_id
) resolved on true
left join costing.production_route_family rf
  on rf.id=resolved.route_family_id
left join lateral (
  select r.id
  from costing.production_route_family_route r
  where r.route_family_id=resolved.route_family_id
    and r.status='APPROVED'
    and r.effective_from<=current_date
    and (r.effective_to is null or r.effective_to>=current_date)
  order by r.effective_from desc,r.route_version desc,r.id desc
  limit 1
) fr on true
left join lateral (
  select x.*
  from costing.product_process_route x
  where x.product_id=pc.product_id
    and x.status='APPROVED'
    and x.effective_from<=current_date
    and (x.effective_to is null or x.effective_to>=current_date)
  order by x.effective_from desc,x.route_version desc,x.id desc
  limit 1
) pr on true
left join lateral (
  select costing.fn_validate_effective_product_process_route(pc.product_id,current_date) as validation
) val on true;

comment on view costing.v_product_process_route_readiness is
'Canonical active-Product route readiness projection. Product-level Route Family assignments take precedence; approved Product Group mappings remain fallback. Legacy readiness status codes and existing columns are retained for client compatibility; assignment provenance columns are appended.';