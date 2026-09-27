# WP-06 — Composition Portal Execution

**Architecture state:** GREEN  
**Progress:** 50%

## Objective
Safely execute verified server Composition data into the portal and record durable server-side progress/evidence.

## Frozen input dependency
WP-05 Composition READY v1 is the accepted input boundary for this work pack.

WP-06 consumes only fresh server-governed snapshots that satisfy that contract. It must not rediscover or decide Composition data in the portal.

## Existing portal contract
- Page: `/admin/addcomposition`.
- Save is per line via native `SaveCompositionData`.
- Required fields include ingredient name, botanical name, ingredient type, reference, ingredient form, part used, quantity and unit.
- Reference placeholder `-1` is rejected.
- Native list/reread endpoints captured.
- Update/delete exist but are prohibited for normal V1.
- Offline fail-closed Composition semantic planner exists.
- `COMPOSITION_LIVE_ARM_DEFAULT=false`.

## Stage-independence decision

The existing `regulatory.eaushadhi_worker_run` plus `regulatory.eaushadhi_product_workflow.entry_status` lifecycle is the Product Details execution authority and is already historically PORTAL_VERIFIED for Product 262.

It MUST NOT be reused for Composition because:

- its begin RPC requires product-level `entry_status = NOT_STARTED`;
- its mark-entered/portal-verified RPCs mutate the product-level Product Details lifecycle;
- Product 262 already has a completed Product Details run;
- reusing it would violate the programme rule that Product Details, Composition and QC Register are independently tracked stages.

WP-06 therefore uses a separate Composition-specific server lifecycle.

## Frozen Composition execution lifecycle v1

### 1. Composition stage state

Create one server row per product in a Composition-stage table.

Required stage statuses:

- `NOT_STARTED`
- `PARTIAL`
- `PORTAL_VERIFIED`

An active run is represented by the run table, not by overloading stage status.

The stage row owns:

- product identity;
- stage status;
- stage row version;
- latest governed `content_hash`;
- latest governed workflow row version observed;
- governed line count;
- proven portal-match count;
- latest durable evidence;
- verified actor/time when PORTAL_VERIFIED;
- audit timestamps/actor.

The stage row MUST NOT mutate Product Details `entry_status`.

### 2. Composition run

A run authorizes at most one governed missing Composition line.

Each run binds:

- one product;
- one target `source_composition_line_id`;
- one starting workflow row version;
- one starting server `content_hash`;
- one stage row version;
- exact portal product identity;
- page identity evidence;
- complete before-list evidence;
- frozen offline planner report;
- server-derived target governed projection;
- save outcome/evidence;
- after-list evidence;
- native reread evidence;
- resolved portal row identity;
- run actor/timestamps.

V1 remains restricted to Product 262 until representative acceptance expands the contract.

### 3. Run statuses

Required run statuses:

- `SAVE_ARMED`
- `SAVE_CONFIRMED`
- `SAVE_AMBIGUOUS`
- `SAVE_REJECTED`
- `ROW_VERIFIED`

Only `SAVE_ARMED`, `SAVE_CONFIRMED` and `SAVE_AMBIGUOUS` are active/nonterminal.

A partial unique index MUST prevent more than one active Composition run per product.

### 4. Arm authority

The offline planner NEVER authorizes mutation and keeps `mutationAllowed=false`.

Portal Save authority exists only after a server RPC creates a durable `SAVE_ARMED` run.

Arm requires all of the following:

1. authenticated e-Aushadhi edit permission;
2. Product 262 for controlled V1;
3. current workflow row version exactly matches;
4. fresh server `content_hash` exactly matches expected;
5. WP-05 Composition READY v1 remains satisfied;
6. no active Composition run exists;
7. page route/product/portal identity evidence is exact;
8. before-list evidence is settled, successful and complete;
9. planner report is `OFFLINE_MISSING`, `ok=true`, `mutationAllowed=false`;
10. no blockers/conflicts/duplicates/extras are present;
11. planner governed count equals fresh governed Composition count;
12. planner matches + missing source IDs form an exact, duplicate-free partition of the current governed source IDs;
13. requested target source line appears exactly once in the planner missing set;
14. target line authority is re-derived from the fresh server payload, never trusted from renderer-provided field values.

A successful arm stores the full bounded evidence and returns one run ID plus the server-derived target projection.

### 5. One-save-at-most-once rule

The live executor may invoke native `SaveCompositionData` only when:

