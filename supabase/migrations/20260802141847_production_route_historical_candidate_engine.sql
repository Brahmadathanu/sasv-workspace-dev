-- backfilled from live schema_migrations on 2026-10-24, CI-016
create table if not exists costing.production_route_candidate_policy (
  id bigint generated always as identity primary key,
  policy_code text not null,
  version_no integer not null,
  effective_from date not null,
  effective_to date,
  status text not null check (status in ('DRAFT','APPROVED','SUPERSEDED','INACTIVE')),
  min_eligible_batches integer not null default 3 check (min_eligible_batches >= 1),
  core_threshold numeric not null default 0.80 check (core_threshold > 0 and core_threshold <= 1),
  common_threshold numeric not null default 0.50 check (common_threshold > 0 and common_threshold <= 1),
  occasional_threshold numeric not null default 0.20 check (occasional_threshold >= 0 and occasional_threshold <= 1),
  default_lookback_months integer not null default 12 check (default_lookback_months between 1 and 60),
  maximum_lookback_months integer not null default 24 check (maximum_lookback_months between 1 and 120),
  approval_reference text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  note text,
  unique (policy_code, version_no),
  check (effective_to is null or effective_to >= effective_from),
  check (core_threshold >= common_threshold and common_threshold >= occasional_threshold),
  check ((status <> 'APPROVED') or (approval_reference is not null and approved_at is not null))
);

insert into costing.production_route_candidate_policy (
  policy_code, version_no, effective_from, status,
  min_eligible_batches, core_threshold, common_threshold,
  occasional_threshold, default_lookback_months,
  maximum_lookback_months, approval_reference, approved_at, note
)
select
  'PRODUCT_PROCESS_ROUTE_CANDIDATE_V1', 1, date '2026-08-01', 'APPROVED',
  3, 0.80, 0.50, 0.20, 12, 24,
  'EVP-3I2C12C.5.11BU.4', now(),
  'Historical Daily Work Log evidence may create route candidates only. It never approves or activates a Product route.'
where not exists (
  select 1 from costing.production_route_candidate_policy
  where policy_code='PRODUCT_PROCESS_ROUTE_CANDIDATE_V1' and version_no=1
);

create or replace function costing.fn_resolve_production_route_candidate_policy(p_as_of_date date)
returns costing.production_route_candidate_policy
language sql
stable
security definer
set search_path = costing, public
as $$
  select p.*
  from costing.production_route_candidate_policy p
  where p.status='APPROVED'
    and p.effective_from <= p_as_of_date
    and (p.effective_to is null or p.effective_to >= p_as_of_date)
  order by p.effective_from desc, p.version_no desc, p.id desc
  limit 1
$$;

