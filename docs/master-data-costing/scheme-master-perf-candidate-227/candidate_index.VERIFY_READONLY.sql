-- Read-only pre/post checks (no DDL, no EXPLAIN ANALYZE).
select md5(pg_get_viewdef('public.v_costing_scheme_master_register'::regclass,true)) as view_md5;          -- expect 8fdc0306bd2f1efbe0638c7c13ba4dda before AND after
select c.reloptions, c.relacl::text from pg_class c where c.oid='public.v_costing_scheme_master_register'::regclass; -- unchanged
select indexname, indexdef from pg_indexes where schemaname='costing' and tablename='sku_scheme_viability_snapshot' order by 1;
select pg_size_pretty(pg_relation_size('costing.sku_scheme_viability_snapshot')) heap, n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze
  from pg_stat_user_tables where schemaname='costing' and relname='sku_scheme_viability_snapshot';
select relallvisible, relpages from pg_class where oid='costing.sku_scheme_viability_snapshot'::regclass;       -- visibility-map coverage
explain (costs off) select * from public.v_costing_scheme_master_register order by scheme_name asc limit 1000;  -- after: expect Index Only Scan using the new index
