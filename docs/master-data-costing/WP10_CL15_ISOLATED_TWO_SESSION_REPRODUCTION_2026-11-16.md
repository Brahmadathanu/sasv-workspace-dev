# WP10/CL15 — confirmed isolated two-session activation–subgroup race, 16 November 2026

**Classification: REPRODUCED IN DISPOSABLE PG FIXTURE, NOT OBSERVED IN PRODUCTION.** Original guard proposal 05 remains **HOLD / UNAPPLIED**. The correction is REVIEW-ONLY until independent red/green tests, full lock-order audit, exact SQL review, and separate owner application approval.

## Evidence source and method

- CI: [GitHub Actions run 43927979156](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43927979156), job 133512452350, commit `99040b8d87a2c289c1ecb6222c45560baf0bfa24`: **SUCCESS** for pure source contracts, isolated PG fixture suite and mocked Chromium; no skips in the WP10 offline workflow.
- New test: `scripts/wp10-g2-safeguards/crossflow-concurrency.test.mjs`, uses the disposable Unix-socket PostgreSQL cluster in `scripts/wp08-g2-0-shared-master-data/pg-harness.mjs`; route tables are labelled fixture stand-ins, while SKU activation and product edit writers are the reviewed live-verbatim definitions and original guard proposal 05 is loaded unchanged.
- Isolation: a freshly created throw-away database; no Supabase auth, production DML, role impersonation or source rollout.
- Session A: row-locks inactive SKU S, successfully activates it within an uncommitted transaction, then waits at the `A_ACTIVATED` barrier.
- Session B: changes product P from subgroup 1 (valid route) to subgroup 3 (invalid route) while A is uncommitted; both original 05 triggers see **zero committed active SKUs**, so B commits.
- A then commits. CI captured:
```json
{"a_exit":0,"b_exit":0,"a_error":"","b_error":"","final":"true|3|false","invariant_violation":true}
```
- Result: active SKU + invalid product route persisted in isolated PostgreSQL. This is a demonstrated concurrency weakness **of original proposed guard 05 under fixture conditions**, not proof a live business row is affected.

## Corrective candidate and gates

A review-only source file `scripts/wp10-g2-safeguards/review-only-activation-parent-lock-PROPOSAL.sql` proposes acquiring a product-row `FOR SHARE` lock before completing a transition into active state, while the product writer already uses `FOR UPDATE`. New trigger name sorts before existing activation-completeness triggers; the shared row lock is held to commit.

The candidate must never be applied independently of the route-impact guard. A new red/green test is proposed on the same isolated fixture and may establish the narrow transaction ordering, but cannot by itself prove full production lock closure. Before authorising:
1. Green proof must show harmful concurrent edit rejected, active SKU route valid; test B-first/A-first, parent inactivation, two SKUs, privileged direct activation, lock-timeout/deadlock and route mapping table mutators.
2. Independent inspect trigger order, FK constraints, authorized and privileged writer closure, audit/epoch state, effect on lock contention and advisory locks; no implicit bypass.
3. Prepare an **atomic**, fail-closed, exact-dependency-fingerprint application unit for original 05 plus the corrected activation lock; do not replay or alter applied 01/02/03/06 or the twelve classification RPCs.
4. Refresh SHA-256 manifest, rollback, grants, local negative controls, actual read-only live preflight, and separate exact owner approval before deployment.

## Programme / release status

WP10, WP11 and WP12 OPEN; 10/13 formal workpacks remain closed. The release scope decision whether 04/05/CL15 is blocking or separately accepted as deferred is not inferred from this test. Preserve WP12 real-role/11-flag, seven-view negative GETs, PWA/Windows, Cost Comparison performance and the owner-accepted parked residual register. Flag `WP10_SAFEGUARDS_V1` OFF. No production change or approval occurred from this test.
