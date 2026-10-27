-- CI-045 read-only verification (run after apply). Expect: 5 triggers incl. the 2 AU2 ones; 56/56 scoped tables guarded.
select tgname, pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid = 'costing.route_step_load_provenance_snapshot'::regclass and not tgisinternal order by 1;
select count(*) filter (where exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'trg_au2_designated_run_guard')) guarded,
       count(*) scoped
  from pg_class c join pg_attribute a on a.attrelid = c.oid and a.attname = 'refresh_run_id' and not a.attisdropped
 where c.relnamespace = 'costing'::regnamespace and c.relkind = 'r' and c.relname like '%snapshot%';
select refresh_run_id, count(*) from costing.route_step_load_provenance_snapshot where refresh_run_id in (119,122,143) group by 1;  -- expect 0 rows
