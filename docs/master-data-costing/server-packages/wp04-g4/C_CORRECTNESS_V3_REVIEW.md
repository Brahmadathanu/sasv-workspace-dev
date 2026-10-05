# WP04-G4 — C correctness correction V3 source review

## Disposition

**SOURCE REVIEW PASS — V3 IS BOUNDED AND READY FOR A SEPARATE EXPLICIT OPERATION AUTHORIZATION. NOT AUTHORIZED / NOT RUN.**

Script SHA-256: `ccb961faac0192b2cd3bcc4fd52ac2da1489ccad10f000e0dd6820360cb80eca`

This review does not claim parser/runtime success, live C-R01/C-R02 proof, portfolio performance, full-611 final-output parity, deployment readiness, G4 completion or G5 opening.

## Review findings

1. **Consumed V2 preserved:** V2 remains unchanged at SHA-256 `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`.
2. **Observed 42702 defect removed:** no C-R01 declaration `n bigint`; V3 uses `total_rows`.
3. **Source-count ambiguity removed:** CTE exposes `source_row_count` and the predicate is explicitly `sc.source_row_count<>611`.
4. **C-R01 budget preserved:** expected total remains 3666 and per-source count remains 611.
5. **Latent C-R02 qualification defect removed:** all seven expected evidence-ID expressions use `r.case_name`; no `case when case_name in (...)` remains.
6. **C-R02 case budget preserved:** eight typed literal cases; six sources/seven drivers; full JSON equality.
7. **No readiness/portfolio expansion:** zero calls to the canonical readiness RPC and zero portfolio-reader calls.
8. **Temporary candidate scope preserved:** exactly one temporary assembler CREATE and one DROP.
9. **Frozen source identities preserved:** assembler `prosrc` guard `fdb75ff20ffd5d37e5103dec6b407f8c`; original run-evidence guard `c29e8b289304e7ece6f7affcccb6ffd8`.
10. **Transaction boundary preserved:** no COMMIT; final statement is ROLLBACK.
11. **Independent reconciliation remains separate:** frozen readback SHA-256 `690047294992cf19c31b57da9e075fd175bff458cdf404513fea584a0d9f16e6`.
12. **Runtime remains NOT_RUN:** no Supabase execution was performed as part of V3 preparation/review.

## Authorization boundary

A future execution, if explicitly authorized, must:

- freshly reconcile repository/main and target;
- verify the exact V3 SHA-256;
- verify source identities, package/context guards and governed membership;
- execute V3 at most once;
- perform no automatic retry on error/timeout;
- perform the separately frozen independent readback immediately afterward;
- stop and assess evidence.

That authorization would not include portfolio/performance testing, full C application, deployment, client implementation, timeout increases or unrelated server changes.
