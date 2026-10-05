# WP04-G4 — Exact C source/rollback/security/proof review

2026-10-05. Preparation input: `0e36987e538aa5bb76852b4e74713292b80280ba`; main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`, freshly fetched and unchanged. Separate review pass by the primary server owner against exact committed artifacts and governance; no second-agent audit or runtime compilation claimed.

## Disposition

**SOURCE DIRECTION RETAINED; BOUNDED PROOF CORRECTIONS REQUIRED BEFORE AUTHORIZATION.** No production operation, application, performance test or client implementation approved. G4 incomplete/application HOLD; G5 blocked; programme4/13.

All eight c-package-manifest.json file digests match exact LF bytes. Frozen input manifest SHA-256: `30fe7197f9daf47240da694c642f082aca2e697e1fb7e4c4f2ff8366b189ebff`. Original C SQL/manifests remain unchanged; this review supersedes their historical REVIEW_PENDING status, not their identity.

## Exact source and rollback findings

| Area | Assessment |
| --- | --- |
| Authority/composition | Original scheme/regional queries and driver JSON tail are byte-identical in the typed assembler. Existing point run-evidence and cohort inputs use the same assembler. Private prefetched core differs from A/B core only at enrichment invocation; no second client/bulk evaluator |
| Selection/context | Six LEFT joins retain SKU/period/valuation/run equality; captured valid unique run/SKU keys justify removal of point LIMIT1 only for these six inputs. Null equality semantics remain unchanged; singleton null SKU retained; no null-key JSON map |
| Row presence | Source uses non-null snapshot ID, not status, to retain original snapshot_present behavior. Seven ordered drivers preserve admin/finance sharing one snapshot. This is source evidence; runtime present-null boundary still missing |
| Existing behavior | Public canonical/enrich entry and period/gap reader bodies unchanged from accepted A/B. EXACT branch unchanged text, with changed helper dependency needing proof. No-success branch skips cohort enrichment. Route/commercial/statistics/lifecycle unchanged; no invented row authority |
| Internal input boundary | Prefetch checks object/context/key count, evidence shape, seven driver codes and required arrays; invalid input raises, with no fallback read or successful UNKNOWN. Internals owner-only; public entry does not accept prefetch |
| Permissions | Nine new candidates have explicit owner/revocations; same three prior public readers retain authenticated execution and existing in-body permission checks. Three existing ACLs retained; full candidate ACL/attribute guards. No new grant/policy/module/RLS change. Native role/API behavior unproved |
| Identity/restore | 12 definitions, three exact original restoration bodies, nine reverse-order drops without CASCADE. Candidate post/rollback-pre guard covers body, signature, argument/default/output metadata, attributes/settings and ACL. Source/key/column/caller/event guards; one outer transaction, no COMMIT, final ROLLBACK. Separate readback covers22originals, three replacement attributes and absence by candidate name |
| Budget | Explicit10successful canonical +2missing-refusal,24point helper,4cohort,3prefetched core,6invalid prefetch,1route map/1shared calls; zeroportfolio and zero611old helper calls. Nested work remains; no measured fit within15s claimed |

No demonstrated readiness/lifecycle regression is established by this source review. Compilation, SQL operator behavior and nested-function execution remain NOT_RUN. Current candidate absence is from the latest catalog capture in c-source-before.json; no fresh live query occurred during this review.

## REQUIRED NOW — two bounded proof findings

**C-R01 — Full affected input equivalence omitted.** RESIDUAL_CORRECTION_PLAN.md requires membership/context and cohort-input equivalence across affected membership. The current correctness script checks611count/fingerprint but compares only three cohort outputs. Membership identity is not equivalence of six selected allocation inputs.

Correction: prepare a new versioned correctness proposal with a bounded full611 comparison of the six *input selections*, without611run-evidence/core/canonical invocations. Use mechanically extracted, identity-bound original point selection and candidate cohort join fragments, comparing complete selected rows (including presence/nulls/types), context and multiplicity within the same observation. Explicitly report this as extracted-input parity, not full611function-output parity. Freeze query count/read-load/result budget and source-fragment provenance before authorization. If a faithful bounded comparison cannot be prepared, explicitly reject/disposition this requirement; do not waive it or conceal full evaluator calls.

**C-R02 — Changed typed-row presence boundary lacks proof.** Present-row/null-allocation-status behavior is expressly NOT_RUN; null arguments and missing rows do not exercise that boundary. It is a required invariant of changing scalar point CTEs into composite inputs.

Correction: add bounded absent/present-null composite cases using pure literal typed records and the identity-bound original projection versus candidate assembler. Preserve all six table types and seven drivers; check snapshot_present plus complete JSON/IDs/nulls. No business data insertion, fixture provisioning or invented readiness authority. Label literal projection proof as such, not proof that a corresponding live row exists. If live evidence is used instead, select and bind actual qualifying evidence read-only first; do not guess it. Freeze added calls and result limits explicitly.

These are REQUIRED NOW proof-package findings, not new parked issues, new architecture decisions or a license to refactor C source. Neither finding proves that production logic is wrong; they prevent an incomplete proof being promoted as sufficient.

## Remaining G4 requirements

Runtime compile/parity/restoration of C is NOT_RUN. Full611final-output parity is distinct from input equivalence. Live no-success context, all-existing/filter behavior, native Auth/API permission/payload behavior, CSE compatibility, complete nonmonetary/monetary-note review, repeatable performance and committed deployment rollback remain unresolved where not previously proven. Extra private wrappers can affect point performance; neither Manage Products latency nor portfolio goals are certified. Historical8,174.908ms still misses3s/5s goals. No goal change, timeout increase, route/commercial/index optimization or wider test is authorized.

## Exact next action / clean stopping point

WP04-G4 — Prepare and review **one narrow versioned C correctness proposal correction for C-R01/C-R02**, keeping original C SQL/source identities and all prior evidence unchanged. Do not overwrite c-correctness-proposal.sql or reuse its digest for a correction. Then review the new exact script/read-load/restore/readback boundary before any explicit authorization request. No production authorization requested at this stopping point. All prior authorizations consumed; DEC-014/WP03/parked/locked unchanged. Continue WP04 in a new chat in the same Costing Project only as a continuity handover, not a new WP or restart.
