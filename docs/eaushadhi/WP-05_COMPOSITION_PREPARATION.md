# WP-05 — Composition Data Completion, Verification & UX

**Architecture state:** YELLOW  
**Progress:** 45%

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
- [x] Product 262 post-entry Ingredient Form reconciliation authority is deployed, versioned and client-governed.
- [x] VERIFIED Composition ordinary fields are lifecycle-locked; pre-entry Reopen and post-entry Reconcile are distinct correction paths.

## Frozen Composition READY contract v1

The server is the authority. Portal state does not make a line READY.

### Line READY
A Composition line is READY for WP-06 only when all of the following are true:

1. The governed source line exists and the portal-required source identity/value fields needed for execution are present.
2. `review_status = VERIFIED`.
3. Selected Ingredient Type, Ingredient Form, Part Used and Measurement Unit resolve to active governed e-Aushadhi portal options with usable external values; placeholder/unusable values such as `-1` cannot authorize.
4. Quantity/unit semantics pass the frozen strict Composition semantic contract; JavaScript floating-point normalization is not authority.
5. Reference authority is global and must pass the frozen WP-02/WP-03 Composition predicate:
   - line review is VERIFIED;
   - `reference_ready = true`;
   - `source_to_canonical_ready = true`;
   - `canonical_to_portal_ready = true`;
   - alias mapping status = VERIFIED;
   - portal mapping status = VERIFIED;
   - Reference `portal_value` is a nonblank string.
6. No blocking line issue remains.
7. The current line row version is known and must be used by any governed correction path.

Legacy per-line Reference mapping fields, labels, source text, suggested values, or numeric-only Reference values cannot independently authorize execution.

### Product READY
A product is Composition READY for WP-06 only when:

1. The governed Composition set is nonempty and complete for that product.
2. Every governed line satisfies the Line READY contract.
3. Product Composition review completeness is true and no unresolved Composition blocker prevents execution.
4. The current workflow row version is known.
5. A fresh server-generated `content_hash` can be obtained from the authoritative governed snapshot. JavaScript hashing is prohibited.
6. Any governed post-entry reconciliation performed after an earlier portal run has incremented the affected line/workflow versions and therefore requires a fresh WP-06 preflight/snapshot before further execution.

READY means “server-governed input accepted by WP-06.” It does not mean the live portal already matches the server.

## Product 262 contract proof
Karpooradi Thailam is the controlled representative proof for this v1 boundary:

- line 929 Ajamōdā → LIQUID KWATH / portal value 60;
- line 930 Karpūra → SOLID / portal value 66;
- line 931 Kēram → OIL / portal value 61;
- all three lines remain VERIFIED at row_version 8;
- product workflow row_version is 11;
- global Reference resolves to Sahasrayoga / 28;
- post-entry reconciliation notes and audit events record each old/new Ingredient Form transition.

The Product-262-only reconciliation RPC is a bounded correction mechanism, not a generic replacement for normal pre-entry review.

## UX rule
For VERIFIED Composition lines:

- ordinary Ingredient Type, Ingredient Form, Part Used, Unit and Notes controls stay locked;
- pre-entry correction uses Reopen only while the portal entry lifecycle remains NOT_STARTED;
- post-entry Ingredient Form correction uses the dedicated governed Reconcile mapping path where explicitly eligible;
- direct ordinary-field editing must never substitute for either correction lifecycle.

## Required redesign still open
Current large per-ingredient cards are not yet the desired high-volume operator UX. Dense/expandable presentation and representative multi-product acceptance remain open WP-05 work.

## Milestones
- [x] Freeze Composition READY contract.
- [ ] Reconcile all source pathways and missing-composition manual entry.
- [ ] Manual entry provenance/versioning contract.
- [ ] Canonical/portal field readiness model proven across every required source pathway.
- [ ] Dense operator-friendly Composition UX.
- [ ] Bulk/keyboard/search/filter verification workflow acceptance.
- [ ] Product-level completeness/blocker summary acceptance.
- [ ] Representative multi-product acceptance.
- [x] Output frozen READY contract to WP-06.
- [ ] WP closure audit.

## Current gate
The READY v1 boundary is frozen and may be consumed by WP-06 for controlled execution architecture. WP-05 remains open for source-path/manual-entry completion, high-volume UX, and representative multi-product acceptance; freezing the v1 boundary does not close WP-05.
