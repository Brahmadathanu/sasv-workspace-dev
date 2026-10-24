-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_family_id bigint;
  v_route_id bigint;
  v_cc_pulv bigint;
  v_cc_blend bigint;
  v_cc_hold bigint;
  v_cc_pack bigint;
  v_now timestamptz:=clock_timestamp();
  v_ref text:='PRM-DRY-POWDER-ARCH-20260701';
  v_group_id integer;
begin
  insert into costing.production_cost_centre(
    cost_centre_code,cost_centre_name,cost_centre_type,section_id,subsection_id,area_id,plant_id,
    default_resource_class_code,pool_scope,effective_from,status,approval_reference,approved_at,description
  )
  select 'PROD_DRY_POWDER_SIZE_REDUCTION','Dry Powder Size Reduction and Sieving','PROCESS_AREA_CENTRED',
         3,19,15,null,'GRINDER','SHARED_ROUTE','2026-07-01','APPROVED',v_ref,v_now,
         'Shared Production cost centre for disintegration, pulverization and sieving of dry powder and Choornam formulations.'
  where not exists(select 1 from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_SIZE_REDUCTION');

  insert into costing.production_cost_centre(
    cost_centre_code,cost_centre_name,cost_centre_type,section_id,subsection_id,area_id,plant_id,
    default_resource_class_code,pool_scope,effective_from,status,approval_reference,approved_at,description
  )
  select 'PROD_DRY_POWDER_BLEND','Dry Powder Blending','PROCESS_AREA_CENTRED',
         4,5,23,null,'GENERAL_AREA','SHARED_ROUTE','2026-07-01','APPROVED',v_ref,v_now,
         'Shared Production cost centre for governed dry powder blending and batch mixing.'
  where not exists(select 1 from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_BLEND');

  insert into costing.production_cost_centre(
    cost_centre_code,cost_centre_name,cost_centre_type,section_id,subsection_id,area_id,plant_id,
    default_resource_class_code,pool_scope,effective_from,status,approval_reference,approved_at,description
  )
  select 'PROD_DRY_POWDER_FG_BULK_HOLD','Dry Powder FG Bulk Holding','SERVICE_CENTRED',
         4,5,91,null,'STORAGE_OCCUPANCY','SHARED_ROUTE','2026-07-01','APPROVED',v_ref,v_now,
         'Passive holding of finished dry powder bulk before packing.'
  where not exists(select 1 from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_FG_BULK_HOLD');

  insert into costing.production_cost_centre(
    cost_centre_code,cost_centre_name,cost_centre_type,section_id,subsection_id,area_id,plant_id,
    default_resource_class_code,pool_scope,effective_from,status,approval_reference,approved_at,description
  )
  select 'PROD_DRY_POWDER_PACK','Dry Powder Filling and Packing','PROCESS_AREA_CENTRED',
         6,21,56,null,'PACKING_MACHINE','SHARED_ROUTE','2026-07-01','APPROVED',v_ref,v_now,
         'Shared packing cost centre for pouch or container filling, labelling, cartoning and related dry-powder packing operations.'
  where not exists(select 1 from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_PACK');

  select id into v_cc_pulv from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_SIZE_REDUCTION';
  select id into v_cc_blend from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_BLEND';
  select id into v_cc_hold from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_FG_BULK_HOLD';
  select id into v_cc_pack from costing.production_cost_centre where cost_centre_code='PROD_DRY_POWDER_PACK';

  select id into v_family_id from costing.production_route_family where family_code='DRY_POWDER_CHOORNAM';
  if v_family_id is null then
    insert into costing.production_route_family(
      family_code,family_name,status,effective_from,description,approval_reference,approved_at
    ) values(
      'DRY_POWDER_CHOORNAM','Dry Powder and Choornam Manufacturing','APPROVED','2026-07-01',
      'Shared manufacturing Route Family for dry powder, Choornam, Karpam, Kudineer Choornam and Kvatha Choornam products. Prepared liquids and instant preparations are excluded and require separate Route Families.',
      'PRM-RF-DRY_POWDER_CHOORNAM-APP-20260701',v_now
    ) returning id into v_family_id;
  end if;

  select id into v_route_id from costing.production_route_family_route where route_family_id=v_family_id and route_version=1;
  if v_route_id is null then
    insert into costing.production_route_family_route(
      route_family_id,route_code,route_version,route_name,status,effective_from,source_type,evidence_status,route_note
    ) values(
      v_family_id,'DRY_POWDER_CHOORNAM_ROUTE',1,'Dry Powder and Choornam Shared Manufacturing Route',
      'DRAFT','2026-07-01','MANUAL','MANUAL_COMPLETE',
      'Architecture-first shared route. Product-level additions, bypasses, replacements and cycle/location/resource changes remain governed. Data-quality confirmation is deferred until the complete Costing and Pricing pipeline is implemented.'
    ) returning id into v_route_id;

    insert into costing.production_route_family_route_step(
      family_route_id,step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,plant_id,
      behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,
      is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,step_note
    ) values
      (v_route_id,'RM_ISSUE',10,2,(select id from costing.production_cost_centre where cost_centre_code='STORES_RM_ISSUE_BOUNDARY'),2,1,72,null,
       'SUPERVISION_ONLY','GENERAL_AREA','BOUNDARY_RM_ISSUE',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL','Raw Material Stores to Production boundary.'),
      (v_route_id,'DISINTEGRATION',20,161,v_cc_pulv,3,19,15,null,
       'FULLY_ATTENDED','GRINDER','PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE','Normal dry-material size-reduction opening step; Product route may bypass where not required.'),
      (v_route_id,'PULVERIZATION',30,21,v_cc_pulv,3,19,15,null,
       'FULLY_ATTENDED','GRINDER','PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE','Normal pulverization step; Product route may alter cycles or bypass where approved.'),
      (v_route_id,'SIEVING',40,22,v_cc_pulv,3,19,15,null,
       'FULLY_ATTENDED','GRINDER','PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE','Normal sieving step with Product-level override capability.'),
      (v_route_id,'POWDER_BLENDING',50,31,v_cc_blend,4,5,23,null,
       'FULLY_ATTENDED','GENERAL_AREA','PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE','Shared powder blending step; may be bypassed for genuinely single-component or non-blended products.'),
      (v_route_id,'FG_BULK_HOLD',60,195,v_cc_hold,4,5,91,null,
       'SUPERVISION_ONLY','STORAGE_OCCUPANCY','INTERMEDIATE_WIP_HOLD',1,1,true,true,true,'PASSIVE','SUPERVISION','Finished dry-powder bulk holding before packing.'),
      (v_route_id,'DRY_POWDER_PACKING',70,214,v_cc_pack,6,21,56,null,
       'FULLY_ATTENDED','PACKING_MACHINE','PRODUCTION_PROCESS',1,1,true,true,false,'INCLUDE','INCLUDE','Generic dry-powder filling and packing; Product route may replace with a specific pack operation.'),
      (v_route_id,'QC_ASSESSMENT',80,159,(select id from costing.production_cost_centre where cost_centre_code='QC_ASSESSMENT_BOUNDARY'),5,10,48,null,
       'SUPERVISION_ONLY','GENERAL_AREA','QC_OTHER_POOL',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL','Quality Control assessment boundary.'),
      (v_route_id,'FG_TRANSFER',90,111,(select id from costing.production_cost_centre where cost_centre_code='FG_TRANSFER_BOUNDARY'),6,21,56,null,
       'SUPERVISION_ONLY','GENERAL_AREA','BOUNDARY_FG_TRANSFER',1,1,true,false,false,'EXCLUDE_OTHER_POOL','EXCLUDE_OTHER_POOL','Transfer to Finished Goods Stores boundary.');

    if not coalesce((costing.fn_validate_route_family_route(v_route_id)->>'valid')::boolean,false) then
      raise exception 'Dry Powder Route Family route validation failed: %',costing.fn_validate_route_family_route(v_route_id);
    end if;

    update costing.production_route_family_route set status='REVIEW_REQUIRED',updated_at=v_now where id=v_route_id and status='DRAFT';
    update costing.production_route_family_route
      set status='APPROVED',approval_reference='PRM-ROUTE-DRY_POWDER_CHOORNAM-V1-APP-20260701',approved_at=v_now,updated_at=v_now
    where id=v_route_id and status='REVIEW_REQUIRED';
  end if;

  foreach v_group_id in array array[7,8,9,23,24,54,55,56,64,65,81]
  loop
    if not exists(
      select 1 from costing.production_route_family_product_group_map
      where product_group_id=v_group_id and status in ('DRAFT','IN_REVIEW','APPROVED')
        and daterange(coalesce(effective_from,'2026-07-01'::date),coalesce(effective_to,'infinity'::date),'[]')
            && daterange('2026-07-01'::date,'infinity'::date,'[]')
    ) then
      insert into costing.production_route_family_product_group_map(
        route_family_id,product_group_id,status,effective_from,mapping_basis,mapping_note,approval_reference,approved_at
      ) values(
        v_family_id,v_group_id,'APPROVED','2026-07-01','MANUAL',
        'Architecture-first dry powder/Choornam Route Family mapping. Product-level differences remain governed; record-level data quality is deferred.',
        format('PRM-MAP-DRY_POWDER-G%s-APP-20260701',v_group_id),v_now
      );
    end if;
  end loop;
end $$;