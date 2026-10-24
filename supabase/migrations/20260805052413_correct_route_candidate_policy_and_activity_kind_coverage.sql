-- backfilled from live schema_migrations on 2026-10-24, CI-016
update costing.production_route_candidate_policy
set effective_from = date '2026-07-01'
where id = 1
  and policy_code = 'PRODUCT_PROCESS_ROUTE_CANDIDATE_V1'
  and version_no = 1
  and status = 'APPROVED'
  and effective_from = date '2026-08-01';

create or replace function costing.fn_preview_product_process_route_evidence(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null::integer
)
returns jsonb
language sql
stable security definer
set search_path to 'costing', 'public'
as $function$
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
), per_batch_detail as (
  select bmr_id,activity_kind_id,activity_id,section_id,subsection_id,area_id,plant_id,count(*)::numeric occurrences
  from eligible_raw group by bmr_id,activity_kind_id,activity_id,section_id,subsection_id,area_id,plant_id
), detail_step as (
  select r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.activity_id,
         r.section_id,r.subsection_id,r.area_id,r.plant_id,
         count(distinct r.bmr_id)::integer detail_batches_present,count(*)::integer logged_occurrences,
         percentile_cont(0.5) within group(order by r.sequence_position)::numeric median_sequence_position,
         percentile_cont(0.5) within group(order by pb.occurrences)::numeric median_occurrences_per_batch
  from eligible_raw r
  join per_batch_detail pb on pb.bmr_id=r.bmr_id and pb.activity_kind_id=r.activity_kind_id and pb.activity_id=r.activity_id
    and pb.section_id=r.section_id and pb.subsection_id=r.subsection_id and pb.area_id=r.area_id
    and pb.plant_id is not distinct from r.plant_id
  group by r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.activity_id,r.section_id,r.subsection_id,r.area_id,r.plant_id
), per_batch_kind as (
  select bmr_id,activity_kind_id,count(*)::numeric occurrences
  from eligible_raw
  group by bmr_id,activity_kind_id
), kind_step as (
  select r.activity_kind_id,
         max(r.activity_short_code) activity_short_code,
         max(r.activity_kind_name) activity_kind_name,
         count(distinct r.bmr_id)::integer batches_present,
         count(*)::integer logged_occurrences,
         percentile_cont(0.5) within group(order by r.sequence_position)::numeric median_sequence_position,
         percentile_cont(0.5) within group(order by pb.occurrences)::numeric median_occurrences_per_batch
  from eligible_raw r
  join per_batch_kind pb on pb.bmr_id=r.bmr_id and pb.activity_kind_id=r.activity_kind_id
  group by r.activity_kind_id
), kind_classified as (
  select s.*,ec.eligible_batches,
         case when ec.eligible_batches=0 then 0::numeric else s.batches_present::numeric/ec.eligible_batches end batch_coverage,
         case
           when ec.eligible_batches=0 then 'NO_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches>=p.core_threshold then 'CORE_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches>=p.common_threshold then 'COMMON_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches>=p.occasional_threshold then 'OCCASIONAL_EVIDENCE'
           else 'EXCEPTION_EVIDENCE'
         end evidence_class
  from kind_step s cross join eligible_count ec cross join policy p
), classified_detail as (
  select d.activity_kind_id,d.activity_short_code,d.activity_kind_name,d.activity_id,
         d.section_id,d.subsection_id,d.area_id,d.plant_id,
         d.detail_batches_present as batches_present,d.logged_occurrences,
         d.median_sequence_position,d.median_occurrences_per_batch,
         k.eligible_batches,k.batch_coverage,k.evidence_class,
         case when k.batches_present=0 then 0::numeric else d.detail_batches_present::numeric/k.batches_present end location_resource_share
  from detail_step d
  join kind_classified k on k.activity_kind_id=d.activity_kind_id
), readiness as (
  select ec.eligible_batches,p.min_eligible_batches,
         case
           when ec.eligible_batches=0 then 'NO_ELIGIBLE_HISTORY'
           when ec.eligible_batches<p.min_eligible_batches then 'PARTIAL_EVIDENCE'
           when not exists(select 1 from kind_classified where activity_short_code='RMDI' and evidence_class in('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
           when not exists(select 1 from kind_classified where activity_short_code='TRATO' and evidence_class in('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
           when not exists(
             select 1 from kind_classified k
             where k.activity_kind_id in (
               select distinct r.activity_kind_id
               from eligible_raw r
               where r.section_id in(3,4,6)
                 and r.activity_short_code not in('RMDI','TRATO','FINGO','INTST','FGBU')
             )
             and k.evidence_class in('CORE_EVIDENCE','COMMON_EVIDENCE')
           ) then 'PARTIAL_EVIDENCE'
           else 'REVIEWABLE_CANDIDATE'
         end candidate_status
  from eligible_count ec cross join policy p
)
select jsonb_build_object(
  'product',(select to_jsonb(x) from product_ctx x),
  'policy',(select jsonb_build_object('policy_code',policy_code,'version_no',version_no,'lookback_months',lookback_months,'min_eligible_batches',min_eligible_batches,'core_threshold',core_threshold,'common_threshold',common_threshold,'occasional_threshold',occasional_threshold) from policy),
  'summary',(select jsonb_build_object('candidate_status',candidate_status,'eligible_batches',eligible_batches,'minimum_required_batches',min_eligible_batches,'approvable',false,'approval_note','Historical evidence is preview-only. A governed Product route must still be explicitly created, validated and approved.') from readiness),
  'batch_quality',coalesce((select jsonb_agg(to_jsonb(q) order by q.first_started_on desc,q.bmr_id desc) from batch_quality q),'[]'::jsonb),
  'activity_kind_summary',coalesce((select jsonb_agg(to_jsonb(k) order by k.median_sequence_position,k.activity_kind_name) from kind_classified k),'[]'::jsonb),
  'candidate_steps',coalesce((select jsonb_agg(to_jsonb(c) order by c.median_sequence_position,c.activity_kind_name,c.area_id,c.plant_id) from classified_detail c),'[]'::jsonb)
)
$function$;