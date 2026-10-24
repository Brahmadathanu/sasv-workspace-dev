-- backfilled from live schema_migrations on 2026-10-24, CI-016
grant select on table costing.sku_mrp_policy to authenticated;
revoke all on table costing.sku_mrp_policy from anon;

drop policy if exists sku_mrp_policy_authenticated_read on costing.sku_mrp_policy;
create policy sku_mrp_policy_authenticated_read
on costing.sku_mrp_policy
for select
to authenticated
using ((select auth.uid()) is not null);