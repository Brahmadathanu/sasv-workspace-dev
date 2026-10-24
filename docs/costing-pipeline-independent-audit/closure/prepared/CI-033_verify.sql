-- CI-033 read-only verification. Run before and after.
-- 1. Direct access (expected after fix: all false)
select r as role, has_table_privilege(r,'costing.v_cost_pool_monthly_combined','SELECT') as can_select_base
from unnest(array['anon','authenticated','service_role']) r;
-- 2. ACL (expected after fix: {postgres=arwdDxtm/postgres})
select relacl from pg_class where oid='costing.v_cost_pool_monthly_combined'::regclass;
-- 3. Screen path still works: gated public view still granted and still gated (expected: true, true)
select has_table_privilege('authenticated','public.v_costing_cost_pool_monthly_summary','SELECT') as screen_view_granted,
       pg_get_viewdef('public.v_costing_cost_pool_monthly_summary'::regclass) ilike '%fn_costing_view_allowed%' as screen_view_gated;
-- 4. Row parity as owner (expected: same count before and after)
select period_start, count(*) from public.v_costing_cost_pool_monthly_summary group by 1 order by 1 desc limit 3;
-- 5. Owner of the definer functions that read the base view (expected: postgres only)
select distinct pg_get_userbyid(p.proowner) from pg_proc p where p.prosrc ilike '%v_cost_pool_monthly_combined%';
-- 6. Manual check after applying: the costing-permission user opens Cost Governance > Cost pool summary
--    (rows shown); a user without the permission sees 0 rows (as TB2).
