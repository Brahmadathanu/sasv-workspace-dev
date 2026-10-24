-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_family_id bigint;
  v_v1_id bigint;
  v_v2_id bigint;
  v_validation jsonb;
  v_rm_activity integer;
  v_pulv_activity integer;
  v_sieve_activity integer;
  v_qc_activity integer;
  v_fg_activity integer;
  v_cc_rm bigint;
  v_cc_size bigint;
  v_cc_qc bigint;
  v_cc_fg bigint;
begin
  select id into v_family_id
  from costing.production_route_family
  where family_code='DRY_POWDER_CHOORNAM';
  if v_family_id is null then
    raise exception 'DRY_POWDER_CHOORNAM route family not found';
  end if;

  select id into v_v1_id
  from costing.production_route_family_route
  where route_family_id=v_family_id and route_version=1;
  if v_v1_id is null then
    raise exception 'Dry Powder route v1 not found';
  end if;

  if exists (
    select 1 from costing.production_route_family_route
    where route_family_id=v_family_id and route_version=2
  ) then
    raise exception 'Dry Powder route v2 already exists';
  end if;

  select a.id into v_rm_activity
  from public.activities a
  where a.activity_name='RM dispensation'
    and a.section_id=2 and a.sub_section_id=1 and a.area_id=72;

  select a.id into v_pulv_activity
  from public.activities a
  where a.activity_name='Pulverization'
    and a.section_id=3 and a.sub_section_id=19 and a.area_id=15;

  select a.id into v_sieve_activity
  from public.activities a
  where a.activity_name='Sieving'
    and a.section_id=3 and a.sub_section_id=19 and a.area_id=15;

  select a.id into v_qc_activity
  from public.activities a
  where a.activity_name='Finished Goods Quality Assessment'
    and a.section_id=5 and a.sub_section_id=10 and a.area_id=48;

  select a.id into v_fg_activity
  from public.activities a
  where a.activity_name='Transfer to FG store'
    and a.section_id=6 and a.sub_section_id=21 and a.area_id=56;

  if v_rm_activity is null or v_pulv_activity is null or v_sieve_activity is null
     or v_qc_activity is null or v_fg_activity is null then
    raise exception 'One or more canonical Dry Powder activities are missing';
  end if;

  select id into v_cc_rm from costing.production_cost_centre where cost_centre_code='STORES_RM_ISSUE_BOUNDARY' and status='APPROVED';
  select id into v_cc_size from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_SIZE_REDUCTION' and status='APPROVED';
  select id into v_cc_qc from costing.production_cost_centre where cost_centre_code='QC_ASSESSMENT_BOUNDARY' and status='APPROVED';
  select id into v_cc_fg from costing.production_cost_centre where cost_centre_code='FG_TRANSFER_BOUNDARY' and status='APPROVED';

  if v_cc_rm is null or v_cc_size is null or v_cc_qc is null or v_cc_fg is null then
    raise exception 'One or more required approved cost centres are missing';
  end if;

  insert into costing.production_route_family_route(
    route_family_id,route_code,route_version,route_name,status,effective_from,
    source_type,evidence_status,supersedes_route_id,route_note
  ) values (
    v_family_id,'DRY_POWDER_CHOORNAM_ROUTE',2,
    'Dry Powder and Choornam Shared Manufacturing Route v2',
    'DRAFT',date '2026-08-11','MANUAL','MANUAL_COMPLETE',v_v1_id,
    'Cost-sheet integrity revision. Shared route is intentionally limited to common bulk-manufacturing truth: RM issue boundary, pulverization, sieving, QC boundary and FG transfer boundary. Disintegration, blending, washing/drying, fortification/bhavana and other stable Product-specific operations require governed Product Route differences. Packaging operations are excluded from the manufacturing route because Packing Labour is prospectively allocated through the approved Direct Labour component model; operational packaging/BMR/DWL execution remains parked until Cost Sheet closure.'
  ) returning id into v_v2_id;

  insert into costing.production_route_family_route_step(
    family_route_id,step_key,sequence_no,activity_id,cost_centre_id,
    section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,
    route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,
    allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note
  ) values
  (v_v2_id,'RM_ISSUE',10,v_rm_activity,v_cc_rm,2,1,72,null,'SUPERVISION_ONLY','GENERAL_AREA',
   'BOUNDARY_RM_ISSUE',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL',
   'Raw Material Stores to Production boundary; excluded from Manufacturing Labour and Production Overhead.'),
  (v_v2_id,'PULVERIZATION',20,v_pulv_activity,v_cc_size,3,19,15,null,'FULLY_ATTENDED','GRINDER',
   'PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE',
   'Common Dry Powder/Choornam pulverization step. Stable Product-specific cycle or route differences remain governed.'),
  (v_v2_id,'SIEVING',30,v_sieve_activity,v_cc_size,3,19,15,null,'FULLY_ATTENDED','GRINDER',
   'PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE',
   'Common Dry Powder/Choornam sieving step. Stable Product-specific cycle or route differences remain governed.'),
  (v_v2_id,'QC_ASSESSMENT',40,v_qc_activity,v_cc_qc,5,10,48,null,'SUPERVISION_ONLY','GENERAL_AREA',
   'QC_OTHER_POOL',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL',
   'Finished Goods Quality Assessment boundary after bulk processing; QC cost remains in the separate QC pool.'),
  (v_v2_id,'FG_TRANSFER',50,v_fg_activity,v_cc_fg,6,21,56,null,'SUPERVISION_ONLY','GENERAL_AREA',
   'BOUNDARY_FG_TRANSFER',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL',
   'Finished Goods transfer boundary retained as the governed terminal route boundary; excluded from Manufacturing Labour and Production Overhead.');

  v_validation := costing.fn_validate_route_family_route(v_v2_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Dry Powder route v2 draft failed validation: %',v_validation;
  end if;
end
$$;