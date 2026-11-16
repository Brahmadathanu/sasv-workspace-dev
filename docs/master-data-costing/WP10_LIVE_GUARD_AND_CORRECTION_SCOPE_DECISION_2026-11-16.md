# WP10 — Live guard contract and correction-scope decision (2026-11-16)

## Read-only production function verification
Inspected live `public.fn_guard_active_sku_requires_active_product()` and `public.fn_guard_sku_activation_completeness()` using `pg_get_functiondef` (no writes). The first checks parent status by ordinary SELECT; the second returns early for UPDATE when `old.is_active=true`, and otherwise calls `costing.fn_sku_activation_missing_items(new.id,new.product_id)` without locking the parent. Neither function alone serializes an inactive-to-active transition against a concurrent product subgroup update. This agrees with the isolated CL15 negative mutation witness.

## Scope of experimental correction
The `experimental-parent-lock.sql` candidate acquires `FOR UPDATE` on the product row and rechecks activation essentials for an inactive-to-active SKU transition. Its newer active-reparent clause is defence-in-depth only: proposal 04's `WP10_ACTIVE_SKU_REPARENT_REJECTED` already prohibits active reparent in the tested fixtures. CL18/19 verify that prohibition, **not** a successful candidate lock path. No justification to broaden production permissions for active reparent.

## Proposal 05 risk boundary
Unapplied proposal 05 guards `products.sub_group_id` changes only; its own header expressly excludes `sub_groups.product_group_id` changes and route mapping table mutations. Therefore **candidate parent lock + proposal 05 are not a comprehensive route-dependency transaction policy**. These exclusions must be separately assessed as blocked, governed/immutable, or needing a new guard before WP10 formal closure. Do not silently mark them PASS.

## Approval gate
Need: explicit allowed-writer matrix (including route map and subgroup group reassignment), lock-order/reverse schedule fixtures for allowed mutations, reviewed correction-only SQL (not fixture script), rollback that does not undo applied proposals 01/02/03/06, privilege/SECURITY DEFINER review, staging validation, owner approval, then bounded production acceptance. WP10 OPEN. Production unchanged.
