\pset format unaligned
\pset tuples_only on
with s as (select * from costing.route_load_scaling_snapshot where refresh_run_id=128),
st as (select * from costing.route_step_factor_snapshot where refresh_run_id=128),
r as (select s.allocation_pool, s.product_id, s.scaled_factor,
        sum(st.step_factor*coalesce(costing.fn_route_step_loads(st.resource_class_code, s.solid_charge_kg, s.output_charge, s.output_charge_uom, :'vd'::date),1)) f
      from s join st on st.product_id=s.product_id and st.allocation_pool=s.allocation_pool
      group by 1,2,3)
select 'replay_vd='||:'vd'||' rows='||count(*)||' mismatches_vs_run128='||count(*) filter (where abs(f-scaled_factor)>1e-9)||' md5='||md5(string_agg(allocation_pool||product_id||':'||round(f,9),'|' order by allocation_pool,product_id)) from r;
