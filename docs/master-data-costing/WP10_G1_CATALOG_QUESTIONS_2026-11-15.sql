-- STATUS (reconciliation update): Q1-Q9 below were ANSWERED by ChatGPT's independent read-only capture
-- (WP10_G1_EVIDENCE/independent-live-catalog-2026-11-15.json; results mapped in WP10_G1_AUDIT_REPORT section 7 and tests P5.*).
-- This file is kept as the record of the questions. Still open and OPTIONAL: definitions of the four route-validation callees
-- (fn_resolve_effective_route_family_route, fn_resolve_effective_product_process_route, fn_validate_product_process_route,
-- fn_validate_route_family_route) and build-history metadata (ids/status/timestamps only). Nothing here has been executed by the audit session.
-- WP10 G1 — exact READ-ONLY catalog questions for ChatGPT (project qhmoqtxpeasamtlxaoak). NOT EXECUTED by the G1 audit session (no database access).
-- Catalog / metadata only: no business rows, no completeness counts, no role impersonation, no writer or preview/readiness function is invoked.
-- Each block names the finding it can confirm or refute. Return results as JSON per block (Q1..Q9) for the G2 design freeze.
begin read only;

-- Q1  Live definitions, ownership, SECURITY mode, search_path, grants and md5 of the four writers whose live text is NOT in the repo or catalog.
--     Confirms: client inputs vs server authority, permissions, active-create handling, duplicate rules, audit writes (matrix rows W1-W4).
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proconfig, p.proacl::text,
       md5(pg_get_functiondef(p.oid)) as def_md5, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('rpc_create_product','rpc_update_product','rpc_create_product_sku','rpc_update_product_sku');

-- Q2  ACL / owner / SECURITY of the five already-captured functions (the catalog capture omitted proacl).  Confirms: who can EXECUTE the guard and lifecycle RPCs.
select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef, p.proacl::text
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (('public','rpc_set_product_sku_active'),('public','rpc_get_sku_activation_check'),('public','fn_guard_sku_activation_completeness'),
      ('public','fn_guard_active_sku_requires_active_product'),('costing','fn_sku_activation_missing_items'));

-- Q3  Triggers and trigger-function definitions on the PRODUCT side and on audit tables. Confirms the documented product-inactivation guard
--     (fn_guard_product_inactivation_requires_no_active_skus), the price-list guard and the change-log function (finding G-3, G-9).
select c.relnamespace::regnamespace::text as schema, c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where not t.tgisinternal and c.relname in ('products','product_master_audit','product_sku_master_audit','product_sku_change_log')
order by 1, 2, 3;
select n.nspname, p.proname, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('fn_guard_product_inactivation_requires_no_active_skus','fn_product_skus_price_list_active_guard','fn_log_product_sku_change','fn_log_product_change');

-- Q4  Direct-table coverage: table privileges, RLS flags and policies for the writer tables. Confirms which roles can bypass the RPCs (finding G-8).
select c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) as owner,
       has_table_privilege('authenticated', c.oid, 'INSERT') as auth_ins, has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_upd,
       has_table_privilege('authenticated', c.oid, 'DELETE') as auth_del, has_table_privilege('anon', c.oid, 'SELECT') as anon_sel,
       has_table_privilege('service_role', c.oid, 'UPDATE') as svc_upd
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('products','product_skus','product_master_audit','product_sku_master_audit','product_sku_change_log');
select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies
where schemaname = 'public' and tablename in ('products','product_skus','product_master_audit','product_sku_master_audit','product_sku_change_log');

-- Q5  Freshness substrate: what the fingerprint hashes, what the epoch bump does, who calls the governed build, and the substrate shape. (finding G-1, G-2)
select p.proname, pg_get_function_identity_arguments(p.oid) as args, md5(pg_get_functiondef(p.oid)) as def_md5, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'costing' and p.proname in ('fn_wp04_readiness_source_fingerprint','fn_wp04_readiness_bump_source_epoch','fn_wp04_build_readiness_portfolio');
select table_name, column_name, data_type from information_schema.columns
where table_schema = 'costing' and table_name in ('readiness_portfolio_source_epoch','product_sku_readiness_portfolio_build') order by table_name, ordinal_position;
-- build-history METADATA only (ids, status, timestamps; no SKU rows). Optional if the owner prefers not to read it:
select id, period_start, status, is_current, valuation_date, evidence_refresh_run_id, source_fingerprint_digest is not null as has_digest
from costing.product_sku_readiness_portfolio_build order by id desc limit 20;

-- Q6  Schedules and callers: any cron job / function that invokes the governed build or refreshes readiness. (finding G-1: owner and cadence of the rebuild)
select to_regclass('cron.job') is not null as pg_cron_present;
select jobid, jobname, schedule, active, left(command, 160) as command_head from cron.job order by jobid;          -- skip if pg_cron_present is false
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prosrc ilike '%fn_wp04_build_readiness_portfolio%' and p.proname <> 'fn_wp04_build_readiness_portfolio';
select extname from pg_extension where extname in ('pg_cron','pg_net','supabase_vault');

-- Q7  Alert / notification surfaces that could consume READINESS_BUILD_STALE or a dependency expiry. (finding G-1, G-5)
select table_schema, table_name from information_schema.tables where table_schema in ('public','costing')
  and table_name ~* '(alert|notif|outbox|inbox|incident|task|monitor|freshness|health)' order by 1, 2;
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.prosrc ~ 'READINESS_BUILD_(STALE|ABSENT)' order by 1, 2;

-- Q8  Resolver definitions not in the repo: confirms which tables each five-essential resolver reads vs the 44 hooked tables (finding G-6).
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, md5(pg_get_functiondef(p.oid)) as def_md5, pg_get_functiondef(p.oid) as def
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'costing' and p.proname in ('fn_resolve_sku_mrp_as_of','fn_resolve_sku_selling_price_policy_as_of','fn_resolve_route_family_for_product','fn_validate_effective_product_process_route');

-- Q9  Which date the readiness read paths evaluate "as-of" (finding G-2: guard uses today IST, LIVE_AS_OF uses the governed valuation date).
select p.proname, pg_get_function_identity_arguments(p.oid) as args, md5(pg_get_functiondef(p.oid)) as def_md5,
       (pg_get_functiondef(p.oid) ~* 'current_date|now\(\)|clock_timestamp') as references_today
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('rpc_get_product_sku_readiness','rpc_get_product_sku_readiness_portfolio','rpc_get_readiness_governed_periods','fn_product_sku_readiness_live_core');

rollback;
