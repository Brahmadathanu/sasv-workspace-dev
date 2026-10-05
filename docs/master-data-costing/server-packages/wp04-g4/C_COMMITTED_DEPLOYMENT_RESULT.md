# WP04-G4 — Committed C deployment result

2026-10-05. **COMMITTED DEPLOYMENT PASS / POST-DEPLOYMENT VERIFICATION PASS / CONDITIONAL ROLLBACK NOT TRIGGERED.**

## Authorization

One exact committed deployment attempt was explicitly authorized for:

- target `qhmoqtxpeasamtlxaoak`
- main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- deployment SHA-256 `cfc07ee0a731e11ba57e12d2edd3dea58c22bc05fc42c50446c9032a6132da12`
- post-deployment verification SHA-256 `35aba23abc2409a8c1bc9b434fbb36c337302e4883e1e4c1f811dff72b29658e`
- conditional rollback SHA-256 `38024dab44f4bb513588142437e2f360fc90f35e4beb17437e3266faaa008d88`
- old-state readback SHA-256 `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`

## Fresh pre-deployment guards

PASS:

- current main exactly matched authorized SHA;
- all four authorized script digests freshly recomputed and matched;
- old-state independent readback returned `overall_pass=true`;
- all 22 original definitions matched;
- original attributes/ACLs matched;
- candidates absent;
- event fingerprint matched;
- six snapshot-table column fingerprint matched;
- textual caller fingerprint matched;
- no idle WP04 transaction;
- governed valuation = 2026-09-10;
- latest matching SUCCESS run = 115;
- OPERATIONAL membership = 611;
- membership MD5 = `eeba4bf20f54589fe5b037173a79ed82`.

## Committed deployment

`c-committed-deployment.sql` executed exactly once.

Result: completed without SQL error; transaction COMMIT succeeded.

No retry occurred. Statement timeout remained 15 seconds.

## Immediate independent post-deployment verification

`c-post-deployment-verification.sql` executed exactly once.

Returned:

- candidate_identity = PASS
- governed_period_reader = PASS
- product_gap_reader = PASS
- canonical_single_read = PASS
- portfolio_full611_smoke = PASS
- native_api = DEFERRED_TO_G7
- performance_goal = UNMET_NON_BLOCKING
- business_mutation = false

The verification is read-only and ends ROLLBACK.

## Rollback disposition

Conditional rollback trigger condition was not met.

Therefore:

- `c-committed-rollback.sql` was **NOT EXECUTED**;
- conditional rollback authorization remains **NOT CONSUMED**;
- old-state rollback verification was not run post-deployment because no rollback occurred.

## Performance disposition preserved exactly

Server performance feasibility remains:

**ACCEPTED WITH MEASURED LIMITATION**

Measurements remain exactly:

- 6938.008 ms
- 5084.304 ms
- both full-611 OPERATIONAL/full-statistics
- both above provisional 3-second / 5-second engineering goals
- goals remain UNMET and must not be represented as passed
- performance authorization remains consumed
- prior restoration PASS retained

No new performance benchmark was performed during deployment verification.

## Native Auth/API disposition preserved

- structural preflight PASS;
- runtime proof NOT RUN;
- deferred to mandatory G7 authenticated/live verification;
- no bearer JWT/manual token handling occurred.

## G4 server disposition

The committed server deployment/rollback gate is **PASS**.

The deployed C server contract is now the active production state.

No G5/client implementation, merge, release, native API proof, architectural optimization or unrelated production operation occurred in this gate.
