# WP-05 — Composition Data Completion, Verification & UX

**Architecture state:** YELLOW  
**Progress:** 35%

## Objective
Ensure every product can reach a truthful server-side Composition READY state before portal execution.

## Source model
- Proprietary product ingredient tabs.
- `PROD ING - ...` classical data where available.
- Governed manual-entry path where Composition source is missing.
- Global terminology projections for ingredient type/form/part/unit/reference.

## Existing foundations
- [x] Source composition line/review architecture exists.
- [x] Karpooradi three-line governed Composition is complete and verified for non-Reference fields.
- [x] Portal controlled vocabularies for ingredient type/form/part/unit/reference captured.
- [x] Global Reference governance moved out of per-line authority.
- [x] Product-scoped Composition filtering/review foundations exist.

## Required redesign
Current large per-ingredient cards are not suitable for high-volume operator verification. Design a dense, readable grid/table with expandable detail where needed, while preserving audit/source provenance and safe editing.

## Milestones
- [ ] Freeze Composition READY contract.
- [ ] Reconcile all source pathways and missing-composition manual entry.
- [ ] Manual entry provenance/versioning contract.
- [ ] Canonical/portal field readiness model for every line.
- [ ] Dense operator-friendly Composition UX.
- [ ] Bulk/keyboard/search/filter verification workflow.
- [ ] Product-level completeness/blocker summary.
- [ ] Representative multi-product acceptance.
- [ ] Output frozen contract to WP-06.
- [ ] WP closure audit.

## Current gate
Begins after WP-02 global terminology governance is stable and WP-01 source inventory provides a reliable gap picture.
