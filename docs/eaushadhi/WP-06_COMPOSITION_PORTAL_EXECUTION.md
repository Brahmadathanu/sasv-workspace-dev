# WP-06 — Composition Portal Execution

**Architecture state:** YELLOW  
**Progress:** 20%

## Objective
Safely execute verified server Composition data into the portal and record durable server-side progress/evidence.

## Existing portal contract
- Page: `/admin/addcomposition`.
- Save is per line via native `SaveCompositionData`.
- Required fields include ingredient name, botanical name, ingredient type, reference, ingredient form, part used, quantity and unit.
- Reference placeholder -1 is rejected.
- Native list/reread endpoints captured.
- Update/delete exist but are prohibited for normal V1.
- Offline fail-closed composition contract helper exists.
- `COMPOSITION_LIVE_ARM_DEFAULT=false`.

## Approved safety invariants
Governance preflight → exact page/product identity → complete list → classify existing rows → exactly missing governed rows eligible → durable SAVE_ARMED → one Save at most once → fresh list → bounded row-ID parse → native reread → exact semantic compare → no automatic retry after uncertain Save → no unexplained extras → final exact set → mark stage PORTAL_VERIFIED → stop before final Submit.

## Milestones
- [x] Read-only portal contract investigation.
- [x] First-line bootstrap contract designed offline.
- [ ] Freeze Composition READY input contract from WP-05.
- [ ] Durable server lifecycle/run model for Composition execution.
- [ ] Implement live executor while arm remains default OFF.
- [ ] Controlled first-line bootstrap on Karpooradi.
- [ ] Prove row edit-ID and unitname semantics.
- [ ] Continue remaining lines with no update/delete.
- [ ] Final exact-set reconciliation and PORTAL_VERIFIED stage.
- [ ] Representative regression.
- [ ] WP closure audit.

## Current gate
Blocked from mutation until WP-05 Composition READY contract and WP-02 global Reference readiness are complete.
