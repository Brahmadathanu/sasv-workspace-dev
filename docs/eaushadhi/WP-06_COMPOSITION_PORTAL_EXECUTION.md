# WP-06 — Composition Portal Execution

**Architecture state:** YELLOW  
**Progress:** 45%

## Objective
Safely execute verified server Composition data into the portal and record durable server-side progress/evidence.

## Frozen input dependency
WP-05 Composition READY v1 is now the accepted input boundary for this work pack.

WP-06 must consume only fresh server-governed snapshots that satisfy that contract. It must not rediscover or decide Composition data in the portal.

## Existing portal contract
- Page: `/admin/addcomposition`.
- Save is per line via native `SaveCompositionData`.
- Required fields include ingredient name, botanical name, ingredient type, reference, ingredient form, part used, quantity and unit.
- Reference placeholder `-1` is rejected.
- Native list/reread endpoints captured.
- Update/delete exist but are prohibited for normal V1.
- Offline fail-closed Composition semantic planner exists.
- `COMPOSITION_LIVE_ARM_DEFAULT=false`.

## Approved safety invariants
Governance preflight → exact page/product identity → complete list → classify existing rows → exactly missing governed rows eligible → durable SAVE_ARMED → one Save at most once → fresh list → bounded row-ID parse → native reread → exact semantic compare → no automatic retry after uncertain Save → no unexplained extras → final exact set → mark stage PORTAL_VERIFIED → stop before final Submit.

No implicit portal-mutation permission carries from Product Details, the first bootstrap row, post-entry reconciliation, or another portal stage.

## Karpooradi live evidence
Product 262 / Karpooradi Thailam is the controlled Composition execution proof product.

Proven:

- native Composition list endpoint and empty/nonempty response contracts;
- page-controlled vocabularies and Reference-by-Ingredient-Type loader;
- native Save request shape;
- edit-row hidden identity and `GetCompositionDataUpdate` reread contract;
- list rows are label-oriented while native reread returns controlled portal values;
- Reference portal value 28 = Sahasrayoga;
- Measurement portal value 9 = ML;
- Part Used portal value 113 = SEED;
- Ingredient Type portal value 1 = ACTIVE INGREDIENTS;
- first controlled Ajamōdā row was manually bootstrapped and reread exactly as LIQUID KWATH / 60;
- row identity/reread semantics are proven without invoking Update/Delete;
- governed post-entry reconciliation then aligned the server to the actual formulation-specific Ingredient Forms:
  - Ajamōdā = LIQUID KWATH / 60;
  - Karpūra = SOLID / 66;
  - Kēram = OIL / 61.

Current live portal Composition remains partial: only Ajamōdā is present. Karpūra and Kēram are not yet entered.

## Content/snapshot rule
The execution snapshot is server authoritative.

- Reference effective `portal_value` participates in server `content_hash`.
- Governed Ingredient Form changes participate in server `content_hash`.
- `payload_hash` must not be conflated with authoritative `content_hash`.
- No JavaScript hash implementation is permitted.
- Any post-entry reconciliation requires a fresh governed snapshot/preflight before another portal mutation.

## Milestones
- [x] Read-only portal contract investigation.
- [x] First-line bootstrap contract designed offline.
- [x] Freeze Composition READY input contract from WP-05.
- [ ] Durable server lifecycle/run model specialized for Composition execution.
- [ ] Implement live Composition executor while arm remains default OFF.
- [x] Controlled first-line bootstrap on Karpooradi.
- [x] Prove row edit-ID and unitname/reread value semantics.
- [ ] Continue remaining lines under the durable WP-06 mutation gate with no normal Update/Delete.
- [ ] Final exact-set reconciliation and Composition-stage PORTAL_VERIFIED evidence.
- [ ] Representative regression.
- [ ] WP closure audit.

## Current gate
Freeze and implement the durable Composition-specific run/executor lifecycle around the frozen WP-05 READY v1 input.

Until that contract is audited and the next mutation gate is explicitly opened:

- do not manually continue Karpūra or Kēram portal entry;
- do not invoke native Composition Save/Update/Delete;
- keep `COMPOSITION_LIVE_ARM_DEFAULT=false`;
- do not touch QC Register or final Submit.

The next portal mutation must occur inside this work pack with explicit bounded authorization, durable server progress evidence, fresh governed snapshot/hash, exact-list classification and post-save reread/semantic proof.
