-- Read-only: recompute run-128 load factors from the run-128 step snapshots (Σ step factor × loads) via :FN at two valuation dates
with s as (select * from costing.route_load_scaling_snapshot where refresh_run_id=128),
poh as (select st.product_id, st.effective_step_key, st.base_step_id, st.override_id, st.resource_class_code, st.step_factor f,
               coalesce(o.activity_id, b.activity_id) activity_id
          from costing.product_production_overhead_step_snapshot st
          left join costing.product_process_route_override o on o.id=st.override_id
          left join costing.production_route_family_route_step b on b.id=st.base_step_id
         where st.refresh_run_id=128),
dl as (select d.product_id, d.effective_step_key, p.base_step_id, p.override_id, d.resource_class_code, d.step_labour_factor f, d.activity_id
         from costing.product_direct_labour_step_snapshot d
         left join poh p on p.product_id=d.product_id and p.effective_step_key=d.effective_step_key
        where d.refresh_run_id=128),
e as (select 'PRODUCTION_OVERHEAD' pool, * from poh union all select 'MANUFACTURING_LABOUR', * from dl),
r as (select v.d, s.allocation_pool, s.product_id, s.scaled_factor,
             sum(e.f * costing.fn_route_step_loads(e.resource_class_code, s.solid_charge_kg, s.output_charge, s.output_charge_uom, v.d)) f
        from s join e on e.pool=s.allocation_pool and e.product_id=s.product_id
        cross join (values (date '2026-10-16'),(date '2026-11-30')) v(d)
       group by 1,2,3,4)
select d, count(*) n, count(*) filter (where abs(f-scaled_factor)>1e-9) mismatches,
       md5(string_agg(allocation_pool||product_id||':'||round(f,9),'|' order by allocation_pool,product_id)) md5
  from r group by d order by d
