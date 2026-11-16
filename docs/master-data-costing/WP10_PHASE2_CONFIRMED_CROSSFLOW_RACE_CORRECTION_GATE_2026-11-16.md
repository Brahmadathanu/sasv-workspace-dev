# WP10 Phase 2 — confirmed cross-flow race and corrective acceptance gate (2026-11-16)

Status: **CONFIRMED IN DISPOSABLE POSTGRESQL; GUARD 05 HOLD; NO PRODUCTION CHANGE**.

Evidence: [CI run 43799198061](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43799198061), job 133074961637, CF1–CF4 PASS, commit e730d2c6. The test is a *counterexample detector*, not a safety-verification test. CF3 observed activation exit=0, product-edit exit=0, active SKU=true, subgroup=3, canonical route valid=false. The artificial AFTER trigger delays commit **after** the activation BEFORE checks; the other writer commits while that transaction is open. Fixture uses the live-verbatim writer and route chain with synthetic data, plus the unapplied 05 proposal. This does not prove that production data is already corrupt.

## Mechanism

05's product BEFORE/AFTER functions check active children using ordinary SELECT without synchronising against a concurrent first-SKU activation. The SKU activation writer locks its SKU row but does not first acquire a conflicting parent-product lock for the complete validation/write transaction. A product subgroup edit holds the parent row lock, yet can read the previously committed inactive SKU state and accept a move to a subgroup without a route. The activation can then commit, leaving an active SKU whose canonical route is invalid.

## Corrective protocol to implement in a NEW draft (do not mutate the reviewed/applied proposal history)

1. Establish a **single parent-first lock order** across both writer paths. A SKU activation must acquire a conflicting lock on its parent product **before** reading readiness/route and before changing is_active. A product subgroup writer already locks the parent row; its route-impact checks must execute under that lock and must read the committed child activation state after the lock is acquired. Check that the chosen lock mode conflicts with UPDATE's actual row-lock mode and that no existing SKU/parent trigger acquires locks in the opposite order.
2. Fail closed on parent missing, changed ownership, inability to acquire the lock, or invalid route; retain existing permissions, audits, inactive-SKU behaviour, and no override. Do not add a client-side-only check. Use an owner-reviewed transactional server change, not an unreviewed production patch.
3. Avoid changing the live canonical route resolver or route mappings. Re-evaluate all relevant route/activation predicates under the lock, including the first activation and concurrent inactivation/reparenting. Inspect existing trigger/FK lock order and retry/deadlock semantics.
4. Extend the fixture to test BOTH schedules: activation lock first -> subgroup move rejected; subgroup edit first -> subsequent activation rejected. Test two active children, unrelated product, no-op edit, route-valid subgroup, already-invalid route, inactive SKU, rollback, audit atomicity, permission denial and lock-timeout. Add a negative mutation control that removes the parent lock and reproduces CF3. A CI green counterexample detector alone does not qualify.
5. Review existing proposal 04 and rollback 99 fingerprints and object receipts. Publish a *new*, exact, unapplied application manifest with prerequisite and rollback implications. Do not silently replace 05's reviewed SQL or claim its current md5 provenance is still valid after modification.

## Gates

- Cross-flow vulnerability: **CONFIRMED** in isolated PostgreSQL.
- Corrective server implementation: **NOT YET IMPLEMENTED**.
- Corrected two-order PostgreSQL regression and mutation evidence: **NOT TESTED**.
- Production-scale, role, PWA and Electron acceptance: **NOT TESTED**.
- Owner authority for production DDL, deployment, flags, registry, permissions, writer operations: **NOT GRANTED**.
- Guard 04, guard 05 and rollback 99 remain **UNAPPLIED**; WP10_SAFEGUARDS_V1 remains **OFF**.
- WP10 OPEN, programme 10/13; preserve WP11 and WP12, historical CRLF-only differences.

**Decision:** Do not apply 05. Complete and independently review the corrected lock protocol and its evidence, then request separate owner approval for any production application.
