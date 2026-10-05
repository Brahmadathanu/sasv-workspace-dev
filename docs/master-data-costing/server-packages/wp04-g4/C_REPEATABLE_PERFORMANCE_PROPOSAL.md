# WP04-G4 — C repeatable performance feasibility proposal

2026-10-05. **FROZEN / NOT AUTHORIZED / NOT RUN.**

Script: `c-repeatable-performance-proposal.sql`  
SHA-256: `bfcc9176b7745fb4e2e6ef0cbe357bba16c917c3d47ec7633d96a812c7c5a75f`  
Git blob: `d1f89e880c04a8e3c06a6ea9af9bf6df03758b2d`

## Governance disposition

Native Auth/API runtime verification is deferred—not waived—to G7 authenticated/live verification because G7 is the repository-designated signed-in application verification gate.

Performance is different: G4 explicitly requires residual performance to be resolved by bounded proof or reviewed feasibility disposition before the server contract is handed to G5.

Therefore this proposal addresses only G4 performance feasibility.

## Exact operation

- target: `qhmoqtxpeasamtlxaoak`
- expected main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- exact reviewed C forward package embedded unchanged before the performance section;
- one REPEATABLE READ transaction;
- lock timeout 2s;
- statement timeout 15s;
- idle-in-transaction timeout 30s;
- no actual COMMIT;
- final ROLLBACK.

After candidate identity checks, the proof:

1. uses the existing reviewed Control Center actor only through transaction-local SQL claim simulation for the server-side permission check; this is **not** native Auth/API proof;
2. creates one temporary metrics table only;
3. invokes the C OPERATIONAL portfolio exactly twice with all filters/search/cursor null and limit 1;
4. each call still computes the complete 611-SKU population/statistics;
5. verifies period 2026-09-01, valuation 2026-09-10, evidence run 115, population/matched 611, returned 1 and severity total 611;
6. stores only elapsed milliseconds, response-byte count and count/goal metadata;
7. emits no business payload;
8. reports whether both observations are <=3s and <=5s;
9. performs no timeout increase or automatic retry;
10. ends in ROLLBACK.

## Interpretation

Two observations are the minimum repeatability check for G4 feasibility, not a production SLA or concurrency benchmark.

- If both complete and both are <=5s, the C package has bounded evidence of meeting the full-statistics feasibility goal in this production observation. The <=3s flag is retained as the stricter page-response goal, but because the current contract computes full statistics in the same call, both flags describe the same combined response.
- If either completes above 5s, performance feasibility is not satisfied; stop for disposition, no automatic optimization loop.
- If either times out at 15s, treat as proof failure; no timeout increase or retry.
- G7 must still perform signed-in application/live performance verification after client integration.

## Exclusions

No native Auth/API request, CSE-P01 resolution, committed deployment, rollback rehearsal, final migration, client implementation, G5 work, or prior proof rerun is included.
