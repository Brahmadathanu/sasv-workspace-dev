def rep(s,a,b,cnt=1):
    assert s.count(a)==cnt,(a[:80],s.count(a)); return s.replace(a,b)
FIX="""(case when jsonb_typeof(%s)='array' then %s else '[]'::jsonb end)"""
# ---------------- POH ----------------
s=open('live_rpc_refresh_production_overhead_workload_snapshot.sql').read()
s=rep(s,"  v_bt boolean;\nbegin","  v_bt boolean;\n  v_rl text;          -- AU-6L equipment-loads approval (null = off)\nbegin")
s=rep(s,"  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5\n",
"  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5\n  select m.approval_reference into v_rl from costing.fn_route_load_scaling_mode(p_valuation_date) m; -- AU-6L\n")
s=rep(s,"  create temporary table tmp_po_product on commit drop as\n",
"""  -- AU-6L: batch charge per product from batch_size_ref (+ RM BOM / unit-mass override).
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
""")
s=rep(s,"           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor\n    from tmp_po_foundation f\n",
"""           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) raw_route_factor,
           case when v_rl is null or ch.product_id is null then sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count)
                else sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
                         *costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)) end route_factor -- AU-6L
    from tmp_po_foundation f
""")
s=rep(s,"""    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    group by f.product_id
""","""    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    left join tmp_po_charge ch on ch.product_id=f.product_id
    group by f.product_id, ch.product_id
""")
s=rep(s,"    sf.route_factor,\n    case when f.preferred_batch_size>0 then","    sf.route_factor,\n    sf.raw_route_factor,\n    case when f.preferred_batch_size>0 then")
s=rep(s,"  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;\n",
"""  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  -- AU-6L lineage (only when loads are effective).
  if v_rl is not null then
    insert into costing.route_load_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,product_base_uom,preferred_batch_size,
      solid_charge_kg,output_charge,output_charge_uom,charge_source,raw_factor,scaled_factor,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'PRODUCTION_OVERHEAD',t.product_id,t.product_base_uom,t.preferred_batch_size,
           ch.solid_kg,ch.output_qty,ch.output_uom,ch.charge_source,t.raw_route_factor,t.route_factor,v_rl,
           (select jsonb_agg(jsonb_build_object('seq',e.sequence_no,'rc',e.resource_class_code,
                     'loads',costing.fn_route_step_loads(e.resource_class_code, ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)) order by e.sequence_no)
              from tmp_po_foundation f
              cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
                as e(sequence_no numeric, resource_class_code text)
             where f.product_id=t.product_id)
      from tmp_po_product t
      join tmp_po_charge ch on ch.product_id=t.product_id
     where t.raw_route_factor is not null;

    -- Manufacturing Labour (written earlier in the chain) must have used the same batch charge per product.
    if exists (select 1 from costing.route_load_scaling_snapshot d
                join costing.route_load_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
               where d.refresh_run_id=p_refresh_run_id and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD'
                 and (d.preferred_batch_size is distinct from p.preferred_batch_size or d.solid_charge_kg is distinct from p.solid_charge_kg
                      or d.output_charge is distinct from p.output_charge)) then
      raise exception 'AU-6L: Manufacturing Labour and Production Overhead used different batch charges in run %',p_refresh_run_id;
    end if;
  end if;
""")
s=rep(s,"'period_start',v_period_start,'batch_true',v_bt,","'period_start',v_period_start,'batch_true',v_bt,'route_load_scaling',v_rl,")
open('new_poh.sql','w').write(s)
# ---------------- DL ----------------
s=open('live_rpc_refresh_sku_direct_labour_component_split_snapshot.sql').read()
s=rep(s,"  v_bt boolean;\nbegin","  v_bt boolean;\n  v_rl text;          -- AU-6L equipment-loads approval (null = off)\nbegin")
s=rep(s,"""       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;
  end if;
""","""       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;

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
                 *costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date)) fs,
             jsonb_agg(jsonb_build_object('seq',nullif(e->>'sequence_no','')::numeric,'rc',e->>'resource_class_code',
                       'loads',costing.fn_route_step_loads(e->>'resource_class_code', ch.solid_kg, ch.output_qty, ch.output_uom, p_valuation_date))
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
""")
s=rep(s,"""  insert into costing.product_direct_labour_step_snapshot(""","""  if v_rl is not null then -- AU-6L lineage
    insert into costing.route_load_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,product_base_uom,preferred_batch_size,
      solid_charge_kg,output_charge,output_charge_uom,charge_source,raw_factor,scaled_factor,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'MANUFACTURING_LABOUR',s.product_id,s.product_base_uom,s.bs,
           s.solid_kg,s.output_qty,s.output_uom,s.charge_source,s.raw_intensity,case when s.f>0 then s.raw_intensity*s.fs/s.f else s.raw_intensity end,v_rl,s.step_detail
      from tmp_dl_scale s;
  end if;

  insert into costing.product_direct_labour_step_snapshot(""")
open('new_dl.sql','w').write(s)
print('ok')
