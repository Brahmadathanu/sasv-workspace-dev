-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_preview_product_group_route_candidate(
  p_product_group_id integer,
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
         least(coalesce(p_lookback_months,p.default_lookback_months),p.maximum_lookback_months) lookback_months
  from costing.fn_resolve_production_route_candidate_policy(p_as_of_date) p
), group_ctx as (
  select pg.id product_group_id,pg.group_name
  from public.product_groups pg where pg.id=p_product_group_id
), group_products as (
  select pr.id::bigint product_id,pr.item product_name
  from public.products pr
  join public.sub_groups sg on sg.id=pr.sub_group_id
  where sg.product_group_id=p_product_group_id
), raw as (
  select b.product_id::bigint,b.id::bigint bmr_id,a.kind_id activity_kind_id,
         ak.short_code activity_short_code,ak.name activity_kind_name,
         d.section_id,d.subsection_id,d.area_id,d.plant_id,d.status,d.completed_on
  from group_products gp
  join public.bmr_details b on b.product_id=gp.product_id
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
      else true
    end eligible
  from raw group by product_id,bmr_id
), eligible_product_counts as (
  select product_id,count(*)::integer eligible_batches
  from batch_quality where eligible group by product_id
), product_kind as (
  select r.product_id,r.activity_kind_id,r.activity_short_code,r.activity_kind_name,
         count(distinct r.bmr_id)::integer batches_present,
         ep.eligible_batches,
         count(distinct r.bmr_id)::numeric/ep.eligible_batches batch_coverage
  from raw r
  join batch_quality bq on bq.product_id=r.product_id and bq.bmr_id=r.bmr_id and bq.eligible
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
         count(distinct r.product_id)::integer products_present,
         count(distinct r.bmr_id)::integer batches_present,
         row_number() over(partition by r.activity_kind_id order by count(distinct r.product_id) desc,count(distinct r.bmr_id) desc,r.area_id,r.plant_id nulls last) rn
  from raw r join batch_quality q on q.product_id=r.product_id and q.bmr_id=r.bmr_id and q.eligible
  group by r.activity_kind_id,r.section_id,r.subsection_id,r.area_id,r.plant_id
), family_steps as (
  select k.*,
         l.section_id modal_section_id,l.subsection_id modal_subsection_id,l.area_id modal_area_id,l.plant_id modal_plant_id,
         case
           when k.product_support_ratio>=p.core_threshold then 'FAMILY_CORE_STEP'
           when k.product_support_ratio>=p.common_threshold then 'FAMILY_COMMON_STEP'
           when k.product_support_ratio>=p.occasional_threshold then 'FAMILY_OCCASIONAL_STEP'
           else 'FAMILY_EXCEPTION_STEP'
         end family_evidence_class
  from kind_support k
  left join location_support l on l.activity_kind_id=k.activity_kind_id and l.rn=1
  cross join policy p
), summary as (
  select count(*)::integer products_in_group,
         (select count(*) from eligible_product_counts)::integer products_with_eligible_history,
         coalesce(sum(eligible_batches),0)::integer eligible_batches
  from group_products gp left join eligible_product_counts ep on ep.product_id=gp.product_id
)
select jsonb_build_object(
  'product_group',(select to_jsonb(g) from group_ctx g),
  'policy',(select jsonb_build_object('policy_code',policy_code,'version_no',version_no,'lookback_months',lookback_months,'core_threshold',core_threshold,'common_threshold',common_threshold,'occasional_threshold',occasional_threshold) from policy),
  'summary',(select to_jsonb(s) from summary s),
  'family_steps',coalesce((select jsonb_agg(jsonb_build_object(
     'activity_kind_id',activity_kind_id,'activity_short_code',activity_short_code,'activity_kind_name',activity_kind_name,
     'products_with_any_evidence',products_with_any_evidence,'products_supporting_step',products_supporting_step,
     'product_support_ratio',product_support_ratio,'average_product_batch_coverage',average_product_batch_coverage,
     'family_evidence_class',family_evidence_class,
     'modal_section_id',modal_section_id,'modal_subsection_id',modal_subsection_id,'modal_area_id',modal_area_id,'modal_plant_id',modal_plant_id
   ) order by family_evidence_class,activity_kind_name) from family_steps),'[]'::jsonb)
)
$$;

