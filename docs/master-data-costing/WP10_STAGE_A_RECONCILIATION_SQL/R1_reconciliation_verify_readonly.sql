-- WP10 Stage A migration-history reconciliation — READ-ONLY verification. NOT A MIGRATION. Run as postgres, TWICE: before and after history registration.
-- Output: one row per fact (check | value). Compare the two runs: every row must be IDENTICAL except history_count (+1) and history_max_version / registered_row.
-- Read-only transaction: no DDL, no DML, no grant change. Counts only for business tables; no user identities.
begin transaction read only;

with t(tbl) as (values ('categories'), ('sub_categories'), ('product_groups'), ('sub_groups')),
rpcs as (select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname ~ '^rpc_wp10_(create|rename|delete)_(category|subcategory|product_group|subgroup)$'),
helpers as (select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname in ('app_has_permission', 'app_has_permission_core', 'require_permission')),
facts(ord, k, v) as (
  select 10, 'history_count', count(*)::text from supabase_migrations.schema_migrations
  union all select 11, 'history_max_version', max(version) from supabase_migrations.schema_migrations
  union all select 12, 'target_version_unused (expect true BEFORE, false AFTER)', (not exists (select 1 from supabase_migrations.schema_migrations where version = '20261118161406'))::text
  union all select 13, 'target_name_registered_rows (expect 0 BEFORE, 1 AFTER)', count(*)::text from supabase_migrations.schema_migrations where name = 'wp10_four_master_stage_a_state_reconciliation'
  union all select 14, 'target_version_later_than_all_other_registered', (coalesce((select max(version) from supabase_migrations.schema_migrations where version <> '20261118161406'), '0') < '20261118161406')::text
  union all select 15, 'registered_row (version and name)', coalesce((select version || ' ' || name from supabase_migrations.schema_migrations where version = '20261118161406'), '(none)')
  union all select 16, 'duplicate_versions (expect 0)', (select count(*) - count(distinct version) from supabase_migrations.schema_migrations)::text
  union all select 20, 'policy_count_on_four_tables (expect 16 when hardened)', count(*)::text from pg_policies where schemaname = 'public' and tablename in (select tbl from t)
  union all select 21, 'policy_fingerprint (names, cmd, roles, expressions; no OIDs)', md5(coalesce(string_agg(tablename || '|' || policyname || '|' || cmd || '|' || permissive || '|' || roles::text || '|' || coalesce(qual, '') || '|' || coalesce(with_check, ''), E'\n' order by tablename, policyname), ''))
        from pg_policies where schemaname = 'public' and tablename in (select tbl from t)
  union all select 22, 'rls_flags (enabled,forced) ' || tbl, (select relrowsecurity::text || ',' || relforcerowsecurity::text from pg_class where oid = to_regclass('public.' || tbl)) from t
  union all select 23, 'table_acl_fingerprint', md5(coalesce(string_agg(c.relname || ':' || coalesce(c.relacl::text, ''), E'\n' order by c.relname), ''))
        from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname in (select tbl from t)
  union all select 24, 'authenticated_table_privileges ' || tbl, (select string_agg(a.privilege_type, ',' order by a.privilege_type) from pg_class c, aclexplode(c.relacl) a, pg_roles r where c.oid = to_regclass('public.' || tbl) and a.grantee = r.oid and r.rolname = 'authenticated') from t
  union all select 30, 'governed_rpc_count (expect 12)', count(*)::text from rpcs
  union all select 31, 'governed_rpc_definition_fingerprint', md5(coalesce(string_agg(proname || pg_get_functiondef(oid), E'\n' order by proname), '')) from rpcs
  union all select 32, 'rpc_acl_fingerprint', md5(coalesce(string_agg(p.proname || ':' || coalesce(p.proacl::text, ''), E'\n' order by p.proname), '')) from pg_proc p where p.oid in (select oid from rpcs)
  union all select 33, 'helper_definition_fingerprint', md5(coalesce(string_agg(proname || pg_get_functiondef(oid), E'\n' order by proname), '')) from helpers
  union all select 34, 'helper_md5_prosrc (WP05 receipts: app_has_permission 12727b365c1728d3830eeab039b6e344; core b75d5b4ee5cc6c464149c5743e165b95 as of 12 Nov — INFO, drift is reviewer-visible)',
        (select string_agg(proname || '=' || md5(prosrc), '; ' order by proname) from pg_proc where oid in (select oid from helpers))
  union all select 40, 'row_count ' || tbl, (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || tbl, false, true, '')))[1]::text from t
  union all select 50, 'server_version', current_setting('server_version')
)
select k as "check", v as value from facts order by ord, k;

rollback;
