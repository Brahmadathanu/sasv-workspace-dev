-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- Gate 11Y.10I.2C.3F.1B.2B.4
-- Keep current operational PRM read surfaces free of archived architecture.

create or replace function public.rpc_get_production_route_manager_product_assignments(
  p_status text default null,
  p_search text default null,
  p_route_family_id bigint default null,
  p_product_group_id integer default null,
  p_product_id integer default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns jsonb
language plpgsql security definer
set search_path to 'public','costing','pg_temp'
as $function$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,100),500));
  v_offset integer:=greatest(coalesce(p_offset,0),0);
  v_status text:=nullif(upper(btrim(p_status)),'');
  v_result jsonb;
begin
  perform public.require_permission('module:production-route-manager',false);
  if v_status is not null and v_status not in('DRAFT','IN_REVIEW','APPROVED','INACTIVE','SUPERSEDED','CANCELLED') then raise exception 'Invalid assignment status %',p_status; end if;
  with assignment_rows as materialized (
    select a.id assignment_id,a.status,a.product_id,p.item product_name,p.status product_status,p.uom_base product_base_uom,
           c.id category_id,c.category_name,sc.id sub_category_id,sc.subcategory_name,pg.id product_group_id,pg.group_name product_group_name,
           sg.id product_subgroup_id,sg.sub_group_name product_subgroup_name,
           a.route_family_id,rf.family_code route_family_code,rf.family_name route_family_name,rf.status route_family_status,
           a.assignment_basis,a.assignment_note,a.effective_from,a.effective_to,a.approval_reference,a.approved_by,a.approved_at,
           a.supersedes_assignment_id,a.cancellation_reason,a.cancelled_by,a.cancelled_at,a.created_by,a.created_at,a.updated_at,
           case when a.status='DRAFT' then jsonb_build_array('SUBMIT_FOR_REVIEW','CANCEL')
                when a.status='IN_REVIEW' then jsonb_build_array('APPROVE','CANCEL')
                when a.status='APPROVED' then jsonb_build_array('INACTIVATE') else '[]'::jsonb end lifecycle_actions,
           true definition_read_only,
           exists(select 1 from costing.production_route_family_product_map x
                  where x.id<>a.id and x.product_id=a.product_id and x.archived_at is null
                    and x.status in('DRAFT','IN_REVIEW','APPROVED')
                    and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
                        && daterange(a.effective_from,coalesce(a.effective_to,'infinity'::date),'[]')) has_active_or_pending_overlap,
           coalesce((select jsonb_agg(jsonb_build_object('assignment_id',x.id,'status',x.status,'route_family_id',x.route_family_id,
                                                        'effective_from',x.effective_from,'effective_to',x.effective_to)
                                      order by x.effective_from,x.id)
                     from costing.production_route_family_product_map x
                     where x.id<>a.id and x.product_id=a.product_id and x.archived_at is null
                       and x.status in('DRAFT','IN_REVIEW','APPROVED')
                       and daterange(x.effective_from,coalesce(x.effective_to,'infinity'::date),'[]')
                           && daterange(a.effective_from,coalesce(a.effective_to,'infinity'::date),'[]')),'[]'::jsonb) overlap_evidence,
           costing.fn_validate_effective_product_process_route(a.product_id,
             case when a.effective_to is not null then least(current_date,a.effective_to) else greatest(a.effective_from,current_date) end) current_effective_route_validation
    from costing.production_route_family_product_map a
    join public.products p on p.id=a.product_id
    join public.sub_groups sg on sg.id=p.sub_group_id
    join public.product_groups pg on pg.id=sg.product_group_id
    join public.sub_categories sc on sc.id=pg.sub_category_id
    join public.categories c on c.id=sc.category_id
    join costing.production_route_family rf on rf.id=a.route_family_id and rf.archived_at is null
    where a.archived_at is null
      and (p_route_family_id is null or a.route_family_id=p_route_family_id)
      and (p_product_group_id is null or pg.id=p_product_group_id)
      and (p_product_id is null or a.product_id=p_product_id)
      and (nullif(btrim(p_search),'') is null or p.item ilike '%'||btrim(p_search)||'%'
           or sg.sub_group_name ilike '%'||btrim(p_search)||'%' or pg.group_name ilike '%'||btrim(p_search)||'%'
           or rf.family_name ilike '%'||btrim(p_search)||'%' or c.category_name ilike '%'||btrim(p_search)||'%'
           or sc.subcategory_name ilike '%'||btrim(p_search)||'%' or a.product_id::text=btrim(p_search) or a.id::text=btrim(p_search))
  ), filtered as (select * from assignment_rows where v_status is null or status=v_status),
  page as (
    select * from filtered
    order by case status when 'DRAFT' then 1 when 'IN_REVIEW' then 2 when 'APPROVED' then 3 when 'INACTIVE' then 4 when 'SUPERSEDED' then 5 when 'CANCELLED' then 6 else 7 end,
             category_name,subcategory_name,product_group_name,product_subgroup_name,product_name,effective_from desc,assignment_id desc
    limit v_limit offset v_offset
  )
  select jsonb_build_object('status_filter',v_status,'product_id_filter',p_product_id,'total_count',(select count(*) from filtered),
    'limit',v_limit,'offset',v_offset,
    'status_counts',coalesce((select jsonb_object_agg(status,cnt order by status) from (select status,count(*) cnt from assignment_rows group by status)s),'{}'::jsonb),
    'rows',coalesce((select jsonb_agg(to_jsonb(page) order by
      case status when 'DRAFT' then 1 when 'IN_REVIEW' then 2 when 'APPROVED' then 3 when 'INACTIVE' then 4 when 'SUPERSEDED' then 5 when 'CANCELLED' then 6 else 7 end,
      category_name,subcategory_name,product_group_name,product_subgroup_name,product_name,effective_from desc,assignment_id desc) from page),'[]'::jsonb))
  into v_result;
  return v_result;
