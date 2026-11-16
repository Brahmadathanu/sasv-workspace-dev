# WP10/CL15 — bulk Phase 2 independent review and exact decision gate (17 Nov 2026)

**STATUS: REVIEW ONLY / NO PRODUCTION AUTHORITY / WP10 OPEN / programme 10 of 13 formally closed.** This file is a receiver for the controlled code/CI work in [draft PR #463](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/463), not permission to install a trigger, change role privileges, activate a feature, merge a runtime PR or cut an Electron installer.

## Verified scope and isolated evidence

1. Live catalog spot-check from 16 Nov: project `qhmoqtxpeasamtlxaoak` was healthy; nine costing WP10 private helper functions, two public read RPCs, six applied Phase 1/classification migration history versions, **zero** proposed WP10 guard 04/05 functions/triggers. This is a metadata SELECT-only check, not a new full ACL/signature review. See `COSTING_BULK_EXECUTION_DEFERRED_GATE_2026-11-16.md`.
2. [Original red/green CI run 43929599188](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43929599188), complete SUCCESS. Disposable two-session PG fixture, reviewed live-verbatim activation/product writer definitions and original proposed guard 05, with labelled route-table stand-ins. RED: both transactions commit, final `true|3|false` (active SKU, invalid route). GREEN: added parent-row SHARE-lock trigger causes harmful concurrent product subgroup edit to be rejected, final `true|1|true`.
3. Extended review-only controls added to PR #463:
   - `crossflow-controls.test.mjs`: no-active-SKU edit, B-first activation refusal, privileged direct activation, valid→valid move, product inactivation guard, two active SKUs, valid→invalid rejection; explicit **route-map deletion remains possible** residual.
   - `crossflow-reverse-order.test.mjs`: B locks and edits product first, then A attempts activation and must wait on product row before validating the committed new route; A-first SHARE lock with bounded B timeout.
   - `atomic-05-cl15-review.test.mjs`: generated one-transaction 05+CL15 candidate, guarded behavior, scoped exact-receipt rollback, negative tampered-receipt rollback.
4. Generator `scripts/wp10-g2-safeguards/gen-atomic-05-cl15-review.mjs` combines **original unchanged** 05 source and candidate locking SQL under exactly one top-level BEGIN/COMMIT. The candidate SQL and scoped rollback are under `scripts/`, **not** `supabase/migrations/`. The generator's --check verifies shape; test evidence is isolated, not installation authority.
5. The rollback `review-only-atomic-05-cl15-scoped-rollback.sql` requires all three functions and three triggers to retain matching definition-MD5 receipts before dropping any, in one transaction without CASCADE; does **not** target already-applied 01/02/03/06, classification RPCs or business rows. The existing `99_rollback_all.sql` is unsuitable for selective production 05+CL15 rollback because it covers other already-installed WP10 components. Do not use it for this candidate.

## Independent design review — source constraints, not a production PASS

- The live `rpc_set_product_sku_active` obtains SKU `FOR UPDATE` and validates parent route without a shared product lock. The live `rpc_update_product` obtains product `FOR UPDATE`. Original 05 merely reads committed active-SKU counts. Under READ COMMITTED it misses a concurrent uncommitted first activation; this failure is **reproduced in fixture**, not observed in production.
- Candidate `fn_wp10_activation_parent_lock` is a trigger on `product_skus` BEFORE INSERT/UPDATE OF `is_active,product_id`, with name chosen to precede the existing activation-completeness trigger. An inactive→active transition locks its parent product row `FOR SHARE`, which conflicts with the product writer's parent `FOR UPDATE`; the product row lock persists through commit. B-first must recheck after wake-up rather than rely on a stale valid route.
- Direct privileged active→active `product_id` re-parent remains a **separate guard 04** concern; the candidate lock does not itself reject it. A simultaneous deactivate+reparent through direct DML remains an owner-audit-policy concern.
- Route Manager modifications of production route-family maps/steps and `sub_groups.product_group_id` changes do **not** flow through original product-subgroup guard 05 and are **NOT CLOSED**. Existing source/privilege review plus dedicated future safety design required; do not claim complete active-SKU route conservation from two locks.
- A lock can introduce wait/deadlock/latency changes across product updates, SKU activation and legacy direct writers. Positive isolated scenarios do not establish production scale or full nested function call order. First-writer and privileged-role cases need independent closed-path analysis. No API permission target or grant has been added by this review source.
- 12 classification RPCs remain installed; the four pages are Electron-root only, merged client source not yet installed. Four-master authenticated direct-DML REVOKE remains separately governed after legacy Electron fleet cutover.

## Exact safety gates before any production consideration

| Gate | Required evidence and stop rule |
|---|---|
| Independent source / call-graph review | Verify the combined guard's event order, triggers, recursion, FK locks, owner privileges, all writers, audit and READ COMMITTED snapshot behavior. No bypass of five essentials. |
| Comprehensive isolated cases | Red and green A-first/B-first, normal valid→valid and invalid→invalid, no-active, multi-SKU, direct activation/reparent, inactivation, lock timeouts/deadlocks, mapper edits, tampered rollback, role denials. Any inconsistent final state: HOLD. |
| Exact immutable payload and safety | Record combined generated SHA-256, each source hash, live dependency fingerprints, absence/receipt preflight, lock/statement bounds, scope-limited rollback and CI logs. Any production drift: STOP. |
| Business governance boundary | Explicit disposition of guard 04, route-map writers, subgroup parent change, legacy Electron direct-DML and remaining operator ownership; no blanket safety claim. |
| Owner exact decision | Separate authority naming the database, script SHA, time/operator and backup/rollback; no earlier 'go ahead' authorises this write. |
| Release receiver | WP12 real signed-in Editor/View/Denied, sensitive negative GETs, 11 flags, costing/price parity, PWA SW, WP11 actual 390px, packaged Windows installer and publication gate remain independent. |

**No proposed trigger has been applied in Supabase; no existing data, grants, services, pricing runs, flags or production clients have been changed.** Preserve all previously approved deferrals and the 10/13 count.