- Composition live arm is explicitly enabled by trusted Electron code;
- a current `SAVE_ARMED` run exists;
- run product/target/hash/stage version still match;
- page identity still matches.

The executor must issue native Save at most once for that run.

There is no automatic retry after invocation uncertainty.

### 6. Save outcome

Immediately after the single Save attempt, record exactly one durable outcome:

- `CONFIRMED` → run becomes `SAVE_CONFIRMED`;
- `AMBIGUOUS` → run becomes `SAVE_AMBIGUOUS`;
- `REJECTED` with strong proof no mutation occurred → run becomes `SAVE_REJECTED`.

A terminal `SAVE_REJECTED` run grants no retry authority; a later attempt requires a new fresh plan and new run.

An ambiguous run blocks automatic retry and must be recovered only by fresh list/reread evidence.

### 7. Row verification

After CONFIRMED or AMBIGUOUS Save, capture:

- fresh complete list;
- bounded portal row identity;
- native `GetCompositionDataUpdate` reread;
- fresh offline planner result.

Row verification requires:

1. content hash and workflow version still equal run authority;
2. target source line now appears exactly once in planner `matches`;
3. target no longer appears in `missing`;
4. native reread row identity equals the bounded list row identity;
5. all governed semantic fields match the server-derived target projection using frozen strict semantics;
6. Reference is proven by portal VALUE, not label-only;
7. no conflicts, duplicates, unexplained extras or ambiguity exist.

Then the run becomes `ROW_VERIFIED` and stage evidence/counts update.

### 8. Final exact-set verification

Final stage PORTAL_VERIFIED is a separate server action after a fresh complete list and planner result.

It requires:

- current server hash/workflow authority;
- planner code `ALREADY_COMPLETE`;
- exact governed/portal set equality;
- no blockers/conflicts/duplicates/extras/ambiguity;
- every portal row has bounded identity/reread semantics where required by the final evidence contract;
- no active Composition run.

Only then may Composition stage status become `PORTAL_VERIFIED`.

This MUST NOT change Product Details `entry_status`.

### 9. Bootstrap compatibility

The existing manually bootstrapped Ajamōdā row is historical portal evidence, not a reason to bypass the lifecycle.

The first durable Karpūra run may begin from a before-plan containing:

- one exact match: Ajamōdā;
- two missing governed rows: Karpūra and Kēram.

The server may initialize/update the Composition stage to `PARTIAL` from that bounded before-plan evidence while arming exactly one missing target.

No separate destructive adoption or portal update is required.

### 10. Hash/version discipline

- `content_hash` is server authoritative.
- `payload_hash` is not execution authority for Composition.
- No JavaScript hashing.
- Any change in governed Composition or workflow row version blocks resume/verify until a fresh run is created.
- Composition stage/run mutations use their own row versions and MUST NOT increment Product Details workflow row version merely to represent Composition progress.

## Approved safety invariants
Governance preflight → exact page/product identity → complete list → offline classify → durable SAVE_ARMED for exactly one missing line → one Save at most once → durable outcome → fresh complete list → bounded row-ID parse → native reread → exact semantic compare → ROW_VERIFIED → repeat only through a fresh run → final exact set → Composition stage PORTAL_VERIFIED → stop before QC/final Submit.

No implicit portal-mutation permission carries from Product Details, the first bootstrap row, post-entry reconciliation, another Composition run, or another portal stage.

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
- governed post-entry reconciliation aligned the server to:
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
- [x] Freeze durable server lifecycle/run model specialized for Composition execution.
- [ ] Implement Composition stage/run server foundation.
- [ ] Implement live Composition executor while arm remains default OFF.
- [x] Controlled first-line bootstrap on Karpooradi.
- [x] Prove row edit-ID and unitname/reread value semantics.
- [ ] Continue remaining lines under the durable WP-06 mutation gate with no normal Update/Delete.
- [ ] Final exact-set reconciliation and Composition-stage PORTAL_VERIFIED evidence.
- [ ] Representative regression.
- [ ] WP closure audit.

## Current gate
Implement and independently audit the Composition-specific stage/run server foundation exactly as frozen above.

Until that server foundation is live and audited:

- do not manually continue Karpūra or Kēram portal entry;
- do not invoke native Composition Save/Update/Delete;
- keep `COMPOSITION_LIVE_ARM_DEFAULT=false`;
- do not touch QC Register or final Submit.
