# WP04-G4 — Full-611 final-output parity source review

2026-10-05. **SOURCE REVIEW PASS — EXECUTION REQUIRES FRESH EXPLICIT AUTHORIZATION.**

Frozen script SHA-256: `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753`

## Review result

PASS:

- current main remains exactly `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`;
- one repeatable-read outer transaction;
- 2s lock timeout and unchanged 15s statement timeout;
- no actual COMMIT statement;
- final ROLLBACK present;
- current canonical RPC is not redefined or invoked;
- current enrich function is not redefined;
- current run-evidence helper is not redefined;
- candidate portfolio RPC is not invoked;
- five proof-only function names are guarded absent before creation;
- all proof-only functions are explicitly dropped before restoration check;
- 611 membership and frozen fingerprint are guarded;
- route evidence is evaluated once and shared between arms;
- C cohort coverage must equal 611;
- both arms receive the same SKU/base context and route evidence;
- comparison is complete JSON via `IS DISTINCT FROM`;
- any mismatch raises and records the first mismatching SKU in the error;
- comparison count must equal 611;
- closed C-R01/C-R02/readback/CSE/payload/no-success/ALL_EXISTING proofs are not rerun.

## Important interpretation

The original arm uses the same reviewed common LIVE base composition as the C arm, but ends through the current unchanged public enrich helper and current point run-evidence helper. The C arm ends through the cohort envelope/C enrich path.

This is intentionally narrower and safer than 611 public canonical RPC calls. Earlier sampled black-box canonical parity remains separate closed evidence supporting the common-core factoring. This proposal does not claim a second black-box full-611 public RPC census.

The proposal is still a production mutation/read-load operation because it creates transaction-scoped proof functions in the production database and performs 1,222 common-core evaluations plus cohort/route/shared reads.

## Disposition

Recommended execution decision: **AUTHORIZE ONE ATTEMPT ONLY**, with fresh main/target/source/context/digest guards, no retry, no timeout increase, final rollback, and immediate independent readback/restoration verification.

If the script times out under 15 seconds, treat that as a bounded proof failure. Do not increase the timeout automatically.
