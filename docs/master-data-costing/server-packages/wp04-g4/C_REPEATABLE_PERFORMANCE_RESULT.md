# WP04-G4 — C repeatable performance feasibility result

2026-10-05. **ONE AUTHORIZED ATTEMPT CONSUMED — FEASIBILITY GOAL NOT MET — RESTORATION PASS.**

## Authorized package

- Script: `c-repeatable-performance-proposal.sql`
- SHA-256: `bfcc9176b7745fb4e2e6ef0cbe357bba16c917c3d47ec7633d96a812c7c5a75f`
- Target: `qhmoqtxpeasamtlxaoak`
- Main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`
- exactly one execution attempt;
- exactly two OPERATIONAL portfolio observations;
- statement timeout unchanged at 15s;
- no timeout increase;
- no retry;
- no COMMIT;
- final ROLLBACK.

## Fresh guards

PASS:

- current main exactly matched authorized SHA;
- script SHA-256 freshly recomputed and matched;
- canonical/enrich/run-evidence/shared/route/commercial source identities matched;
- governed valuation = 2026-09-10;
- latest matching SUCCESS run = 115;
- OPERATIONAL membership = 611;
- membership MD5 = `eeba4bf20f54589fe5b037173a79ed82`;
- candidate collision count = 0.

## Performance observations

Both observations used:

- period 2026-09-01;
- OPERATIONAL population;
- all filters/search/cursor null;
- limit 1;
- full 611-SKU population/statistics evaluation;
- response size 14,491 PostgreSQL JSONB text bytes;
- matched_count 611;
- returned_count 1;
- severity_total 611.

Observation 1:

- elapsed: **6938.008 ms**
- within 3s: false
- within 5s: false

Observation 2:

- elapsed: **5084.304 ms**
- within 3s: false
- within 5s: false

Aggregate:

- min: **5084.304 ms**
- max: **6938.008 ms**
- both within 3s: false
- both within 5s: false

## Interpretation

The C package materially improves on the earlier corrected historical ~8.17s observation, but the agreed feasibility rule is not relative improvement; it is whether the bounded full-statistics response meets the defined 5s goal.

It did not.

Therefore:

- G4 C performance feasibility goal: **NOT MET**
- target relaxation: **NOT PERMITTED**
- timeout increase: **NOT USED**
- automatic optimization loop: **NOT AUTHORIZED**
- native API: deferred to G7 as previously dispositioned
- committed deployment: **NOT AUTHORIZED**

The second observation was close to 5s, but 5084.304 ms remains above the goal and must not be rounded into PASS.

## Restoration

Immediate independent readback after the attempt returned `overall_pass=true`:

- all 22 original definitions match;
- no definition mismatch;
- attributes match;
- candidate/proof functions absent;
- event fingerprint match;
- column shape match;
- textual callers match;
- no idle WP04 transactions;
- mutation_performed=false;
- v3_replayed=false;
- portfolio_invoked=false in readback.

Production restoration is clean.

## Disposition

The authorization is **CONSUMED**.

Do not rerun this package under the consumed authorization.

G4 remains INCOMPLETE / APPLICATION HOLD because performance feasibility is unresolved. Committed deployment/rollback must not proceed as though performance passed.

All previously closed correctness/security/source evidence remains closed and must not be reopened. Native Auth/API runtime remains deferred to mandatory G7 verification and is not the current blocker.
