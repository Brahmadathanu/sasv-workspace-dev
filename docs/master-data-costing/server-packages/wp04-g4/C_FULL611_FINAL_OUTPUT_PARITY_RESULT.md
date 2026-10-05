# WP04-G4 — Full-611 final-output parity attempt result

2026-10-05. **ONE AUTHORIZED ATTEMPT CONSUMED — TIMEOUT / PARITY NOT PROVED.**

## Authorized package

- Script: `c-full611-final-output-parity-proposal.sql`
- SHA-256: `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753`
- Target: `qhmoqtxpeasamtlxaoak`
- Main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- One attempt only
- statement timeout: 15s
- no retry / no timeout increase
- final rollback boundary

## Fresh pre-execution guards

PASS:

- current `main` exactly matched the authorized SHA;
- target project healthy;
- script SHA-256 freshly recomputed and matched exactly;
- current database/user = postgres/postgres;
- enrich MD5 = `65b40f9ac648ee077641c84eaee18497`;
- run-evidence MD5 = `c29e8b289304e7ece6f7affcccb6ffd8`;
- shared helper MD5 = `7467604a4929b59412181c3c7481e0e8`;
- route helper MD5 = `29835ce9be925dfe0afdea8133d8217a`;
- governed valuation = 2026-09-10;
- latest matching SUCCESS run = 115;
- OPERATIONAL membership = 611;
- membership MD5 = `eeba4bf20f54589fe5b037173a79ed82`;
- proof-function collision count = 0.

## Runtime result

The single authorized attempt timed out under the unchanged 15-second statement timeout.

PostgreSQL error:

- SQLSTATE: `57014`
- reason: canceling statement due to statement timeout
- active path at cancellation:
  - `fn_resolve_sales_allocation_default_policy_as_of`
  - `fn_resolve_sku_commercial_sales_basis_point`
  - SQL inside `fn_wp04_old_live_core`
  - inline proof block assignment

No retry occurred. The timeout was not increased.

Because the attempt terminated before the proof completed, there is no valid 611 comparison count or mismatch count to promote. Therefore:

- full-611 final-output parity: **NOT PROVED**
- mismatch claim: **NONE MADE**
- performance claim: **NONE**
- application authorization: **NO**

## Independent restoration/readback

Immediately after the timed-out attempt, the separately frozen read-only completion readback was executed solely for restoration verification.

Result: `overall_pass=true`.

PASS:

- database/owner context;
- all 22 original definitions;
- no definition mismatch;
- attributes;
- candidate/proof functions absent;
- event fingerprint;
- six-table column shape;
- textual callers;
- no idle WP04 transaction.

Boundary fields:

- `mutation_performed=false`
- `v3_replayed=false`
- `portfolio_invoked=false`

Therefore the failed proof attempt left no production schema/function residue or known source drift.

## Disposition

The one-attempt authorization is **CONSUMED**.

Do not rerun this exact package under the consumed authorization.

The timeout is a bounded proof failure, not evidence of output mismatch. Full-611 final-output parity remains unresolved.

All previously closed evidence remains closed and must not be reopened:

- C-R01 PASS
- C-R02 PASS
- independent readback PASS
- CSE compatibility PASS
- payload/nonmonetary/monetary-note PASS
- live no-success compatibility PASS
- ALL_EXISTING/filter behavior PASS

G4 remains INCOMPLETE / APPLICATION HOLD. Native Auth/API, full-611 final-output parity, repeatable performance and committed deployment/rollback remain unresolved. No portfolio execution, performance benchmark, deployment, full C application, G5 or client work occurred.
