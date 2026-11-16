# WP10 — Hierarchical cascade deletion and permissions review (2026-11-16)

## Read-only production FK catalog
`public.sub_groups(product_group_id)` references `public.product_groups(id) ON DELETE CASCADE`. Subgroups are referenced by:
- `public.products(sub_group_id) ON DELETE RESTRICT`;
- `costing.production_route_family_product_subgroup_map(product_subgroup_id) ON DELETE RESTRICT`;
- `public.scheme_policy_rules(sub_group_id)` with default NO ACTION.

The draft `rpc_wp10_delete_subgroup` now explicitly checks these three dependencies; database FKs remain authoritative against concurrent dependent inserts.

## New adjacent client/privilege finding
`js/product-groups.js` directly inserts, renames and deletes `public.product_groups`; live `authenticated` role has UPDATE and DELETE privileges there. A group DELETE may cascade into its subgroups. FK restrictions can prevent some cascades when dependencies exist, but an empty or otherwise unreferenced group can be removed, and the current direct DML/RLS policy needs separate permission review.

## Disposition
Do not deploy subgroup-only REVOKE as complete WP10 hierarchy protection. Audit `public.product_groups` RLS and remaining category/subcategory cascade FKs, and map legitimate UI write paths. Add governed group CRUD and safe delete controls to a coordinated master-hierarchy security package or explicitly defer with a documented owner-approved risk. No production changes; draft SQL remains untested and unapproved.
