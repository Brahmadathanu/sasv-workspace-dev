# WP-02 — Global Terminology Governance

**Architecture state:** PURPLE  
**Progress:** 99%

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
- [x] Correct canonical-section filtering so it is independent from source-row filtering.
- [x] Add required-selection validation before source/portal draft RPC calls.
- [x] ChatGPT independent re-audit.
- [x] Merge to main completed at `2b7ef2e2aba8cd60b65737b47de4b1f372676ba4`; remote feature branch deleted. Local feature worktree retained safely because `.tmp-smoke-userdata/` is untracked.
- [x] Operational checkout safely fast-forwarded to main and Electron restarted without worker/portal/Reference/Composition mutation.
- [x] Corrected shell architecture implemented and independently audited: Reference Dictionary is structurally exclusive/full-page, compact tables replace record cards, and browser-worker controls are consolidated behind one trigger.

## Governance verification milestones
- [ ] Verify `Sahasrayōgam - Sujanapriya → Sahasrayōgam` once globally.
- [ ] Verify `Sahasrayōgam → Sahasrayoga (28)` once globally.
- [ ] Prove all matching lines/products inherit readiness.
- [ ] Verify multiple distinct source references/canonical works remain independent.
- [ ] WP closure audit.

## Current gate
Final shell is operationally synced and visually accepted; shell is now frozen for WP-02. Live pre-verification state is confirmed: alias 1 `Sahasrayōgam - Sujanapriya → Sahasrayōgam` is DRAFT; alias 2 `Sahasrayōgam - Vaidyapriya → Sahasrayōgam` remains DRAFT; canonical portal mapping 28 `Sahasrayōgam → Sahasrayoga / external 28` remains DRAFT. Verify alias 1 first, prove the resulting state, then verify mapping 28 separately.

## Prohibited until gate changes
No Composition portal mutation. No QC Register mutation. No final Submit.
