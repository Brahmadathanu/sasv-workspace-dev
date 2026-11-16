# WP10 — Independent candidate review: active-SKU reparent bypass (2026-11-16)

## Blocking finding (static source inspection)

The experimental `public.fn_wp10_activation_parent_lock_recheck()` in `scripts/wp10-g2-safeguards/experimental-parent-lock.sql` returns early for **every UPDATE where `old.is_active is true`**, regardless of whether `new.product_id` differs. Therefore an **already-active SKU reparent** does not acquire the new parent row `FOR UPDATE` or run the candidate's post-lock activation essentials recheck. Existing earlier BEFORE guards may reject invalid destinations in serial execution (CL17/CL18), but the candidate does **not** serialize this cross-flow writer itself. A successful CL18 serial test cannot close that concurrency gap.

## Required correction and tests (offline only)

1. Narrow the early return to `old.is_active is true AND old.product_id IS NOT DISTINCT FROM new.product_id`. Active reparent must lock the destination parent and recheck essentials.
2. Review source-parent/destination-parent lock ordering, because the SKU row and both product rows may be locked by different writers. Test a concurrent active SKU reparent and destination subgroup edit in **both schedules**; bound statement/lock timeouts, check committed invariants and fail on deadlocks.
3. Confirm `fn_sku_activation_missing_items(new.id,new.product_id)` checks route and completeness using NEW destination, and verify trigger execution order; do not rely on assumptions.
4. Independently inspect privilege boundary of SECURITY DEFINER and correction-only rollback before any deploy. The fixture SQL explicitly says NOT AN INSTALLABLE MIGRATION.

**Disposition:** candidate NOT PRODUCTION-READY. No production changes or approvals inferred.
