\pset format unaligned
\pset tuples_only on
\echo T1 switch OFF: wrapper loads vs run 128 (all 898 load factors)
select 'T1 vd='||d||' rows='||count(*)||' mismatches='||count(*) filter (where abs(factor-legacy)>1e-9)
       ||' md5='||md5(string_agg(allocation_pool||product_id||':'||round(factor,9),'|' order by allocation_pool,product_id))
  from (values (date '2026-10-16'),(date '2026-11-30')) v(d), costing.local_g4_factors(d) group by d order by d;
