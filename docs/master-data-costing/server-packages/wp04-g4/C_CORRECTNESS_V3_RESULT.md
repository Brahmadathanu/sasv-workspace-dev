# WP04-G4 — C correctness correction V3 execution result

2026-10-05. **ONE AUTHORIZED V3 ATTEMPT CONSUMED — CORRECTNESS PROOF PASS.**

## Authorized identity

- Target: `qhmoqtxpeasamtlxaoak`
- Main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- Script: `c-correctness-proposal-v3.sql`
- Script SHA-256: `ccb961faac0192b2cd3bcc4fd52ac2da1489ccad10f000e0dd6820360cb80eca`
- Frozen independent readback SHA-256: `690047294992cf19c31b57da9e075fd175bff458cdf404513fea584a0d9f16e6`

Authorization permitted exactly one V3 attempt, no retry, no COMMIT, final ROLLBACK, immediate independent readback, then stop. It did not authorize portfolio/performance testing, full C application, deployment, timeout increase, client implementation, or unrelated server changes.

## Fresh pre-execution guards

PASS before execution:

- Git `main` exactly matched authorized SHA.
- Supabase target resolved to `qhmoqtxpeasamtlxaoak` / `sasv-workspace`, ACTIVE_HEALTHY.
- V3 SHA-256 matched exactly.
- Frozen independent readback SHA-256 matched exactly.
- Frozen C forward draft SHA-256 matched `83766951ef244941ca6b0679e70b8a18d240a3a9ed3d8c2b3d8bafe7220bc055`.
- Frozen source-before SHA-256 matched `671503e113896b70be78a3246eca49cd9009eb9c0ed1844b4e772dacd7af77f1`.
- Frozen package identities SHA-256 matched `f9521353e8b2daa10f9a33ea0138565ea5b46d658e04f7c948a6bd591cd383f1`.
- Original run-evidence definition MD5 matched `c29e8b289304e7ece6f7affcccb6ffd8`.
- Temporary assembler absent.
- Governed period 2026-09-01 valuation date matched 2026-09-10.
- Latest SUCCESS run matched 115.
- Operational membership matched 611 / `eeba4bf20f54589fe5b037173a79ed82`.
- All six exact unique run/SKU index definitions matched.

## V3 execution result

**PASS. One attempt only. No retry.**

### C-R01

Returned:

- scope: `EXTRACTED_INPUT_PARITY_NOT_FINAL_OUTPUT_PARITY`
- population SKUs: 611
- sources: 6
- comparison rows: 3666
- old point selections: 3666
- candidate set-join sources: 6
- mismatches: 0
- type mismatches: 0
- multiplicity failures: 0
- readiness helper calls: 0
- canonical calls: 0
- core calls: 0
- portfolio calls: 0

Therefore the bounded six-input selection equivalence proof passed for all 611 operational SKUs. This is input parity only; it is not full-611 final-output parity.

### C-R02

Returned:

- proof kind: `PURE_LITERAL_TYPED_RECORD_PROJECTION`
- cases: 8
- sources: 6
- drivers: 7
- absent cases: 1
- present-null single-source cases: 6
- present-null all-sources cases: 1
- complete JSON compared: true
- persisted fixture writes: 0
- live present-null row claimed: false

Therefore the bounded literal typed-record projection proof passed.

The script also returned:

- `application_authorized=false`
- `performance_proved=false`
- `full611_final_output_parity=NOT_RUN`

## Independent readback handling

The separately frozen independent-readback script was invoked immediately after V3 as required, but the platform blocked the tool call **before it reached Supabase**. This was not a database error and the readback script did not execute.

No retry of V3 occurred.

A compact read-only restoration/reconciliation query was then run solely to verify critical post-transaction state. It returned:

- candidate_count = 0
- temporary assembler absent = true
- canonical MD5 = `0e966c3c1ab15d56420b234f5c2cef1f`
- enrich MD5 = `65b40f9ac648ee077641c84eaee18497`
- run-evidence MD5 = `c29e8b289304e7ece6f7affcccb6ffd8`
- shared helper MD5 = `7467604a4929b59412181c3c7481e0e8`
- route helper MD5 = `29835ce9be925dfe0afdea8133d8217a`
- commercial point helper MD5 = `68bd9325062299eb8af1291bf4d9393b`
- idle WP04 transactions = 0

These critical restoration checks match the frozen identities. However, because the exact frozen independent-readback script did not reach the database, this evidence must **not** be labelled a full frozen independent-readback PASS.

## Disposition

- C-R01 runtime proof: **PASS**
- C-R02 runtime proof: **PASS**
- V3 authorization: **CONSUMED**
- V3 retry: **NOT AUTHORIZED**
- transaction residue on checked critical state: **NONE OBSERVED**
- exact frozen independent readback: **NOT EXECUTED — PLATFORM BLOCKED BEFORE SUPABASE**
- compact critical reconciliation: **PASS**
- performance proof: **NOT RUN**
- full-611 final-output parity: **NOT RUN**
- full C application/deployment/client work: **NOT AUTHORIZED / NOT RUN**

G4 therefore remains **INCOMPLETE / APPLICATION HOLD**. The correctness omissions C-R01/C-R02 are closed at runtime, but the exact independent-readback evidence remains incomplete and other previously identified G4 proofs remain outstanding.
