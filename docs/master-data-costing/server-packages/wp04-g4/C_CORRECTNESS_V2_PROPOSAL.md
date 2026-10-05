# WP04-G4 — C correctness correction V2 proposal

2026-10-05. **PROPOSAL ONLY / NOT AUTHORIZED / NOT RUN.**

This proposal addresses only the two REQUIRED NOW findings in `C_EXACT_REVIEW.md`: C-R01 full-611 six-input selection equivalence and C-R02 present-row/null-status composite projection. It does not rewrite the frozen C source package, rerun historical correctness proofs, invoke the portfolio, or broaden WP04.

## Frozen identity

- Repository main reconciled before preparation: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`.
- Input exact review/handover commit: `da0969d43374820a2933fa37c52b5fb963629835`.
- Script: `c-correctness-proposal-v2.sql`.
- Exact script SHA-256 (UTF-8/LF content fetched from GitHub): `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`.
- Git blob SHA: `c26f01cac5a9098fee6fc543db16a5305f6b5fba`.
- Existing frozen independent readback remains unchanged: `c-independent-readback.sql`, SHA-256 `690047294992cf19c31b57da9e075fd175bff458cdf404513fea584a0d9f16e6`.
- Original `c-correctness-proposal.sql`, forward/rollback SQL, source capture, manifests and every historical result remain unchanged.

## C-R01 — full affected six-input equivalence

The script first binds the exact governed context: operational membership 611 with membership fingerprint `eeba4bf20f54589fe5b037173a79ed82`, period 2026-09-01, valuation 2026-09-10, SUCCESS run 115, original run-evidence definition MD5 `c29e8b289304e7ece6f7affcccb6ffd8`, and the exact definitions/validity/readiness of all six run/SKU unique indexes.

For each of the six snapshot sources, it compares across all 611 operational SKUs:

- **Original selection fragment:** the mechanically extracted point predicate from the existing run-evidence helper, including `LIMIT 1`.
- **Candidate selection fragment:** the mechanically extracted cohort-style LEFT JOIN predicate used by C.
- **Complete selected row:** `to_jsonb` of the table composite, so presence and every field/null are compared.
- **Type:** relation-type OID comparison, avoiding search-path-dependent text rendering.
- **Multiplicity:** 611 anchored observations per source plus exact unique-index guards preventing run/SKU fan-out.

Frozen read/load budget for C-R01: 3,666 point-selection observations (611 x 6), six set-wise source joins over the same 611-member cohort, one membership/context guard. **Zero readiness helper, canonical, core, route, shared-helper or portfolio business-function calls.** This is extracted-input parity only; it is explicitly not full-611 final readiness-output parity.

## C-R02 — present-row/null-status typed composite boundary

The script temporarily defines only the exact frozen C assembler body, whose `prosrc` MD5 is `fdb75ff20ffd5d37e5103dec6b407f8c`. It runs eight pure-literal typed-composite cases:

1. all six inputs absent;
2. direct-labour row present with null allocation status;
3. production-overhead row present with null allocation status;
4. QC row present with null allocation status;
5. Materials/Stores row present with null allocation status;
6. admin/finance row present with null allocation statuses;
7. Marketing row present with null allocation status;
8. all six rows present with null allocation statuses.

Expected output is an independently written projection bound to the original helper definition guard. Every case compares complete JSON, `snapshot_present`, all seven ordered driver dependencies, evidence IDs/nulls, and empty scheme/regional evidence under deliberately null context. No row is inserted, updated or persisted; no live present-null row is claimed. Some persisted tables currently constrain their status columns non-null; these literal composites test the changed typed-record transformation boundary, not live data feasibility.

## Transaction / restoration / failure boundary

- `REPEATABLE READ`.
- `lock_timeout=2s`; `statement_timeout=15s`; idle-in-transaction timeout 30s.
- No COMMIT; final explicit ROLLBACK.
- Only one temporary candidate definition: `costing.fn_wp04_c_run_assemble(...)`.
- Candidate is owner `postgres` and execution is revoked from PUBLIC/anon/authenticated/service_role.
- Exact frozen assembler body identity is checked after creation.
- Candidate is explicitly dropped before the final ROLLBACK; original run-evidence function identity is checked before and after.
- Any later authorized attempt is one attempt/no automatic retry. Timeout or unexpected error is a failed attempt, not permission to retry.
- The existing frozen `c-independent-readback.sql` must be run separately after any attempt, including error/timeout, before any disposition.

## Explicit exclusions

No production application or deployment; no portfolio/performance invocation; no full-611 final-output parity; no rerun of prior canonical/helper/core proofs; no live no-success proof; no ALL_EXISTING/filter proof; no native Auth/API proof; no CSE plan proof; no client implementation; no route/commercial/index redesign.

The SQL file is a frozen proposal for review. Its existence in Git is traceability only and is not authorization to execute it.
