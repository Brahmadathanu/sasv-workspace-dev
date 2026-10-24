-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
  v_family_id bigint;
  v_route_id bigint;
  v_safe_count integer;
  v_assignment_count integer;
  v_validation jsonb;
  v_now timestamptz := now();
begin
  select id into v_family_id
  from costing.production_route_family
  where family_code='OIL_FORMULATIONS_REGULAR';

  if v_family_id is null then
    insert into costing.production_route_family(
      family_code,family_name,status,effective_from,description,
      approval_reference,approved_at,created_at,updated_at
    ) values (
      'OIL_FORMULATIONS_REGULAR',
      'Oil Formulations - Regular',
      'APPROVED',
      date '2026-07-01',
      'Governed manufacturing Route Family for medicated oil formulations. The shared backbone covers RM issue, WIP holding, medicated oil processing in SS vessels, hydraulic recovery of oil retained in kalkam or processed solids, QC, FG bulk holding, oil-formulation packing and transfer to FG store. Preparation variants and true Product-specific operations are governed through Product process routes and overrides.',
      'PRM-RF-OIL_FORMULATIONS_REGULAR-APP-20260701',
      v_now,v_now,v_now
    ) returning id into v_family_id;
  elsif not exists(
    select 1 from costing.production_route_family
    where id=v_family_id and status='APPROVED' and effective_from<=date '2026-07-01'
  ) then
    raise exception 'Existing OIL_FORMULATIONS_REGULAR family is not in the expected approved state';
  end if;

  select id into v_route_id
  from costing.production_route_family_route
  where route_family_id=v_family_id and route_version=1;

  if v_route_id is null then
    insert into costing.production_route_family_route(
      route_family_id,route_code,route_version,route_name,status,effective_from,
      source_type,evidence_status,approval_reference,approved_at,route_note,
      created_at,updated_at
    ) values (
      v_family_id,
      'OIL_FORMULATIONS_REGULAR_ROUTE',
      1,
      'Oil Formulations - Regular Manufacturing Route',
      'DRAFT',
      date '2026-07-01',
      'HISTORICAL_CANDIDATE',
      'HISTORICAL_COMPLETE',
      null,null,
      'Version 1 shared Oil route derived from governed historical evidence. Oil processing means medicated oil processing in an SS processing vessel; Oil extraction means subsequent hydraulic recovery of oil retained in kalkam or processed solids. Preparation variants are intentionally excluded from the universal backbone and must be added through governed Product routes.',
      v_now,v_now
    ) returning id into v_route_id;
  elsif exists(
    select 1 from costing.production_route_family_route
    where id=v_route_id and status not in ('DRAFT','REVIEW_REQUIRED','APPROVED')
  ) then
    raise exception 'Existing Oil Route Version 1 is not reusable';
  end if;

  if not exists(select 1 from costing.production_route_family_route_step where family_route_id=v_route_id) then
    insert into costing.production_route_family_route_step(
      family_route_id,step_key,sequence_no,activity_id,cost_centre_id,
      section_id,subsection_id,area_id,plant_id,behaviour_code,resource_class_code,
      route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,
      allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,
      step_note,created_at,updated_at
    ) values
    (v_route_id,'RM_ISSUE_BOUNDARY',10,2,22,2,1,72,null,'FULLY_ATTENDED','GENERAL_AREA','BOUNDARY_RM_ISSUE',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL','Governed handover from Raw Material Stores to Oil Production.',v_now,v_now),
    (v_route_id,'OIL_WIP_HOLD',20,227,24,4,9,90,null,'WAITING_OR_COOLING','STORAGE_OCCUPANCY','INTERMEDIATE_WIP_HOLD',2,1,false,true,true,'PASSIVE','SUPERVISION','Optional and repeatable intermediate holding before, during or after Oil processing, using the shared governed WIP holding pool while retaining the Oil processing location.',v_now,v_now),
    (v_route_id,'MEDICATED_OIL_PROCESSING',30,67,25,4,9,77,null,'INTERMITTENT_ATTENDED','PROCESSING_VESSEL','PRODUCTION_PROCESS',1.5,1,true,true,false,'INCLUDE','INCLUDE','Medicated oil processing in an SS processing vessel. This is the principal Sneha preparation operation and precedes hydraulic Oil extraction.',v_now,v_now),
    (v_route_id,'HYDRAULIC_OIL_RECOVERY',40,169,25,4,9,77,null,'FULLY_ATTENDED','FILTRATION_SYSTEM','PRODUCTION_PROCESS',1,1,true,true,false,'INCLUDE','INCLUDE','Hydraulic extraction or recovery of medicated Oil retained in kalkam or processed solids after completion of Oil processing.',v_now,v_now),
    (v_route_id,'QC_ASSESSMENT_BOUNDARY',50,159,26,5,10,48,null,'FULLY_ATTENDED','GENERAL_AREA','QC_OTHER_POOL',1,1,true,true,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL','Governed Finished Goods Quality Assessment boundary; visible in the route and allocated through the QC pool.',v_now,v_now),
    (v_route_id,'OIL_FG_BULK_HOLD',60,188,29,6,21,85,null,'WAITING_OR_COOLING','STORAGE_OCCUPANCY','INTERMEDIATE_WIP_HOLD',2,1,true,true,false,'PASSIVE','SUPERVISION','Governed line-side holding of finished medicated Oil bulk before or during packing.',v_now,v_now),
    (v_route_id,'OIL_FILL_PACK',70,97,31,6,21,55,null,'FULLY_ATTENDED','PACKING_MACHINE','PRODUCTION_PROCESS',1.5,1,true,true,true,'INCLUDE','INCLUDE','Generalised conversion of Oil FG bulk to saleable packed SKUs. Actual bottling, labelling, monocarton and cartoning combinations remain governed by event_type_lkp.',v_now,v_now),
    (v_route_id,'FG_TRANSFER_BOUNDARY',80,99,28,6,21,55,null,'FULLY_ATTENDED','GENERAL_AREA','BOUNDARY_FG_TRANSFER',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL','Governed closing handover from Oil Filling and Packing to Finished Goods Stores.',v_now,v_now);
  end if;

  v_validation := costing.fn_validate_route_family_route(v_route_id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    raise exception 'Oil Route Family route validation failed: %',v_validation;
  end if;

  update costing.production_route_family_route
  set status='APPROVED',
      approval_reference='PRM-ROUTE-OIL_FORMULATIONS_REGULAR-V1-APP-20260701',
      approved_at=coalesce(approved_at,v_now),
      updated_at=v_now
  where id=v_route_id and status in ('DRAFT','REVIEW_REQUIRED');

  with oil as (
    select p.id product_id,
           costing.fn_preview_product_process_route_evidence(p.id,date '2026-07-22',12) ev
    from public.products p
    join public.sub_groups sg on sg.id=p.sub_group_id
    where sg.product_group_id in (10,11,58)
      and upper(coalesce(p.status,''))='ACTIVE'
  ), reviewable as (
    select product_id,ev,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='OILPR'),false) has_oilpr,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='OILEX'),false) has_oilex,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='FGBU'),false) has_fgbu,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='BOTLA'),false) has_botla,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='RMDI'),false) has_rmdi,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='FINGO'),false) has_fingo,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='TRATO'),false) has_trato,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='INTST'),false) has_intst
    from oil where ev->'summary'->>'candidate_status'='REVIEWABLE_CANDIDATE'
  ), safe as (
    select product_id from reviewable
    where has_oilpr and has_oilex and has_fgbu and has_botla and has_rmdi and has_fingo and has_trato and has_intst
  )
  select count(*) into v_safe_count from safe;

  if v_safe_count<>49 then
    raise exception 'Expected 49 safe Oil Products but found %',v_safe_count;
  end if;

  with oil as (
    select p.id product_id,
           costing.fn_preview_product_process_route_evidence(p.id,date '2026-07-22',12) ev
    from public.products p
    join public.sub_groups sg on sg.id=p.sub_group_id
    where sg.product_group_id in (10,11,58)
      and upper(coalesce(p.status,''))='ACTIVE'
  ), reviewable as (
    select product_id,ev,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='OILPR'),false) has_oilpr,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='OILEX'),false) has_oilex,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='FGBU'),false) has_fgbu,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='BOTLA'),false) has_botla,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='RMDI'),false) has_rmdi,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='FINGO'),false) has_fingo,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='TRATO'),false) has_trato,
      coalesce((select bool_or((x->>'evidence_class') in ('CORE_EVIDENCE','COMMON_EVIDENCE')) from jsonb_array_elements(ev->'activity_kind_summary') x where x->>'activity_short_code'='INTST'),false) has_intst
    from oil where ev->'summary'->>'candidate_status'='REVIEWABLE_CANDIDATE'
  ), safe as (
    select product_id from reviewable
    where has_oilpr and has_oilex and has_fgbu and has_botla and has_rmdi and has_fingo and has_trato and has_intst
  )
  insert into costing.production_route_family_product_map(
    route_family_id,product_id,status,effective_from,assignment_basis,assignment_note,
    approval_reference,approved_at,created_at,updated_at
  )
  select v_family_id,s.product_id,'APPROVED',date '2026-07-01','HISTORICAL_REVIEW',
         'Approved first Oil Route Family rollout. Product has governed historical evidence for the complete shared Oil backbone at common/core level. Preparation variants and Product-specific operations remain subject to Product process routes.',
         'PRM-RFPM-OIL-FIRST-ROLLOUT-APP-20260701',v_now,v_now,v_now
  from safe s
  where not exists(
    select 1 from costing.production_route_family_product_map m
    where m.product_id=s.product_id and m.status='APPROVED'
      and m.effective_from<=date '2026-07-01'
      and (m.effective_to is null or m.effective_to>=date '2026-07-01')
  );

  select count(*) into v_assignment_count
  from costing.production_route_family_product_map
  where route_family_id=v_family_id and status='APPROVED'
    and effective_from<=date '2026-07-01'
    and (effective_to is null or effective_to>=date '2026-07-01');

  if v_assignment_count<>49 then
    raise exception 'Expected 49 approved Oil Product assignments but found %',v_assignment_count;
  end if;
end
$migration$;