# WP10 — Four-level classification-master direct-DML security gate (2026-11-16)

## Live read-only privilege and RLS evidence
All four tables `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups` have authenticated INSERT/UPDATE/DELETE grants and RLS enabled. Each has a single `*_authenticated_crud` ALL policy whose USING and WITH CHECK require only `auth.uid() IS NOT NULL`. This is NOT module Edit authorization.

Canonical permission targets exist for `module:manage-categories`, `module:manage-subcategories`, `module:manage-product-groups`, `module:manage-subgroups`: each has 3 permission rows, 1 editor (aggregates only).

## Client paths
- `js/categories.js`: direct insert/update/delete `categories`;
- `js/subcategories.js`: direct insert/update/delete `sub_categories`;
- `js/product-groups.js`: direct insert/update/delete `product_groups`;
- `js/subgroups.js` (baseline): direct insert/update/delete `sub_groups`. PR #444 draft changes only this last screen to governed RPCs.

## Referential deletion chain
- `sub_categories.category_id -> categories.id ON DELETE CASCADE`;
- `product_groups.sub_category_id -> sub_categories.id ON DELETE CASCADE`;
- `sub_groups.product_group_id -> product_groups.id ON DELETE CASCADE`.
- Other referencing FKs may block cascades: route mappings, scheme rules, products, laboratory and installed-capacity tables. They do not enforce a module permission.

## Decision gate
A subgroup-only revoke leaves parent-level direct UPDATE/DELETE and cascades exposed. Expand to coordinated four-level governed CRUD or explicitly retain and document an owner-approved residual security risk. No production permission change before all four client workflows, old Electron compatibility, tests, and rollout order are addressed. Avoid creating production SQL objects before isolated security review. WP10 OPEN.
