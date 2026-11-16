# WP10 — CL15 correction-only gated candidate and closure boundaries (2026-11-16)

## Why CL15 is not closed by the CRUD package
The direct-DML hierarchy migration controls classification writes, not the concurrent first SKU activation vs product subgroup-route change. The pre-existing **unapplied** proposal 05 guards `products.sub_group_id` route impact but, alone, does not serialize it against an in-progress first activation. The isolated CL15 negative mutation reproduces both writes committing, leaving an active SKU with invalid route.

## Gated correction-only SQL staged
- `scripts/wp10-g2-safeguards/review-only-cl15-parent-lock-correction.sql` is transactional. It fails if its objects already exist, if `costing.fn_sku_activation_missing_items(bigint,bigint)` or the existing activation-completeness trigger is absent, **or if proposal 05's route-impact functions/AFTER trigger are not installed and enabled**. It then installs the same parent-row locking and after-lock activation recheck logic exercised in isolated PostgreSQL.
- `scripts/wp10-g2-safeguards/review-only-cl15-parent-lock-correction-rollback.sql` drops only the new CL15 trigger/function, with exact-definition drift checks and fail-closed missing-object behavior.
- The existing `parent-lock-candidate.test.mjs` suite now executes the **exact guarded candidate and its exact dedicated rollback**, not the previous fixture-only experimental SQL, while retaining the CL12/13/15/16/17/18/19 schedules.
- Dependency order is non-negotiable: independently review/apply proposal 05 before this correction; proposal 05 remains UNAPPLIED. The correction is NOT independently deployable.
- The combination still does not govern `sub_groups.product_group_id` changes or approved route-family mapping edits. Those are separate writer-boundary analyses and cannot be declared closed by CL15 alone.

## Status and next gate
No production SQL, client deployment, merge, grant or flag change. Exact-current-head GitHub Actions result must be captured before classifying the guarded candidate as PASS. Follow with independent deadlock/lock-order and multi-writer scope review, then one bounded owner deployment decision. WP10 OPEN.