create or replace function costing.fn_preview_product_route_delta_candidate(
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
with pc as (
  select pr.id::bigint product_id,pr.item product_name,sg.product_group_id
  from public.products pr join public.sub_groups sg on sg.id=pr.sub_group_id
  where pr.id=p_product_id
), pp as (
  select costing.fn_preview_product_process_route_candidate(p_product_id,p_as_of_date,p_lookback_months) j
), gp as (
  select costing.fn_preview_product_group_route_candidate(pc.product_group_id,p_as_of_date,p_lookback_months) j from pc
), product_kind as (
  select x->>'activity_kind_id' activity_kind_id,
         max(x->>'activity_short_code') activity_short_code,
         max(x->>'activity_kind_name') activity_kind_name,
         max((x->>'batch_coverage')::numeric) product_batch_coverage,
         max(case x->>'evidence_class' when 'CORE_EVIDENCE' then 4 when 'COMMON_EVIDENCE' then 3 when 'OCCASIONAL_EVIDENCE' then 2 when 'EXCEPTION_EVIDENCE' then 1 else 0 end) evidence_rank,
         (array_agg((x->>'area_id')::integer order by (x->>'batch_coverage')::numeric desc,(x->>'area_id')::integer))[1] modal_area_id,
         (array_agg(nullif(x->>'plant_id','')::integer order by (x->>'batch_coverage')::numeric desc,(x->>'area_id')::integer))[1] modal_plant_id
  from pp,jsonb_array_elements(pp.j->'candidate_steps') x
  group by x->>'activity_kind_id'
), family_kind as (
  select x->>'activity_kind_id' activity_kind_id,
         x->>'activity_short_code' activity_short_code,
         x->>'activity_kind_name' activity_kind_name,
         (x->>'product_support_ratio')::numeric product_support_ratio,
         x->>'family_evidence_class' family_evidence_class,
         (x->>'modal_area_id')::integer modal_area_id,
         nullif(x->>'modal_plant_id','')::integer modal_plant_id
  from gp,jsonb_array_elements(gp.j->'family_steps') x
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
           else 'ALIGNED_OR_NO_DELTA'
         end delta_suggestion
  from product_kind pk full join family_kind fk on fk.activity_kind_id=pk.activity_kind_id
)
select jsonb_build_object(
  'product',(select jsonb_build_object('product_id',product_id,'product_name',product_name,'product_group_id',product_group_id) from pc),
  'product_candidate_summary',(select j->'summary' from pp),
  'family_candidate_summary',(select j->'summary' from gp),
  'delta_candidates',coalesce((select jsonb_agg(to_jsonb(c) order by c.activity_kind_name) from cmp c),'[]'::jsonb),
  'approval_note','Delta proposals are review aids only and cannot create or approve Product route overrides.'
)
$$;

create or replace function public.rpc_preview_product_group_route_candidate(
  p_product_group_id integer,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_preview_product_group_route_candidate(p_product_group_id,p_as_of_date,p_lookback_months);
end
$$;

create or replace function public.rpc_preview_product_route_delta_candidate(
  p_product_id bigint,
  p_as_of_date date default current_date,
  p_lookback_months integer default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,costing
as $$
begin
  perform public.require_permission('module:production-route-manager',false);
  return costing.fn_preview_product_route_delta_candidate(p_product_id,p_as_of_date,p_lookback_months);
end
$$;

revoke all on function costing.fn_preview_product_group_route_candidate(integer,date,integer) from public,anon,authenticated;
revoke all on function costing.fn_preview_product_route_delta_candidate(bigint,date,integer) from public,anon,authenticated;
grant execute on function costing.fn_preview_product_group_route_candidate(integer,date,integer) to service_role,postgres;
grant execute on function costing.fn_preview_product_route_delta_candidate(bigint,date,integer) to service_role,postgres;
revoke all on function public.rpc_preview_product_group_route_candidate(integer,date,integer) from public,anon;
revoke all on function public.rpc_preview_product_route_delta_candidate(bigint,date,integer) from public,anon;
grant execute on function public.rpc_preview_product_group_route_candidate(integer,date,integer) to authenticated,service_role,postgres;
grant execute on function public.rpc_preview_product_route_delta_candidate(bigint,date,integer) to authenticated,service_role,postgres;
