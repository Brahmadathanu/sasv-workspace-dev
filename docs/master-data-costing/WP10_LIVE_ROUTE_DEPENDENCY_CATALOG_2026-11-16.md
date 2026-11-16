# WP10 — Live route-dependency catalog evidence (2026-11-16)

**READ-ONLY SUPABASE CATALOG INSPECTION.** Project `qhmoqtxpeasamtlxaoak`. No data mutations, DDL, deploys or flags.

## Confirmed live trigger inventory

- `public.product_skus`: `trg_active_sku_requires_active_product`, `trg_sku_activation_completeness_guard`, `trg_product_skus_price_list_active_guard`, `trg_product_sku_change_log`, WP04 readiness epoch trigger.
- `public.products`: `trg_product_inactivation_requires_no_active_skus`, WP04 readiness epoch trigger.
- `public.sub_groups`: WP04 readiness epoch trigger only in the queried trigger inventory. No route-impact guard on subgroup group reassignment observed.
- `public.product_groups`: WP04 readiness epoch trigger only.
- `costing.production_route_family_product_group_map`: effective-date guard, mapping immutability guard, WP04 readiness epoch trigger.
- `costing.production_route_family_product_subgroup_map`: effective-date guard, subgroup-mapping immutability guard, WP04 readiness epoch trigger.
- `costing.production_route_family_product_map`: effective-date guard, approval reference guard, product-route-family assignment guard, WP04 readiness epoch trigger.
- `costing.production_route_family`: effective-date guard, approval reference guard, route-family immutability guard, WP04 readiness epoch trigger.
- `costing.production_route_family_route`: effective-date guard, approval reference guard, route-family-route immutability guard, WP04 readiness epoch trigger.
- `costing.production_route_family_route_step`: step immutability guard, WP04 readiness epoch trigger.
- `costing.product_process_route`: effective-date guard, approval reference guard, route parent immutability guard, WP04 readiness epoch trigger.
- `costing.product_process_route_override`: route override immutability guard, WP04 readiness epoch trigger.

## Interpretive limits

A trigger name or existence **does not establish** that it prevents all route-invalidating mutations. Next inspect exact live `pg_get_functiondef`, trigger event predicates, table permissions and canonical resolver dependencies. In particular, WP04 readiness epoch triggers appear to invalidate cached readiness; they should not be treated as writer guards without function-body proof. Existing route immutability may restrict UPDATE but not INSERT, DELETE or approval transitions; do not infer coverage.

The SKU remains linked by `product_id`. Proposal 05 guards `products.sub_group_id` only; no evidence here that subgroup-to-group reclassification or route-mapping changes are covered by 05. The experimental parent-lock trigger is still fixture-only.

## Next gate

Read-only capture of exact relevant live function/trigger bodies and grants, derive a mutation/lock matrix, test deadlocks and negative mutation in disposable PostgreSQL, and seek independent review. No new live route guard is authorised by this document.
