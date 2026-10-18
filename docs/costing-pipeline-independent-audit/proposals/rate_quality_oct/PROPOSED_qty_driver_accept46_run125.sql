-- PROPOSED, NOT APPLIED. Accept the 46 low-impact governed-default quantity drivers on run 125 (43 carried from Sep with identical evidence, plus 207, 879, 1798).
-- Excludes the 19 suspect SKUs (products 54,1206,1159,1127,1083,1253,1340,468,219,210,300,913,323,1341,310,233,196,772,309).
-- Status only: costs are unchanged. A rerun at valuation 2026-10-16 is needed to clear the flags.
begin;
select set_config('request.jwt.claims', json_build_object('sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6','role','authenticated')::text, true);
select set_config('request.jwt.claim.sub','dff17104-c02a-4bca-95b1-e8ddff46a9b6', true);
create temp table t_acc on commit drop as
select r.* from costing.sku_sales_allocation_basis_snapshot b
cross join lateral costing.rpc_accept_sales_allocation_quantity_driver_review(125, b.sku_id,
  'Governed default quantity driver accepted for Oct, user approved <DATE>', 'AU5 qty-driver review run125; low impact') r
where b.refresh_run_id=125 and b.monthly_driver_status='REVIEW_REQUIRED'
  and b.product_id not in (54,1206,1159,1127,1083,1253,1340,468,219,210,300,913,323,1341,310,233,196,772,309);
do $$ begin if (select count(*) from t_acc)<>46 then raise exception 'expected 46, got %',(select count(*) from t_acc); end if; end $$;
commit;
-- P2 (19 suspect SKUs): user decision per product. Batch-size or volume corrections go through the app's batch-size and assumption screens, not SQL.
