# WP04-G4 — C correctness correction V3 proposal

## Status

**PROPOSAL ONLY — FROZEN FOR REVIEW; NOT AUTHORIZED; NOT RUN.**

Script: `c-correctness-proposal-v3.sql`  
SHA-256: `ccb961faac0192b2cd3bcc4fd52ac2da1489ccad10f000e0dd6820360cb80eca`  
Git blob: `0ee9a03359d4db85f83384e5b45e100edecf21c7`

V2 remains immutable at SHA-256 `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`; its single authorization was consumed by the recorded SQLSTATE 42702 failure.

## Scope

V3 changes only proposal/proof mechanics. It does not alter the frozen original C source, historical evidence, production definitions or the independent readback.

### Correction 1 — observed C-R01 ambiguity

V2 declared a PL/pgSQL variable `n` while `source_counts` also exposed a column `n`. V3:

- renames the PL/pgSQL result variable to `total_rows`;
- renames the CTE count column to `source_row_count`;
- explicitly qualifies `sc.source_row_count`.

The intended C-R01 budget remains 611 operational SKUs × 6 source inputs = 3666 comparisons.

### Correction 2 — latent C-R02 record qualification

Repository review after the failed V2 attempt found that seven independently-written expected-value expressions still referred to bare `case_name`. Because V2 failed in C-R01 first, this was not reached at runtime.

V3 qualifies all seven as `r.case_name`. This is a proposal-only correction; the eight literal typed-record cases and expected JSON semantics are otherwise unchanged.

## Preserved boundaries

- target is not encoded as authorization;
- no production application;
- no COMMIT;
- final ROLLBACK;
- one temporary assembler definition, then explicit DROP;
- exact assembler body identity guard remains `fdb75ff20ffd5d37e5103dec6b407f8c`;
- original run-evidence identity remains `c29e8b289304e7ece6f7affcccb6ffd8`;
- membership guard remains 611 / `eeba4bf20f54589fe5b037173a79ed82`;
- zero canonical readiness calls;
- zero portfolio calls;
- no performance proof;
- independent readback remains separately frozen at SHA-256 `690047294992cf19c31b57da9e075fd175bff458cdf404513fea584a0d9f16e6`.

## Proof intent

C-R01 remains **EXTRACTED_INPUT_PARITY_NOT_FINAL_OUTPUT_PARITY**.

C-R02 remains **PURE_LITERAL_TYPED_RECORD_PROJECTION**, with no persisted fixtures and no claim that live present-null rows exist.

Any future runtime attempt requires a new explicit authorization bound to the exact V3 digest, target and current main. No authorization is implied by this proposal.
