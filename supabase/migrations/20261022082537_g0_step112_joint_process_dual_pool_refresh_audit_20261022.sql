-- backfilled from live schema_migrations on 2026-10-24, CI-016
-- READ-ONLY EXACT LIVE FUNCTION DEFINITION, BASELINE BEFORE JOINT INTEGRATION.
CREATE OR REPLACE FUNCTION costing.rpc_refresh_sku_direct_labour_component_split_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS TABLE(refreshed_period_start date, inserted_row_count bigint, blocked_count bigint, review_required_count bigint, ready_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date := date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.direct_labour_workload_policy%rowtype;
  v_preview jsonb;
  v_total_pool numeric;
  v_mfg_component_id bigint;
  v_pack_component_id bigint;
  v_mfg_pool numeric;
  v_pack_pool numeric;
  v_mfg_staff_count bigint;
  v_pack_staff_count bigint;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_product_count integer;
  v_company_mfg_workload numeric;
  v_company_pack_units numeric;
  v_bt boolean;
  v_rl text;          -- AU-6L equipment-loads approval (null = off)
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run from costing.costing_refresh_run where id=p_refresh_run_id;
  if not found then raise exception 'Costing refresh run % not found',p_refresh_run_id; end if;
  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Direct Labour component snapshot context does not match refresh run %',p_refresh_run_id;
  end if;
  if not (
    v_run.overall_status='SUCCESS'
    or (
      v_run.overall_status='RUNNING'
      and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
      and exists (
        select 1 from costing.costing_refresh_run_stage s
        where s.refresh_run_id=p_refresh_run_id
          and s.stage_code='03_COST_BUILD_TO_SCHEME'
          and s.stage_status='RUNNING'
      )
    )
  ) then
    raise exception 'Direct Labour component snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  select * into v_policy from costing.fn_resolve_direct_labour_workload_policy(p_valuation_date);
  if v_policy.formula_type is distinct from 'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS' then
    raise exception 'Resolved Direct Labour policy %/% is not component-split and cannot use this writer',v_policy.policy_code,v_policy.policy_version;
  end if;

  if exists(select 1 from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_direct_labour_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_direct_labour_allocation_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Direct Labour snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select total_pool_amount into v_total_pool
  from costing.cost_pool_monthly_snapshot
  where period_start=v_period_start
    and valuation_date=p_valuation_date
    and refresh_run_id=p_refresh_run_id
    and allocation_pool='DIRECT_LABOUR';
  if v_total_pool is null then raise exception 'Direct Labour frozen pool is missing for exact run %',p_refresh_run_id; end if;

  select id,component_pool_amount,staff_count
    into v_mfg_component_id,v_mfg_pool,v_mfg_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='MANUFACTURING_LABOUR';

  select id,component_pool_amount,staff_count
    into v_pack_component_id,v_pack_pool,v_pack_staff_count
  from costing.direct_labour_component_pool_snapshot
  where refresh_run_id=p_refresh_run_id and component_code='PACKING_LABOUR';

  if v_mfg_component_id is null or v_pack_component_id is null then
    raise exception 'Frozen Direct Labour component pools are incomplete for run %',p_refresh_run_id;
  end if;
  if (v_mfg_pool+v_pack_pool) is distinct from v_total_pool then
    raise exception 'Frozen Direct Labour component pools do not reconcile for run %: manufacturing %, packing %, total %',p_refresh_run_id,v_mfg_pool,v_pack_pool,v_total_pool;
  end if;

  v_preview:=costing.fn_preview_direct_labour_shadow_workload(v_policy.id,v_period_start,p_valuation_date,p_refresh_run_id,null);

  create temporary table tmp_dl_product on commit drop as
  select x.*,
    case when x.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and x.direct_labour_workload_units>0 then true else false end as is_eligible
  from jsonb_to_recordset(v_preview->'rows') as x(
    product_id bigint,product_name text,product_base_uom text,recipient_sku_count integer,
    monthly_product_base_qty numeric,monthly_driver_status text,standard_batch_count bigint,
    route_family_id bigint,family_route_id bigint,product_route_id bigint,effective_route_source text,
    foundation_status text,foundation_note text,workload_status text,workload_note text,
    direct_labour_route_intensity numeric,direct_labour_workload_units numeric,labour_step_evidence jsonb
  );

  create temporary table tmp_packing_responsibility on commit drop as
  select t.product_id,t.route_family_id,pr.rule_id,pr.responsibility_code,pr.resolution_source,pr.rationale
  from tmp_dl_product t
  cross join lateral costing.fn_resolve_packing_labour_responsibility(t.route_family_id,p_valuation_date) pr;

  update tmp_dl_product t
  set workload_status = case
          when t.foundation_status like 'REVIEW_REQUIRED%' then 'REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR'
          else 'READY_ZERO_MANUFACTURING_LABOUR'
      end,
      workload_note = case
          when t.foundation_status like 'REVIEW_REQUIRED%' then
              'The governed route intentionally contains no Manufacturing-Labour steps; Manufacturing Labour is zero, while the quantity foundation requires review. Packing Labour remains separate.'
          else
              'The governed route intentionally contains no Manufacturing-Labour steps. Manufacturing Labour is validly zero and Packing Labour remains separate.'
      end
  where t.workload_status='BLOCKED_NO_POSITIVE_DIRECT_LABOUR_ROUTE_INTENSITY'
    and coalesce(t.direct_labour_route_intensity,0)=0
    and t.foundation_status not like 'BLOCKED%'
    and jsonb_typeof(t.labour_step_evidence)='array'
    and jsonb_array_length(t.labour_step_evidence)>0
    and not exists (
        select 1
        from jsonb_array_elements(t.labour_step_evidence) e
        where coalesce(e->>'direct_labour_scope','') <> 'EXCLUDE_OTHER_POOL'
    )
    and (
      not exists (
        select 1 from costing.production_route_family rf
        where rf.id=t.route_family_id and rf.family_code='OUTSOURCED_SOFT_GEL_JOB_WORK'
      )
      or exists (
        select 1 from tmp_packing_responsibility pr
        where pr.product_id=t.product_id
          and pr.responsibility_code='EXTERNAL_FULLY_PACKED'
          and pr.rule_id is not null
      )
    );

  -- AU-5 batch-true: manufacturing-labour workload on unrounded normal batch equivalents (route intensity x qty / batch_size_ref)
  v_bt := costing.fn_batch_true_effective(p_valuation_date);
  if v_bt then
    update tmp_dl_product t
       set direct_labour_workload_units = t.direct_labour_route_intensity * t.monthly_product_base_qty / br.preferred_batch_size
      from (select distinct on (b.product_id) b.product_id,b.preferred_batch_size
              from public.production_batch_size_ref b
             where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
             order by b.product_id,b.effective_from desc,b.id desc) br
     where br.product_id=t.product_id and br.preferred_batch_size>0
       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;

    -- AU-6L: each labour step x equipment loads per batch; intensity re-stated, workload on unrounded batch equivalents.
    select m.approval_reference into v_rl from costing.fn_route_load_scaling_mode(p_valuation_date) m;
    if v_rl is not null then
      create temporary table tmp_dl_bs on commit drop as
      select distinct on (b.product_id) b.product_id,b.preferred_batch_size
        from public.production_batch_size_ref b
       where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
       order by b.product_id,b.effective_from desc,b.id desc;

      if exists (select 1 from tmp_dl_product t
                 cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
                 where coalesce(nullif(e->>'step_labour_factor','')::numeric,0) <> 0
                   and costing.fn_route_step_loads(e->>'resource_class_code', 1, 1, 'Kg', p_valuation_date) is null) then
        raise exception 'AU-6L: labour step resource class without an effective equipment capacity row (fail-closed)';
      end if;

      create temporary table tmp_dl_scale on commit drop as
      select t.product_id, t.product_base_uom, br.preferred_batch_size bs, ch.solid_kg, ch.output_qty, ch.output_uom, ch.charge_source,
             t.direct_labour_route_intensity raw_intensity,
             sum(nullif(e->>'step_labour_factor','')::numeric) f,
             sum(nullif(e->>'step_labour_factor','')::numeric
                 *costing.fn_au9_g4_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, nullif(e->>'base_step_id','')::bigint, nullif(e->>'override_id','')::bigint, nullif(e->>'activity_id','')::integer)) fs,
             jsonb_agg(jsonb_build_object('seq',nullif(e->>'sequence_no','')::numeric,'rc',e->>'resource_class_code',
                       'loads',costing.fn_au9_g4_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, nullif(e->>'base_step_id','')::bigint, nullif(e->>'override_id','')::bigint, nullif(e->>'activity_id','')::integer))
                       order by nullif(e->>'sequence_no','')::numeric) step_detail
        from tmp_dl_product t
        join tmp_dl_bs br on br.product_id=t.product_id and br.preferred_batch_size>0
        cross join lateral costing.fn_route_batch_charge(t.product_id, br.preferred_batch_size, t.product_base_uom, p_valuation_date) ch
        cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
       where coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0
       group by t.product_id, t.product_base_uom, br.preferred_batch_size, ch.solid_kg, ch.output_qty, ch.output_uom, ch.charge_source, t.direct_labour_route_intensity;

      update tmp_dl_product t
         set direct_labour_route_intensity = t.direct_labour_route_intensity * s.fs / s.f,
             direct_labour_workload_units  = (t.direct_labour_route_intensity * s.fs / s.f) * t.monthly_product_base_qty / s.bs
        from tmp_dl_scale s
       where s.product_id=t.product_id and s.f > 0;
    end if;
  end if;

      -- Empty attribution lineage for historical/non-joint runs.
  -- Forward-only policy branch must DROP and rebuild this temp table.
  CREATE TEMP TABLE tmp_joint_dl_adjust (product_id bigint, policy_id bigint, original_workload numeric, corrected_workload numeric) ON COMMIT DROP;

  -- Joint physical-stage labour adjustment (forward-only, before AU6 cap).
  IF EXISTS (SELECT 1 FROM costing.joint_process_policy p
             WHERE p.effective_from<=p_valuation_date
             AND (p.effective_to IS NULL OR p.effective_to>p_valuation_date)) THEN
    IF NOT v_bt OR v_rl IS NULL THEN
      RAISE EXCEPTION 'JOINT_DL_REQUIRES_AU5_AU6L';
    END IF;
    DROP TABLE tmp_joint_dl_adjust;
    CREATE TEMP TABLE tmp_joint_dl_adjust ON COMMIT DROP AS
    WITH members AS (
       SELECT p.id policy_id,p.reference_output_qty,o.product_id,o.output_qty,
              t.monthly_product_base_qty,t.labour_step_evidence,
              bs.preferred_batch_size
       FROM costing.joint_process_policy p
       JOIN costing.joint_process_output o ON o.policy_id=p.id
       JOIN tmp_dl_product t ON t.product_id=o.product_id
       JOIN tmp_dl_bs bs ON bs.product_id=o.product_id
       WHERE p.effective_from<=p_valuation_date
         AND (p.effective_to IS NULL OR p.effective_to>p_valuation_date)
    ), batches AS (
      SELECT policy_id, max(monthly_product_base_qty/nullif(output_qty,0)) b
      FROM members GROUP BY policy_id
    ), details AS (
       SELECT m.policy_id,m.product_id,m.reference_output_qty,m.output_qty,
              m.monthly_product_base_qty,m.preferred_batch_size,b.b,
              s.base_step_id,s.common_cycles,s.continuation_cycles,
              s.continuation_product_id,
              (e->>'step_labour_factor')::numeric
                /nullif((e->>'standard_cycle_count')::numeric,0) per_cycle,
              costing.fn_au9_g4_route_step_loads(
                e->>'resource_class_code',ch.solid_kg,ch.output_qty,ch.output_uom,
                p_valuation_date,(e->>'base_step_id')::bigint,
                (e->>'override_id')::bigint,(e->>'activity_id')::integer) original_load,
              costing.fn_price_revision_joint_stage_load(
                e->>'resource_class_code',ch.solid_kg,ch.output_qty,ch.output_uom,
                p_valuation_date,(e->>'base_step_id')::bigint,
                (e->>'override_id')::bigint,(e->>'activity_id')::integer) joint_load,
              (e->>'step_labour_factor')::numeric route_step_factor
       FROM members m
       JOIN batches b ON b.policy_id=m.policy_id
       JOIN costing.joint_process_stage s ON s.policy_id=m.policy_id
       CROSS JOIN LATERAL costing.fn_route_batch_charge(
           m.product_id,m.preferred_batch_size,'Kg',p_valuation_date) ch
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(m.labour_step_evidence)='array'
              THEN m.labour_step_evidence ELSE '[]'::jsonb END) e
       WHERE (e->>'base_step_id')::bigint=s.base_step_id
    ), parity AS (
       SELECT policy_id,base_step_id,count(*) n,
              min(per_cycle*joint_load) factor,
              min(per_cycle*joint_load)=max(per_cycle*joint_load) equal_factors
       FROM details GROUP BY policy_id,base_step_id
    ), recalc AS (
       SELECT d.product_id,d.policy_id,count(*) stages,
              sum(d.monthly_product_base_qty/d.preferred_batch_size
                  *d.route_step_factor*d.original_load) original_workload,
              sum(costing.fn_joint_stage_member_workload(
                  d.common_cycles,d.continuation_cycles,d.output_qty,
                  d.reference_output_qty,d.product_id=d.continuation_product_id,
                  d.b,p.factor)) corrected_workload
       FROM details d JOIN parity p ON p.policy_id=d.policy_id
                                  AND p.base_step_id=d.base_step_id
       GROUP BY d.product_id,d.policy_id
    )
    SELECT z.*,
           (SELECT count(*) FROM costing.joint_process_stage
             WHERE policy_id=z.policy_id) expected_stages,
           (SELECT count(*) FROM costing.joint_process_output
             WHERE policy_id=z.policy_id) expected_members,
           (SELECT bool_and(n=2 AND equal_factors)
             FROM parity WHERE policy_id=z.policy_id) factors_ok
    FROM recalc z;
    IF EXISTS(
      SELECT 1 FROM tmp_joint_dl_adjust a JOIN tmp_dl_product t
        ON t.product_id=a.product_id
      WHERE a.expected_members<>2 OR a.expected_stages<>4
        OR a.stages<>a.expected_stages OR NOT coalesce(a.factors_ok,false)
        OR a.original_workload IS NULL OR a.corrected_workload IS NULL
        OR t.direct_labour_workload_units<a.original_workload
        OR NOT t.is_eligible
    ) OR (SELECT count(*) FROM tmp_joint_dl_adjust)<>
      (SELECT count(*) FROM costing.joint_process_output o
       JOIN costing.joint_process_policy p ON p.id=o.policy_id
       WHERE p.effective_from<=p_valuation_date
         AND (p.effective_to IS NULL OR p.effective_to>p_valuation_date))
    THEN RAISE EXCEPTION 'JOINT_DL_PRECAP_VALIDATION_FAILED'; END IF;
    UPDATE tmp_dl_product t SET
      direct_labour_workload_units=t.direct_labour_workload_units-a.original_workload+a.corrected_workload,
      direct_labour_route_intensity=(t.direct_labour_workload_units-a.original_workload+a.corrected_workload)
        /nullif(t.monthly_product_base_qty/(SELECT preferred_batch_size FROM tmp_dl_bs WHERE product_id=t.product_id),0)
    FROM tmp_joint_dl_adjust a WHERE a.product_id=t.product_id;
  END IF;

  -- AU-6: default-volume cap (default-driven workload <= policy pool_cap_share of eligible workload).
  update tmp_dl_product t
     set direct_labour_workload_units = c.new_workload
    from costing.fn_default_volume_cap(
           p_refresh_run_id, p_valuation_date, 'MANUFACTURING_LABOUR',
           (select jsonb_agg(jsonb_build_object('product_id',x.product_id,'workload',x.direct_labour_workload_units,'base_qty',x.monthly_product_base_qty))
              from tmp_dl_product x
             where x.is_eligible and x.direct_labour_workload_units > 0)) c
   where c.product_id = t.product_id;

  select count(*),count(*) filter(where is_eligible),count(*) filter(where workload_status like 'BLOCKED%'),
         sum(direct_labour_workload_units) filter(where is_eligible)
    into v_recipient_count,v_eligible_count,v_blocked_product_count,v_company_mfg_workload
  from tmp_dl_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_mfg_workload,0)<=0 then
    raise exception 'Manufacturing Labour allocation has no eligible positive route workload for refresh run %',p_refresh_run_id;
  end if;

  select sum(b.monthly_allocation_units)
    into v_company_pack_units
  from costing.sku_sales_allocation_basis_snapshot b
  join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
  where b.period_start=v_period_start
    and b.valuation_date=p_valuation_date
    and b.refresh_run_id=p_refresh_run_id
    and b.monthly_allocation_units>0
    and pr.responsibility_code='SASV_INTERNAL_PACKING';

  if coalesce(v_company_pack_units,0)<=0 then
    raise exception 'Packing Labour allocation has no positive frozen monthly package units for SASV-packed recipient SKUs in refresh run %',p_refresh_run_id;
  end if;

  insert into costing.product_direct_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,monthly_product_base_qty,
    monthly_driver_status,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    workload_status,workload_reason_code,workload_note,recipient_product_count,eligible_product_count,
    blocked_product_count,eligible_coverage_ratio,company_eligible_workload_units,direct_labour_pool_amount,
    product_workload_share,product_direct_labour_allocation,direct_labour_pool_snapshot_id,
    manufacturing_labour_component_pool_snapshot_id
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,t.product_id,t.product_name,t.product_base_uom,
    t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.monthly_product_base_qty,
    t.monthly_driver_status,t.standard_batch_count,t.direct_labour_route_intensity,t.direct_labour_workload_units,
    t.workload_status,t.workload_status,
    case when t.workload_status='READY' then 'Manufacturing Labour workload is ready under the component-split Direct Labour policy.'
         when t.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'Manufacturing Labour is validly zero because the governed route contains no Manufacturing-Labour steps; Packing Labour responsibility is resolved separately.'
         when t.workload_status='REVIEW_REQUIRED_FOUNDATION' then 'Manufacturing Labour workload is calculated but the governed quantity foundation requires review.'
         when t.workload_status='REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR' then 'Manufacturing Labour is validly zero under the governed route, while the quantity foundation requires review; Packing Labour responsibility is resolved separately.'
         else t.workload_note end,
    v_recipient_count,v_eligible_count,v_blocked_product_count,
    v_eligible_count::numeric/nullif(v_recipient_count,0),v_company_mfg_workload,v_mfg_pool,
    case when t.is_eligible then t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    case when t.is_eligible then v_mfg_pool*t.direct_labour_workload_units/v_company_mfg_workload else 0 end,
    (select id from costing.cost_pool_monthly_snapshot where refresh_run_id=p_refresh_run_id and allocation_pool='DIRECT_LABOUR'),
    v_mfg_component_id
  from tmp_dl_product t;

  if v_rl is not null then -- AU-6L lineage
    insert into costing.route_load_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,product_base_uom,preferred_batch_size,
      solid_charge_kg,output_charge,output_charge_uom,charge_source,raw_factor,scaled_factor,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'MANUFACTURING_LABOUR',s.product_id,s.product_base_uom,s.bs,
           s.solid_kg,s.output_qty,s.output_uom,s.charge_source,s.raw_intensity,case when s.f>0 then s.raw_intensity*s.fs/s.f else s.raw_intensity end,v_rl,(coalesce(s.step_detail,'[]'::jsonb) ||
             coalesce((select jsonb_build_array(jsonb_build_object(
               'record_type','JOINT_PROCESS_ATTRIBUTION',
               'policy_id',a.policy_id,
               'original_shared_workload',a.original_workload,
               'corrected_shared_workload',a.corrected_workload,
               'product_workload_after_joint',t.direct_labour_workload_units,
               'route_intensity_after_joint',t.direct_labour_route_intensity))
               from tmp_joint_dl_adjust a where a.product_id=s.product_id),'[]'::jsonb))
      from tmp_dl_scale s
      join tmp_dl_product t on t.product_id=s.product_id;
    -- AU-9 G4: per-step load provenance (only when plant-aware loads are on).
    if costing.fn_au9_g4_load_mode(p_valuation_date) is not null then
      perform costing.fn_au9_g4_capture_provenance(p_refresh_run_id, v_period_start, p_valuation_date, 'MANUFACTURING_LABOUR',
                s.product_id, s.solid_kg, s.output_qty, s.output_uom, t.labour_step_evidence)
         from tmp_dl_scale s join tmp_dl_product t on t.product_id = s.product_id;
    end if;
  end if;

  insert into costing.product_direct_labour_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,
    sequence_no,effective_step_key,source_type,activity_id,cost_centre_id,direct_labour_scope,scope_factor,
    behaviour_code,attendance_factor,expected_occurrence_count,standard_cycle_count,step_labour_factor,resource_class_code
  )
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,pw.id,pw.product_id,
    nullif(e->>'sequence_no','')::numeric,e->>'effective_step_key',e->>'source_type',
    nullif(e->>'activity_id','')::bigint,nullif(e->>'cost_centre_id','')::bigint,e->>'direct_labour_scope',
    nullif(e->>'scope_factor','')::numeric,e->>'behaviour_code',nullif(e->>'attendance_factor','')::numeric,
    nullif(e->>'expected_occurrence_count','')::numeric,nullif(e->>'standard_cycle_count','')::numeric,
    nullif(e->>'step_labour_factor','')::numeric,e->>'resource_class_code'
  from costing.product_direct_labour_workload_snapshot pw
  join tmp_dl_product t on t.product_id=pw.product_id
  cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end)e
  where pw.refresh_run_id=p_refresh_run_id;

  insert into costing.sku_packing_labour_workload_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,expected_package_units,
    company_expected_package_units,package_workload_share,packing_labour_component_pool_snapshot_id,
    packing_labour_pool_amount,packing_labour_allocation,packing_labour_cost_per_sku_unit,
    packing_responsibility_rule_id,packing_responsibility_code,packing_responsibility_resolution_source,
    workload_status,workload_reason_code,workload_note,source_method,created_at
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0 else b.monthly_allocation_units end,
    v_company_pack_units,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then b.monthly_allocation_units/v_company_pack_units else 0 end,
    v_pack_component_id,v_pack_pool,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then v_pack_pool*(b.monthly_allocation_units/v_company_pack_units) else 0 end,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' then 0
         when b.monthly_allocation_units>0 then v_pack_pool/v_company_pack_units else 0 end,
    pr.rule_id,pr.responsibility_code,pr.resolution_source,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'READY'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED'
      when ar.effective_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'READY_EXTERNAL_FULLY_PACKED'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'BLOCKED_NO_POSITIVE_EXPECTED_PACKAGE_UNITS'
      when ar.effective_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_PACKING_QUANTITY_FOUNDATION'
      else 'READY'
    end,
    case
      when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null then 'SASV Packing Labour is validly zero because the approved route-family responsibility rule governs this finished SKU as externally fully packed.'
      when b.monthly_allocation_units is null or b.monthly_allocation_units<=0 then 'Packing Labour cannot be allocated because frozen monthly package units are not positive.'
      when ar.effective_status='REVIEW_REQUIRED' then 'Packing Labour is calculable from frozen monthly package units, but the quantity foundation requires review.'
      else 'Packing Labour workload is ready from frozen exact-run monthly package units.'
    end,
    case when pr.responsibility_code='EXTERNAL_FULLY_PACKED' and pr.rule_id is not null
         then 'PACKING_LABOUR_RESPONSIBILITY_RULE.EXTERNAL_FULLY_PACKED'
         else 'SKU_SALES_ALLOCATION_BASIS_SNAPSHOT.MONTHLY_ALLOCATION_UNITS' end,
    clock_timestamp()
  from costing.sku_sales_allocation_basis_snapshot b
  join tmp_packing_responsibility pr on pr.product_id=b.product_id
  cross join lateral costing.fn_sales_allocation_quantity_driver_review_status(b.id) ar
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  create temporary table tmp_dl_product_pack on commit drop as
  select product_id,sum(packing_labour_allocation) as product_packing_labour_allocation
  from costing.sku_packing_labour_workload_snapshot
  where refresh_run_id=p_refresh_run_id
  group by product_id;

  -- These exact-run snapshots are populated immediately before the large SKU join.
  -- Refresh planner statistics so the current run is not mis-estimated as a one-row slice,
  -- which otherwise causes catastrophic nested-loop rescans of the same run snapshots.
  execute 'analyze costing.sku_sales_allocation_basis_snapshot';
  execute 'analyze costing.product_direct_labour_workload_snapshot';
  execute 'analyze costing.sku_packing_labour_workload_snapshot';

  insert into costing.sku_direct_labour_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,allocation_basis_snapshot_id,sku_id,product_id,product_name,
    product_base_uom,pack_size,pack_uom,sku_base_qty_per_unit,direct_labour_pool_amount,direct_labour_staff_count,
    sales_units_12m,sales_base_qty_12m,product_sales_units_12m,product_sales_base_qty_12m,company_sales_units_12m,
    product_allocation_share,resolved_sales_units,resolved_sales_base_qty,resolved_product_sales_units,
    resolved_product_sales_base_qty,resolved_company_sales_units,resolved_product_allocation_share,
    product_direct_labour_allocation,direct_labour_cost_per_base_uom,direct_labour_cost_per_sku,
    allocation_basis_status,allocation_basis_source,allocation_resolution_status,allocation_resolution_note,
    direct_labour_allocation_status,direct_labour_allocation_note,refreshed_at,policy_id,
    product_workload_snapshot_id,standard_batch_count,direct_labour_route_intensity,direct_labour_workload_units,
    product_workload_share,sku_within_product_share,allocation_reason_code,direct_labour_pool_snapshot_id,
    manufacturing_direct_labour_pool_amount,packing_labour_pool_amount,
    manufacturing_direct_labour_allocation,packing_labour_allocation,
    manufacturing_direct_labour_cost_per_sku,packing_labour_cost_per_sku,
    packing_labour_workload_snapshot_id,direct_labour_component_model_code
  )
  select
    b.period_start,b.valuation_date,b.refresh_run_id,b.id,b.sku_id,b.product_id,b.product_name,
    b.product_base_uom,b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,v_total_pool,coalesce(v_mfg_staff_count,0)+coalesce(v_pack_staff_count,0),
    b.actual_sales_units_12m,b.actual_sales_base_qty_12m,b.actual_product_sales_units_12m,
    b.actual_product_sales_base_qty_12m,b.actual_company_sales_units_12m,b.product_allocation_share,
    b.resolved_sales_units,b.resolved_sales_base_qty,b.resolved_product_sales_units,
    b.resolved_product_sales_base_qty,b.resolved_company_sales_units,b.resolved_product_allocation_share,
    pw.product_direct_labour_allocation+coalesce(pp.product_packing_labour_allocation,0),
    case when b.sku_base_qty_per_unit>0 then
      ((case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0))/b.sku_base_qty_per_unit else 0 end,
    case when b.monthly_allocation_units>0 then
      ((case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
              then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)
        + coalesce(pk.packing_labour_allocation,0))/b.monthly_allocation_units else 0 end,
    b.allocation_basis_status,'DIRECT_LABOUR_COMPONENT_SPLIT',b.allocation_resolution_status,b.allocation_resolution_note,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='BLOCKED' then 'BLOCKED'
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED'
      else 'READY'
    end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') then 'Direct Labour is blocked because the Manufacturing Labour component is blocked by Product route/foundation readiness. Packing Labour evidence is retained separately.'
      when pk.workload_status='BLOCKED' then 'Direct Labour is blocked because the Packing Labour quantity basis is blocked.'
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'Direct Labour is calculated from Manufacturing Labour plus Packing Labour, with one or more quantity foundations requiring review.'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' and pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED' then 'Direct Labour is ready with valid zero SASV Manufacturing Labour and zero SASV Packing Labour under the approved externally fully-packed responsibility rule.'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'Direct Labour is ready with a valid zero Manufacturing-Labour component plus the governed Packing-Labour component.'
      else 'Direct Labour is ready as Manufacturing Labour plus Packing Labour under the approved component-split policy.'
    end,
    clock_timestamp(),v_policy.id,pw.id,pw.standard_batch_count,pw.direct_labour_route_intensity,
    pw.direct_labour_workload_units,pw.product_workload_share,
    case when pw.monthly_product_base_qty>0 then b.monthly_allocation_base_qty/pw.monthly_product_base_qty end,
    case
      when pw.workload_status not in ('READY','REVIEW_REQUIRED_FOUNDATION','READY_ZERO_MANUFACTURING_LABOUR','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') then pw.workload_status
      when pk.workload_status='BLOCKED' then pk.workload_reason_code
      when pw.workload_status in ('REVIEW_REQUIRED_FOUNDATION','REVIEW_REQUIRED_ZERO_MANUFACTURING_LABOUR') or pk.workload_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_DIRECT_LABOUR_COMPONENT_FOUNDATION'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' and pk.packing_responsibility_code='EXTERNAL_FULLY_PACKED' then 'READY_ZERO_SASV_MANUFACTURING_AND_PACKING_LABOUR'
      when pw.workload_status='READY_ZERO_MANUFACTURING_LABOUR' then 'READY_ZERO_MANUFACTURING_LABOUR_PACKING_ONLY'
      else 'READY'
    end,
    pw.direct_labour_pool_snapshot_id,
    v_mfg_pool,v_pack_pool,
    case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
         then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end,
    coalesce(pk.packing_labour_allocation,0),
    case when b.monthly_allocation_units>0 then
      (case when pw.workload_status in ('READY','REVIEW_REQUIRED_FOUNDATION') and pw.monthly_product_base_qty>0
            then pw.product_direct_labour_allocation*(b.monthly_allocation_base_qty/pw.monthly_product_base_qty) else 0 end)/b.monthly_allocation_units else 0 end,
    coalesce(pk.packing_labour_cost_per_sku_unit,0),
    pk.id,'MANUFACTURING_ROUTE_PLUS_EXPECTED_PACKAGE_UNITS'
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_direct_labour_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  join costing.sku_packing_labour_workload_snapshot pk
    on pk.refresh_run_id=b.refresh_run_id and pk.sku_id=b.sku_id
  left join tmp_dl_product_pack pp on pp.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  if abs((select coalesce(sum(product_direct_labour_allocation),0) from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_mfg_pool)>0.000001 then
    raise exception 'Manufacturing Labour Product allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;
  if abs((select coalesce(sum(packing_labour_allocation),0) from costing.sku_packing_labour_workload_snapshot where refresh_run_id=p_refresh_run_id)-v_pack_pool)>0.000001 then
    raise exception 'Packing Labour allocation does not reconcile to component pool for run %',p_refresh_run_id;
  end if;

  if v_bt then
    insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
    select p_refresh_run_id,'MANUFACTURING_LABOUR',v_mfg_pool,sum(product_direct_labour_allocation),v_mfg_pool-sum(product_direct_labour_allocation),v_eligible_count,v_recipient_count-v_eligible_count,v_mfg_pool/nullif(v_company_mfg_workload,0),'NORMAL_VOLUME_RATE'
      from costing.product_direct_labour_workload_snapshot where refresh_run_id=p_refresh_run_id
    on conflict (refresh_run_id,allocation_pool) do nothing;
  end if;

  return query
  select v_period_start,count(*)::bigint,
    count(*) filter(where s.direct_labour_allocation_status='BLOCKED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='REVIEW_REQUIRED')::bigint,
    count(*) filter(where s.direct_labour_allocation_status='READY')::bigint
  from costing.sku_direct_labour_allocation_snapshot s
  where s.refresh_run_id=p_refresh_run_id;
end;
$function$
;

-- READ-ONLY EXACT LIVE FUNCTION DEFINITION, BASELINE BEFORE JOINT INTEGRATION.
CREATE OR REPLACE FUNCTION costing.rpc_refresh_production_overhead_workload_snapshot(p_period_start date, p_valuation_date date, p_refresh_run_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'costing', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date:=date_trunc('month',p_period_start)::date;
  v_run costing.costing_refresh_run%rowtype;
  v_policy costing.production_overhead_workload_policy%rowtype;
  v_pool_snapshot_id bigint;
  v_pool numeric;
  v_foundation jsonb;
  v_recipient_count integer;
  v_eligible_count integer;
  v_blocked_count integer;
  v_coverage numeric;
  v_company_workload numeric;
  v_allocated_pool numeric;
  v_bt boolean;
  v_rl text;          -- AU-6L equipment-loads approval (null = off)
begin
  if p_period_start is null or p_valuation_date is null or p_refresh_run_id is null then
    raise exception 'period_start, valuation_date and refresh_run_id are required';
  end if;

  select * into v_run
  from costing.costing_refresh_run
  where id=p_refresh_run_id;

  if not found then
    raise exception 'Costing refresh run % not found',p_refresh_run_id;
  end if;

  if v_run.period_start is distinct from v_period_start
     or v_run.valuation_date is distinct from p_valuation_date
     or v_run.valuation_context_source is distinct from 'CAPTURED_AT_REQUEST' then
    raise exception 'Production Overhead snapshot context does not match refresh run %',p_refresh_run_id;
  end if;

  if not (
      v_run.overall_status='SUCCESS'
      or (
        v_run.overall_status='RUNNING'
        and v_run.current_stage_code='03_COST_BUILD_TO_SCHEME'
        and exists (
          select 1
          from costing.costing_refresh_run_stage s
          where s.refresh_run_id=p_refresh_run_id
            and s.stage_code='03_COST_BUILD_TO_SCHEME'
            and s.stage_status='RUNNING'
        )
      )
  ) then
    raise exception 'Production Overhead snapshots require governed Stage 03 RUNNING context or an already-successful exact run';
  end if;

  if exists(select 1 from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id)
     or exists(select 1 from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id) then
    raise exception 'Production Overhead snapshots already exist for refresh run % and are immutable',p_refresh_run_id;
  end if;

  select * into v_policy
  from costing.fn_resolve_production_overhead_workload_policy(p_valuation_date);

  if v_policy.id is null then
    raise exception 'No uniquely resolvable approved Production Overhead policy exists for valuation date %',p_valuation_date;
  end if;

  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5
  select m.approval_reference into v_rl from costing.fn_route_load_scaling_mode(p_valuation_date) m; -- AU-6L

  select p.id,p.total_pool_amount
  into v_pool_snapshot_id,v_pool
  from costing.cost_pool_monthly_snapshot p
  where p.period_start=v_period_start
    and p.valuation_date=p_valuation_date
    and p.refresh_run_id=p_refresh_run_id
    and p.allocation_pool='PRODUCTION_OVERHEAD';

  if v_pool_snapshot_id is null or v_pool is null then
    raise exception 'Production Overhead frozen pool is missing for exact run %',p_refresh_run_id;
  end if;

  -- Reuse the canonical shared exact-run route/batch foundation rather than
  -- resolving and validating Product routes repeatedly inside POH.
  v_foundation := costing.fn_preview_shared_standard_batch_route_foundation(
    v_period_start,p_valuation_date,p_refresh_run_id,null
  );

  create temporary table tmp_po_foundation on commit drop as
  select *
  from jsonb_to_recordset(coalesce(v_foundation->'rows','[]'::jsonb)) as f(
    product_id bigint,
    product_name text,
    product_base_uom text,
    recipient_sku_count integer,
    monthly_product_base_qty numeric,
    monthly_driver_status text,
    actual_source_sku_count integer,
    assumption_source_sku_count integer,
    default_source_sku_count integer,
    sku_quantity_evidence jsonb,
    batch_size_ref_id bigint,
    preferred_batch_size numeric,
    min_batch_size numeric,
    max_batch_size numeric,
    batch_size_effective_from date,
    raw_batch_requirement numeric,
    standard_batch_count bigint,
    route_family_id bigint,
    family_route_id bigint,
    product_route_id bigint,
    effective_route_source text,
    route_validation jsonb,
    effective_step_count integer,
    direct_labour_include_step_count integer,
    direct_labour_supervision_step_count integer,
    direct_labour_excluded_step_count integer,
    production_overhead_include_step_count integer,
    production_overhead_passive_step_count integer,
    production_overhead_excluded_step_count integer,
    step_evidence jsonb,
    foundation_status text,
    foundation_note text
  );

  -- AU-6L: batch charge per product from batch_size_ref (+ RM BOM / unit-mass override).
  create temporary table tmp_po_charge on commit drop as
  select f.product_id, c.solid_kg, c.output_qty, c.output_uom, c.charge_source
    from tmp_po_foundation f
    cross join lateral costing.fn_route_batch_charge(f.product_id, f.preferred_batch_size, f.product_base_uom, p_valuation_date) c
   where v_rl is not null and f.preferred_batch_size > 0;

  if v_rl is not null and exists (
       select 1 from tmp_po_foundation f
       cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
         as e(resource_class_code text, expected_occurrence_count numeric, standard_cycle_count numeric)
       where coalesce(e.expected_occurrence_count,0)*coalesce(e.standard_cycle_count,0) <> 0
         and costing.fn_route_step_loads(e.resource_class_code, 1, 1, 'Kg', p_valuation_date) is null) then
    raise exception 'AU-6L: route step resource class without an effective equipment capacity row (fail-closed)';
  end if;

  create temporary table tmp_po_product on commit drop as
  with sf as (
    select f.product_id,
           count(*)::integer effective_step_count,
           count(*) filter(where e.production_overhead_scope='INCLUDE')::integer included_step_count,
           count(*) filter(where e.production_overhead_scope='PASSIVE')::integer passive_step_count,
           count(*) filter(where e.production_overhead_scope='EXCLUDE_OTHER_POOL')::integer excluded_step_count,
           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) raw_route_factor,
           case when v_rl is null or ch.product_id is null then sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count)
                else sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
                         *costing.fn_au9_g4_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, e.base_step_id, e.override_id, e.activity_id)) end route_factor -- AU-6L
    from tmp_po_foundation f
    cross join lateral jsonb_to_recordset(
      case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
    ) as e(
      effective_step_key text,
      sequence_no numeric,
      activity_id integer,
      cost_centre_id bigint,
      behaviour_code text,
      resource_class_code text,
      expected_occurrence_count numeric,
      standard_cycle_count numeric,
      direct_labour_scope text,
      production_overhead_scope text,
      source_type text,
      base_step_id bigint,
      override_id bigint
    )
    left join costing.production_overhead_scope_factor sc
      on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
    left join costing.production_overhead_behaviour_factor bh
      on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    left join tmp_po_charge ch on ch.product_id=f.product_id
    group by f.product_id, ch.product_id
  )
  select
    f.product_id,
    f.product_name,
    f.product_base_uom,
    f.monthly_product_base_qty,
    f.monthly_driver_status,
    f.route_family_id,
    f.family_route_id,
    f.product_route_id,
    f.effective_route_source,
    f.batch_size_ref_id,
    f.preferred_batch_size,
    sf.effective_step_count,
    sf.included_step_count,
    sf.passive_step_count,
    sf.excluded_step_count,
    sf.route_factor,
    sf.raw_route_factor,
    case when f.preferred_batch_size>0 then f.monthly_product_base_qty/f.preferred_batch_size end monthly_batch_equivalents,
    case when f.preferred_batch_size>0 and f.monthly_product_base_qty>0
         then ceil(f.monthly_product_base_qty/f.preferred_batch_size)::integer end rounded_batch_count,
    case when f.preferred_batch_size>0 and f.monthly_product_base_qty>0 and sf.route_factor is not null
         then (case when v_bt then f.monthly_product_base_qty/f.preferred_batch_size else ceil(f.monthly_product_base_qty/f.preferred_batch_size) end)*sf.route_factor end workload_units, -- AU-5: batch-equivalent (unrounded) when batch-true effective
    case
      when f.family_route_id is null then 'BLOCKED_NO_APPROVED_EFFECTIVE_ROUTE'
      when (sf.route_factor is null or sf.route_factor<=0)
           and f.foundation_status not like 'BLOCKED%'
           and coalesce(sf.effective_step_count,0)>0
           and coalesce(sf.included_step_count,0)=0
           and coalesce(sf.passive_step_count,0)=0
           and coalesce(sf.excluded_step_count,0)=coalesce(sf.effective_step_count,0)
        then 'READY_ZERO_PRODUCTION_OVERHEAD'
      when sf.route_factor is null or sf.route_factor<=0 then 'BLOCKED_NO_POSITIVE_ROUTE_FACTOR'
      when f.batch_size_ref_id is null or f.preferred_batch_size<=0 then 'BLOCKED_NO_ACTIVE_BATCH_SIZE'
      when f.monthly_product_base_qty is null or f.monthly_product_base_qty<=0 then 'BLOCKED_NO_MONTHLY_PRODUCT_BASE_QTY'
      when f.monthly_driver_status='BLOCKED' then 'BLOCKED_MONTHLY_DRIVER'
      when f.monthly_driver_status='REVIEW_REQUIRED' then 'REVIEW_REQUIRED_MONTHLY_DRIVER'
      else 'READY'
    end workload_status
  from tmp_po_foundation f
  left join sf on sf.product_id=f.product_id;

      -- Empty attribution lineage for historical/non-joint runs.
  -- Forward-only policy branch must DROP and rebuild this temp table.
  CREATE TEMP TABLE tmp_joint_po_adjust (product_id bigint, policy_id bigint, old_work numeric, new_work numeric) ON COMMIT DROP;

  -- Joint physical process adjustment, before default-volume cap and pool denominator.
  -- Forward-only: history prior to the approved policy effective date is untouched.
  -- The existing POH calculation omits AU-6L charge rows if v_rl IS NULL.
  -- A joint correction cannot reproduce the original stage workload without them.
  IF v_rl IS NULL AND EXISTS (
      SELECT 1 FROM costing.joint_process_policy jp
      WHERE jp.effective_from <= p_valuation_date
        AND (jp.effective_to IS NULL OR jp.effective_to > p_valuation_date)
  ) THEN RAISE EXCEPTION 'JOINT_PO_REQUIRES_ACTIVE_AU6L_CAPACITY'; END IF;

  IF EXISTS (SELECT 1 FROM costing.joint_process_policy jp
             WHERE jp.effective_from <= p_valuation_date
               AND (jp.effective_to IS NULL OR jp.effective_to > p_valuation_date)) THEN
    DROP TABLE tmp_joint_po_adjust;
    CREATE TEMP TABLE tmp_joint_po_adjust ON COMMIT DROP AS
    WITH pol AS (
      SELECT jp.id,jp.reference_output_qty
      FROM costing.joint_process_policy jp
      WHERE jp.effective_from <= p_valuation_date
        AND (jp.effective_to IS NULL OR jp.effective_to > p_valuation_date)
    ), members AS (
      SELECT p.id policy_id,o.product_id,o.output_qty,p.reference_output_qty,
             f.monthly_product_base_qty,f.preferred_batch_size,
             f.step_evidence
      FROM pol p
      JOIN costing.joint_process_output o ON o.policy_id=p.id
      JOIN tmp_po_foundation f ON f.product_id=o.product_id
    ), joint_b AS (
      SELECT policy_id,max(monthly_product_base_qty/output_qty) b
      FROM members
      GROUP BY policy_id
    ), detail AS (
      SELECT m.policy_id,m.product_id,m.output_qty,m.reference_output_qty,
             m.monthly_product_base_qty,m.preferred_batch_size,j.b,
             st.base_step_id,st.common_cycles,st.continuation_cycles,
             st.continuation_product_id,
             sc.factor*bh.factor*rs.factor*e.expected_occurrence_count AS step_weight,
             costing.fn_price_revision_joint_stage_load(
               e.resource_class_code,ch.solid_kg,ch.output_qty,ch.output_uom,
               p_valuation_date,e.base_step_id,e.override_id,e.activity_id
             ) AS joint_load,
             costing.fn_au9_g4_route_step_loads(
               e.resource_class_code,ch.solid_kg,ch.output_qty,ch.output_uom,
               p_valuation_date,e.base_step_id,e.override_id,e.activity_id
             ) AS original_load,
             e.standard_cycle_count
      FROM members m
      JOIN joint_b j ON j.policy_id=m.policy_id
      JOIN costing.joint_process_stage st ON st.policy_id=m.policy_id
      JOIN tmp_po_charge ch ON ch.product_id=m.product_id
      CROSS JOIN LATERAL jsonb_to_recordset(
        CASE WHEN jsonb_typeof(m.step_evidence)='array'
             THEN m.step_evidence ELSE '[]'::jsonb END
      ) AS e(
        base_step_id bigint,override_id bigint,activity_id integer,
        resource_class_code text,production_overhead_scope text,
        behaviour_code text,expected_occurrence_count numeric,
        standard_cycle_count numeric
      )
      JOIN costing.production_overhead_scope_factor sc
        ON sc.policy_id=v_policy.id AND sc.scope_code=e.production_overhead_scope
      JOIN costing.production_overhead_behaviour_factor bh
        ON bh.policy_id=v_policy.id AND bh.behaviour_code=e.behaviour_code
      JOIN costing.production_overhead_resource_factor rs
        ON rs.policy_id=v_policy.id AND rs.resource_class_code=e.resource_class_code
      WHERE e.base_step_id=st.base_step_id
        AND m.output_qty>0 AND m.preferred_batch_size>0
        AND m.monthly_product_base_qty>0
    ), stage_check AS (
      SELECT policy_id,base_step_id,count(*) n,
             min(step_weight*joint_load) lo,min(step_weight*joint_load)=max(step_weight*joint_load) equal_load
      FROM detail GROUP BY policy_id,base_step_id
    ), per_product AS (
      SELECT d.product_id,d.policy_id,count(*) n,
        sum(d.monthly_product_base_qty/d.preferred_batch_size
            *d.step_weight*d.original_load*d.standard_cycle_count) old_work,
        sum(costing.fn_joint_stage_member_workload(
           d.common_cycles,d.continuation_cycles,d.output_qty,d.reference_output_qty,
           d.product_id=d.continuation_product_id,d.b,c.lo)) new_work
      FROM detail d JOIN stage_check c
        ON c.policy_id=d.policy_id AND c.base_step_id=d.base_step_id
      GROUP BY d.product_id,d.policy_id
    )
    SELECT x.*, (SELECT count(*) FROM costing.joint_process_stage s
                  WHERE s.policy_id=x.policy_id) expected_steps,
           (SELECT count(*) FROM costing.joint_process_output o
                  WHERE o.policy_id=x.policy_id) expected_members,
           (SELECT bool_and(equal_load AND n=2) FROM stage_check s
                  WHERE s.policy_id=x.policy_id) factors_equal
    FROM per_product x;

    IF EXISTS (
      SELECT 1 FROM tmp_joint_po_adjust a JOIN tmp_po_product p
        ON p.product_id=a.product_id
      WHERE NOT coalesce(a.factors_equal,false)
         OR a.n<>a.expected_steps OR a.expected_members<>2
         OR a.expected_steps<>4
         OR a.old_work IS NULL OR a.new_work IS NULL
         OR p.workload_units IS NULL OR p.workload_units < a.old_work
         OR p.workload_status NOT IN ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER')
    ) OR (SELECT count(*) FROM tmp_joint_po_adjust) <>
       (SELECT count(*) FROM costing.joint_process_output o
         JOIN costing.joint_process_policy p ON p.id=o.policy_id
         WHERE p.effective_from<=p_valuation_date
         AND (p.effective_to IS NULL OR p.effective_to>p_valuation_date))
    THEN RAISE EXCEPTION 'JOINT_PO_PRECAP_VALIDATION_FAILED'; END IF;

    UPDATE tmp_po_product p
       SET workload_units=p.workload_units-a.old_work+a.new_work,
           route_factor=(p.workload_units-a.old_work+a.new_work)
             /nullif(p.monthly_batch_equivalents,0)
      FROM tmp_joint_po_adjust a WHERE a.product_id=p.product_id;
  END IF;

    -- AU-6: default-volume cap (default-driven workload <= policy pool_cap_share of eligible workload).
  update tmp_po_product t
     set workload_units = c.new_workload
    from costing.fn_default_volume_cap(
           p_refresh_run_id, p_valuation_date, 'PRODUCTION_OVERHEAD',
           (select jsonb_agg(jsonb_build_object('product_id',x.product_id,'workload',x.workload_units,'base_qty',x.monthly_product_base_qty))
              from tmp_po_product x
             where x.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
               and x.workload_units > 0)) c
   where c.product_id = t.product_id;

  select count(*),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')),
         count(*) filter(where workload_status like 'BLOCKED%'),
         count(*) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD'))::numeric/nullif(count(*),0),
         sum(workload_units) filter(where workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD'))
  into v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product;

  if coalesce(v_eligible_count,0)=0 or coalesce(v_company_workload,0)<=0 then
    raise exception 'Production Overhead allocation requires at least one eligible Product with positive workload';
  end if;

  insert into costing.product_production_overhead_workload_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_id,product_name,product_base_uom,
    route_family_id,family_route_id,product_route_id,effective_route_source,batch_size_ref_id,preferred_batch_size,
    monthly_product_base_qty,monthly_driver_status,monthly_batch_equivalents,rounded_batch_count,effective_step_count,included_step_count,
    passive_step_count,excluded_step_count,route_factor,workload_units,workload_status,workload_reason_code,workload_note,
    recipient_product_count,ready_product_count,blocked_product_count,workload_coverage_ratio,company_ready_workload_units)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,t.product_id,t.product_name,t.product_base_uom,
         t.route_family_id,t.family_route_id,t.product_route_id,t.effective_route_source,t.batch_size_ref_id,t.preferred_batch_size,
         t.monthly_product_base_qty,t.monthly_driver_status,t.monthly_batch_equivalents,t.rounded_batch_count,coalesce(t.effective_step_count,0),
         coalesce(t.included_step_count,0),coalesce(t.passive_step_count,0),coalesce(t.excluded_step_count,0),t.route_factor,t.workload_units,
         t.workload_status,t.workload_status,
         case when t.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route contains effective steps, all explicitly excluded from Production Overhead. Production Overhead is validly zero and non-blocking.'
              when t.workload_status='READY' then 'Production Overhead workload is eligible and ready for the exact-run pool allocation.'
              when t.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Production Overhead workload is eligible using a governed monthly quantity requiring review.'
              else 'Production Overhead workload is individually blocked with zero allocation: '||t.workload_status end,
         v_recipient_count,v_eligible_count,v_blocked_count,v_coverage,v_company_workload
  from tmp_po_product t;

  -- Step lineage comes from the same once-resolved shared foundation.
  insert into costing.product_production_overhead_step_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,product_workload_snapshot_id,product_id,sequence_no,effective_step_key,
    source_type,base_step_id,override_id,production_overhead_scope,scope_factor,behaviour_code,behaviour_factor,
    resource_class_code,resource_factor,expected_occurrence_count,standard_cycle_count,step_factor)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,s.id,s.product_id,e.sequence_no,e.effective_step_key,
         e.source_type,e.base_step_id,e.override_id,e.production_overhead_scope,sc.factor,e.behaviour_code,bh.factor,
         e.resource_class_code,rs.factor,e.expected_occurrence_count,e.standard_cycle_count,
         sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
  from costing.product_production_overhead_workload_snapshot s
  join tmp_po_foundation f on f.product_id=s.product_id
  cross join lateral jsonb_to_recordset(
    case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end
  ) as e(
    effective_step_key text,
    sequence_no numeric,
    activity_id integer,
    cost_centre_id bigint,
    behaviour_code text,
    resource_class_code text,
    expected_occurrence_count numeric,
    standard_cycle_count numeric,
    direct_labour_scope text,
    production_overhead_scope text,
    source_type text,
    base_step_id bigint,
    override_id bigint
  )
  join costing.production_overhead_scope_factor sc
    on sc.policy_id=v_policy.id and sc.scope_code=e.production_overhead_scope
  join costing.production_overhead_behaviour_factor bh
    on bh.policy_id=v_policy.id and bh.behaviour_code=e.behaviour_code
  join costing.production_overhead_resource_factor rs
    on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  -- AU-6L lineage (only when loads are effective).
  if v_rl is not null then
    insert into costing.route_load_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,product_base_uom,preferred_batch_size,
      solid_charge_kg,output_charge,output_charge_uom,charge_source,raw_factor,scaled_factor,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'PRODUCTION_OVERHEAD',t.product_id,t.product_base_uom,t.preferred_batch_size,
           ch.solid_kg,ch.output_qty,ch.output_uom,ch.charge_source,t.raw_route_factor,t.route_factor,v_rl,
           (select jsonb_agg(jsonb_build_object('seq',e.sequence_no,'rc',e.resource_class_code,
                     'loads',costing.fn_au9_g4_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date, e.base_step_id, e.override_id, e.activity_id)) order by e.sequence_no)
              from tmp_po_foundation f
              cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
                as e(sequence_no numeric, resource_class_code text, base_step_id bigint, override_id bigint, activity_id integer)
             where f.product_id=t.product_id)
           || coalesce((select jsonb_build_array(jsonb_build_object(
              'record_type','JOINT_PROCESS_ATTRIBUTION',
              'policy_id',a.policy_id,
              'original_shared_workload',a.old_work,
              'corrected_shared_workload',a.new_work,
              'product_workload_after_joint',t.workload_units,
              'route_factor_after_joint',t.route_factor))
              from tmp_joint_po_adjust a where a.product_id=t.product_id),'[]'::jsonb)
      from tmp_po_product t
      join tmp_po_charge ch on ch.product_id=t.product_id
     where t.raw_route_factor is not null;

    -- AU-9 G4: per-step load provenance and labour/overhead consistency (only when plant-aware loads are on).
    if costing.fn_au9_g4_load_mode(p_valuation_date) is not null then
      perform costing.fn_au9_g4_capture_provenance(p_refresh_run_id, v_period_start, p_valuation_date, 'PRODUCTION_OVERHEAD',
                t.product_id, ch.solid_kg, ch.output_qty, ch.output_uom, f.step_evidence)
         from tmp_po_product t
         join tmp_po_charge ch on ch.product_id = t.product_id
         join tmp_po_foundation f on f.product_id = t.product_id
        where t.raw_route_factor is not null;
      if exists (select 1 from costing.route_step_load_provenance_snapshot d
                   join costing.route_step_load_provenance_snapshot p on p.refresh_run_id = d.refresh_run_id and p.product_id = d.product_id
                    and p.effective_step_key = d.effective_step_key
                  where d.refresh_run_id = p_refresh_run_id and d.allocation_pool = 'MANUFACTURING_LABOUR' and p.allocation_pool = 'PRODUCTION_OVERHEAD'
                    and (d.loads is distinct from p.loads or d.resolution_basis is distinct from p.resolution_basis)) then
        raise exception 'AU-9 G4: Manufacturing Labour and Production Overhead resolved the same route step differently in run %', p_refresh_run_id;
      end if;
    end if;

    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
    if exists (select 1 from costing.route_load_scaling_snapshot d
                join costing.route_load_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
               where d.refresh_run_id=p_refresh_run_id and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD'
                 and (d.preferred_batch_size is distinct from p.preferred_batch_size or d.solid_charge_kg is distinct from p.solid_charge_kg
                      or d.output_charge is distinct from p.output_charge)) then
      raise exception 'AU-6L: Manufacturing Labour and Production Overhead used different batch charges in run %',p_refresh_run_id;
    end if;
  end if;

  insert into costing.sku_production_overhead_allocation_snapshot(
    period_start,valuation_date,refresh_run_id,policy_id,pool_snapshot_id,product_workload_snapshot_id,sku_id,product_id,product_name,
    pack_size,pack_uom,sku_base_qty_per_unit,monthly_sku_base_qty,monthly_product_base_qty,sku_within_product_share,
    production_overhead_pool_amount,product_workload_share,product_production_overhead_allocation,
    production_overhead_cost_per_base_uom,production_overhead_cost_per_sku,allocation_status,allocation_reason_code,allocation_note)
  select v_period_start,p_valuation_date,p_refresh_run_id,v_policy.id,v_pool_snapshot_id,pw.id,b.sku_id,b.product_id,b.product_name,
         b.pack_size,b.pack_uom,b.sku_base_qty_per_unit,b.monthly_allocation_base_qty,pw.monthly_product_base_qty,
         case when pw.monthly_product_base_qty>0 then b.monthly_allocation_base_qty/pw.monthly_product_base_qty end,
         v_pool,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') then pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') then v_pool*pw.workload_units/v_company_workload else 0 end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') and pw.monthly_product_base_qty>0
              then (v_pool*pw.workload_units/v_company_workload)/pw.monthly_product_base_qty end,
         case when pw.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD') and pw.monthly_product_base_qty>0
              then ((v_pool*pw.workload_units/v_company_workload)/pw.monthly_product_base_qty)*b.sku_base_qty_per_unit end,
         case when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'REVIEW_REQUIRED'
              when pw.workload_status in ('READY','READY_ZERO_PRODUCTION_OVERHEAD') then 'READY' else 'BLOCKED' end,
         pw.workload_status,
         case when pw.workload_status='READY_ZERO_PRODUCTION_OVERHEAD' then 'The governed route is explicitly outside the Production Overhead pool; this SKU receives valid zero Production Overhead while the full pool remains allocated across positive-workload eligible Products.'
              when pw.workload_status='READY' then 'Full Production Overhead pool is allocated across Products eligible in this exact run.'
              when pw.workload_status='REVIEW_REQUIRED_MONTHLY_DRIVER' then 'Full Production Overhead pool is allocated across current eligible Products; this Product uses a monthly quantity requiring review.'
              else 'Product is individually blocked and receives zero Production Overhead in this exact run. A later governed run may redistribute the pool after the blocker is resolved.' end
  from costing.sku_sales_allocation_basis_snapshot b
  join costing.product_production_overhead_workload_snapshot pw
    on pw.refresh_run_id=b.refresh_run_id and pw.product_id=b.product_id
  where b.period_start=v_period_start and b.valuation_date=p_valuation_date and b.refresh_run_id=p_refresh_run_id;

  select coalesce(sum(x.product_allocation),0)
    + coalesce((select sum(v_pool*w.workload_units/nullif(w.company_ready_workload_units,0))
                from costing.product_production_overhead_workload_snapshot w
                where w.refresh_run_id=p_refresh_run_id
                  and w.workload_status in ('READY','REVIEW_REQUIRED_MONTHLY_DRIVER','READY_ZERO_PRODUCTION_OVERHEAD')
                  and not exists (select 1 from costing.sku_sales_allocation_basis_snapshot b where b.refresh_run_id=p_refresh_run_id and b.product_id=w.product_id)),0)
    into v_allocated_pool
    from (
      select product_id,max(product_production_overhead_allocation) product_allocation
      from costing.sku_production_overhead_allocation_snapshot
      where refresh_run_id=p_refresh_run_id
      group by product_id
    ) x;

  if abs(coalesce(v_pool,0)-coalesce(v_allocated_pool,0)) > 0.000001 then
    raise exception 'Production Overhead exact-run allocation does not reconcile to frozen pool for refresh run %: pool %, allocated %',
      p_refresh_run_id,v_pool,v_allocated_pool;
  end if;

  if exists (
    select 1
    from costing.sku_production_overhead_allocation_snapshot s
    where s.refresh_run_id=p_refresh_run_id
      and (s.pool_snapshot_id is distinct from v_pool_snapshot_id
           or s.production_overhead_pool_amount is distinct from v_pool)
  ) then
    raise exception 'Production Overhead SKU snapshot pool lineage mismatch for refresh run %',p_refresh_run_id;
  end if;

  if v_bt then
    insert into costing.batch_true_absorption_variance(refresh_run_id,allocation_pool,pool_amount,absorbed_at_standard,variance_amount,products_batch_true,products_current_method,rate_used,rate_basis)
    values(p_refresh_run_id,'PRODUCTION_OVERHEAD',v_pool,v_allocated_pool,v_pool-v_allocated_pool,v_eligible_count,v_recipient_count-v_eligible_count,v_pool/nullif(v_company_workload,0),'NORMAL_VOLUME_RATE')
    on conflict (refresh_run_id,allocation_pool) do nothing;
  end if;

  return jsonb_build_object(
    'period_start',v_period_start,'batch_true',v_bt,'route_load_scaling',v_rl,'plant_aware_load_switch_id',costing.fn_au9_g4_load_mode(p_valuation_date),'valuation_date',p_valuation_date,'refresh_run_id',p_refresh_run_id,'policy_id',v_policy.id,
    'pool_snapshot_id',v_pool_snapshot_id,
    'allocation_mode','FULL_POOL_TO_CURRENT_ELIGIBLE_PRODUCTS','recipient_product_count',v_recipient_count,
    'eligible_product_count',v_eligible_count,'blocked_product_count',v_blocked_count,'eligible_coverage_ratio',v_coverage,
    'company_eligible_workload_units',v_company_workload,'pool_amount',v_pool,'allocated_pool_amount',v_allocated_pool,
    'unallocated_pool_amount',v_pool-v_allocated_pool,'monetary_allocation_enabled',true,
    'product_snapshot_count',(select count(*) from costing.product_production_overhead_workload_snapshot where refresh_run_id=p_refresh_run_id),
    'step_snapshot_count',(select count(*) from costing.product_production_overhead_step_snapshot where refresh_run_id=p_refresh_run_id),
    'sku_snapshot_count',(select count(*) from costing.sku_production_overhead_allocation_snapshot where refresh_run_id=p_refresh_run_id)
  );
end;
$function$
;
