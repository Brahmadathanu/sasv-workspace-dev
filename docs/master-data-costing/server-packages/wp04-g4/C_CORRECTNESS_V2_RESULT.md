# WP04-G4 — C correctness correction V2 execution result

2026-10-05. **ONE AUTHORIZED ATTEMPT CONSUMED — FAILED / NO RETRY.**

## Authorized identity

- Target: `qhmoqtxpeasamtlxaoak`
- Main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- Script: `c-correctness-proposal-v2.sql`
- Script SHA-256: `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`
- Independent readback SHA-256: `690047294992cf19c31b57da9e075fd175bff458cdf404513fea584a0d9f16e6`
- Authorization: exactly one attempt; no retry; no COMMIT; final ROLLBACK; independent readback required after success/error/timeout; no portfolio/performance/deployment/client/full-C work.

## Fresh pre-execution guards

PASS before the attempt:

- Git `main` exactly matched the authorized SHA.
- Supabase target resolved to project `qhmoqtxpeasamtlxaoak` / `sasv-workspace`, ACTIVE_HEALTHY.
- Proposal SHA-256 matched exactly.
- Independent readback SHA-256 matched exactly.
- Original run-evidence definition MD5 matched `c29e8b289304e7ece6f7affcccb6ffd8`.
- Temporary assembler absent.
- Governed period 2026-09-01 valuation date matched 2026-09-10.
- Latest SUCCESS run matched 115.
- Operational membership matched 611 and MD5 `eeba4bf20f54589fe5b037173a79ed82`.
- All six exact unique run/SKU index definitions matched.

## Attempt result

**FAILED. No retry performed.**

PostgreSQL error:

- SQLSTATE: `42702`
- Message: `column reference "n" is ambiguous`
- Location: C-R01 inline PL/pgSQL block, query over `source_counts`.
- Cause: the block declared PL/pgSQL variable `n bigint`, while the `source_counts` CTE also exposed `count(*) n`. The predicate `WHERE n<>611` was therefore ambiguous between the PL/pgSQL variable and CTE column.

The error occurred during C-R01 before a successful proof result was produced. C-R01 and C-R02 therefore remain **NOT PROVED AT RUNTIME** by this attempt.

No automatic retry occurred. No timeout increase, portfolio/performance test, full C application, deployment, client implementation, or unrelated server operation occurred.

## Mandatory independent readback

The separately frozen `c-independent-readback.sql` was executed immediately after the failed attempt.

Result: **PASS / ORIGINAL STATE RECONCILED.**

- `candidate_count = 0`
- `all_22_definitions_match = true`
- every listed definition check `matches = true`
- existing owner/ACL/search_path attributes match
- `columns_match = true`
- event MD5 = `4e2c16f8333e51161dc11c5376fb3296`
- `textual_callers_match = true`
- `idle_wp04_transactions = 0`

Therefore no temporary C candidate remained and the original captured source/attributes were restored/unchanged after the failed transaction.

## Disposition

This is a **proposal defect**, not evidence of a production readiness regression and not a failure of the C source direction. The exact V2 script/digest is now a consumed failed artifact and must not be silently edited or retried under the consumed authorization.

G4 remains **INCOMPLETE / APPLICATION HOLD**; G5 remains blocked; programme remains 4/13.

Any correction must be a new versioned proposal with a new digest, independently reviewed before any new explicit authorization. This result does not authorize that new operation.
