-- backfilled from live schema_migrations on 2026-10-24, CI-016
create or replace function costing.fn_preview_route_family_route_steps(
  p_family_route_id bigint,
  p_date_from date default '2025-07-01'::date,
  p_date_to date default '2026-08-01'::date
) returns jsonb
language plpgsql
stable security definer
set search_path to 'costing','public','pg_temp'
as $function$
declare
  v_route costing.production_route_family_route%rowtype;
  v_group_id integer;
  v_steps jsonb;
  v_evidence jsonb;
  v_gap jsonb;
begin
  select r.* into v_route
  from costing.production_route_family_route r
  join costing.production_route_family f on f.id=r.route_family_id and f.archived_at is null
  where r.id=p_family_route_id and r.archived_at is null;

  if not found then
    return jsonb_build_object(
      'preview_only',true,'approvable',false,'valid',false,
      'errors',jsonb_build_array('ACTIVE_ROUTE_FAMILY_ROUTE_NOT_FOUND'),'records_created',0
    );
  end if;

  select min(m.product_group_id) into v_group_id
  from costing.production_route_family_product_group_map m
  where m.route_family_id=v_route.route_family_id
    and m.archived_at is null
    and m.status='APPROVED'
    and m.effective_from<=coalesce(p_date_to,current_date)
    and (m.effective_to is null or m.effective_to>=coalesce(p_date_from,date '1900-01-01'));

  if v_group_id is null then
    return jsonb_build_object(
      'preview_only',true,'approvable',false,'valid',false,
      'errors',jsonb_build_array('NO_APPROVED_PRODUCT_GROUP_MAPPING'),
      'family_route_id',p_family_route_id,'records_created',0
    );
  end if;

  with pg_products as (
    select p.id product_id,p.item product_name
    from public.products p
    join public.sub_groups sg on sg.id=p.sub_group_id
    where sg.product_group_id=v_group_id and upper(coalesce(p.status,''))='ACTIVE'
  ), dwl as (
    select d.*
    from public.daily_work_log d
    join pg_products pp on lower(btrim(pp.product_name))=lower(btrim(d.item))
    where d.log_date between coalesce(p_date_from,date '2025-07-01') and coalesce(p_date_to,current_date)
  ), batch_flags as (
    select d.item,d.batch_number,
      bool_or(lower(d.activity)=lower('Pressurized extraction')) has_pressurized,
      bool_or(lower(d.activity)=lower('Open vessel boiling')) has_open_vessel,
      bool_or(lower(d.activity)=lower('Intermediate storage') and d.area_id=14) has_pre_wip,
      bool_or(lower(d.activity)=lower('Intermediate storage') and d.area_id in (43,44,90)) has_post_wip,
      bool_or(lower(d.activity)=lower('Finished Goods Quality Assessment')) has_qc,
      bool_or(lower(d.activity) in (lower('Bottling, labelling and cartoning'),lower('Bottling'),lower('Labelling and cartoning'),lower('Bottling and labelling'))) has_pack,
      bool_or(lower(d.activity)=lower('Transfer to FG store')) has_fg
    from dwl d
    where nullif(btrim(d.batch_number),'') is not null
    group by d.item,d.batch_number
  )
  select jsonb_build_object(
    'total_batches',count(*),
    'both_pressurized_and_open',count(*) filter(where has_pressurized and has_open_vessel),
    'pressurized_only',count(*) filter(where has_pressurized and not has_open_vessel),
    'open_only',count(*) filter(where has_open_vessel and not has_pressurized),
    'with_pre_extraction_wip',count(*) filter(where has_pre_wip),
    'with_post_extraction_wip',count(*) filter(where has_post_wip),
    'with_qc',count(*) filter(where has_qc),
    'with_pack',count(*) filter(where has_pack),
    'with_fg_transfer',count(*) filter(where has_fg)
  ) into v_evidence
  from batch_flags;

  v_steps:=jsonb_build_array(
    jsonb_build_object('step_key','RM_ISSUE_BOUNDARY','sequence_no',10,'activity_id',2,'activity_name','RM dispensation','cost_centre_id',22,'cost_centre_code','STORES_RM_ISSUE_BOUNDARY','section_id',2,'subsection_id',1,'area_id',72,'plant_id',null,'behaviour_code','FULLY_ATTENDED','resource_class_code','GENERAL_AREA','route_step_scope','BOUNDARY_RM_ISSUE','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',false,'allows_skip_with_approval',false,'production_overhead_scope','EXCLUDE_OTHER_POOL','direct_labour_scope','EXCLUDE_OTHER_POOL','step_note','Governed handover from Raw Material Stores to Production.','preview_only',true),
    jsonb_build_object('step_key','RM_DISINTEGRATION','sequence_no',20,'activity_id',161,'activity_name','Disintegration','cost_centre_id',23,'cost_centre_code','PROD_RM_DISINTEGRATION','section_id',3,'subsection_id',19,'area_id',15,'plant_id',null,'behaviour_code','FULLY_ATTENDED','resource_class_code','GRINDER','route_step_scope','PRODUCTION_PROCESS','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',false,'allows_skip_with_approval',true,'production_overhead_scope','INCLUDE','direct_labour_scope','INCLUDE','step_note','Canonical size-reduction step. Historical absence may represent incomplete logging and requires approved bypass.','preview_only',true),
    jsonb_build_object('step_key','PRE_EXTRACTION_WIP','sequence_no',30,'activity_id',173,'activity_name','Intermediate storage','cost_centre_id',24,'cost_centre_code','PROD_WIP_STORAGE','section_id',3,'subsection_id',19,'area_id',14,'plant_id',null,'behaviour_code','WAITING_OR_COOLING','resource_class_code','STORAGE_OCCUPANCY','route_step_scope','INTERMEDIATE_WIP_HOLD','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',false,'allows_repeat',true,'allows_skip_with_approval',true,'production_overhead_scope','PASSIVE','direct_labour_scope','SUPERVISION','step_note','Optional or repeatable pre-extraction WIP holding using the governed semi-processed line-side store.','preview_only',true),
    jsonb_build_object('step_key','PRESSURIZED_EXTRACTION','sequence_no',40,'activity_id',62,'activity_name','Pressurized extraction','cost_centre_id',25,'cost_centre_code','PROD_EXTRACTION_VESSELS','section_id',4,'subsection_id',9,'area_id',77,'plant_id',null,'behaviour_code','INTERMITTENT_ATTENDED','resource_class_code','EXTRACTION_SYSTEM','route_step_scope','PRODUCTION_PROCESS','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',true,'allows_skip_with_approval',true,'production_overhead_scope','INCLUDE','direct_labour_scope','INCLUDE','step_note','Observed in 248 of 254 batches and normally followed by open-vessel boiling.','preview_only',true),
    jsonb_build_object('step_key','OPEN_VESSEL_BOILING','sequence_no',50,'activity_id',63,'activity_name','Open vessel boiling','cost_centre_id',25,'cost_centre_code','PROD_EXTRACTION_VESSELS','section_id',4,'subsection_id',9,'area_id',77,'plant_id',null,'behaviour_code','INTERMITTENT_ATTENDED','resource_class_code','EXTRACTION_SYSTEM','route_step_scope','PRODUCTION_PROCESS','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',true,'allows_skip_with_approval',true,'production_overhead_scope','INCLUDE','direct_labour_scope','INCLUDE','step_note','Observed in 249 of 254 batches and sequentially follows pressurized extraction in 246 batches.','preview_only',true),
    jsonb_build_object('step_key','QC_ASSESSMENT_BOUNDARY','sequence_no',60,'activity_id',159,'activity_name','Finished Goods Quality Assessment','cost_centre_id',26,'cost_centre_code','QC_ASSESSMENT_BOUNDARY','section_id',5,'subsection_id',10,'area_id',48,'plant_id',null,'behaviour_code','FULLY_ATTENDED','resource_class_code','GENERAL_AREA','route_step_scope','QC_OTHER_POOL','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',true,'allows_skip_with_approval',false,'production_overhead_scope','EXCLUDE_OTHER_POOL','direct_labour_scope','EXCLUDE_OTHER_POOL','step_note','Governed QC boundary. Visible in route but allocated through the QC driver.','preview_only',true),
    jsonb_build_object('step_key','LIQUID_FILL_PACK','sequence_no',70,'activity_id',90,'activity_name','Bottling, labelling and cartoning','cost_centre_id',27,'cost_centre_code','PROD_LIQUID_FILL_PACK','section_id',6,'subsection_id',21,'area_id',52,'plant_id',null,'behaviour_code','FULLY_ATTENDED','resource_class_code','PACKING_MACHINE','route_step_scope','PRODUCTION_PROCESS','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',true,'allows_skip_with_approval',true,'production_overhead_scope','INCLUDE','direct_labour_scope','INCLUDE','step_note','Canonical combined liquid filling, labelling and cartoning activity for area 52.','preview_only',true),
    jsonb_build_object('step_key','FG_TRANSFER_BOUNDARY','sequence_no',80,'activity_id',92,'activity_name','Transfer to FG store','cost_centre_id',28,'cost_centre_code','FG_TRANSFER_BOUNDARY','section_id',6,'subsection_id',21,'area_id',52,'plant_id',null,'behaviour_code','FULLY_ATTENDED','resource_class_code','GENERAL_AREA','route_step_scope','BOUNDARY_FG_TRANSFER','expected_occurrence_count',1,'standard_cycle_count',1,'is_mandatory',true,'allows_repeat',false,'allows_skip_with_approval',false,'production_overhead_scope','EXCLUDE_OTHER_POOL','direct_labour_scope','EXCLUDE_OTHER_POOL','step_note','Governed closing handover from Production or Packing to Finished Goods Stores.','preview_only',true)
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'activity',d.activity,'area_id',d.area_id,'section_id',d.section_id,'subsection_id',d.subsection_id,
    'rows',d.rows,'batches',d.batches,'reason','POST_EXTRACTION_STORAGE_NOT_MAPPED_TO_APPROVED_WIP_COST_CENTRE'
  ) order by d.rows desc),'[]'::jsonb)
  into v_gap
  from (
    with pg_products as (
      select p.item product_name
      from public.products p join public.sub_groups sg on sg.id=p.sub_group_id
      where sg.product_group_id=v_group_id and upper(coalesce(p.status,''))='ACTIVE'
    )
    select w.activity,w.area_id,w.section_id,w.subsection_id,count(*) rows,count(distinct nullif(btrim(w.batch_number),'')) batches
    from public.daily_work_log w
    join pg_products pp on lower(btrim(pp.product_name))=lower(btrim(w.item))
    where w.log_date between coalesce(p_date_from,date '2025-07-01') and coalesce(p_date_to,current_date)
      and lower(w.activity)=lower('Intermediate storage') and w.area_id in(43,44,90)
    group by w.activity,w.area_id,w.section_id,w.subsection_id
  ) d;

  return jsonb_build_object(
    'preview_only',true,'approvable',false,'requires_manual_review',true,'records_created',0,
    'family_route_id',v_route.id,'route_family_id',v_route.route_family_id,'product_group_id',v_group_id,
    'date_from',coalesce(p_date_from,date '2025-07-01'),'date_to',coalesce(p_date_to,current_date),
    'candidate_step_count',jsonb_array_length(v_steps),'candidate_steps',v_steps,
    'batch_evidence',v_evidence,'evidence_gaps',v_gap,
    'decision_notes',jsonb_build_array(
      'PRESSURIZED_EXTRACTION_AND_OPEN_VESSEL_BOILING_ARE_SEQUENTIAL_CANONICAL_STEPS',
      'PRE_EXTRACTION_WIP_IS_OPTIONAL_REPEATABLE_AND_PASSIVE',
      'POST_EXTRACTION_STORAGE_REQUIRES_SEPARATE_COST_CENTRE_REVIEW_BEFORE_ROUTE_INSERTION',
      'ALL_ACTIVITY_IDS_ARE_HIERARCHY_SPECIFIC_NOT_NAME_INFERRED'
    )
  );
end
$function$;