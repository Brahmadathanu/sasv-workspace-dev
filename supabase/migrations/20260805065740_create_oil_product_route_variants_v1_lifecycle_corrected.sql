-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $$
declare
  v_family_route_id bigint;
  v_row record;
  v_route_id bigint;
  v_ref_id bigint;
  v_version integer;
  v_existing bigint;
  v_validation jsonb;
begin
  select id into v_family_route_id
  from costing.production_route_family_route
  where route_family_id=(select id from costing.production_route_family where family_code='OIL_FORMULATIONS_REGULAR')
    and status='APPROVED'
    and effective_from<=date '2026-07-22'
    and (effective_to is null or effective_to>=date '2026-07-22')
  order by route_version desc,id desc
  limit 1;

  if v_family_route_id is null then raise exception 'Approved Oil Route Family route not found'; end if;

  for v_row in
    with assigned as (
      select m.product_id,p.item product_name
      from costing.production_route_family_product_map m
      join public.products p on p.id=m.product_id
      where m.route_family_id=(select id from costing.production_route_family where family_code='OIL_FORMULATIONS_REGULAR')
        and m.status='APPROVED'
        and m.effective_from<=date '2026-07-22'
        and (m.effective_to is null or m.effective_to>=date '2026-07-22')
    ), ev as (
      select a.product_id,a.product_name,costing.fn_preview_product_process_route_evidence(a.product_id,date '2026-07-22',12) j
      from assigned a
    ), kinds as (
      select e.product_id,e.product_name,x->>'activity_short_code' code,(x->>'batch_coverage')::numeric batch_coverage
      from ev e cross join lateral jsonb_array_elements(e.j->'activity_kind_summary') x
    ), p as (
      select product_id,product_name,
        coalesce(max(batch_coverage) filter(where code='DSNTG'),0) dsntg_cov,
        coalesce(max(batch_coverage) filter(where code='PLVRZ'),0) plvrz_cov,
        coalesce(max(batch_coverage) filter(where code='PREEX'),0) preex_cov,
        coalesce(max(batch_coverage) filter(where code='JUIEX'),0) juiex_cov
      from kinds group by product_id,product_name
    )
    select * from p
    where dsntg_cov>=0.5 or plvrz_cov>=0.5 or preex_cov>=0.5 or juiex_cov>=0.5
    order by product_id
  loop
    select id into v_existing
    from costing.product_process_route
    where product_id=v_row.product_id and base_route_family_route_id=v_family_route_id
      and status in ('DRAFT','REVIEW_REQUIRED','APPROVED')
    order by route_version desc,id desc limit 1;

    if v_existing is null then
      select id into v_ref_id
      from public.production_batch_size_ref
      where product_id=v_row.product_id and is_active and effective_from<=date '2026-07-22'
      order by effective_from desc,id desc limit 1;
      if v_ref_id is null then raise exception 'Missing active batch-size reference for Product %',v_row.product_id; end if;

      select coalesce(max(route_version),0)+1 into v_version from costing.product_process_route where product_id=v_row.product_id;

      insert into costing.product_process_route(
        product_id,base_route_family_route_id,route_version,route_code,status,effective_from,batch_size_ref_id,
        source_type,evidence_status,route_note,created_by
      ) values(
        v_row.product_id,v_family_route_id,v_version,'PRODUCT_'||v_row.product_id||'_ROUTE','DRAFT',date '2026-07-01',v_ref_id,
        'HISTORICAL_CANDIDATE','HISTORICAL_COMPLETE',
        'Governed Oil Product route generated from common/core historical preparation evidence. Only evidence-supported preparation steps are added to the approved Oil Route Family backbone.',null
      ) returning id into v_route_id;

      if v_row.dsntg_cov>=0.5 then
        insert into costing.product_process_route_override(product_route_id,operation_type,override_step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,override_reason)
        values(v_route_id,'ADD_STEP','RM_DISINTEGRATION',12,161,23,3,19,15,'FULLY_ATTENDED','GRINDER','PRODUCTION_PROCESS',1,1,true,false,true,'INCLUDE','INCLUDE','Added from common/core Product historical evidence for Disintegration before Oil processing.');
      end if;
      if v_row.plvrz_cov>=0.5 then
        insert into costing.product_process_route_override(product_route_id,operation_type,override_step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,override_reason)
        values(v_route_id,'ADD_STEP','RM_PULVERIZATION',14,21,23,3,19,15,'FULLY_ATTENDED','GRINDER','PRODUCTION_PROCESS',1,1,true,false,true,'INCLUDE','INCLUDE','Added from common/core Product historical evidence for Pulverization before Oil processing.');
      end if;
      if v_row.preex_cov>=0.5 then
        insert into costing.product_process_route_override(product_route_id,operation_type,override_step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,override_reason)
        values(v_route_id,'ADD_STEP','PRESSURIZED_PRE_EXTRACTION',22,62,25,4,9,77,'INTERMITTENT_ATTENDED','EXTRACTION_SYSTEM','PRODUCTION_PROCESS',1,1,true,true,true,'INCLUDE','INCLUDE','Added from common/core Product historical evidence for pressurized extraction before medicated Oil processing.');
      end if;
      if v_row.juiex_cov>=0.5 then
        insert into costing.product_process_route_override(product_route_id,operation_type,override_step_key,sequence_no,activity_id,cost_centre_id,section_id,subsection_id,area_id,behaviour_code,resource_class_code,route_step_scope,expected_occurrence_count,standard_cycle_count,is_mandatory,allows_repeat,allows_skip_with_approval,production_overhead_scope,direct_labour_scope,override_reason)
        values(v_route_id,'ADD_STEP','FRESH_JUICE_EXTRACTION',24,64,30,4,20,46,'FULLY_ATTENDED','EXTRACTION_SYSTEM','PRODUCTION_PROCESS',1,1,true,false,true,'INCLUDE','INCLUDE','Added from common/core Product historical evidence for fresh juice extraction before medicated Oil processing.');
      end if;

      v_validation:=costing.fn_validate_product_process_route(v_route_id);
      if not coalesce((v_validation->>'valid')::boolean,false) then
        raise exception 'Oil Product route validation failed for Product %: %',v_row.product_id,v_validation;
      end if;

      update costing.product_process_route set status='REVIEW_REQUIRED',updated_at=now() where id=v_route_id and status='DRAFT';
      update costing.product_process_route set status='APPROVED',approval_reference='PRM-PROUTE-OIL-'||v_row.product_id||'-V'||v_version||'-APP-20260701',approved_by=null,approved_at=now(),updated_at=now()
      where id=v_route_id and status='REVIEW_REQUIRED';
    end if;
  end loop;
end $$;