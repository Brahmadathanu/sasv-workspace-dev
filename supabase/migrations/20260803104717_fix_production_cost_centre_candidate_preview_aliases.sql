-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_preview_production_cost_centre_candidates(
  p_product_group_id integer,
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = costing, public
as $function$
declare
  v_from date := coalesce(p_date_from, current_date - interval '365 days');
  v_to date := coalesce(p_date_to, current_date);
  v_product_count integer;
  v_products_with_evidence integer;
  v_total_rows integer;
  v_result jsonb;
begin
  if p_product_group_id is null or p_product_group_id <= 0 then
    raise exception 'A valid Product Group ID is required';
  end if;
  if v_to < v_from then raise exception 'Date-to must be on or after date-from'; end if;
  if not exists (select 1 from public.product_groups where id=p_product_group_id) then
    raise exception 'Product Group % not found',p_product_group_id;
  end if;

  with group_products as (
    select p.id product_id,p.item product_name
    from public.products p
    join public.sub_groups sg on sg.id=p.sub_group_id
    where sg.product_group_id=p_product_group_id
      and upper(coalesce(p.status,''))='ACTIVE'
  ), evidence as (
    select gp.product_id,gp.product_name,d.id dwl_id,d.log_date,d.batch_number,d.activity,
           d.section_id,d.subsection_id,d.area_id,d.plant_id,
           case
             when lower(btrim(coalesce(d.activity,'')))='rm dispensation' then 'RM_ISSUE_BOUNDARY'
             when lower(btrim(coalesce(d.activity,''))) in ('disintegration','pulverization') then 'RM_DISINTEGRATION'
             when lower(btrim(coalesce(d.activity,''))) in ('pressurized extraction','open vessel boiling') then 'EXTRACTION_VESSELS'
             when lower(btrim(coalesce(d.activity,'')))='intermediate storage' then 'WIP_STORAGE'
             when lower(btrim(coalesce(d.activity,'')))='finished goods quality assessment' then 'QC_ASSESSMENT_BOUNDARY'
             when lower(btrim(coalesce(d.activity,''))) in ('bottling, labelling and cartoning','bottling and labelling','bottling','labelling and cartoning') then 'LIQUID_FILL_PACK'
             when lower(btrim(coalesce(d.activity,'')))='transfer to fg store' then 'FG_TRANSFER_BOUNDARY'
             else null
           end candidate_key
    from group_products gp
    join public.daily_work_log d
      on lower(btrim(d.item))=lower(btrim(gp.product_name))
     and d.log_date between v_from and v_to
  )
  select (select count(*) from group_products),
         (select count(distinct product_id) from evidence),
         (select count(*) from evidence)
  into v_product_count,v_products_with_evidence,v_total_rows;

  with group_products as (
    select p.id product_id,p.item product_name
    from public.products p
    join public.sub_groups sg on sg.id=p.sub_group_id
    where sg.product_group_id=p_product_group_id
      and upper(coalesce(p.status,''))='ACTIVE'
  ), evidence as (
    select gp.product_id,gp.product_name,d.id dwl_id,d.log_date,d.batch_number,d.activity,
           d.section_id,d.subsection_id,d.area_id,d.plant_id,
           case
             when lower(btrim(coalesce(d.activity,'')))='rm dispensation' then 'RM_ISSUE_BOUNDARY'
             when lower(btrim(coalesce(d.activity,''))) in ('disintegration','pulverization') then 'RM_DISINTEGRATION'
             when lower(btrim(coalesce(d.activity,''))) in ('pressurized extraction','open vessel boiling') then 'EXTRACTION_VESSELS'
             when lower(btrim(coalesce(d.activity,'')))='intermediate storage' then 'WIP_STORAGE'
             when lower(btrim(coalesce(d.activity,'')))='finished goods quality assessment' then 'QC_ASSESSMENT_BOUNDARY'
             when lower(btrim(coalesce(d.activity,''))) in ('bottling, labelling and cartoning','bottling and labelling','bottling','labelling and cartoning') then 'LIQUID_FILL_PACK'
             when lower(btrim(coalesce(d.activity,'')))='transfer to fg store' then 'FG_TRANSFER_BOUNDARY'
             else null
           end candidate_key
    from group_products gp
    join public.daily_work_log d
      on lower(btrim(d.item))=lower(btrim(gp.product_name))
     and d.log_date between v_from and v_to
  ), bucketed as (
    select * from evidence where candidate_key is not null
  ), candidate_counts as (
    select candidate_key,count(*) evidence_rows,count(distinct product_id) product_count,
           count(distinct nullif(batch_number,'')) batch_count,
           count(*) filter(where plant_id is not null) rows_with_plant,
           count(distinct plant_id) filter(where plant_id is not null) distinct_plant_count,
           min(log_date) first_log_date,max(log_date) last_log_date
    from bucketed group by candidate_key
  ), dominant_location as (
    select distinct on (candidate_key) candidate_key,section_id,subsection_id,area_id,count(*) location_rows
    from bucketed
    group by candidate_key,section_id,subsection_id,area_id
    order by candidate_key,count(*) desc,section_id nulls last,subsection_id nulls last,area_id nulls last
  ), candidate_json as (
    select jsonb_agg(jsonb_build_object(
      'candidate_key',c.candidate_key,
      'suggested_code',case c.candidate_key
        when 'RM_ISSUE_BOUNDARY' then 'STORES_RM_ISSUE_BOUNDARY'
        when 'RM_DISINTEGRATION' then 'PROD_RM_DISINTEGRATION'
        when 'EXTRACTION_VESSELS' then 'PROD_EXTRACTION_VESSELS'
        when 'WIP_STORAGE' then 'PROD_WIP_STORAGE'
        when 'QC_ASSESSMENT_BOUNDARY' then 'QC_ASSESSMENT_BOUNDARY'
        when 'LIQUID_FILL_PACK' then 'PROD_LIQUID_FILL_PACK'
        when 'FG_TRANSFER_BOUNDARY' then 'FG_TRANSFER_BOUNDARY' end,
      'suggested_name',case c.candidate_key
        when 'RM_ISSUE_BOUNDARY' then 'Raw Material Issue Boundary'
        when 'RM_DISINTEGRATION' then 'Raw Material Disintegration'
        when 'EXTRACTION_VESSELS' then 'Extraction and Processing Vessels'
        when 'WIP_STORAGE' then 'Production Work-in-Process Holding'
        when 'QC_ASSESSMENT_BOUNDARY' then 'Quality Assessment Boundary'
        when 'LIQUID_FILL_PACK' then 'Liquid Filling and Packing'
        when 'FG_TRANSFER_BOUNDARY' then 'Finished Goods Transfer Boundary' end,
      'suggested_cost_centre_type',case when c.candidate_key in ('RM_ISSUE_BOUNDARY','QC_ASSESSMENT_BOUNDARY','FG_TRANSFER_BOUNDARY','WIP_STORAGE') then 'SERVICE_CENTRED' else 'PROCESS_AREA_CENTRED' end,
      'suggested_pool_scope',case when c.candidate_key in ('RM_ISSUE_BOUNDARY','QC_ASSESSMENT_BOUNDARY','FG_TRANSFER_BOUNDARY') then 'EXCLUDED_OTHER_POOL' else 'SHARED_ROUTE' end,
      'suggested_resource_class_code',case c.candidate_key
        when 'RM_ISSUE_BOUNDARY' then 'GENERAL_AREA'
        when 'RM_DISINTEGRATION' then 'GRINDER'
        when 'EXTRACTION_VESSELS' then 'EXTRACTION_SYSTEM'
        when 'WIP_STORAGE' then 'STORAGE_OCCUPANCY'
        when 'QC_ASSESSMENT_BOUNDARY' then 'GENERAL_AREA'
        when 'LIQUID_FILL_PACK' then 'PACKING_MACHINE'
        when 'FG_TRANSFER_BOUNDARY' then 'GENERAL_AREA' end,
      'suggested_section_id',l.section_id,'suggested_subsection_id',l.subsection_id,'suggested_area_id',l.area_id,
      'section_name',s.section_name,'subsection_name',ss.subsection_name,'area_name',a.area_name,
      'evidence_rows',c.evidence_rows,'product_count',c.product_count,'batch_count',c.batch_count,
      'rows_with_plant',c.rows_with_plant,'distinct_plant_count',c.distinct_plant_count,
      'first_log_date',c.first_log_date,'last_log_date',c.last_log_date,
      'evidence_share',case when v_total_rows>0 then round(c.evidence_rows::numeric/v_total_rows,6) else 0 end,
      'review_required',true,'approvable',false,'preview_only',true
    ) order by case c.candidate_key
      when 'RM_ISSUE_BOUNDARY' then 10 when 'RM_DISINTEGRATION' then 20 when 'WIP_STORAGE' then 30
      when 'EXTRACTION_VESSELS' then 40 when 'QC_ASSESSMENT_BOUNDARY' then 50
      when 'LIQUID_FILL_PACK' then 60 when 'FG_TRANSFER_BOUNDARY' then 70 else 999 end) data
    from candidate_counts c
    join dominant_location l using(candidate_key)
    left join public.sections s on s.id=l.section_id
    left join public.subsections ss on ss.id=l.subsection_id
    left join public.areas a on a.id=l.area_id
  ), unmatched_agg as (
    select e.activity,e.section_id,e.subsection_id,e.area_id,count(*) evidence_rows,
           count(distinct e.product_id) product_count,count(distinct nullif(e.batch_number,'')) batch_count
    from evidence e
    where e.candidate_key is null
    group by e.activity,e.section_id,e.subsection_id,e.area_id
    order by count(*) desc
    limit 50
  ), unmatched_json as (
    select jsonb_agg(jsonb_build_object(
      'activity',u.activity,'section_id',u.section_id,'subsection_id',u.subsection_id,'area_id',u.area_id,
      'section_name',s.section_name,'subsection_name',ss.subsection_name,'area_name',a.area_name,
      'evidence_rows',u.evidence_rows,'product_count',u.product_count,'batch_count',u.batch_count,
      'review_required',true
    ) order by u.evidence_rows desc,u.activity) data
    from unmatched_agg u
    left join public.sections s on s.id=u.section_id
    left join public.subsections ss on ss.id=u.subsection_id
    left join public.areas a on a.id=u.area_id
  )
  select jsonb_build_object(
    'product_group_id',p_product_group_id,'product_group_name',pg.group_name,
    'date_from',v_from,'date_to',v_to,
    'active_product_count',v_product_count,'products_with_evidence',v_products_with_evidence,
    'total_evidence_rows',v_total_rows,
    'candidate_count',coalesce(jsonb_array_length(cj.data),0),
    'candidates',coalesce(cj.data,'[]'::jsonb),
    'unmatched_evidence',coalesce(uj.data,'[]'::jsonb),
    'preview_only',true,'records_created',0,'approvable',false,'requires_manual_review',true
  ) into v_result
  from public.product_groups pg
  left join candidate_json cj on true
  left join unmatched_json uj on true
  where pg.id=p_product_group_id;

  return v_result;
end
$function$;