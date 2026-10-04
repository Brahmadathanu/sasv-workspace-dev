# WP04-G4 — Focused residual-cost correction/proof plan

## Status and authority

2026-10-04. Source-only plan; NOT IMPLEMENTED, NOT RUN, NOT DEPLOYED.
Main: `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`; input audit: `a55e0cb4c8871661ee1a080f0478938d667bf798`.
G0–G3 retained at their documented levels; G4 INCOMPLETE / APPLICATION HOLD; G5 BLOCKED; programme 4/13.
DEC-014 remains unchanged: ChatGPT owns server work; client work follows a proven server contract. No prior consumed authorization extends to this plan's implementation or proof.

## Evidence and confidence

Sources: HELPER_DIAGNOSTIC_RESULT.md/json, helper-diagnostic-source.json, PERFORMANCE_EVIDENCE.json, ab-forward-draft.sql, AB_CORRECTNESS_V2_RESULT.md and CORRECTED_PERFORMANCE_RESULT.md. This checkpoint performs repository/source analysis only, not fresh live inspection. Captured catalog facts require fresh guards before any operation.

| Path | Evidence | Confidence / limitation |
| --- | --- | --- |
| Repeated canonical work | Corrected portfolio still assesses 611 SKUs before statistics/filtering/page retrieval. Each assessment consumes run evidence and commercial evidence | High for repetition; contribution to total latency is not isolated |
| Run-evidence point reads | Six snapshot CTEs per SKU, plus scheme/regional evidence. Three fixed samples: 2.441–6.773ms | High for repeated structure; three samples cannot establish population cost or projected savings |
| Commercial evidence | Three samples: 2.262–4.648ms; existing point path remains per SKU | Measured contributor, not safe to rewrite while CSE-P01 row authority remains unresolved |
| Route map | One full map: 1,819.717ms, 639 rows, 214,064 shared hits; nested family/validation resolution visible in source | High for measured standalone cost; not exact portfolio phase attribution |
| Shared global work | Once-per-response helper: 8.331ms | Low-priority candidate; no evidence supporting refactoring |
| Statistics/sorting/page | Complete assessment needed for current full statistics; A/B already consolidated relational assessment/count reuse | No separate measured phase cost. Do not redefine full statistics or assess only the page |

The design remains N canonical evaluations, not N public RPC/network calls. Per-SKU JSON construction and other evidence reads remain even after the proposed change. Measurements are not additive budgets, p95 evidence, or a speed guarantee. Cache/plan effects are uncontrolled.

## Alternatives and disposition

| Alternative | Benefit hypothesis | Boundary / disposition |
| --- | --- | --- |
| C: cohort-load six allocation snapshots, shared canonical composition | Avoid repeated point-query setup and expose set-wise retrieval to PostgreSQL | Recommended first bounded package; plan-level only |
| Reuse route-family/validator resolution | Potentially reduce measured route work | Excluded from C: specialist contracts and effective-date semantics widen regression surface |
| Batch commercial evidence | Potentially remove repeated commercial queries | Excluded: must not resolve ambiguous rows or reopen CSE-P01 |
| Split statistics from page retrieval | Could defer some work | Excluded: changes response/statistics contract; no measured justification |
| New indexes, caches, jobs or readiness stores | Unproven | Excluded: captured run/SKU indexes already exist; no plan evidence for new indexes or alternate authority |

Route validators do not all use the same date: product-process validation resolves family using route effective_from/current_date, while other paths use valuation/as-of context. Shared-family reuse is therefore not a mechanical substitution. Do not promise an exact 1.82-second reduction by subtracting the standalone measurement.

## Proposed C boundary — not an executable design

1. Collect six allocation snapshot inputs for the exact intended SKU cohort and governed period, valuation date and non-null run. Captured catalog shows unique run/SKU keys (some partial for non-null run). Retain all four equality predicates; uniqueness does not prove period/valuation compatibility.
2. Factor one driver-evidence builder shared by the original point run-evidence helper and the cohort path. Do not create a bulk-only copy of status, reason, owner, route or JSON business rules.
3. Keep scheme and regional evidence queries and their existing composition unchanged per SKU. Reuse the same assembler for point/cohort reads. Feed the already collected evidence into canonical LIVE_AS_OF composition without silently rereading snapshots.
4. Preserve public canonical signatures and authorization. EXACT_RUN branch text and observable behavior remain unchanged; regression proof must cover its changed helper dependency. No-success-run LIVE_AS_OF early return remains unchanged.
5. Request-scoped, read-only inputs only. No persistent/session cache, GUC evidence authority, table/view/index/job, specialist writer, public API expansion or client business logic.

