-- CI-033 ROLLBACK. Restores the pre-fix ACL exactly (authenticated SELECT only).
begin;
grant select on costing.v_cost_pool_monthly_combined to authenticated;
commit;
