-- backfilled from live schema_migrations on 2026-10-24, CI-016
do $migration$
declare
  v_row record;
  v_id bigint;
  v_validation jsonb;
begin
  for v_row in
    select * from (values
      (
        'PROD_OIL_FG_BULK_HOLD'::text,
        'Oil Formulation FG Bulk Holding'::text,
        'SERVICE_CENTRED'::text,
        6::integer,21::integer,85::integer,null::integer,
        'STORAGE_OCCUPANCY'::text,
        'SHARED_ROUTE'::text,
        'Passive line-side holding of finished medicated oil bulk before or during packaging operations.'::text,
        'PRM-CC-PROD_OIL_FG_BULK_HOLD-APP-20260701'::text
      ),
      (
        'PROD_JUICE_EXTRACTION',
        'Juice Extraction',
        'PROCESS_AREA_CENTRED',
        4,20,46,null,
        'EXTRACTION_SYSTEM',
        'SHARED_ROUTE',
        'Governed production cost centre for juice extraction used as an upstream preparation step in applicable formulations.',
        'PRM-CC-PROD_JUICE_EXTRACTION-APP-20260701'
      ),
      (
        'PROD_OIL_FILL_PACK',
        'Oil Formulation Filling and Packing',
        'PROCESS_AREA_CENTRED',
        6,21,55,null,
        'PACKING_MACHINE',
        'SHARED_ROUTE',
        'Governed production cost centre for bottling, labelling, monocarton handling where applicable, cartoning and related oil-formulation packing operations.',
        'PRM-CC-PROD_OIL_FILL_PACK-APP-20260701'
      ),
      (
        'PROD_RM_WASH_DRY',
        'Raw Material Washing and Drying',
        'PROCESS_AREA_CENTRED',
        4,9,77,null,
        'MANUAL',
        'SHARED_ROUTE',
        'Governed Product-specific preparation cost centre for raw-material washing and drying where explicitly required by the approved Product route.',
        'PRM-CC-PROD_RM_WASH_DRY-APP-20260701'
      )
    ) as x(
      code,name,centre_type,section_id,subsection_id,area_id,plant_id,
      resource_class,pool_scope,description,approval_reference
    )
  loop
    select id into v_id
    from costing.production_cost_centre
    where cost_centre_code=v_row.code;

    if v_id is null then
      insert into costing.production_cost_centre(
        cost_centre_code,cost_centre_name,cost_centre_type,
        section_id,subsection_id,area_id,plant_id,
        default_resource_class_code,pool_scope,effective_from,
        description,status,created_by,created_at,updated_at
      ) values (
        v_row.code,v_row.name,v_row.centre_type,
        v_row.section_id,v_row.subsection_id,v_row.area_id,v_row.plant_id,
        v_row.resource_class,v_row.pool_scope,date '2026-07-01',
        v_row.description,'DRAFT',auth.uid(),now(),now()
      ) returning id into v_id;
    end if;

    v_validation := costing.fn_validate_production_cost_centre(v_id);
    if not coalesce((v_validation->>'valid')::boolean,false) then
      raise exception 'Cost centre % failed validation: %',v_row.code,v_validation->'errors';
    end if;

    update costing.production_cost_centre
    set status='APPROVED',
        approval_reference=v_row.approval_reference,
        approved_by=auth.uid(),
        approved_at=coalesce(approved_at,now()),
        updated_at=now()
    where id=v_id and status='DRAFT';

    if exists (
      select 1 from costing.production_cost_centre c
      where c.id=v_id
        and (
          c.status<>'APPROVED'
          or c.effective_from<>date '2026-07-01'
          or c.section_id is distinct from v_row.section_id
          or c.subsection_id is distinct from v_row.subsection_id
          or c.area_id is distinct from v_row.area_id
          or c.plant_id is distinct from v_row.plant_id
          or c.default_resource_class_code<>v_row.resource_class
          or c.pool_scope<>v_row.pool_scope
        )
    ) then
      raise exception 'Cost centre % exists but does not match the governed definition',v_row.code;
    end if;
  end loop;
end
$migration$;