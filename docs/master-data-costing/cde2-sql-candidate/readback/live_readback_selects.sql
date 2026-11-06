-- CDE-2 live read-back pack: SELECT / catalog queries ONLY, for the SERVER SESSION to run read-only against production.
-- NOT RUN by the author of this PR. Nothing here writes, grants or creates. Each block answers one open item in CDE2_SQL_CANDIDATE_REVIEW_2026-11-06.md.

-- A. Writer entry points: owner, SECURITY DEFINER, EXECUTE ACL, definition hash (R2). Expect DL writers and callers = postgres only.
select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proacl::text as acl, md5(pg_get_functiondef(p.oid)) as def_md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where (n.nspname, p.proname) in (('costing','rpc_refresh_exact_sku_control_snapshot'), ('costing','rpc_refresh_costing_control_summary_snapshots'),
   ('costing','rpc_refresh_sku_direct_labour_component_split_snapshot'), ('costing','rpc_refresh_sku_direct_labour_legacy_snapshot'),
   ('costing','rpc_refresh_sku_direct_labour_allocation_snapshot'), ('costing','fn_guard_stage05_exact_snapshot_write'),
   ('costing','fn_apply_control_snapshot_refresh_context'), ('costing','fn_enforce_mutable_refresh_run_snapshot'), ('public','require_permission'));
-- A2. Who can reach those writers: effective EXECUTE for end-user roles.
select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join (select rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
 where n.nspname = 'costing' and p.proname in ('rpc_refresh_exact_sku_control_snapshot','rpc_refresh_costing_control_summary_snapshots','rpc_refresh_sku_direct_labour_component_split_snapshot','rpc_refresh_sku_direct_labour_legacy_snapshot','rpc_refresh_sku_direct_labour_allocation_snapshot');

-- B. Anything that can move a run out of SUCCESS or delete runs (R2: re-opening a run would re-open the write window).
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('costing','public') and (p.prosrc ~* 'update\s+costing\.costing_refresh_run' or p.prosrc ~* 'delete\s+from\s+costing\.costing_refresh_run');
-- B2. Triggers on the five sources (enabled state matters: 'D' = disabled).
select c.relname, t.tgname, t.tgenabled, t.tgfoid::regproc from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'costing' and not t.tgisinternal and c.relname in ('sku_prime_cost_snapshot','sku_direct_labour_allocation_snapshot','sku_internal_material_conversion_snapshot','sku_costing_control_status_snapshot','sku_regional_marketing_expense_allocation_snapshot') order by 1,2;
-- B3. Direct DML privileges on the five sources (owner already confirmed none for authenticated/service_role UPDATE).
select c.relname, g.grantee::regrole::text, g.privilege_type from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join lateral aclexplode(c.relacl) g
 where n.nspname = 'costing' and c.relname in ('sku_prime_cost_snapshot','sku_direct_labour_allocation_snapshot','sku_internal_material_conversion_snapshot','sku_costing_control_status_snapshot','sku_regional_marketing_expense_allocation_snapshot') order by 1,2,3;

-- C. Default privileges that would auto-grant EXECUTE on a new public function (R4 / D10).
select pg_get_userbyid(defaclrole) as for_role, defaclnamespace::regnamespace as schema, defaclobjtype, defaclacl::text from pg_default_acl;

-- D. Review scope (R3): the governed status rows the proposed rule reads; shows which periods are in scope today.
select period_start, latest_success_run_id, approved_run_id, display_state from costing.v_costing_period_run_status order by period_start;
select max(period_start) as scope_floor from costing.v_costing_period_run_status where approved_run_id is not null;

-- E. Timestamp integrity (R1) over EVERY candidate-eligible run (adapt the run list from D): null or later-than-finish stage timestamps must be zero.
--    (Owner already ran this for 80, 82, 148, 149: 0 null, 0 late.)
-- select r.id, count(*) filter (where p.refreshed_at is null or c.snapshot_refreshed_at is null or d.refreshed_at is null) as null_ts,
--        count(*) filter (where p.refreshed_at > r.finished_at or c.snapshot_refreshed_at > r.finished_at or d.refreshed_at > r.finished_at) as late_ts
--   from costing.costing_refresh_run r join costing.sku_prime_cost_snapshot p on p.refresh_run_id = r.id
--   join costing.sku_costing_control_status_snapshot c on c.refresh_run_id = r.id and c.sku_id = p.sku_id
--   join costing.sku_direct_labour_allocation_snapshot d on d.refresh_run_id = r.id and d.sku_id = p.sku_id where r.id in (<runs from D>) group by r.id;

-- F. Logging options available on the live server (R4 / D5).
select name, setting from pg_settings where name in ('log_min_messages','client_min_messages','log_statement','log_min_duration_statement','track_functions');
select extname from pg_extension where extname in ('pg_stat_statements','pgaudit');
