\pset format unaligned
\pset tuples_only on
select 'run'||r||'_fp='||md5(costing.fn_compute_run_fingerprint(r)::text)||' tables='||(select count(*) from jsonb_object_keys(costing.fn_compute_run_fingerprint(r))) from (values (122),(128)) t(r);
select 'existing_fn_view_md5='||md5(string_agg(k||v,'|' order by k)) from (
 select p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('costing','public') and p.prokind in ('f','p') and p.proname not like 'fn_au9%'
 union all select c.oid::regclass::text, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('costing','public') and c.relkind='v' and c.relname<>'v_plant_capacity_readiness') x;
select 'route_capacity_md5='||md5(string_agg(to_jsonb(c)::text,'|' order by id)) from costing.route_equipment_load_capacity c;
select 'plant_master_md5='||md5(string_agg(to_jsonb(p)::text,'|' order by id)) from public.plant_machinery p;