end
$function$;

create or replace function costing.fn_preview_route_family_candidate(
  p_route_family_id bigint default null,
  p_product_group_ids integer[] default null,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language sql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
with policy as (
  select p.*,least(coalesce(p_lookback_months,p.default_lookback_months),p.maximum_lookback_months) lookback_months
  from costing.fn_resolve_production_route_candidate_policy(p_as_of_date) p
), family_ctx as (
  select f.id route_family_id,f.family_code,f.family_name,f.status
  from costing.production_route_family f where f.id=p_route_family_id and f.archived_at is null
), mapped_groups as (
  select distinct m.product_group_id
  from costing.production_route_family_product_group_map m
  join costing.production_route_family f on f.id=m.route_family_id and f.archived_at is null
  where p_route_family_id is not null and m.route_family_id=p_route_family_id and m.archived_at is null
    and m.status='APPROVED' and m.effective_from<=p_as_of_date and (m.effective_to is null or m.effective_to>=p_as_of_date)
), requested_groups as (select distinct unnest(coalesce(p_product_group_ids,'{}'::integer[])) product_group_id),
scope_groups as (select product_group_id from mapped_groups union select product_group_id from requested_groups where p_route_family_id is null),
group_details as (
  select pg.id product_group_id,pg.group_name,sc.id sub_category_id,sc.subcategory_name,c.id category_id,c.category_name,
         concat_ws(' › ',c.category_name,sc.subcategory_name,pg.group_name) hierarchy
  from scope_groups s join public.product_groups pg on pg.id=s.product_group_id
  join public.sub_categories sc on sc.id=pg.sub_category_id join public.categories c on c.id=sc.category_id
), scope_products as (
  select pr.id::bigint product_id,pr.item product_name,sg.product_group_id
  from public.products pr join public.sub_groups sg on sg.id=pr.sub_group_id join scope_groups g on g.product_group_id=sg.product_group_id
), raw as (
  select b.product_id::bigint,b.id::bigint bmr_id,a.kind_id activity_kind_id,ak.short_code activity_short_code,ak.name activity_kind_name,
         d.section_id,d.subsection_id,d.area_id,d.plant_id,d.status,d.completed_on
  from scope_products sp join public.bmr_details b on b.product_id=sp.product_id
  join public.daily_work_log d on d.item=b.item and d.batch_number=b.bn
  join public.activities a on a.activity_name=d.activity and a.section_id=d.section_id and a.sub_section_id=d.subsection_id and a.area_id=d.area_id
  join public.activity_kinds ak on ak.id=a.kind_id cross join policy p
  where d.log_date >= (date_trunc('month',p_as_of_date::timestamp)::date-make_interval(months=>p.lookback_months)) and d.log_date<p_as_of_date+1
), batch_quality as (
  select product_id,bmr_id,case when count(*) filter(where activity_short_code='RMDI')=0 then false
    when count(*) filter(where activity_short_code='TRATO')=0 then false
    when count(*) filter(where section_id in(3,4,6) and activity_short_code not in('RMDI','TRATO','FINGO','INTST','FGBU'))=0 then false
    when count(*) filter(where status<>'Done' or completed_on is null)>0 then false else true end eligible
  from raw group by product_id,bmr_id
), eligible_product_counts as (select product_id,count(*)::integer eligible_batches from batch_quality where eligible group by product_id),
product_kind as (
  select r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,count(distinct r.bmr_id)::integer batches_present,ep.eligible_batches,
         count(distinct r.bmr_id)::numeric/ep.eligible_batches batch_coverage
  from raw r join batch_quality q on q.product_id=r.product_id and q.bmr_id=r.bmr_id and q.eligible
  join eligible_product_counts ep on ep.product_id=r.product_id
  group by r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,ep.eligible_batches
), kind_support as (
  select pk.activity_kind_id,pk.activity_short_code,pk.activity_kind_name,count(*)::integer products_with_any_evidence,
         count(*) filter(where pk.batch_coverage>=p.common_threshold)::integer products_supporting_step,
         count(*) filter(where pk.batch_coverage>=p.common_threshold)::numeric/nullif((select count(*) from eligible_product_counts),0) product_support_ratio,
         avg(pk.batch_coverage)::numeric average_product_batch_coverage
  from product_kind pk cross join policy p group by pk.activity_kind_id,pk.activity_short_code,pk.activity_kind_name
), location_support as (
  select r.activity_kind_id,r.section_id,r.subsection_id,r.area_id,r.plant_id,count(distinct r.product_id)::integer products_present,
         count(distinct r.bmr_id)::integer batches_present,
         row_number() over(partition by r.activity_kind_id order by count(distinct r.product_id) desc,count(distinct r.bmr_id) desc,r.area_id,r.plant_id nulls last) rn
  from raw r join batch_quality q on q.product_id=r.product_id and q.bmr_id=r.bmr_id and q.eligible
  group by r.activity_kind_id,r.section_id,r.subsection_id,r.area_id,r.plant_id
), family_steps as (
  select k.*,l.section_id modal_section_id,l.subsection_id modal_subsection_id,l.area_id modal_area_id,l.plant_id modal_plant_id,
    case when k.product_support_ratio>=p.core_threshold then 'FAMILY_CORE_STEP'
         when k.product_support_ratio>=p.common_threshold then 'FAMILY_COMMON_STEP'
         when k.product_support_ratio>=p.occasional_threshold then 'FAMILY_OCCASIONAL_STEP' else 'FAMILY_EXCEPTION_STEP' end family_evidence_class
  from kind_support k left join location_support l on l.activity_kind_id=k.activity_kind_id and l.rn=1 cross join policy p
), summary as (
  select (select count(*) from scope_groups)::integer product_groups_in_scope,(select count(*) from scope_products)::integer products_in_scope,
         (select count(*) from eligible_product_counts)::integer products_with_eligible_history,coalesce((select sum(eligible_batches) from eligible_product_counts),0)::integer eligible_batches
)
select jsonb_build_object('scope_mode',case when p_route_family_id is null then 'PRE_MAPPING_PRODUCT_GROUP_SET' else 'APPROVED_ROUTE_FAMILY_MAPPING' end,
  'route_family',(select to_jsonb(f) from family_ctx f),
  'product_groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.category_name,g.subcategory_name,g.group_name,g.product_group_id) from group_details g),'[]'::jsonb),
  'policy',(select jsonb_build_object('policy_code',policy_code,'version_no',version_no,'lookback_months',lookback_months,'core_threshold',core_threshold,
                                      'common_threshold',common_threshold,'occasional_threshold',occasional_threshold) from policy),
  'summary',(select to_jsonb(s) from summary s),
  'family_steps',coalesce((select jsonb_agg(to_jsonb(fs) order by fs.family_evidence_class,fs.activity_kind_name) from family_steps fs),'[]'::jsonb),
  'approvable',false,'approval_note','Route Family evidence is preview-only. Matching names never create mappings or approve routes.')
$function$;

create or replace function costing.fn_preview_route_family_route_steps(
  p_family_route_id bigint,p_date_from date default date '2025-07-01',p_date_to date default date '2026-08-01'
) returns jsonb
language plpgsql stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare v_route costing.production_route_family_route%rowtype; v_group_id integer; v_steps jsonb; v_evidence jsonb; v_gap jsonb;
begin
  select r.* into v_route from costing.production_route_family_route r
  join costing.production_route_family f on f.id=r.route_family_id and f.archived_at is null
  where r.id=p_family_route_id and r.archived_at is null;
  if not found then return jsonb_build_object('preview_only',true,'approvable',false,'valid',false,'errors',jsonb_build_array('ACTIVE_ROUTE_FAMILY_ROUTE_NOT_FOUND'),'records_created',0); end if;
  select min(m.product_group_id) into v_group_id from costing.production_route_family_product_group_map m
  where m.route_family_id=v_route.route_family_id and m.archived_at is null and m.status='APPROVED'
    and m.effective_from<=coalesce(p_date_to,current_date) and (m.effective_to is null or m.effective_to>=coalesce(p_date_from,date '1900-01-01'));
  if v_group_id is null then return jsonb_build_object('preview_only',true,'approvable',false,'valid',false,
      'errors',jsonb_build_array('NO_APPROVED_PRODUCT_GROUP_MAPPING'),'family_route_id',p_family_route_id,'records_created',0); end if;
  -- Reuse the governed family candidate engine for evidence summary; this function is preview-only.
  v_evidence:=costing.fn_preview_route_family_candidate(v_route.route_family_id,array[v_group_id],coalesce(p_date_to,current_date),null)->'summary';
  select coalesce(jsonb_agg(to_jsonb(s) order by s.sequence_no,s.id),'[]'::jsonb) into v_steps
  from costing.production_route_family_route_step s where s.family_route_id=p_family_route_id;
  v_gap:='[]'::jsonb;
  return jsonb_build_object('preview_only',true,'approvable',false,'requires_manual_review',true,'records_created',0,
    'family_route_id',v_route.id,'route_family_id',v_route.route_family_id,'product_group_id',v_group_id,
    'date_from',coalesce(p_date_from,date '2025-07-01'),'date_to',coalesce(p_date_to,current_date),
    'candidate_step_count',jsonb_array_length(v_steps),'candidate_steps',v_steps,'batch_evidence',coalesce(v_evidence,'{}'::jsonb),
    'evidence_gaps',v_gap,'decision_notes',jsonb_build_array('ACTIVE_ROUTE_ONLY','PREVIEW_ONLY'));
end
$function$;
