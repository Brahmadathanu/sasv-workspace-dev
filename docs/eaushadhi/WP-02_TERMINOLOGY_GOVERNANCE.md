# WP-02 — Global Terminology Governance

**Architecture state:** DONE  
**Progress:** 100%

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
- [x] Sahasrayōgam → Sahasrayoga (28) global mapping verified as mapping 28 to portal option 473 (`Sahasrayoga / 28`).

## Client milestones
- [x] Initial Global Reference Dictionary client implemented on feature branch `feat/eaushadhi-global-reference-dictionary-client`, head `c4dad91eb2f5e0fa7f31971b48e9b0ecafb804ef`.
- [x] Correct canonical-section filtering so it is independent from source-row filtering.
- [x] Add required-selection validation before source/portal draft RPC calls.
- [x] ChatGPT independent re-audit.
- [x] Merge to main completed at `2b7ef2e2aba8cd60b65737b47de4b1f372676ba4`; remote feature branch deleted. Local feature worktree retained safely because `.tmp-smoke-userdata/` is untracked.
- [x] Operational checkout safely fast-forwarded to main and Electron restarted without worker/portal/Reference/Composition mutation.
- [x] Corrected shell architecture implemented and independently audited: Reference Dictionary is structurally exclusive/full-page, compact tables replace record cards, and browser-worker controls are consolidated behind one trigger.

## Governance verification milestones
- [x] Verified `Sahasrayōgam - Sujanapriya → Sahasrayōgam` once globally (alias 1).
- [x] Verified `Sahasrayōgam → Sahasrayoga / 28` once globally (portal mapping 28).
- [x] Proved all 1,477 Sujanapriya source-reference lines across 85 products inherit Reference readiness.
- [x] Proved `Sahasrayōgam - Vaidyapriya` remains independently DRAFT: 32 lines / 10 products remain not ready despite the shared portal mapping being VERIFIED.
- [x] Proved Product 262 / Karpooradi Thailam source composition lines 929–931 resolve through alias 1 + mapping 28 and are `reference_ready=true` without per-line Reference edits.
- [x] Independently verified live database state after each controlled mutation.
- [x] WP closure audit complete.

## Current gate
WP-02 is CLOSED and downstream-safe. The global Reference governance contract, server authority, consolidated client review workflow, controlled live verification sequence, and inherited-readiness behavior are accepted.

Final live state:
- alias 1 `Sahasrayōgam - Sujanapriya` → canonical term 160 `Sahasrayōgam`: VERIFIED.
- alias 2 `Sahasrayōgam - Vaidyapriya` → canonical term 160: DRAFT and intentionally not auto-verified.
- portal mapping 28: canonical term 160 → portal option 473 `Sahasrayoga / 28`: VERIFIED.
- Sujanapriya corpus: 1,477 / 1,477 lines ready across 85 / 85 products.
- Vaidyapriya corpus: 0 / 32 lines ready across 0 / 10 products because its alias remains DRAFT.
- Product 262 / Karpooradi Thailam lines 929–931: all Reference-ready.

Before live Composition execution resumes, retain the separate Composition content-hash caveat: re-audit/test whether the final effective Reference value is covered by the Composition execution hash.

## Prohibited until gate changes
No Composition portal mutation. No QC Register mutation. No final Submit.
