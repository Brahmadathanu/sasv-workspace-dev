# WP04-G4 — Full-611 final-output parity proposal

2026-10-05. **FROZEN / NOT AUTHORIZED / NOT RUN.**

Script: `c-full611-final-output-parity-proposal.sql`  
SHA-256: `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753`  
Git blob: `e0cc25664f7b17b896b5c997ddcfe99f512ad3d6`

## Purpose

Close only the remaining full-611 final-output parity obligation without reopening any completed proof and without invoking the candidate portfolio RPC.

The proposal compares two arms over the exact 611-SKU OPERATIONAL membership under one repeatable-read observation:

1. **Original arm** — the reviewed common LIVE base composition plus the current unchanged `fn_product_sku_readiness_enrich`, which retains the current point run-evidence path.
2. **C arm** — the same common LIVE base composition plus the C cohort envelope and C enrichment.

This isolates the semantic effect of the C run-evidence optimization across the full operational population.

Previously completed sampled black-box canonical parity remains closed evidence and is not rerun.

## Execution boundary

- target: `qhmoqtxpeasamtlxaoak`
- expected main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- governed period: 2026-09-01
- valuation: 2026-09-10
- SUCCESS run: 115
- membership: 611 / `eeba4bf20f54589fe5b037173a79ed82`
- `REPEATABLE READ`
- lock timeout 2s
- statement timeout 15s
- idle-in-transaction timeout 30s
- no actual COMMIT statement
- explicit final ROLLBACK

The script creates five previously absent proof functions inside the transaction:
`fn_wp04_c_run_assemble`, `fn_wp04_c_run_cohort`, `fn_wp04_c_enrich`, `fn_wp04_c_live_core`, and `fn_wp04_old_live_core`.

It does **not** replace the current public canonical RPC, current enrich function, or current run-evidence helper.

It creates one transaction-local temporary table containing only SKU ID + C evidence envelope for the 611 members.

## Workload

- one route-map evaluation;
- one shared-issues evaluation for the C arm;
- one 611-SKU cohort evidence load;
- 611 original-arm common-core evaluations using current original enrich/point evidence;
- 611 C-arm common-core evaluations using the C cohort envelope;
- complete JSON comparison for every SKU;
- zero portfolio RPC invocations;
- zero public canonical RPC invocations.

This is substantial production read load and therefore requires fresh explicit human authorization.

## Failure rule

Any guard drift, timeout, SQL/runtime error, comparison coverage shortfall or output mismatch is a STOP. No automatic retry. Final rollback/restoration reconciliation and separate readback are required before any next action.

A PASS proves only full-611 final JSON parity for the reviewed common LIVE composition between the current enrichment path and the C cohort-enrichment path. It does not prove native API behavior, performance targets, application readiness, committed deployment or rollback.
