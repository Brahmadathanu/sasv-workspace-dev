# WP10 Phase 2 — correction safety gate (2026-11-16)

**Status: OPEN / NO PRODUCTION EXECUTION AUTHORISED.** Draft PR #444, candidate `scripts/wp10-g2-safeguards/experimental-parent-lock.sql` is a **fixture-only experiment**, not an installable migration. The original 04/05 guard proposals remain UNAPPLIED; `WP10_SAFEGUARDS_V1` OFF.

## Evidence already established

- GitHub Actions [run #19](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/43802068365) SUCCESS: CL1–CL9 PASS (activation-first, subgroup-first, direct privileged writes). The isolated fixture uses live-verbatim selected functions and synthetic tables. This is not a production execution.
- Baseline cross-flow test CF3 reproduces the original 05 race in disposable PostgreSQL; successful CF3 means the **defect was reproduced**, not that uncorrected 05 is safe.

## Blocking issues and closure criteria

1. **Lock-order and deadlock audit** — Inspect all live SKU writer/trigger and product writer/trigger lock acquisition sequences, FK row locks and update trigger order. Exercise opposing transactions with bounded `lock_timeout`, `statement_timeout` and `deadlock_timeout`, asserting both no integrity violation and no deadlock. A test that merely times out is NOT PASS. Confirm both app RPC and privileged direct paths; account for multiple SKU rows.
2. **Rollback scope** — Existing proposal `99_rollback_all.sql` lists `costing.fn_wp10_today_ist`, essential-state, boundary and expiry-horizon functions from **already applied Phase 1**. Never run it as a Phase-2-only rollback. Design an exact, idempotent and receipt-checked **correction-only** rollback which removes only newly installed correction objects, without touching Phase 1 functions, approved policies, business data or existing non-WP10 triggers. Prove rollback and tamper refusal on a disposable fixture. Do not silently modify 99's existing contract.
3. **Candidate installation contract** — The experimental trigger currently has no installation receipt and no dedicated rollback. It must not be promoted directly. If a trigger-based design survives lock review, create a separately reviewed, uniquely named versioned proposal with installation receipts, guarded preconditions, least privilege, safe rollout and reversal. If it does not survive, prefer a parent-first lock in the activation writer plus a proven direct-write guard, not a partial fix.
4. **Negative mutation** — Deliberately remove the parent lock or post-lock recheck in isolated test variants; require tests to fail, proving that CL3/CL6 actually detect the missing safeguard.
5. **Independent acceptance** — Pin repository commit, CI runs, live read-only catalog and pre-deployment checks; review compatibility with 04/05, client behaviour and trigger ordering. Mark any unavailable evidence NOT TESTED. Owner must separately authorise exact production SQL before application.

## Scope boundaries

No Supabase writes, production DDL, deployment, flag changes, permissions changes or WP10 closure by this document. WP11/WP12 remain OPEN; programme closure count remains 10/13. Keep the historical CRLF-only migration differences unchanged.
