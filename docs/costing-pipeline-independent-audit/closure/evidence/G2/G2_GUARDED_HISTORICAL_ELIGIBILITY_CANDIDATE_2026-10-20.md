# G2 historical route eligibility — guarded candidate, 20 Oct 2026

**Decision state: proposed, NOT approved or deployed.**

Read-only verified: family32 old route30 SUPERSEDED Aug17–23, route34 SUPERSEDED Aug24, current route38 APPROVED from Aug24. There is therefore a clean old-only window followed by a same-day collision. Across all 18 non-archived SUPERSEDED family routes, 17 have closed effective_to and one has open-ended effective_to. Previously verified 17 cross-status overlaps persist; frozen runs122/128 contain zero superseded predecessors in DL/POH snapshots.

## Guarded eligibility proposal
1. First determine ALL effective date-matching, unarchived family/product route rows with status APPROVED or SUPERSEDED.
2. Reject ambiguity when more than one such row covers the valuation date. Never resolve by highest version, approved timestamp or status precedence; this sacrifices availability on overlapping historical dates but avoids inventing a record's operational validity.
3. If exactly one candidate remains, accept it for **historical read/validation only**, provided superseded candidate has an explicit closed effective_to and the as-of date is in that window. An open-ended SUPERSEDED candidate is unresolved and must fail closed pending provenance; do not silently treat it as indefinitely valid.
4. For present-day new route submission and approval retain the existing strict APPROVED base-route test and permission/evidence controls. Never use this historical eligibility alone to approve a draft.
5. Apply compatible guarded semantics to family resolver, product resolver, independent readiness and historical product-route validation only after verifying their date contracts. Keep latest-version onboarding and direct-ID previews intact.
6. For same-day overlap cases (e.g. family32 Aug24 and product957 Aug25), return a clear conflict requiring governed historical evidence rather than a guessed winner. The alternative of treating newer approved version as authoritative is NOT adopted without operator proof.
7. Do not modify dates, status, approved routes, snapshots or run122/128 in an attempt to make this policy pass.

## Still to prove
- Genuine operational applicability for each exceptional overlap and whether historical reconstructions require such dates.
- Full PostgreSQL regression under actual stored procedures; earlier JS fixture is only a model.
- Financial impact DL/POH and workload semantics (Dhanyamlam eight total repetitions, other legitimate cycles) under proposed new plant-aware computation.
- WP04 readiness and strict prospective approval behavior.

G2/CI-032 HIGH OPEN. No live changes.
