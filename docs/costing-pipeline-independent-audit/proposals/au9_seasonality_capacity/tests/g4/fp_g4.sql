\pset format unaligned
\pset tuples_only on
select 'run'||r||'_fp='||md5(costing.fn_compute_run_fingerprint(r)::text) from (values (122),(128)) t(r);
select 'fn_view_excl_g4_and_rpcs='||md5(string_agg(k||v,'|' order by k)) from (
 select p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('costing','public') and p.prokind in ('f','p') and p.proname not like 'fn_au9%' and p.proname not like 'local_%' and p.proname not like 'rpc_refresh%'
 union all select c.oid::regclass::text, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind='v') x;
select 'capacity_master_md5='||md5((select string_agg(to_jsonb(p)::text,'|' order by id) from costing.plant_capacity_profile p)||(select string_agg(to_jsonb(f)::text,'|' order by id) from costing.capacity_fallback_policy f)||(select string_agg(to_jsonb(c)::text,'|' order by id) from costing.route_equipment_load_capacity c));
select 'snap128_md5='||md5((select string_agg(to_jsonb(s)::text,'|' order by id) from costing.route_load_scaling_snapshot s)||(select string_agg(to_jsonb(s)::text,'|' order by id) from costing.sku_cost_snapshot s));
