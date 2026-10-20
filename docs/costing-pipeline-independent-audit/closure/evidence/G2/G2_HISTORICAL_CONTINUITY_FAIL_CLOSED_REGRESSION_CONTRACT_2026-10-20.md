# G2 historical continuity — fail-closed regression contract (20 October 2026)

**Preparation only. G2 OPEN; no live execution or approval.**

## Confirmed defects
1. Family successor approval updates predecessor to SUPERSEDED with `effective_to=new_start-1`, but `costing.fn_resolve_effective_route_family_route` searches APPROVED only.
2. Product-route successor approval applies the same predecessor transition, but `costing.fn_resolve_effective_product_process_route` searches APPROVED only. Its current `count(*) > 1` ambiguity rejection must survive.
3. `costing.fn_product_process_route_readiness` has an independent APPROVED-only, date-scoped family-route selector.
4. `costing.fn_validate_product_process_route` requires the base family route to be APPROVED with no historic-date distinction. New approval and review RPCs invoke this validator, so indiscriminately accepting SUPERSEDED would compromise prospective controls.
5. Onboarding's latest-version display and direct-ID preview are NOT historical resolver defects; preserve their semantics.

## Additional verified database constraint
`product_process_route_no_approved_overlap` GiST exclusion prohibits overlaps among non-archived APPROVED versions of a product, using inclusive daterange endpoints. Its partial predicate does **not** prohibit historical SUPERSEDED-versus-APPROVED overlap. The candidate repair must explicitly maintain ambiguity rejection for all date-eligible statuses and require validated temporal provenance; do not assume inclusion of SUPERSEDED is automatically safe.

## Mandatory isolated PostgreSQL scenarios
- F1: family predecessor APPROVED valid on day D-1; successor APPROVED valid on D; old predecessor later SUPERSEDED with effective_to D-1. Historical resolution D-1 returns old; D returns new.
- F2: archived, draft, rejected, inactive, future-effective and expired routes never resolve outside allowed periods.
- F3: two eligible historical route rows at one date must fail closed (no arbitrary first/latest resolution); verify family and product routes.
- P1: product-specific predecessor similarly resolves as of D-1 and successor at D, with preserved explicit ambiguity exception.
- P2: historical product-route validation accepts only documented previously approved base valid for its relevant date; approval of a NEW product route against historical superseded base must still fail.
- P3: approval/review RPC remain permission-controlled, reference-validated, and fail closed on invalid base, stale family assignment, incorrect batch_size_ref ownership, or invalid overrides.
- R1: readiness family ID, effective route source and validation agree with resolved old/new as-of version. Check both inherited and product override paths.
- R2: current onboarding latest-version remains unchanged; direct-ID candidate preview remains preview-only.
- C1: compare untouched run122 and run128 IDs, snapshot row counts and totals before/after isolated tests; no live writes.
- C2: Dhanyamlam eight total repetitions (never 8x8) and genuine other repeat routes (e.g. 41, 40) remain individually correct; DL and POH remain separately reconciled.
- C3: source route144 must not be edited in place; successor v2 draft with governed steps/approval only after separate authorisation, WP04 epoch/readiness tests, and explicit financial and user approval.

## Proposed implementation order (not approved)
1. In isolated fixture, define eligible historical status+effective-period policy, explicit multiple-match rejection and provenance assumptions.
2. Test family and product resolvers together; update independent date-scoped readiness selector consistently.
3. Separate historical product-route validation from strict submit/approve eligibility with the minimum change to existing architecture; preserve immutable steps and standard production_batch_size_ref.
4. Test all known callers and audited independent selectors, including rollback semantics.
5. Report before/after cases and freeze migration proposal for explicit approval. No production SQL, cron, activation, pricing or branch merge.

### STOP conditions
Any unresolved overlap, broadened authorisation, historical result mismatch, bypassed batch reference, unclear production mass/cycle semantics, pool imbalance, or WP04 readiness regression stops migration approval.

### Verified / unverified boundary
Constraints and function source examined through live SELECT only. This is a **test specification, not an executed integration suite**. No statement here claims tests passed.
