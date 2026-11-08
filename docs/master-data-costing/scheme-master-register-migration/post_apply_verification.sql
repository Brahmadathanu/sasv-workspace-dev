-- Scheme Master register migration (issue #211 B / PR #213): POST-APPLY verification. READ-ONLY (begin read only ... rollback). NOT run by the author.
-- HISTORICAL/RE-RUNNABLE: the migration was APPLIED on 8 Nov 2026 (live version 20261108082334); this file is safe to re-run read-only at any time to re-verify the live view.
-- Run right after the owner-approved apply. Compare with the "before" snapshot saved from pre_apply_verification.sql (block P2). If any expectation fails: run the rollback
-- (supabase/rollback-evidence/20261108082334_costing_scheme_master_register_viability_lateral_pre.sql) and re-review.

begin read only;
-- Q1. Definition changed exactly as intended. expect: viewdef_md5 = 8fdc0306bd2f1efbe0638c7c13ba4dda (fingerprint_post_apply = true), fingerprint_changed = true (no longer a9f6...), options_exact = true, columns = 34, viability_references = 1, lateral = true, gate_present = true
select md5(pg_get_viewdef(c.oid, true)) as viewdef_md5, md5(pg_get_viewdef(c.oid, true)) = '8fdc0306bd2f1efbe0638c7c13ba4dda' as fingerprint_post_apply, md5(pg_get_viewdef(c.oid, true)) <> 'a9f6a128427a704e9bea97fc01e7b5f3' as fingerprint_changed,
       c.reloptions is not distinct from array['security_invoker=true']::text[] as options_exact,
       (select count(*) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
       (select count(*) from regexp_matches(pg_get_viewdef(c.oid, true), 'sku_scheme_viability_snapshot', 'g')) as viability_references,
       pg_get_viewdef(c.oid, true) ~* 'LATERAL' as lateral, pg_get_viewdef(c.oid, true) ~ 'fn_costing_view_allowed' as gate_present
  from pg_class c where c.oid = 'public.v_costing_scheme_master_register'::regclass;

-- Q2. "After" snapshot: must be IDENTICAL to P2 (owner, ACL, reloptions, ordered column names and types, per-role SELECT privilege, dependants).
select pg_get_userbyid(c.relowner) as owner, c.relacl::text as acl, c.reloptions,
       (select array_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns_and_types
  from pg_class c where c.oid = 'public.v_costing_scheme_master_register'::regclass;
select r.rolname, has_table_privilege(r.rolname, 'public.v_costing_scheme_master_register', 'SELECT') as can_select from pg_roles r where r.rolname in ('anon', 'authenticated', 'service_role') order by 1;
select distinct coalesce(c.relname, p.proname) as dependant from pg_depend d left join pg_rewrite rw on rw.oid = d.objid and d.classid = 'pg_rewrite'::regclass
  left join pg_class c on c.oid = rw.ev_class left join pg_proc p on p.oid = d.objid and d.classid = 'pg_proc'::regclass
 where d.refobjid = 'public.v_costing_scheme_master_register'::regclass and d.deptype = 'n';

-- Q3. Values: 7 rows and the three changed columns equal the independent base-table recomputation (same expectation as P3). expect: all *_ok = true, 7 rows, same numbers as the saved P3.
select v.scheme_id, v.viability_snapshot_count, v.viability_snapshot_period_count, v.latest_viability_snapshot_period,
       v.viability_snapshot_count = coalesce(t.n, 0) as count_ok, v.viability_snapshot_period_count = coalesce(t.periods, 0) as periods_ok,
       v.latest_viability_snapshot_period is not distinct from t.latest as latest_ok
  from public.v_costing_scheme_master_register v
  left join (select scheme_id, count(*) n, count(distinct period_start) periods, max(period_start) latest from costing.sku_scheme_viability_snapshot group by scheme_id) t on t.scheme_id = v.scheme_id
 order by v.scheme_id;
select count(*) as rows_total from public.v_costing_scheme_master_register;   -- expect 7

-- Q4. Plan and timing, run 3 times (cold if possible). Reference (issue #211): about 124.916 ms, 102,883 shared hits. The cold-start behaviour must be re-measured, not assumed.
set local statement_timeout = '6s';
explain (analyze, buffers, timing off) select * from public.v_costing_scheme_master_register;
rollback;

-- Q5. Permission semantics as the real caller (replace the placeholders). expect: ID-V 7 rows, no-permission user 0 rows, anon cannot select, exactly as before the change.
begin read only;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<ID_V_UUID>","role":"authenticated"}', true), set_config('request.jwt.claim.sub', '<ID_V_UUID>', true);
select count(*) as id_v_rows from public.v_costing_scheme_master_register;                                  -- expect 7
rollback;
begin read only;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<NO_COSTING_UUID>","role":"authenticated"}', true), set_config('request.jwt.claim.sub', '<NO_COSTING_UUID>', true);
select count(*) as no_permission_rows from public.v_costing_scheme_master_register;                          -- expect 0
rollback;
-- Q6. Client check (after the SQL checks): sign in as ID-V and open Pricing Policy Manager -> Scheme Master at 1280 px and 390 px: 7 rows, no console errors, no HTTP 500.
