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

### Dependency-to-dimension mapping — G2 working contract
| Dependency | Grain | Primary dimension | Structural vs contextual | Canonical resolution semantics | Remediation ownership |
| --- | --- | --- | --- | --- | --- |
| Product lifecycle | Product | Entity / lifecycle | Structural identity/lifecycle | EXISTING + Active/Inactive; activation is not downstream readiness | Manage Products |
| SKU lifecycle | SKU | Entity / lifecycle | Structural identity/lifecycle | EXISTING + Active/Inactive; activation is not downstream readiness | Manage Products |
| Product base UOM/conversion | Product | Master foundation | Structural | Valid governed Product base context; SKU pack/UOM remains separate | Manage Products |
| SKU pack size/UOM | SKU | Master foundation | Structural | Valid governed SKU pack context | Manage Products |
| Editable PM template/map/overrides | SKU | Authoring provenance | Structural upstream authoring, but not historical costing authority | Report provenance separately; do not substitute for frozen revision | PM BOM Manager |
| Approved effective PM-BOM revision | SKU x as-of | Costing foundation | Structural | Resolver returns one applicable frozen governed revision; missing/ambiguous is blocking | PM BOM Manager |
| Batch-size reference | Product x as-of | Costing foundation | Structural where consumed | Effective governed reference resolves; applicability follows authoritative consuming resolver | Supply Batch Plan → Batch Sizes |
| Manufacturing route | Product x as-of | Costing foundation | Structural | Authoritative route readiness; inherited family route is valid when resolver says READY | Production Route Manager |
| MRP policy | SKU x valuation date | Costing foundation | Structural commercial policy | `RESOLVED` is resolved; `MISSING`/`AMBIGUOUS` block applicable pricing path | Pricing Policy Manager → MRP Governance |
| Selling-price/GST policy | SKU x valuation date | Costing foundation | Structural commercial policy | Resolver must be resolved and values valid; missing/ambiguous/invalid blocks | Pricing Policy Manager → Selling & Scheme Policies |
| Scheme | SKU/hierarchy x region x date | Costing foundation + resolution source | Structural policy resolution with governed fallback | Explicit policy or `DEFAULT_NO_SCHEME` may both be resolved; row absence alone is not incomplete | Pricing Policy Manager → Selling & Scheme Policies |
| Common commercial sales basis | SKU/Product x period/context | Evidence quality | Contextual | Actual can be READY; governed assumption/default can resolve calculation but remain REVIEW_REQUIRED; unresolved/ambiguous can block | Pricing Policy Manager → Commercial Sales Assumptions |
| Regional commercial basis | SKU x region x period/context | Evidence quality | Contextual | Preserve actual → assumption → governed default hierarchy and resolution source | Pricing Policy Manager → Commercial Sales Assumptions |
| Direct Labour | Global policy + Product/SKU context | Costing foundation + evidence quality | Global structural policy; SKU contextual workload/evidence | Global policy must resolve; route/workload/quantity evidence determines SKU outcome | Driver Governance + Production Route Manager |
| Production Overhead | Global policy + Product/SKU context | Costing foundation + evidence quality | Global structural policy; SKU contextual route/workload/evidence | Global policy must resolve; route scopes/factors/workload and quantity evidence determine SKU outcome | Driver Governance + Production Route Manager |
| QA/QC | Global policy + Product/SKU context | Costing foundation + evidence quality | Global structural policy; Product/SKU contextual test/absorption evidence | Global policy must resolve; downstream evidence can READY/REVIEW/BLOCK | Driver Governance + Cost Sheet Review QC queue |
| Materials/Stores | Global policy + Product/SKU context | Costing foundation + evidence quality | Global structural policy; Product/SKU contextual RM/PM/workload evidence | Global policy resolution is separate from SKU evidence; downstream evidence can READY/REVIEW/BLOCK | Driver Governance + Cost Sheet Review Materials/Stores queue |
| Administrative Overhead | Global policy envelope + SKU context | Costing foundation + evidence quality | Global structural policy; contextual common-sales basis | Approved effective envelope + common sales basis; no route/workload requirement | Driver Governance + Commercial Sales Assumptions for quantity evidence |
| Finance/Admin Overhead | Global policy envelope + SKU context | Costing foundation + evidence quality | Global structural policy; contextual common-sales basis | Approved effective envelope + common sales basis; no route/workload requirement | Driver Governance + Commercial Sales Assumptions for quantity evidence |
| Marketing Expense | Global policy + SKU/region context | Costing foundation + evidence quality | Global structural policy; regional contextual evidence | Effective Marketing policy + regional evidence chain; eligible review acceptance may change effective review status without rewriting raw evidence | Driver Governance / Pricing Policy Manager / Cost Sheet Review / Costing Control Center acceptance |
| Material rate/evidence | Material lines consumed by SKU x context | Evidence quality + costing outcome | Contextual downstream evidence | Preserve authoritative material READY/REVIEW/BLOCK and issue-line remediation; not Product creation master data | Material Cost Manager |
| Final costing control | SKU x period/exact run | Costing outcome | Aggregate result | Preserve server severity/status and recommended route; never reinterpret as lifecycle state | Costing Control Center |

