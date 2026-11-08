-- Scheme Master register migration (issue #211 B / PR #213): PRE-APPLY verification (HISTORICAL: the migration is already APPLIED; after the apply P1 is expected to FAIL by design, use post_apply_verification.sql). READ-ONLY (begin read only ... rollback). NOT run by the author.
-- Run immediately before applying supabase/migrations/20261108082334_costing_scheme_master_register_viability_lateral.sql. SAVE the output: block P2 is the "before" snapshot
-- that post_apply_verification.sql must reproduce. Every expectation below must hold; if one does not, STOP (the migration's own precondition would also refuse).

begin read only;
-- P1. Exact pre-change definition. expect: viewdef_md5 = a9f6a128427a704e9bea97fc01e7b5f3, options_exact = true, columns = 34, viability_references = 3, gate_present = true
select md5(pg_get_viewdef(c.oid, true)) as viewdef_md5,
       md5(pg_get_viewdef(c.oid, true)) = 'a9f6a128427a704e9bea97fc01e7b5f3' as fingerprint_matches,
       c.reloptions is not distinct from array['security_invoker=true']::text[] as options_exact,
       (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
       (select count(*) from regexp_matches(pg_get_viewdef(c.oid, true), 'sku_scheme_viability_snapshot', 'g')) as viability_references,
       pg_get_viewdef(c.oid, true) ~ 'fn_costing_view_allowed' as gate_present
  from pg_class c where c.oid = 'public.v_costing_scheme_master_register'::regclass;

-- P2. "Before" snapshot to keep: owner, ACL, reloptions, ordered column names and types, per-role SELECT privilege, dependants.
select pg_get_userbyid(c.relowner) as owner, c.relacl::text as acl, c.reloptions,
       (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns_and_types
  from pg_class c where c.oid = 'public.v_costing_scheme_master_register'::regclass;
select r.rolname, has_table_privilege(r.rolname, 'public.v_costing_scheme_master_register', 'SELECT') as can_select from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') order by 1;
select distinct coalesce(c.relname, p.proname) as dependant from pg_depend d left join pg_rewrite rw on rw.oid = d.objid and d.classid = 'pg_rewrite'::regclass
  left join pg_class c on c.oid = rw.ev_class left join pg_proc p on p.oid = d.objid and d.classid = 'pg_proc'::regclass
 where d.refobjid = 'public.v_costing_scheme_master_register'::regclass and d.deptype = 'n';

-- P3. "Before" values: the three columns the migration changes, next to an independent recomputation from the base table. expect: all three *_ok = true, 7 rows.
select v.scheme_id, v.viability_snapshot_count, v.viability_snapshot_period_count, v.latest_viability_snapshot_period,
       v.viability_snapshot_count = coalesce(t.n, 0) as count_ok, v.viability_snapshot_period_count = coalesce(t.periods, 0) as periods_ok,
       v.latest_viability_snapshot_period is not distinct from t.latest as latest_ok
  from public.v_costing_scheme_master_register v
  left join (select scheme_id, count(*) n, count(distinct period_start) periods, max(period_start) latest from costing.sku_scheme_viability_snapshot group by scheme_id) t on t.scheme_id = v.scheme_id
 order by v.scheme_id;

-- P4. "Before" plan and timing (warm; run twice). Reference (issue #211): 231.433 ms, 206,906 shared hits.
set local statement_timeout = '6s';
explain (analyze, buffers, timing off) select * from public.v_costing_scheme_master_register;
rollback;