Exact helper signatures, return shapes, names and function count are deliberately not frozen here. They must be settled and reviewed in the unapplied package. This proposal would add the existing run-evidence helper to the replacement/rollback scope beyond the previous canonical/enrich replacements; that expansion is HIGH-RISK, not an approved application.

## Required invariants for exact package review

- Anchor every intended SKU, including all-missing snapshots; left joins must not remove cohort members. Non-null-run uniqueness guards must cover all six sources before replacement.
- Preserve snapshot_present from actual row existence, not resolved status. A present row with null status differs from no row.
- Preserve seven ordered driver dependencies: admin and finance share one snapshot source. Preserve JSON nulls/types, raw/effective status, reasons, notes, owner, route, authority and evidence IDs exactly.
- Preserve all existing helper argument behavior, including null run/SKU/period/valuation and nonexistent SKU. Existing equality-to-null finds no snapshot; do not introduce IS NOT DISTINCT FROM selection or null-run legacy snapshot authority. A singleton null SKU must not cause a null-key JSON map error.
- Preserve helper/canonical differences: helper scheme summary treats RESOLVED_POLICY differently from canonical enrichment; empty regional helper summary UNKNOWN differs from canonical NOT_REQUIRED. Do not harmonize these established behaviors.
- Internal prefetch must be bound to exact context, keys and cohort coverage. Invalid/mismatched input must fail as an internal contract error, not become successful UNKNOWN or silently trigger fallback reads. Do not let public callers supply authoritative prefetch data.
- Preserve regional acceptance/fingerprint logic, unordered commercial row behavior, route checks, lifecycle, UNKNOWN/review/blocker semantics and full statistics. No invented links, monetary rules or bulk remediation.
- Set-wise SQL may still execute indexed probes per SKU; do not claim six physical scans or reduced runtime without a plan/runtime result.
- Include complete existing helper defaults/settings/owner/ACL/dependency inventory and exact restoration text. New internals deny direct public/authenticated access unless separately justified and approved; preserve existing ACLs without escalation.

## Smallest staged proof and stop boundaries

1. **Next executable work gate: exact unapplied C package/proof preparation and source review.** Produce exact forward/restore/source identities, caller inventory, internal input validation, rollback pre/postconditions and separate bounded proof proposals. No database operation or functional application is authorized by this plan review.
2. **Correctness before performance.** Freeze exact invocation counts and load limits after package review. Compare original point helper and canonical full JSON with C point/cohort behavior under the same observation; retain existing fixed LIVE_AS_OF cases 1/11/1795 and EXACT_RUN 114/115 contexts. Cover all six sources, seven drivers, missing/present-null rows, notes/IDs, null arguments and no-success behavior. Do not create fixtures without authorization or claim literal models as server proof. If live evidence cannot cover a case, mark it NOT_RUN and disposition it explicitly.
3. Population/key/context and cohort-input equality checks must cover the affected membership; small sample black-box parity does not prove all 611 final readiness results. Freeze any additional old-helper evaluation cost explicitly; do not hide 611 baseline calls in a proof or automatically rerun prior proofs.
4. Only after accepted correctness disposition, prepare/review a separate one-invocation operational portfolio proof under unchanged 15s timeout, full membership and bounded count/parity/size/latency evidence, restore/ROLLBACK and independent readback. Historical 8,174.908ms and 10,822.426ms remain observations, not controlled benchmarks. No concurrent/exhaustive workload, extra profiling, retry, timeout increase or deployment implied.
5. Native API/access, CSE compatibility, complete payload/monetary-note review, all-existing/filter behavior and committed deployment/rollback requirements remain unresolved where not already proven. C success alone cannot close G4.

Any production operation, including temporary function definitions or additional substantial read-load, requires a frozen reviewed target/main/script digest and fresh explicit human authorization. All previous operation authorizations are consumed. If this focused package is unsafe, unprovable or still misses the agreed goals, stop for bounded feasibility/contract disposition; do not automatically expand to routes, commercial rows, indexes or another optimization loop. No performance target change is approved.

## Exact next gate

WP04-G4 — Exact unapplied C snapshot-cohort package and staged proof preparation, followed by separate exact source/rollback/security/proof review. G4 remains incomplete; G5/client implementation remains blocked. No new architecture decision or parked finding.
