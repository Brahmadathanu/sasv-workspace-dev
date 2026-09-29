# WP-01 — Canonical Product/SKU Completeness Contract

## Objective
Design a server-authoritative completeness/readiness contract; no hard-coded client checklist.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
### G1 live-contract audit
- No existing authoritative server/repository vocabulary was found for a sequential `MASTER_COMPLETE → OPERATIONAL_COMPLETE → COSTING_FOUNDATION_COMPLETE → COSTING_READY` state machine. These remain programme candidate concepts, not live contracts.
- Live costing semantics use `READY`, `REVIEW_REQUIRED` and `BLOCKED` at multiple specialist layers. These statuses are not equivalent to Product/SKU lifecycle state.
- `REVIEW_REQUIRED` can coexist with successful calculation. Governed fallback/default evidence can therefore be structurally resolved while still requiring review.
- `BLOCKED` means the affected downstream path cannot be treated as ready and must fail closed.
- Existing Product/SKU Active/Inactive state is independent of downstream costing completeness.
- Existing `costing.v_sku_costing_control_status` / `public.v_costing_pricing_sku_control_status` already demonstrate a useful remediation pattern: `first_control_status`, `control_severity`, `recommended_ui_route`, notes and specialist status columns.
- Existing costing control/diagnosis views are period/costing projections. They are specialist evidence and must not become the Product/SKU lifecycle authority by themselves.
- Exact-run/frozen evidence remains distinct from live/as-of projection.

### Three-class validation
| Class | Representative | Observed live control | Contract implication |
| --- | --- | --- | --- |
| Ready | SKU 2 / Product 2 / Amritharishtam | `READY_FOR_COST_REVIEW`; severity `READY`; material, prime, manufacturing, Marketing, pricing, selling-price and cost-sheet statuses `READY`; route `COST_APPROVAL_WORKBENCH` | A fully resolved costing outcome can be represented without conflating it with entity activation. |
| Governed review | SKU 1798 / Product 1350 / Mahamanjishtadi Kashaya Choornam | material and PM `READY`; prime/manufacturing/Marketing/pricing/selling-price/cost-sheet `REVIEW_REQUIRED`; severity `REVIEW_REQUIRED`; route `COST_REVIEW_WORKBENCH` | Structural resolution and evidence quality must be separate dimensions. |
| Blocked | SKU 1400 / Product 1083 / Chukku | material/PM/prime/manufacturing/pricing/selling-price/cost-sheet `BLOCKED`; severity `BLOCKER`; route `MATERIAL_RATE_MANAGER` | Blocking dependency must identify the failing domain and remediation route; it cannot be bypassed by activation. |

### Candidate canonical dimensions
WP01-G1 evidence supports a multidimensional contract rather than a single ladder:
1. **Entity / lifecycle** — Product/SKU existence and Active/Inactive state.
2. **Master foundation** — intrinsic governed Product/SKU master attributes required by authoritative resolvers.
3. **Costing foundation** — structural downstream foundations resolved for an explicit as-of context.
4. **Evidence quality** — quality of the evidence used by resolved foundations/calculations, including governed fallback/default and accepted review evidence.
5. **Costing outcome** — aggregate ability to calculate/use the costing chain, preserving `READY`, `REVIEW_REQUIRED`, `BLOCKED`.
6. **Remediation** — dependency/action code, severity, explanatory note, owner/admin surface and recommended UI route.
7. **Evidence context** — live/as-of versus immutable exact-run/frozen evidence.

These dimensions are candidate contract structure pending dependency-by-dependency mapping and independent design audit; their exact field names are not yet approved server API vocabulary.

## Approved design / contract
Not yet approved.

## Milestones
- [~] Current-state/audit gate
- [ ] Design/contract gate where applicable
- [ ] Implementation gate where applicable
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP01-G1 — canonical completeness vocabulary and server-contract derivation`

## Gate Status
[~] IN PROGRESS

## Required to close
Map every approved WP00 dependency into the candidate dimensions; define aggregate semantics, reason/remediation metadata and evidence-context requirements; validate against representative READY/REVIEW_REQUIRED/BLOCKED cases; independently audit the proposed contract before approving server design.

## Next gate
`WP01-G2 — dependency-to-dimension mapping and canonical result-shape design`

## Server changes
None.

## Client changes
None.

## Tests / verification
- Live vocabulary/object audit completed without mutation.
- Three representative live classes validated: READY SKU2, governed-review SKU1798, BLOCKED SKU1400.
- Repository search confirmed candidate sequential completeness labels are not existing authoritative contracts.

## Decisions created
None.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
Not started.
