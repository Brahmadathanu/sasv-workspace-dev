# WP10 — Live activation/inactivation concurrency finding (2026-11-16)

**Read-only live-function inspection** of Supabase project `qhmoqtxpeasamtlxaoak`; no writes.

## Verified definitions

- `public.fn_guard_active_sku_requires_active_product()` reads `public.products.status` using ordinary `SELECT` (no row lock) and refuses activation when status is not `Active`.
- `public.fn_guard_product_inactivation_requires_no_active_skus()` counts active `public.product_skus` for the product using ordinary `SELECT count(*)` (no explicit SKU row lock) and refuses inactivation when count > 0.
- `public.fn_guard_sku_activation_completeness()` calls `costing.fn_sku_activation_missing_items`; no explicit parent lock in its own function body.

## Consequence

The two existing parent/child guards **do not themselves establish a common lock protocol**. A concurrent first-SKU activation and parent inactivation may race; this is a **potential hazard inferred from definitions**, NOT a reproduced production defect. The experimental `zz_wp10_activation_parent_lock_recheck` trigger obtains a parent `FOR UPDATE` lock on activation, but its effect on inactivation and opposing lock order remains untested. Do not claim concurrency safety on the basis of trigger existence.

## Required test

Disposable PostgreSQL fixture: parent active, SKU inactive; schedule activation-first (pause before commit) versus product inactivation, then inactivation-first (hold product row lock) versus SKU activation. Assert at most one operation succeeds and final invariant `NOT (sku.active AND product.inactive)`; capture SQLSTATE and timeout/deadlock outcomes. Add multi-SKU variant, positive serial control, direct privileged writes, negative mutation without lock. Use bounded timeouts. Do not turn timeout/deadlock into PASS. Audit product writer and trigger ordering before production SQL.

## Scope

No changes to SKU ownership; retain `product_id`. No production SQL, flag changes, deployment or closure authorised. WP10 OPEN. This finding supplements `WP10_PRODUCT_ROUTE_MUTATION_DEPENDENCY_AUDIT_2026-11-16.md`.