create or replace function costing.fn_preview_product_process_route_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = costing, public
as $$
with policy as (
  select p.*,
         least(coalesce(p_lookback_months, p.default_lookback_months), p.maximum_lookback_months) as lookback_months
  from costing.fn_resolve_production_route_candidate_policy(p_as_of_date) p
), product_ctx as (
  select pr.id::bigint product_id,
         pr.item product_name,
         sg.product_group_id,
         pg.group_name,
         pr.uom_base
  from public.products pr
  join public.sub_groups sg on sg.id=pr.sub_group_id
  join public.product_groups pg on pg.id=sg.product_group_id
  where pr.id=p_product_id
), raw as (
  select
    b.product_id::bigint,
    b.id::bigint bmr_id,
    b.bn batch_number,
    b.batch_size,
    b.uom batch_uom,
    d.id::bigint log_id,
    d.log_date,
    d.started_on,
    d.completed_on,
    d.status,
    d.section_id,
    d.subsection_id,
    d.area_id,
    d.plant_id,
    a.id::bigint activity_id,
    a.kind_id activity_kind_id,
    ak.short_code activity_short_code,
    ak.name activity_kind_name,
    row_number() over (
      partition by b.id
      order by d.started_on, coalesce(d.completed_on,d.due_date), d.log_date, d.id
    )::integer as sequence_position
  from public.bmr_details b
  join public.daily_work_log d
    on d.item=b.item and d.batch_number=b.bn
  join public.activities a
    on a.activity_name=d.activity
   and a.section_id=d.section_id
   and a.sub_section_id=d.subsection_id
   and a.area_id=d.area_id
  join public.activity_kinds ak on ak.id=a.kind_id
  cross join policy p
  where b.product_id=p_product_id
    and d.log_date >= (date_trunc('month',p_as_of_date::timestamp)::date - make_interval(months=>p.lookback_months))
    and d.log_date < p_as_of_date + 1
), batch_quality as (
  select
    product_id,bmr_id,batch_number,max(batch_size) batch_size,max(batch_uom) batch_uom,
    count(*) log_count,
    count(*) filter (where activity_short_code='RMDI') rm_boundary_count,
    count(*) filter (where activity_short_code='TRATO') fg_boundary_count,
    count(*) filter (where section_id in (3,4,6) and activity_short_code not in ('RMDI','TRATO','FINGO','INTST','FGBU')) production_step_count,
    count(*) filter (where status<>'Done' or completed_on is null) incomplete_log_count,
    min(started_on) first_started_on,
    max(completed_on) last_completed_on,
    case
      when count(*) filter (where activity_short_code='RMDI')=0 then 'MISSING_RM_BOUNDARY'
      when count(*) filter (where activity_short_code='TRATO')=0 then 'MISSING_FG_BOUNDARY'
      when count(*) filter (where section_id in (3,4,6) and activity_short_code not in ('RMDI','TRATO','FINGO','INTST','FGBU'))=0 then 'MISSING_PRODUCTION_PROCESS'
      when count(*) filter (where status<>'Done' or completed_on is null)>0 then 'INCOMPLETE_OR_OPEN_LOGS'
      else 'ELIGIBLE'
    end eligibility_status
  from raw
  group by product_id,bmr_id,batch_number
), eligible_raw as (
  select r.*
  from raw r
  join batch_quality q on q.bmr_id=r.bmr_id and q.eligibility_status='ELIGIBLE'
), eligible_count as (
  select count(*)::integer eligible_batches from batch_quality where eligibility_status='ELIGIBLE'
), product_step as (
  select
    r.activity_kind_id,
    r.activity_short_code,
    r.activity_kind_name,
    r.activity_id,
    r.section_id,
    r.subsection_id,
    r.area_id,
    r.plant_id,
    count(distinct r.bmr_id)::integer batches_present,
    count(*)::integer logged_occurrences,
    percentile_cont(0.5) within group (order by r.sequence_position)::numeric median_sequence_position,
    percentile_cont(0.5) within group (order by per_batch.occurrences)::numeric median_occurrences_per_batch
  from eligible_raw r
  join (
    select bmr_id,activity_kind_id,activity_id,section_id,subsection_id,area_id,plant_id,count(*)::numeric occurrences
    from eligible_raw
    group by bmr_id,activity_kind_id,activity_id,section_id,subsection_id,area_id,plant_id
  ) per_batch
    on per_batch.bmr_id=r.bmr_id
   and per_batch.activity_kind_id=r.activity_kind_id
   and per_batch.activity_id=r.activity_id
   and per_batch.section_id=r.section_id
   and per_batch.subsection_id=r.subsection_id
   and per_batch.area_id=r.area_id
   and per_batch.plant_id is not distinct from r.plant_id
  group by r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.activity_id,r.section_id,r.subsection_id,r.area_id,r.plant_id
), product_step_classified as (
  select s.*,
         ec.eligible_batches,
         case when ec.eligible_batches=0 then 0::numeric else s.batches_present::numeric/ec.eligible_batches end batch_coverage,
         case
           when ec.eligible_batches=0 then 'NO_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches >= p.core_threshold then 'CORE_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches >= p.common_threshold then 'COMMON_EVIDENCE'
           when s.batches_present::numeric/ec.eligible_batches >= p.occasional_threshold then 'OCCASIONAL_EVIDENCE'
           else 'EXCEPTION_EVIDENCE'
         end evidence_class
  from product_step s cross join eligible_count ec cross join policy p
), group_products as (
  select pr.id::bigint product_id
  from public.products pr
  join public.sub_groups sg on sg.id=pr.sub_group_id
  join product_ctx pc on pc.product_group_id=sg.product_group_id
), group_raw as (
  select
    b.product_id::bigint,
    b.id::bigint bmr_id,
    a.kind_id activity_kind_id,
    ak.short_code activity_short_code,
    ak.name activity_kind_name,
    d.section_id,d.subsection_id,d.area_id,d.plant_id,
    d.status,d.completed_on,
    row_number() over (partition by b.id order by d.started_on,coalesce(d.completed_on,d.due_date),d.log_date,d.id)::integer sequence_position
  from group_products gp
  join public.bmr_details b on b.product_id=gp.product_id
  join public.daily_work_log d on d.item=b.item and d.batch_number=b.bn
  join public.activities a on a.activity_name=d.activity and a.section_id=d.section_id and a.sub_section_id=d.subsection_id and a.area_id=d.area_id
  join public.activity_kinds ak on ak.id=a.kind_id
  cross join policy p
  where d.log_date >= (date_trunc('month',p_as_of_date::timestamp)::date - make_interval(months=>p.lookback_months))
    and d.log_date < p_as_of_date + 1
), group_batch_quality as (
  select product_id,bmr_id,
    case
      when count(*) filter (where activity_short_code='RMDI')=0 then false
      when count(*) filter (where activity_short_code='TRATO')=0 then false
      when count(*) filter (where section_id in (3,4,6) and activity_short_code not in ('RMDI','TRATO','FINGO','INTST','FGBU'))=0 then false
      when count(*) filter (where status<>'Done' or completed_on is null)>0 then false
      else true
    end eligible
  from group_raw group by product_id,bmr_id
), group_product_batch_counts as (
  select product_id,count(*)::integer eligible_batches
  from group_batch_quality where eligible group by product_id
), group_step_product_coverage as (
  select
    r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.section_id,r.subsection_id,r.area_id,r.plant_id,
    count(distinct r.bmr_id)::numeric/gc.eligible_batches as product_batch_coverage
  from group_raw r
  join group_batch_quality q on q.bmr_id=r.bmr_id and q.product_id=r.product_id and q.eligible
  join group_product_batch_counts gc on gc.product_id=r.product_id
  group by r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,r.section_id,r.subsection_id,r.area_id,r.plant_id,gc.eligible_batches
), group_step as (
  select
    g.activity_kind_id,g.activity_short_code,g.activity_kind_name,g.section_id,g.subsection_id,g.area_id,g.plant_id,
    count(*)::integer products_with_evidence,
    count(*) filter (where g.product_batch_coverage >= p.common_threshold)::integer products_supporting_step,
    (count(*) filter (where g.product_batch_coverage >= p.common_threshold))::numeric/nullif((select count(*) from group_product_batch_counts),0) as product_support_ratio,
    avg(g.product_batch_coverage)::numeric average_product_batch_coverage
  from group_step_product_coverage g cross join policy p
  group by g.activity_kind_id,g.activity_short_code,g.activity_kind_name,g.section_id,g.subsection_id,g.area_id,g.plant_id
), comparison as (
  select
    coalesce(ps.activity_kind_id,gs.activity_kind_id) activity_kind_id,
    coalesce(ps.activity_short_code,gs.activity_short_code) activity_short_code,
    coalesce(ps.activity_kind_name,gs.activity_kind_name) activity_kind_name,
    coalesce(ps.section_id,gs.section_id) section_id,
    coalesce(ps.subsection_id,gs.subsection_id) subsection_id,
    coalesce(ps.area_id,gs.area_id) area_id,
    coalesce(ps.plant_id,gs.plant_id) plant_id,
    ps.batch_coverage product_batch_coverage,
    ps.evidence_class product_evidence_class,
    gs.product_support_ratio group_product_support_ratio,
    gs.average_product_batch_coverage group_average_batch_coverage,
    case
      when ps.evidence_class in ('CORE_EVIDENCE','COMMON_EVIDENCE') and coalesce(gs.product_support_ratio,0) < p.common_threshold then 'ADD_STEP_CANDIDATE'
      when ps.activity_kind_id is null and coalesce(gs.product_support_ratio,0) >= p.core_threshold then 'BYPASS_STEP_CANDIDATE'
      when ps.activity_kind_id is null and coalesce(gs.product_support_ratio,0) >= p.common_threshold then 'REVIEW_FAMILY_STEP_ABSENCE'
      when ps.evidence_class='EXCEPTION_EVIDENCE' then 'REVIEW_EXCEPTION_STEP'
      else 'ALIGNED_OR_NO_DELTA'
    end delta_suggestion
  from product_step_classified ps
  full join group_step gs
    on gs.activity_kind_id=ps.activity_kind_id
   and gs.section_id=ps.section_id
   and gs.subsection_id=ps.subsection_id
   and gs.area_id=ps.area_id
   and gs.plant_id is not distinct from ps.plant_id
  cross join policy p
), readiness as (
  select
    ec.eligible_batches,
    p.min_eligible_batches,
    case
      when ec.eligible_batches=0 then 'NO_ELIGIBLE_HISTORY'
      when ec.eligible_batches < p.min_eligible_batches then 'PARTIAL_EVIDENCE'
      when not exists (select 1 from product_step_classified where activity_short_code='RMDI' and evidence_class in ('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
      when not exists (select 1 from product_step_classified where activity_short_code='TRATO' and evidence_class in ('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
      when not exists (select 1 from product_step_classified where section_id in (3,4,6) and activity_short_code not in ('RMDI','TRATO','FINGO','INTST','FGBU') and evidence_class in ('CORE_EVIDENCE','COMMON_EVIDENCE')) then 'PARTIAL_EVIDENCE'
      else 'REVIEWABLE_CANDIDATE'
    end candidate_status
  from eligible_count ec cross join policy p
)
select jsonb_build_object(
  'product', (select to_jsonb(pc) from product_ctx pc),
  'policy', (select jsonb_build_object(
      'policy_code',policy_code,'version_no',version_no,'lookback_months',lookback_months,
      'min_eligible_batches',min_eligible_batches,'core_threshold',core_threshold,
      'common_threshold',common_threshold,'occasional_threshold',occasional_threshold
    ) from policy),
  'summary', (select jsonb_build_object(
      'candidate_status',candidate_status,
      'eligible_batches',eligible_batches,
      'minimum_required_batches',min_eligible_batches,
      'approvable',false,
      'approval_note','Historical evidence is preview-only. A governed Product route must still be explicitly created, validated and approved.'
    ) from readiness),
  'batch_quality', coalesce((select jsonb_agg(jsonb_build_object(
      'bmr_id',bmr_id,'batch_number',batch_number,'batch_size',batch_size,'batch_uom',batch_uom,
      'log_count',log_count,'rm_boundary_count',rm_boundary_count,'fg_boundary_count',fg_boundary_count,
      'production_step_count',production_step_count,'incomplete_log_count',incomplete_log_count,
      'first_started_on',first_started_on,'last_completed_on',last_completed_on,'eligibility_status',eligibility_status
    ) order by first_started_on desc,bmr_id desc) from batch_quality),'[]'::jsonb),
  'candidate_steps', coalesce((select jsonb_agg(jsonb_build_object(
      'activity_kind_id',activity_kind_id,'activity_short_code',activity_short_code,'activity_kind_name',activity_kind_name,
      'activity_id',activity_id,'section_id',section_id,'subsection_id',subsection_id,'area_id',area_id,'plant_id',plant_id,
      'batches_present',batches_present,'eligible_batches',eligible_batches,'batch_coverage',batch_coverage,
      'logged_occurrences',logged_occurrences,'median_sequence_position',median_sequence_position,
      'median_occurrences_per_batch',median_occurrences_per_batch,'evidence_class',evidence_class
    ) order by median_sequence_position,activity_kind_name,area_id) from product_step_classified),'[]'::jsonb),
  'family_comparison', coalesce((select jsonb_agg(jsonb_build_object(
      'activity_kind_id',activity_kind_id,'activity_short_code',activity_short_code,'activity_kind_name',activity_kind_name,
      'section_id',section_id,'subsection_id',subsection_id,'area_id',area_id,'plant_id',plant_id,
      'product_batch_coverage',product_batch_coverage,'product_evidence_class',product_evidence_class,
      'group_product_support_ratio',group_product_support_ratio,'group_average_batch_coverage',group_average_batch_coverage,
      'delta_suggestion',delta_suggestion
    ) order by activity_kind_name,area_id) from comparison),'[]'::jsonb)
)
$$;

create or replace function public.rpc_preview_product_process_route_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, costing
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_preview_product_process_route_candidate(p_product_id,p_as_of_date,p_lookback_months);
end
$$;

revoke all on costing.production_route_candidate_policy from public, anon, authenticated;
revoke all on function costing.fn_resolve_production_route_candidate_policy(date) from public, anon, authenticated;
revoke all on function costing.fn_preview_product_process_route_candidate(bigint,date,integer) from public, anon, authenticated;
grant execute on function costing.fn_resolve_production_route_candidate_policy(date) to service_role, postgres;
grant execute on function costing.fn_preview_product_process_route_candidate(bigint,date,integer) to service_role, postgres;

revoke all on function public.rpc_preview_product_process_route_candidate(bigint,date,integer) from public, anon;
grant execute on function public.rpc_preview_product_process_route_candidate(bigint,date,integer) to authenticated, service_role, postgres;
