-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_preview_product_process_route_evidence(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language sql
stable
security definer
set search_path=costing,public
as $$
with policy as (
  select p.*,
         least(coalesce(p_lookback_months,p.default_lookback_months),p.maximum_lookback_months) lookback_months
  from costing.fn_resolve_production_route_candidate_policy(p_as_of_date) p
), product_ctx as (
  select pr.id::bigint product_id,pr.item product_name,pr.uom_base,
         pg.id product_group_id,pg.group_name,
         c.id category_id,c.category_name,
         sc.id sub_category_id,sc.subcategory_name,
         concat_ws(' › ',c.category_name,sc.subcategory_name,pg.group_name) product_group_hierarchy
  from public.products pr
  join public.sub_groups sg on sg.id=pr.sub_group_id
  join public.product_groups pg on pg.id=sg.product_group_id
  join public.sub_categories sc on sc.id=pg.sub_category_id
  join public.categories c on c.id=sc.category_id
  where pr.id=p_product_id
), raw as (
  select b.product_id::bigint,b.id::bigint bmr_id,b.bn batch_number,b.batch_size,b.uom batch_uom,
         d.id::bigint log_id,d.log_date,d.started_on,d.completed_on,d.status,
         d.section_id,d.subsection_id,d.area_id,d.plant_id,
         a.id::bigint activity_id,a.kind_id activity_kind_id,
         ak.short_code activity_short_code,ak.name activity_kind_name,
         row_number() over(partition by b.id order by d.started_on,coalesce(d.completed_on,d.due_date),d.log_date,d.id)::integer sequence_position
  from public.bmr_details b
  join public.daily_work_log d on d.item=b.item and d.batch_number=b.bn
  join public.activities a on a.activity_name=d.activity and a.section_id=d.section_id and a.sub_section_id=d.subsection_id and a.area_id=d.area_id
  join public.activity_kinds ak on ak.id=a.kind_id
  cross join policy p
  where b.product_id=p_product_id
    and d.log_date >= (date_trunc('month',p_as_of_date::timestamp)::date-make_interval(months=>p.lookback_months))
    and d.log_date < p_as_of_date+1
), batch_quality as (
  select product_id,bmr_id,batch_number,max(batch_size) batch_size,max(batch_uom) batch_uom,
         count(*) log_count,
         count(*) filter(where activity_short_code='RMDI') rm_boundary_count,
         count(*) filter(where activity_short_code='TRATO') fg_boundary_count,
         count(*) filter(where section_id in(3,4,6) and activity_short_code not in('RMDI','TRATO','FINGO','INTST','FGBU')) production_step_count,
         count(*) filter(where status<>'Done' or completed_on is null) incomplete_log_count,
         min(started_on) first_started_on,max(completed_on) last_completed_on,
         case
           when count(*) filter(where activity_short_code='RMDI')=0 then 'MISSING_RM_BOUNDARY'
           when count(*) filter(where activity_short_code='TRATO')=0 then 'MISSING_FG_BOUNDARY'
           when count(*) filter(where section_id in(3,4,6) and activity_short_code not in('RMDI','TRATO','FINGO','INTST','FGBU'))=0 then 'MISSING_PRODUCTION_PROCESS'
           when count(*) filter(where status<>'Done' or completed_on is null)>0 then 'INCOMPLETE_OR_OPEN_LOGS'
           else 'ELIGIBLE'
         end eligibility_status
  from raw group by product_id,bmr_id,batch_number
), eligible_raw as (
  select r.* from raw r join batch_quality q on q.bmr_id=r.bmr_id and q.eligibility_status='ELIGIBLE'
), eligible_count as (
  select count(*)::integer eligible_batches from batch_quality where eligibility_status='ELIGIBLE'
), per_batch as (
  select bmr_id,activity_kind_id,activity_id,section_id,subsection_id,area_id,plant_id,count(*)::numeric occurrences
  from eligible_raw group by bmr_id,activity_kind_id,activity_id,section_id,subsection_id,area_id,plant_id
), product_step as (
  select r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.activity_id,
         r.section_id,r.subsection_id,r.area_id,r.plant_id,
         count(distinct r.bmr_id)::integer batches_present,count(*)::integer logged_occurrences,
         percentile_cont(0.5) within group(order by r.sequence_position)::numeric median_sequence_position,
         percentile_cont(0.5) within group(order by pb.occurrences)::numeric median_occurrences_per_batch
  from eligible_raw r
  join per_batch pb on pb.bmr_id=r.bmr_id and pb.activity_kind_id=r.activity_kind_id and pb.activity_id=r.activity_id
    and pb.section_id=r.section_id and pb.subsection_id=r.subsection_id and pb.area_id=r.area_id
    and pb.plant_id is not distinct from r.plant_id
  group by r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.activity_id,r.section_id,r.subsection_id,r.area_id,r.plant_id
), classified as (
  select s.*,ec.eligible_batches,
         case when ec.eligible_batches=0 then 0::numeric else s.batches_present::numeric/ec.eligible_batches end batch_coverage,
         case
           when ec.eligible_batches=0 then 'NO_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches>=p.core_threshold then 'CORE_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches>=p.common_threshold then 'COMMON_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches>=p.occasional_threshold then 'OCCASIONAL_EVIDENCE'
           else 'EXCEPTION_EVIDENCE'
         end evidence_class
  from product_step s cross join eligible_count ec cross join policy p
), readiness as (
  select ec.eligible_batches,p.min_eligible_batches,
         case
           when ec.eligible_batches=0 then 'NO_ELIGIBLE_HISTORY'
           when ec.eligible_batches<p.min_eligible_batches then 'PARTIAL_EVIDENCE'
           when not exists(select 1 from classified where activity_short_code='RMDI' and evidence_class in('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
           when not exists(select 1 from classified where activity_short_code='TRATO' and evidence_class in('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
           when not exists(select 1 from classified where section_id in(3,4,6) and activity_short_code not in('RMDI','TRATO','FINGO','INTST','FGBU') and evidence_class in('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
           else 'REVIEWABLE_CANDIDATE'
         end candidate_status
  from eligible_count ec cross join policy p
)
select jsonb_build_object(
  'product',(select to_jsonb(x) from product_ctx x),
  'policy',(select jsonb_build_object('policy_code',policy_code,'version_no',version_no,'lookback_months',lookback_months,'min_eligible_batches',min_eligible_batches,'core_threshold',core_threshold,'common_threshold',common_threshold,'occasional_threshold',occasional_threshold) from policy),
  'summary',(select jsonb_build_object('candidate_status',candidate_status,'eligible_batches',eligible_batches,'minimum_required_batches',min_eligible_batches,'approvable',false,'approval_note','Historical evidence is preview-only. A governed Product route must still be explicitly created, validated and approved.') from readiness),
  'batch_quality',coalesce((select jsonb_agg(to_jsonb(q) order by q.first_started_on desc,q.bmr_id desc) from batch_quality q),'[]'::jsonb),
  'candidate_steps',coalesce((select jsonb_agg(to_jsonb(c) order by c.median_sequence_position,c.activity_kind_name,c.area_id) from classified c),'[]'::jsonb)
)
$$;

create or replace function costing.fn_preview_route_family_candidate(
  p_route_family_id bigint default null,
  p_product_group_ids integer[] default null,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language sql
stable
security definer
set search_path=costing,public
as $$
with policy as (
  select p.*,least(coalesce(p_lookback_months,p.default_lookback_months),p.maximum_lookback_months) lookback_months
  from costing.fn_resolve_production_route_candidate_policy(p_as_of_date) p
), family_ctx as (
  select f.id route_family_id,f.family_code,f.family_name,f.status
  from costing.production_route_family f where f.id=p_route_family_id
), mapped_groups as (
  select distinct m.product_group_id
  from costing.production_route_family_product_group_map m
  where p_route_family_id is not null and m.route_family_id=p_route_family_id
    and m.status='APPROVED' and m.effective_from<=p_as_of_date and (m.effective_to is null or m.effective_to>=p_as_of_date)
), requested_groups as (
  select distinct unnest(coalesce(p_product_group_ids,'{}'::integer[])) product_group_id
), scope_groups as (
  select product_group_id from mapped_groups
  union
  select product_group_id from requested_groups where p_route_family_id is null
), group_details as (
  select pg.id product_group_id,pg.group_name,sc.id sub_category_id,sc.subcategory_name,c.id category_id,c.category_name,
         concat_ws(' › ',c.category_name,sc.subcategory_name,pg.group_name) hierarchy
  from scope_groups s join public.product_groups pg on pg.id=s.product_group_id
  join public.sub_categories sc on sc.id=pg.sub_category_id
  join public.categories c on c.id=sc.category_id
), scope_products as (
  select pr.id::bigint product_id,pr.item product_name,sg.product_group_id
  from public.products pr join public.sub_groups sg on sg.id=pr.sub_group_id
  join scope_groups g on g.product_group_id=sg.product_group_id
), raw as (
  select b.product_id::bigint,b.id::bigint bmr_id,a.kind_id activity_kind_id,
         ak.short_code activity_short_code,ak.name activity_kind_name,
         d.section_id,d.subsection_id,d.area_id,d.plant_id,d.status,d.completed_on
  from scope_products sp
  join public.bmr_details b on b.product_id=sp.product_id
  join public.daily_work_log d on d.item=b.item and d.batch_number=b.bn
  join public.activities a on a.activity_name=d.activity and a.section_id=d.section_id and a.sub_section_id=d.subsection_id and a.area_id=d.area_id
  join public.activity_kinds ak on ak.id=a.kind_id
  cross join policy p
  where d.log_date >= (date_trunc('month',p_as_of_date::timestamp)::date-make_interval(months=>p.lookback_months))
    and d.log_date < p_as_of_date+1
), batch_quality as (
  select product_id,bmr_id,
         case
           when count(*) filter(where activity_short_code='RMDI')=0 then false
           when count(*) filter(where activity_short_code='TRATO')=0 then false
           when count(*) filter(where section_id in(3,4,6) and activity_short_code not in('RMDI','TRATO','FINGO','INTST','FGBU'))=0 then false
           when count(*) filter(where status<>'Done' or completed_on is null)>0 then false
           else true end eligible
  from raw group by product_id,bmr_id
), eligible_product_counts as (
  select product_id,count(*)::integer eligible_batches from batch_quality where eligible group by product_id
), product_kind as (
  select r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,
         count(distinct r.bmr_id)::integer batches_present,ep.eligible_batches,
         count(distinct r.bmr_id)::numeric/ep.eligible_batches batch_coverage
  from raw r join batch_quality q on q.product_id=r.product_id and q.bmr_id=r.bmr_id and q.eligible
  join eligible_product_counts ep on ep.product_id=r.product_id
  group by r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,ep.eligible_batches
), kind_support as (
  select pk.activity_kind_id,pk.activity_short_code,pk.activity_kind_name,
         count(*)::integer products_with_any_evidence,
         count(*) filter(where pk.batch_coverage>=p.common_threshold)::integer products_supporting_step,
         count(*) filter(where pk.batch_coverage>=p.common_threshold)::numeric/nullif((select count(*) from eligible_product_counts),0) product_support_ratio,
         avg(pk.batch_coverage)::numeric average_product_batch_coverage
  from product_kind pk cross join policy p
  group by pk.activity_kind_id,pk.activity_short_code,pk.activity_kind_name
), location_support as (
  select r.activity_kind_id,r.section_id,r.subsection_id,r.area_id,r.plant_id,
         count(distinct r.product_id)::integer products_present,count(distinct r.bmr_id)::integer batches_present,
         row_number() over(partition by r.activity_kind_id order by count(distinct r.product_id) desc,count(distinct r.bmr_id) desc,r.area_id,r.plant_id nulls last) rn
  from raw r join batch_quality q on q.product_id=r.product_id and q.bmr_id=r.bmr_id and q.eligible
  group by r.activity_kind_id,r.section_id,r.subsection_id,r.area_id,r.plant_id
), family_steps as (
  select k.*,l.section_id modal_section_id,l.subsection_id modal_subsection_id,l.area_id modal_area_id,l.plant_id modal_plant_id,
         case
           when k.product_support_ratio>=p.core_threshold then 'FAMILY_CORE_STEP'
           when k.product_support_ratio>=p.common_threshold then 'FAMILY_COMMON_STEP'
           when k.product_support_ratio>=p.occasional_threshold then 'FAMILY_OCCASIONAL_STEP'
           else 'FAMILY_EXCEPTION_STEP' end family_evidence_class
  from kind_support k left join location_support l on l.activity_kind_id=k.activity_kind_id and l.rn=1 cross join policy p
), summary as (
  select (select count(*) from scope_groups)::integer product_groups_in_scope,
         (select count(*) from scope_products)::integer products_in_scope,
         (select count(*) from eligible_product_counts)::integer products_with_eligible_history,
         coalesce((select sum(eligible_batches) from eligible_product_counts),0)::integer eligible_batches
)
select jsonb_build_object(
  'scope_mode',case when p_route_family_id is null then 'PRE_MAPPING_PRODUCT_GROUP_SET' else 'APPROVED_ROUTE_FAMILY_MAPPING' end,
  'route_family',(select to_jsonb(f) from family_ctx f),
  'product_groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.category_name,g.subcategory_name,g.group_name,g.product_group_id) from group_details g),'[]'::jsonb),
  'policy',(select jsonb_build_object('policy_code',policy_code,'version_no',version_no,'lookback_months',lookback_months,'core_threshold',core_threshold,'common_threshold',common_threshold,'occasional_threshold',occasional_threshold) from policy),
  'summary',(select to_jsonb(s) from summary s),
  'family_steps',coalesce((select jsonb_agg(to_jsonb(fs) order by fs.family_evidence_class,fs.activity_kind_name) from family_steps fs),'[]'::jsonb),
  'approvable',false,
  'approval_note','Route Family evidence is preview-only. Matching names never create mappings or approve routes.'
)
$$;

create or replace function costing.fn_preview_product_process_route_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=costing,public
as $$
declare
  v_product jsonb;
  v_family_id bigint;
  v_family jsonb;
  v_comparison jsonb;
begin
  v_product:=costing.fn_preview_product_process_route_evidence(p_product_id,p_as_of_date,p_lookback_months);
  v_family_id:=costing.fn_resolve_route_family_for_product(p_product_id::integer,p_as_of_date);
  if v_family_id is null then
    return v_product||jsonb_build_object(
      'route_family_context',jsonb_build_object('status','NO_APPROVED_ROUTE_FAMILY_MAPPING'),
      'family_comparison','[]'::jsonb
    );
  end if;
  v_family:=costing.fn_preview_route_family_candidate(v_family_id,null,p_as_of_date,p_lookback_months);
  with product_kind as (
    select x->>'activity_kind_id' activity_kind_id,
           max(x->>'activity_short_code') activity_short_code,
           max(x->>'activity_kind_name') activity_kind_name,
           max((x->>'batch_coverage')::numeric) product_batch_coverage,
           max(case x->>'evidence_class' when 'CORE_EVIDENCE' then 4 when 'COMMON_EVIDENCE' then 3 when 'OCCASIONAL_EVIDENCE' then 2 when 'EXCEPTION_EVIDENCE' then 1 else 0 end) evidence_rank,
           (array_agg((x->>'area_id')::integer order by (x->>'batch_coverage')::numeric desc,(x->>'area_id')::integer))[1] modal_area_id,
           (array_agg(nullif(x->>'plant_id','')::integer order by (x->>'batch_coverage')::numeric desc,(x->>'area_id')::integer))[1] modal_plant_id
    from jsonb_array_elements(v_product->'candidate_steps') x group by x->>'activity_kind_id'
  ), family_kind as (
    select x->>'activity_kind_id' activity_kind_id,x->>'activity_short_code' activity_short_code,x->>'activity_kind_name' activity_kind_name,
           (x->>'product_support_ratio')::numeric product_support_ratio,x->>'family_evidence_class' family_evidence_class,
           (x->>'modal_area_id')::integer modal_area_id,nullif(x->>'modal_plant_id','')::integer modal_plant_id
    from jsonb_array_elements(v_family->'family_steps') x
  ), cmp as (
    select coalesce(pk.activity_kind_id,fk.activity_kind_id) activity_kind_id,
           coalesce(pk.activity_short_code,fk.activity_short_code) activity_short_code,
           coalesce(pk.activity_kind_name,fk.activity_kind_name) activity_kind_name,
           pk.product_batch_coverage,
           case pk.evidence_rank when 4 then 'CORE_EVIDENCE' when 3 then 'COMMON_EVIDENCE' when 2 then 'OCCASIONAL_EVIDENCE' when 1 then 'EXCEPTION_EVIDENCE' else 'NO_EVIDENCE' end product_evidence_class,
           fk.product_support_ratio,fk.family_evidence_class,
           pk.modal_area_id product_modal_area_id,fk.modal_area_id family_modal_area_id,
           pk.modal_plant_id product_modal_plant_id,fk.modal_plant_id family_modal_plant_id,
           case
             when pk.activity_kind_id is null and fk.family_evidence_class='FAMILY_CORE_STEP' then 'BYPASS_STEP_CANDIDATE'
             when pk.evidence_rank>=3 and (fk.activity_kind_id is null or fk.family_evidence_class in('FAMILY_OCCASIONAL_STEP','FAMILY_EXCEPTION_STEP')) then 'ADD_STEP_CANDIDATE'
             when pk.evidence_rank>=3 and fk.family_evidence_class in('FAMILY_CORE_STEP','FAMILY_COMMON_STEP') and (pk.modal_area_id is distinct from fk.modal_area_id or pk.modal_plant_id is distinct from fk.modal_plant_id) then 'LOCATION_OR_RESOURCE_OVERRIDE_CANDIDATE'
             when pk.evidence_rank=1 then 'REVIEW_EXCEPTION_STEP'
             else 'ALIGNED_OR_NO_DELTA' end delta_suggestion
    from product_kind pk full join family_kind fk on fk.activity_kind_id=pk.activity_kind_id
  ) select coalesce(jsonb_agg(to_jsonb(c) order by c.activity_kind_name),'[]'::jsonb) into v_comparison from cmp c;
  return v_product||jsonb_build_object(
    'route_family_context',jsonb_build_object('status','APPROVED_ROUTE_FAMILY_MAPPING','route_family_id',v_family_id,'route_family',v_family->'route_family','summary',v_family->'summary'),
    'family_comparison',v_comparison
  );
end
$$;

create or replace function costing.fn_preview_product_route_delta_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=costing,public
as $$
declare v_product jsonb;
begin
  v_product:=costing.fn_preview_product_process_route_candidate(p_product_id,p_as_of_date,p_lookback_months);
  return jsonb_build_object(
    'product',v_product->'product',
    'product_candidate_summary',v_product->'summary',
    'route_family_context',v_product->'route_family_context',
    'delta_candidates',coalesce(v_product->'family_comparison','[]'::jsonb),
    'approval_note','Delta proposals are review aids only and cannot create or approve Product route overrides.'
  );
end
$$;

create or replace function public.rpc_preview_route_family_candidate(
  p_route_family_id bigint default null,
  p_product_group_ids integer[] default null,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  if p_route_family_id is null and coalesce(cardinality(p_product_group_ids),0)=0 then
    raise exception 'Provide a Route Family or one or more Product Groups for candidate preview';
  end if;
  return costing.fn_preview_route_family_candidate(p_route_family_id,p_product_group_ids,p_as_of_date,p_lookback_months);
end
$$;

create or replace function public.rpc_preview_product_process_route_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_preview_product_process_route_candidate(p_product_id,p_as_of_date,p_lookback_months);
end
$$;

create or replace function public.rpc_preview_product_route_delta_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
) returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_preview_product_route_delta_candidate(p_product_id,p_as_of_date,p_lookback_months);
end
$$;

revoke all on function public.rpc_preview_route_family_candidate(bigint,integer[],date,integer) from public,anon;
grant execute on function public.rpc_preview_route_family_candidate(bigint,integer[],date,integer) to authenticated,service_role;
revoke all on function public.rpc_preview_product_process_route_candidate(bigint,date,integer) from public,anon;
grant execute on function public.rpc_preview_product_process_route_candidate(bigint,date,integer) to authenticated,service_role;
revoke all on function public.rpc_preview_product_route_delta_candidate(bigint,date,integer) from public,anon;
grant execute on function public.rpc_preview_product_route_delta_candidate(bigint,date,integer) to authenticated,service_role;