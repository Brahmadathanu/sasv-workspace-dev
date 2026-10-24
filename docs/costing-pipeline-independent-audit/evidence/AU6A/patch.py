def rep(s,a,b,cnt=1):
    assert s.count(a)==cnt,(a[:80],s.count(a)); return s.replace(a,b)
# ---------------- POH ----------------
s=open('live_rpc_refresh_production_overhead_workload_snapshot.sql').read()
s=rep(s,"  v_bt boolean;\nbegin","  v_bt boolean;\n  v_rs text;          -- AU-6A route batch scaling mode (null = off)\n  v_rs_appr text;\nbegin")
s=rep(s,"  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5\n",
"  v_bt := costing.fn_batch_true_effective(p_valuation_date); -- AU-5\n  select m.scaling_mode, m.approval_reference into v_rs, v_rs_appr from costing.fn_route_batch_scaling_mode(p_valuation_date) m; -- AU-6A\n")
s=rep(s,"  create temporary table tmp_po_product on commit drop as\n",
"""  -- AU-6A: route-family reference batch = median batch_size_ref of the family within the same base UOM.
  create temporary table tmp_po_ref on commit drop as
  select f.route_family_id, f.product_base_uom,
         (percentile_cont(0.5) within group (order by f.preferred_batch_size))::numeric ref_bs, count(*)::integer n
    from tmp_po_foundation f
   where v_rs is not null and f.route_family_id is not null and f.preferred_batch_size > 0
   group by f.route_family_id, f.product_base_uom;

  if v_rs is not null and exists (
       select 1 from tmp_po_foundation f
       cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
         as e(resource_class_code text, expected_occurrence_count numeric, standard_cycle_count numeric)
       where coalesce(e.expected_occurrence_count,0)*coalesce(e.standard_cycle_count,0) <> 0
         and not exists (select 1 from costing.route_step_scale_exponent x where x.resource_class_code = e.resource_class_code)) then
    raise exception 'AU-6A: route step resource class without an approved scale exponent (fail-closed)';
  end if;

  create temporary table tmp_po_product on commit drop as
""")
s=rep(s,"           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) route_factor\n    from tmp_po_foundation f\n",
"""           sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count) raw_route_factor,
           case when v_rs is null then sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count)
                else sum(sc.factor*bh.factor*rs.factor*e.expected_occurrence_count*e.standard_cycle_count
                         *costing.fn_route_batch_scale(f.preferred_batch_size, pr.ref_bs, ex.exponent)) end route_factor -- AU-6A
    from tmp_po_foundation f
""")
s=rep(s,"""    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    group by f.product_id
""","""    left join costing.production_overhead_resource_factor rs
      on rs.policy_id=v_policy.id and rs.resource_class_code=e.resource_class_code
    left join tmp_po_ref pr on pr.route_family_id=f.route_family_id and pr.product_base_uom=f.product_base_uom
    left join costing.route_step_scale_exponent ex on v_rs is not null and ex.resource_class_code=e.resource_class_code
    group by f.product_id
""")
s=rep(s,"    sf.route_factor,\n    case when f.preferred_batch_size>0 then","    sf.route_factor,\n    sf.raw_route_factor,\n    case when f.preferred_batch_size>0 then")
# lineage after step snapshot insert
s=rep(s,"  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;\n",
"""  where s.refresh_run_id=p_refresh_run_id and s.family_route_id is not null;

  -- AU-6A lineage (only when scaling is effective).
  if v_rs is not null then
    insert into costing.route_batch_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,route_family_id,product_base_uom,
      preferred_batch_size,reference_batch_size,family_product_count,raw_factor,scaled_factor,scaling_mode,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'PRODUCTION_OVERHEAD',t.product_id,t.route_family_id,t.product_base_uom,
           t.preferred_batch_size,pr.ref_bs,pr.n,t.raw_route_factor,t.route_factor,v_rs,v_rs_appr,
           (select jsonb_agg(jsonb_build_object('rc',e.resource_class_code,'b',ex.exponent,
                     'scale',costing.fn_route_batch_scale(t.preferred_batch_size, pr.ref_bs, ex.exponent)) order by e.sequence_no)
              from tmp_po_foundation f
              cross join lateral jsonb_to_recordset(case when jsonb_typeof(f.step_evidence)='array' then f.step_evidence else '[]'::jsonb end)
                as e(sequence_no numeric, resource_class_code text)
              left join costing.route_step_scale_exponent ex on ex.resource_class_code=e.resource_class_code
             where f.product_id=t.product_id)
      from tmp_po_product t
      left join tmp_po_ref pr on pr.route_family_id=t.route_family_id and pr.product_base_uom=t.product_base_uom
     where t.raw_route_factor is not null;

    -- Manufacturing Labour (written earlier in the chain) must have used the same reference batch per product.
    if exists (select 1 from costing.route_batch_scaling_snapshot d
                join costing.route_batch_scaling_snapshot p on p.refresh_run_id=d.refresh_run_id and p.product_id=d.product_id
               where d.refresh_run_id=p_refresh_run_id and d.allocation_pool='MANUFACTURING_LABOUR' and p.allocation_pool='PRODUCTION_OVERHEAD'
                 and (d.reference_batch_size is distinct from p.reference_batch_size or d.preferred_batch_size is distinct from p.preferred_batch_size)) then
      raise exception 'AU-6A: Manufacturing Labour and Production Overhead used different reference batches in run %',p_refresh_run_id;
    end if;
  end if;
""")
s=rep(s,"'period_start',v_period_start,'batch_true',v_bt,","'period_start',v_period_start,'batch_true',v_bt,'route_batch_scaling',v_rs,")
open('new_poh.sql','w').write(s)
# ---------------- DL ----------------
s=open('live_rpc_refresh_sku_direct_labour_component_split_snapshot.sql').read()
s=rep(s,"  v_bt boolean;\nbegin","  v_bt boolean;\n  v_rs text;          -- AU-6A route batch scaling mode (null = off)\n  v_rs_appr text;\nbegin")
s=rep(s,"""       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;
  end if;
""","""       and coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0;

    -- AU-6A: scale each labour step by (batch / route-family median batch)^exponent(resource class); intensity re-stated, workload on unrounded batch equivalents.
    select m.scaling_mode, m.approval_reference into v_rs, v_rs_appr from costing.fn_route_batch_scaling_mode(p_valuation_date) m;
    if v_rs is not null then
      create temporary table tmp_dl_bs on commit drop as
      select distinct on (b.product_id) b.product_id,b.preferred_batch_size
        from public.production_batch_size_ref b
       where b.effective_from<=p_valuation_date and (b.effective_to is null or b.effective_to>=p_valuation_date)
       order by b.product_id,b.effective_from desc,b.id desc;

      create temporary table tmp_dl_ref on commit drop as
      select t.route_family_id, t.product_base_uom,
             (percentile_cont(0.5) within group (order by br.preferred_batch_size))::numeric ref_bs, count(*)::integer n
        from tmp_dl_product t join tmp_dl_bs br on br.product_id=t.product_id
       where t.route_family_id is not null and br.preferred_batch_size>0
       group by t.route_family_id, t.product_base_uom;

      if exists (select 1 from tmp_dl_product t
                 cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
                 where coalesce(nullif(e->>'step_labour_factor','')::numeric,0) <> 0
                   and not exists (select 1 from costing.route_step_scale_exponent x where x.resource_class_code = e->>'resource_class_code')) then
        raise exception 'AU-6A: labour step resource class without an approved scale exponent (fail-closed)';
      end if;

      create temporary table tmp_dl_scale on commit drop as
      select t.product_id, t.route_family_id, t.product_base_uom, br.preferred_batch_size bs, r.ref_bs, r.n,
             t.direct_labour_route_intensity raw_intensity,
             sum(nullif(e->>'step_labour_factor','')::numeric) f,
             sum(nullif(e->>'step_labour_factor','')::numeric*costing.fn_route_batch_scale(br.preferred_batch_size, r.ref_bs, ex.exponent)) fs,
             jsonb_agg(jsonb_build_object('rc',e->>'resource_class_code','b',ex.exponent,
                       'scale',costing.fn_route_batch_scale(br.preferred_batch_size, r.ref_bs, ex.exponent))
                       order by nullif(e->>'sequence_no','')::numeric) step_detail
        from tmp_dl_product t
        join tmp_dl_bs br on br.product_id=t.product_id and br.preferred_batch_size>0
        left join tmp_dl_ref r on r.route_family_id=t.route_family_id and r.product_base_uom=t.product_base_uom
        cross join lateral jsonb_array_elements(case when jsonb_typeof(t.labour_step_evidence)='array' then t.labour_step_evidence else '[]'::jsonb end) e
        left join costing.route_step_scale_exponent ex on ex.resource_class_code=e->>'resource_class_code'
       where coalesce(t.monthly_product_base_qty,0)>0 and coalesce(t.direct_labour_workload_units,0)>0
       group by t.product_id, t.route_family_id, t.product_base_uom, br.preferred_batch_size, r.ref_bs, r.n, t.direct_labour_route_intensity;

      update tmp_dl_product t
         set direct_labour_route_intensity = t.direct_labour_route_intensity * s.fs / s.f,
             direct_labour_workload_units  = (t.direct_labour_route_intensity * s.fs / s.f) * t.monthly_product_base_qty / s.bs
        from tmp_dl_scale s
       where s.product_id=t.product_id and s.f > 0;
    end if;
  end if;
""")
s=rep(s,"""  insert into costing.product_direct_labour_step_snapshot(""","""  if v_rs is not null then -- AU-6A lineage
    insert into costing.route_batch_scaling_snapshot(period_start,valuation_date,refresh_run_id,allocation_pool,product_id,route_family_id,product_base_uom,
      preferred_batch_size,reference_batch_size,family_product_count,raw_factor,scaled_factor,scaling_mode,approval_reference,step_detail)
    select v_period_start,p_valuation_date,p_refresh_run_id,'MANUFACTURING_LABOUR',s.product_id,s.route_family_id,s.product_base_uom,
           s.bs,s.ref_bs,s.n,s.raw_intensity,case when s.f>0 then s.raw_intensity*s.fs/s.f else s.raw_intensity end,v_rs,v_rs_appr,s.step_detail
      from tmp_dl_scale s;
  end if;

  insert into costing.product_direct_labour_step_snapshot(""")
open('new_dl.sql','w').write(s)
print('ok')
