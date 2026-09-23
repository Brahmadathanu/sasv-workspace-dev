# WP-02 — Global Terminology Governance

**Architecture state:** BLUE  
**Progress:** 70%

## Objective
Provide reusable global canonical-to-source and canonical-to-portal governance so portal terminology is consistent across products while canonical SASV terminology remains reusable.

## Completed server milestones
- [x] REFERENCE_WORK controlled-term domain established.
- [x] Global `controlled_term_alias` authority implemented.
- [x] Global source-reference candidate/draft/verify RPCs implemented.
- [x] Global canonical Reference Work creation/options RPCs implemented.
- [x] Global canonical→portal `term_portal_mapping` authority retained.
- [x] Global portal mapping DRAFT-create RPC implemented.
- [x] Worker/product projections cut over from per-line Reference authority.
- [x] Legacy per-line Reference work columns marked non-authoritative.
- [x] Sahasrayōgam - Sujanapriya DRAFT alias seeded.
- [x] Sahasrayōgam - Vaidyapriya DRAFT alias seeded.
- [x] Sahasrayōgam → Sahasrayoga (28) remains global DRAFT.

## Client milestones
- [x] Initial Global Reference Dictionary client implemented on feature branch `feat/eaushadhi-global-reference-dictionary-client`, head `c4dad91eb2f5e0fa7f31971b48e9b0ecafb804ef`.
- [ ] Correct canonical-section filtering so it is independent from source-row filtering.
- [ ] Add required-selection validation before source/portal draft RPC calls.
- [ ] ChatGPT independent re-audit.
- [ ] Merge/cleanup.
- [ ] Operational checkout sync/restart.
- [ ] Visual client verification.

## Governance verification milestones
- [ ] Verify `Sahasrayōgam - Sujanapriya → Sahasrayōgam` once globally.
- [ ] Verify `Sahasrayōgam → Sahasrayoga (28)` once globally.
- [ ] Prove all matching lines/products inherit readiness.
- [ ] Verify multiple distinct source references/canonical works remain independent.
- [ ] WP closure audit.

## Current gate
Apply the two bounded client corrections on the existing feature branch; do not widen scope.

## Prohibited until gate changes
No Composition portal mutation. No QC Register mutation. No final Submit.
