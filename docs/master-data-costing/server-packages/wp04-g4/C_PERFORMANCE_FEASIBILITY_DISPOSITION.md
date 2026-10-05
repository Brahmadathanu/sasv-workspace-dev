# WP04-G4 — Bounded performance-feasibility disposition

2026-10-05. **READ-ONLY / SOURCE-ONLY DISPOSITION. NO IMPLEMENTATION, DEPLOYMENT, RERUN OR TARGET CHANGE.**

## Preserved evidence

All correctness, parity, security/source and restoration evidence remains closed.

The latest performance evidence remains exactly:

- observation 1: 6938.008 ms;
- observation 2: 5084.304 ms;
- both OPERATIONAL;
- both assess the full 611-SKU population and complete statistics despite limit=1 page output;
- both above the 5-second feasibility goal;
- authorization consumed;
- no timeout increase;
- restoration readback PASS;
- no rerun authorized.

## What cost remains structurally avoidable

### 1. Portfolio JSON orchestration

The candidate portfolio still:

- materializes the full assessed population;
- serializes full assessments into JSON;
- reparses/expands JSON for validation/incidences/counts;
- runs multiple aggregate/grouping passes before producing the page.

This is avoidable orchestration overhead. It could be reduced by keeping assessments relational longer and consolidating aggregates.

However it does **not** remove the 611 canonical readiness compositions and is therefore not a credible single correction for guaranteeing a 1.94-second improvement against the slower observed run.

### 2. Once-per-response route computation

The route reader remains a substantial demonstrated cost:

- helper diagnostic: 1819.717 ms;
- 639 Product rows;
- 214064 shared hits.

C already evaluates it once per response rather than once per SKU.

Reducing this further would require changing how route readiness is obtained—for example evaluating only the selected Product population, introducing a subset-aware route contract, or persisting/materializing route readiness.

That crosses specialist route-contract authority and is not a small WP04-G4 correction.

### 3. Per-SKU LIVE canonical composition

The portfolio still computes one canonical LIVE readiness composition for every assessed SKU before filters/statistics/page.

For the current OPERATIONAL scope this is 611 evaluations.

Each composition still preserves existing BOM/MRP/selling/commercial/batch/control and other canonical authority. C intentionally did not batch or redefine unordered commercial authority.

This is the fundamental synchronous cost remaining in the current contract.

## What is no longer a justified bounded optimization target

- six run-snapshot point reads: C already batches/cohorts the governed run evidence;
- shared issues: already once per response and measured ~8 ms;
- route evaluation: already once per response; further reduction requires route-contract redesign;
- commercial row selection: unchanged by design; CSE-P01 forbids inventing batching/order authority;
- index additions: prior inspection found relevant indexes; no missing-index evidence justifies a new index;
- smaller page size: does not reduce the full 611 assessment/statistics work.

## Can one bounded correction reasonably bring the response under 5 seconds?

**No sufficiently evidenced correction remains inside the existing architecture.**

The only clearly bounded remaining cleanup is relational/JSON orchestration. It is desirable engineering work but its contribution is unmeasured and it cannot reasonably be asserted to remove enough time to make both recorded runs reliably <5 seconds.

The only demonstrated large single component is route readiness (~1.82s), but changing its evaluation scope/contract is a broader specialist-owned architecture change.

Therefore another “one more optimization + rerun” inside G4 would be speculative and would violate the instruction to avoid an endless latency-test loop.

## Is the remaining cost fundamentally tied to synchronous full-population readiness/statistics?

**Yes, materially.**

The current contract requires:

1. authoritative readiness assessment before readiness-dependent filters;
2. full selected-population statistics;
3. page rows and statistics from the same observation;
4. no client-derived totals;
5. no partial/snapshot substitute mislabelled as live readiness.

Those requirements force the current synchronous endpoint to assess all 611 OPERATIONAL SKUs even when the returned page contains one row.

C reduced repeated evidence work, but it did not and should not eliminate those canonical per-SKU assessments.

## Status of 3-second / 5-second figures

Repository authority is explicit:

- `<=3s page / <=5s statistics` are **provisional engineering goals only**;
- they are **not existing or approved SLAs**;
- G3 may revise the targets with measurements and explicit review;
- if safe criteria cannot be met, scope/target adjustment is to be reviewed rather than hidden with a smaller page.

Therefore missing 5 seconds is a measured engineering-goal miss, not by itself a locked business-rule or governance acceptance failure.

The recent G4 proof temporarily treated 5 seconds as the feasibility test threshold, correctly recording the miss. This disposition does not retroactively convert either observation to PASS and does not silently change the threshold.

## Architectural alternatives

The following could materially reduce perceived or repeated latency, but all require broader design work:

### Separate page retrieval from statistics

Potentially gives a faster first page only if page retrieval can avoid assessing all SKUs. With readiness-dependent filters, that is not straightforward. Separate calls can also create observation inconsistency or duplicate assessment.

This changes response/consistency semantics and should not be introduced as a G4 patch.

### Cache/materialize governed readiness

Could make repeated reads fast, but introduces:

- cache/snapshot authority;
- invalidation/staleness rules;
- LIVE_AS_OF freshness semantics;
- refresh ownership/jobs;
- persisted readiness lifecycle;
- security/exposure review.

That is a new architecture, not a bounded C correction.

### Precompute on governed refresh

Potentially strongest long-term design: persist canonical readiness output/statistics keyed to governed context while retaining live-master semantics through an explicit refresh/invalidity model.

Again this changes authority/freshness semantics and belongs to a separately reviewed architectural work item.

### Subset-aware route resolution

Could remove part of the demonstrated ~1.82s route-wide cost, but requires a new/changed Production Route Manager server contract and full specialist regression.

Not appropriate to introduce silently inside WP04-G4.

## Recommendation

**Option 2 — Accept the measured performance as feasible for WP04 and record the 3s/5s engineering goals as unmet/non-blocking for this work pack, while retaining final signed-in/live performance verification at G7.**

Rationale:

- measured C improved the prior corrected 8.17s result;
- both observations completed safely under the unchanged 15s timeout;
- the response computes canonical readiness and full statistics for 611 SKUs synchronously;
- the 3s/5s figures were explicitly provisional targets, not locked SLAs;
- no remaining bounded correction has evidence strong enough to justify another production optimization cycle;
- the next meaningful speed improvements require broader architecture choices that should not be smuggled into G4.

This is a **recommendation only**. It does not change the current acceptance disposition until explicitly accepted by the programme authority.

If this recommendation is accepted, G4 performance should be recorded as:

- engineering targets: UNMET;
- bounded server feasibility: ACCEPTED WITH MEASURED LIMITATION;
- required G7 follow-up: signed-in application/live latency verification;
- architectural optimization: separate future decision/work item, not a WP04-G4 blocker.

Committed deployment/rollback would then become the remaining G4 server gate and would still require its own exact reviewed high-risk authorization.