### Canonical aggregation rules — candidate
1. **Do not aggregate by row existence.** Every dependency is evaluated through its authoritative resolver or already-governed projection.
2. **Lifecycle is independent.** Active/Inactive is reported, not promoted into a proxy for completeness.
3. **Structural foundation aggregate:** `BLOCKED` if any applicable structural resolver is missing/ambiguous/blocked; otherwise `RESOLVED`. A governed fallback explicitly defined as resolved by its resolver remains resolved.
4. **Evidence-quality aggregate:** `BLOCKED` if contextual evidence prevents calculation; else `REVIEW_REQUIRED` if any applicable resolved evidence requires review; else `READY`.
5. **Costing outcome aggregate:** consume the authoritative costing-control outcome for the requested context rather than recomputing specialist precedence in the client.
6. **Global policy failures stay global.** A missing/invalid global driver policy can block affected SKUs, but remediation metadata must identify the global dependency/owner rather than imply hundreds of independent SKU defects.
7. **Applicability is explicit.** Non-applicable dependencies should be `NOT_APPLICABLE`, not falsely READY or missing.
8. **UNKNOWN is not READY.** Resolver failure/unavailable context must remain explicit and fail closed for readiness claims.
9. **Review acceptance is lineage-preserving.** Where a governed acceptance mechanism exists, expose raw status and effective status plus acceptance identity; never rewrite the raw evidence.
10. **Context is mandatory.** Every readiness result declares whether it is LIVE_AS_OF or EXACT_RUN and carries the relevant as-of/valuation/period/run identifiers.

### Candidate canonical server result shape
The eventual server authority should return one Product/SKU summary plus dependency-level detail. Exact names remain design candidates until independent audit.

**Summary identity/context**
- `product_id`, `sku_id`, Product/SKU labels and lifecycle state.
- `context_type`: `LIVE_AS_OF` or `EXACT_RUN`.
- `as_of_date` / `valuation_date` / `period_start` as applicable.
- `refresh_run_id` when exact-run context is requested.

**Dimension summaries**
- `master_foundation_status`: candidate `RESOLVED | BLOCKED | UNKNOWN`.
- `costing_foundation_status`: candidate `RESOLVED | BLOCKED | UNKNOWN`.
- `evidence_quality_status`: `READY | REVIEW_REQUIRED | BLOCKED | UNKNOWN`.
- `costing_outcome_status`: authoritative `READY | REVIEW_REQUIRED | BLOCKED | UNKNOWN`.
- `overall_severity`: `READY | REVIEW_REQUIRED | BLOCKER | UNKNOWN`.

**Dependency detail[]**
- stable `dependency_code` and human label.
- grain/scope and applicability.
- `dimension`.
- `raw_status`, `effective_status`, `resolution_source`.
- blocking/review `reason_code` and explanatory note.
- authoritative source/resolver identifier for auditability.
- owner/module and `recommended_ui_route`.
- evidence/policy/revision identifiers and effective dates where applicable.
- acceptance identity/status where applicable.

The client may group/filter/render this contract but must not infer missing dependencies, downgrade/upgrade severity, or reproduce resolver precedence.

## Approved design / contract
Not yet approved.

## Milestones
- [x] Current-state/audit gate
- [~] Design/contract gate where applicable
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
Independently audit the dependency mapping, aggregation rules and candidate result shape against live resolver semantics and the approved WP00 matrix; resolve any over-generalisation; decide whether to compose existing authorities through a dedicated server resolver/view/RPC or extend an existing authority. No client implementation before that decision.

## Next gate
`WP01-G3 — independent contract audit and server-authority decision`

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
