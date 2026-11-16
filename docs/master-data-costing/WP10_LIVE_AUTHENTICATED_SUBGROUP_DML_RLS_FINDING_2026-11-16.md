# WP10 — Live authenticated subgroup DML and RLS finding (2026-11-16)

**Priority: security/governance review required. Read-only production catalog inspection only; no mutation or role impersonation executed.**

## Verified live facts
- `public.sub_groups` has columns `id`, `product_group_id`, `sub_group_name`.
- `has_table_privilege('authenticated','public.sub_groups', 'INSERT'/'UPDATE'/'DELETE')` returns **true** for all three operations.
- RLS is enabled (`relrowsecurity=true`) but not forced; the `sub_groups_authenticated_crud` policy applies to **ALL** commands (`polcmd='*'`) for role OID 16479, verified as **authenticated**. Both `USING` and `WITH CHECK` require only `auth.uid() IS NOT NULL`. No explicit module-specific role permission is in the policy text.
- `public.sub_groups` has **no row-level route-impact trigger** in the inspected trigger catalog, only the WP04 readiness epoch statement trigger.
- By contrast, authenticated INSERT/UPDATE/DELETE privileges were false on inspected `public.products`, `public.product_skus`, and selected `costing` route tables.

## Consequence and limit
A logged-in authenticated role appears to satisfy the table privilege and RLS policy for direct subgroup writes, including `product_group_id` updates. Such a change can potentially alter route-family resolution for multiple products with active SKUs. This is a **credible direct DML governance gap**; not a confirmed exploited defect or verified API request. Additional grants, API exposure, role settings and dependency behavior must be checked before declaring exploitability.

## Proposed gate, NOT authorized execution
1. Establish actual intended writer: module RPC vs direct table DML; inventory direct frontend calls and DB grants, check whether any intended workflows rely on authenticated subgroup CRUD.
2. Design a migration that closes direct authenticated DML or constrains it to governed writers, retaining legitimate reads. Independently review service_role and SECURITY DEFINER paths; avoid accidental breakage.
3. In disposable PG, test both negative authenticated DML and authorized subgroup group reassignment with route-impact protection (including multi-product dependencies), reverse concurrency schedule and rollback.
4. Prepare exact correction-only migration, explicit role impact, rollback and owner approval; no production privilege changes without approval.

**Do not mark WP10 complete.** This gap is outside the existing proposal-05 scope. No SQL applied, no deployment, no feature flags changed.
