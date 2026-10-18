-- PROPOSAL (APPLIED LIVE 2026-10-16). SKU 1797 Special Medicine 2 5 g: pricing mirrors SKU 1321 (10 g, inactive).
-- 1321 MRP policy 698: IK=OK=200, ok_pct 0, AUTO, LEGACY_BASELINE (unverified), closed 2026-07-15. 1321 has NO selling-price policy row.
-- MRP = 200, same as SKU 1321 (being discontinued); user ruling 2026-10-16. APPLIED LIVE 2026-10-16 ~18:55 IST: mrp policy 1829, selling policy 1322.
-- Selling policy: company default as seeded (GST 12, discounts 0, contingency 2), same as SKU 879 policy 453.
begin;
do $$ begin
  if exists (select 1 from costing.sku_mrp_policy where sku_id=1797 and status='APPROVED' and effective_to is null)
     or exists (select 1 from costing.sku_selling_price_policy where sku_id=1797 and is_active)
  then raise exception 'SKU 1797 already has a policy; refusing'; end if;
  if exists (select 1 from costing.costing_refresh_run where overall_status in ('PENDING','RUNNING','QUEUED'))
  then raise exception 'refresh in flight; refusing'; end if;
end $$;
select public.rpc_set_sku_mrp_policy(1797, 200, 200, 0, 'AUTO', date '2026-09-01',
  'Same MRP as SKU 1321 (10 g, being discontinued); user ruling 2026-10-16', 'USER-RULING-1797-PRICING-20261016');
select public.rpc_set_sku_selling_price_policy(1797, 12, 0, 0, null, null, 2, date '2026-09-01',
  'Default selling terms; user ruling 2026-10-16');
commit;
-- ROLLBACK: rpc_cancel_scheduled_sku_mrp_policy for the new 1797 MRP row; set is_active=false on the new 1797 selling-policy row.
