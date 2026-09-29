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

### Independent contract audit — G3

#### Findings
1. **Product and SKU master summaries must remain separate.** Product `uom_base/conversion_to_base` and SKU `pack_size/uom` are different grains with different remediation targets. The contract must expose `product_master_foundation_status` and `sku_master_foundation_status`; an optional combined presentation status may be derived server-side but cannot replace either source status.
2. **LIVE_AS_OF requires an explicit period when period-derived evidence is included.** `costing.v_sku_commercial_sales_basis` is keyed by `period_start` and joins the period's governed `valuation_date`. A canonical live request therefore requires `sku_id + period_start + valuation_date/as_of_date` (with server validation of context coherence), not an unqualified "current" flag.
3. **Existing costing control is downstream snapshot authority, not lifecycle readiness authority.** `costing.v_sku_costing_control_status` intentionally composes the latest persisted material/prime/manufacturing/internal-loaded/pricing/cost-sheet snapshots. It is excellent for final costing outcome/remediation but cannot diagnose a newly created SKU before those snapshots exist.
4. **Applicability must be determined by the composition authority from authoritative resolver semantics.** The client must not decide that scheme, route/workload, regional evidence or a driver sub-foundation is applicable.
5. **Global driver policy state should be referenced, not duplicated as independent SKU defects.** The seven registry elements remain visible in dependency detail, but shared global failures carry shared scope/owner identifiers so remediation can deduplicate them.
6. **Structural status vocabulary survives audit with one refinement:** dependency-level status is `RESOLVED | BLOCKED | NOT_APPLICABLE | UNKNOWN`; Product/SKU structural summary omits `NOT_APPLICABLE` because those master dimensions themselves are applicable for an existing SKU.
7. **Evidence-quality status remains `READY | REVIEW_REQUIRED | BLOCKED | NOT_APPLICABLE | UNKNOWN` at dependency level.** Summary uses `READY | REVIEW_REQUIRED | BLOCKED | UNKNOWN`.
8. **Raw/effective status separation is required only where a real acceptance/override authority exists.** Do not fabricate an `effective_status` field for dependencies that have no such mechanism; use null/equal-by-contract semantics explicitly.
9. **Exact-run is a separate evidence mode.** Live resolvers must not be back-used as proof of historical exact-run state. Exact-run requests must compose immutable/frozen run-scoped authorities.

#### Server-authority decision
**Approved architectural direction: create a separate read-only Product/SKU readiness composition authority; do not extend `costing.v_sku_costing_control_status` into this role.**

Rationale:
- lifecycle/readiness must work before a costing run exists;
- several foundations are effective-dated and resolver-driven;
- commercial evidence requires explicit period + valuation context;
- final costing outcome already has a mature snapshot control authority that should be consumed, not rewritten;
- one composition boundary prevents the client from reproducing resolver precedence.

The preferred interface shape is a **parameterized server function/RPC**, not a plain unparameterized view, because the contract requires explicit `sku_id`, `period_start` and `valuation/as_of date` and must validate context coherence. The function should be read-only and security-invoker unless live permission evidence later proves a different controlled pattern is required.

A two-part payload is preferred:
- **summary** — identity/lifecycle, Product master status, SKU master status, costing-foundation status, evidence-quality status, downstream costing outcome when available, overall severity and context;
- **dependencies[]** — stable dependency codes with grain/scope, applicability, raw/effective status where meaningful, resolution source, reason/note, owner/remediation route, source authority and evidence identifiers.

The composition function must call/reuse existing authoritative resolvers/projections. It must not copy their precedence logic into a second implementation.

#### Context contract — refined
For `LIVE_AS_OF`:
- required: `sku_id`, `period_start`, `valuation_date` (or a server-resolved valuation date from the governed period with equality validation);
- Product route/BOM/batch/commercial policies resolve against the governed valuation/as-of date;
- period-derived commercial evidence resolves for the explicit period;
- downstream costing outcome may be attached only when the available persisted control evidence matches the requested context; otherwise report it as unavailable/UNKNOWN rather than borrowing another period.

For `EXACT_RUN`:
- required: `refresh_run_id` and `sku_id`;
- period/valuation context is taken from the immutable run context;
- dependency evidence must come from run-scoped/frozen authorities where available;
- live resolver output must never overwrite or masquerade as exact-run evidence.

## Approved design / contract
The G3 architecture above is approved as the working WP01 server-contract direction, subject to implementation-detail verification and regression proof before WP01 closure.

## Milestones
- [x] Current-state/audit gate
- [x] Design/contract gate where applicable
- [x] Implementation gate where applicable
- [x] Focused verification
- [x] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP01-G5 — independent audit and server-contract closure`

## Gate Status
[x] COMPLETED AND VERIFIED

## Required to close
Independent audit is complete and PASS. Reconcile the WP01 documentation branch with current main, prove no Product/Costing overlap from moved main, merge only after explicit approval, then run post-merge verification and close WP01.

## Next gate
`WP01-G5C — repository reconciliation, merge/post-merge proof and WP01 closure`

### G4 implementation-ready server contract and source-authority proof

#### Public boundary
Create one read-only authenticated RPC in `public`, provisionally:
`public.rpc_get_product_sku_readiness(p_sku_id bigint, p_period_start date, p_context_type text default 'LIVE_AS_OF', p_refresh_run_id bigint default null) returns jsonb`.

Final naming may be adjusted at implementation, but overloading must be avoided.

**Permission:** `public.require_permission('module:costing-control-center', false)` is the proven current read/control convention and is the initial approved permission boundary. Do not expose internal `costing.fn_*` resolvers directly to authenticated users.

**Security:** existing protected read RPCs use `SECURITY DEFINER` with fixed `search_path = public, costing, pg_temp`, explicit module permission checks, and restricted EXECUTE grants. Because several required specialist resolvers are themselves restricted `SECURITY DEFINER` functions executable only by postgres/service_role, a pure security-invoker public wrapper cannot compose them for authenticated clients. Therefore the G3 preference for security-invoker is superseded by live evidence: use the established controlled `SECURITY DEFINER` read-RPC pattern, revoke PUBLIC execution, grant only authenticated/service_role as required, and run security advisors after DDL.

#### Input/context validation
**LIVE_AS_OF**
- require `p_sku_id` and month-normalized `p_period_start`;
- derive the governed valuation date from `costing.cost_periods` / the semantics already exposed by `rpc_get_cost_period_valuation_context`;
- reject missing period/valuation context rather than silently substituting `current_date`;
- return the resolved period/valuation context in the payload;
- downstream persisted costing outcome is attached only if its period/valuation context matches; otherwise outcome is `UNKNOWN` with a context-mismatch/unavailable reason.

**EXACT_RUN**
- require `p_sku_id` and `p_refresh_run_id`;
- derive period/valuation from `costing.costing_refresh_run`, consistent with `rpc_get_costing_refresh_context`;
- if a supplied `p_period_start` conflicts with the run context, fail closed;
- require run-context integrity to be suitable for exact evidence; legacy/unverified or mismatched context must be reported explicitly;
- read run-scoped frozen/snapshot authorities by `refresh_run_id + period_start + valuation_date + sku_id`; never invoke live resolvers as historical proof.

#### Source-authority map
| Dependency | LIVE_AS_OF authority | EXACT_RUN authority/proof | Contract treatment |
| --- | --- | --- | --- |
| Product lifecycle/base UOM | `public.products` joined through SKU | frozen identity fields where present plus run context; lifecycle-at-run is not inferred if not frozen | Product master summary; exact mode must label non-frozen lifecycle fields unavailable rather than current |
| SKU lifecycle/pack UOM | `public.product_skus` | frozen SKU identity/pack fields in run snapshots where present | SKU master summary |
| PM-BOM revision | `public.plm_sku_bom_revision_as_of(sku, valuation_date)` | run-scoped PM/material snapshots and frozen BOM lineage | Structural dependency |
| Batch-size reference | existing governed batch-size effective-dated authority consumed by costing/route workload | run-scoped workload/allocation snapshots where frozen | Structural dependency; implementation must call existing resolver/source, not duplicate precedence |
| Manufacturing route | `costing.fn_product_process_route_readiness(valuation_date)`, filtered to Product | run-scoped direct-labour/production-overhead/workload snapshots plus frozen route lineage where available | Structural foundation for live; exact mode reports only frozen evidence available |
| MRP | `costing.fn_resolve_sku_mrp_as_of` | `costing.sku_costing_control_status_snapshot` MRP policy/resolution columns | Structural commercial dependency |
| Selling/GST | `costing.fn_resolve_sku_selling_price_policy_as_of` | `costing.sku_costing_control_status_snapshot` selling-policy/resolution columns | Structural commercial dependency |
| Scheme | `costing.fn_resolve_selected_scheme_policy_as_of` per applicable region | exact snapshot scheme-context/frozen pricing evidence | Governed fallback such as DEFAULT_NO_SCHEME is resolved |
| Common commercial basis | `costing.v_sku_commercial_sales_basis` for requested period/valuation | run-scoped allocation snapshots | Evidence-quality dependency |
| Regional commercial basis | governed regional assumption/default resolvers and period context | `sku_regional_marketing_allocation_basis_snapshot` | Evidence-quality dependency |
| Direct Labour | driver registry/policy resolver + route/workload authority | `sku_direct_labour_allocation_snapshot` | Global policy + SKU evidence, deduplicated remediation scope |
| Production Overhead | driver registry/policy resolver + route/workload authority | `sku_production_overhead_allocation_snapshot` / `sku_overhead_allocation_snapshot` | Global policy + SKU evidence |
| QA/QC | driver registry/effective policy + governed allocation evidence | `sku_overhead_allocation_snapshot` | Global policy + SKU evidence |
| Materials/Stores | driver registry/effective policy + governed allocation evidence | `sku_overhead_allocation_snapshot` | Global policy + SKU evidence |
| Administrative Overhead | approved driver envelope + common sales basis | `sku_admin_finance_overhead_allocation_snapshot` | Global policy + contextual evidence |
| Finance/Admin Overhead | approved driver envelope + common sales basis | `sku_admin_finance_overhead_allocation_snapshot` | Global policy + contextual evidence |
| Marketing Expense | effective Marketing policy + regional evidence/acceptance authorities | `sku_marketing_expense_allocation_snapshot`, regional basis/allocation snapshots, acceptance lineage | Preserve raw/effective review semantics |
| Material rates | live material-cost authority for requested governed context where available | run-scoped material/RM/PM snapshots | Evidence quality/downstream outcome; not Product master |
| Final costing outcome | matching-context persisted control evidence only | `costing.sku_costing_control_status_snapshot` keyed by exact run/context/SKU | Consume authoritative status/severity/remediation |

#### Exact-run coverage conclusion
Exact-run support is feasible without historical reconstruction. The live schema contains run-keyed snapshots for final control status and all seven driver/allocation families, including:
- direct labour;
- production overhead;
- combined QA/QC + Materials/Stores overhead;
- Administrative + Finance/Admin overhead;
- Marketing and regional Marketing evidence;
- final SKU costing-control status.

`costing.sku_costing_control_status_snapshot` additionally freezes `valuation_date`, `refresh_run_id`, MRP policy identity/resolution, selling-price policy identity/resolution and scheme-context metadata.

Where a lifecycle/master attribute was never frozen in the run, exact mode must return `UNKNOWN/NOT_FROZEN_IN_RUN` for that historical dimension rather than joining today's mutable master and presenting it as historical fact.

#### Payload contract
Return a single JSON object:
- `context`: context type, SKU, Product, period, valuation date, refresh run when applicable, context-integrity status;
- `lifecycle`: current lifecycle only for LIVE_AS_OF; exact mode marks non-frozen lifecycle evidence unavailable;
- `summary`: `product_master_foundation_status`, `sku_master_foundation_status`, `costing_foundation_status`, `evidence_quality_status`, `costing_outcome_status`, `overall_severity`;
- `dependencies`: ordered array of stable dependency objects;
- `shared_issues`: deduplicated global/system-scope defects (not repeated as independent SKU remediation);
- `downstream_control`: matching-context authoritative costing-control status when available.

Each dependency object carries:
`dependency_code`, `label`, `scope`, `dimension`, `applicability`, `raw_status`, nullable `effective_status`, `resolution_source`, `reason_code`, `note`, `owner_module`, `recommended_ui_route`, `authority`, `evidence_ids`, and effective/context dates as applicable.

#### Implementation guardrails
- read-only: no INSERT/UPDATE/DELETE, no refresh side effects;
- no resolver-precedence duplication;
- no use of `current_date` to silently fill governed valuation context;
- no direct authenticated EXECUTE grants on internal specialist resolvers;
- fixed search_path and explicit permission check;
- revoke PUBLIC EXECUTE on the new RPC before granting intended roles;
- no service-role exposure in client code;
- security + performance advisors after DDL;
- regression proof against READY SKU2, REVIEW_REQUIRED SKU1798, BLOCKED SKU1400, plus a newly created/incomplete SKU if a safe existing candidate can be identified without mutation.

## Server changes
None.

### G5 implementation checkpoint — server boundary live, contract completion still in progress
Live migrations:
- `20260929073632 wp01_product_sku_readiness_composition_rpc`
- `20260929073856 wp01_product_sku_readiness_rpc_acl_hardening`

Implemented public boundary:
`public.rpc_get_product_sku_readiness(bigint,date,text,bigint) returns jsonb`.

Verified properties:
- read-only `STABLE SECURITY DEFINER` with fixed `search_path = public, costing, pg_temp`;
- explicit `require_permission('module:costing-control-center', false)`;
- EXECUTE ACL is postgres/authenticated/service_role only; `anon_exec=false`;
- LIVE_AS_OF derives governed valuation date from the requested costing period and rejects missing context;
- EXACT_RUN derives immutable period/valuation context from `costing_refresh_run`;
- exact-run SKU1798/Run114 reports context `CONSISTENT`, Product historical master `UNKNOWN` rather than current-master substitution, and REVIEW_REQUIRED downstream outcome;
- live regression: SKU2 => READY/RESOLVED, SKU1798 => REVIEW_REQUIRED with structural foundation RESOLVED, SKU1400 => lifecycle inactive + structural BLOCKED;
- active/no-snapshot regression: SKU114 Rasnadi Choornam is visible immediately and reports BLOCKED foundations (missing PM-BOM, MRP and selling policy) with no downstream snapshot.
- initial unauthenticated SQL call failed closed with `Not authenticated`, confirming the permission boundary.
- security advisor exposed an explicit anon EXECUTE inherited/default grant after the first migration; the second migration removed it and ACL proof now reports `anon_exec=false`.

**G5 is not complete.** The first implementation establishes and proves the composition boundary, but the locked G4 contract also requires scheme/regional evidence and all seven driver families in dependency detail/shared-issue output. Those must be added and regression-audited before G5 closure. Do not treat the current RPC as the final WP01 contract yet.

Repository reconciliation: while this branch was open, `main` advanced independently to `73219fa4f0c723be14b4d2b1b1b4ff5e8b059988` through e-Aushadhi-only files. No Product/Costing/WP01 overlap was found. Reconcile against current main before final WP01 merge.

### G5 extended composition checkpoint — seven drivers, scheme and regional evidence
Additional live migrations:
- `20260929090402 wp01_readiness_driver_evidence_helpers`
- `20260929090700 wp01_readiness_driver_evidence_composition`
- `20260929091214 wp01_readiness_public_rpc_driver_enrichment`
- `20260929091416 wp01_readiness_scheme_regional_status_semantics`

Contract extension:
- all seven canonical driver families are now emitted from persisted run evidence: Direct Labour, Production Overhead, Quality Control Overhead, Materials / Stores Overhead, Administrative Overhead, Finance/Admin Overhead, Marketing Expense;
- selected-scheme evidence and regional-Marketing evidence are included without reimplementing their allocation formulas;
- regional Marketing preserves raw/effective acceptance semantics from `v_regional_marketing_evidence_review_queue`;
- absence from the regional review queue is represented as `NOT_REQUIRED`, not as a defect;
- selected-scheme `RESOLVED_POLICY` and `DEFAULT_NO_SCHEME` are governed successful outcomes; they are not incorrectly collapsed to BLOCKED;
- LIVE_AS_OF now pins persisted evidence to the latest SUCCESS refresh run for the governed period/valuation context. As of this checkpoint that is Run115 for Sep-2026 / valuation 2026-09-10. Failed Run116 is excluded;
- EXACT_RUN remains pinned to the requested run, proven with SKU1798 / Run114.

Regression after correction:
- SKU2: foundation RESOLVED, evidence READY, outcome READY, overall READY, evidence run115.
- SKU1798: foundation RESOLVED, evidence REVIEW_REQUIRED, outcome REVIEW_REQUIRED, overall REVIEW_REQUIRED, evidence run115.
- SKU1400: lifecycle inactive, foundation BLOCKED, evidence REVIEW_REQUIRED, overall BLOCKER.
- SKU114: lifecycle active, no downstream control snapshot, foundation BLOCKED and explicit missing prerequisites remain visible; evidence BLOCKED.
- SKU1798 exact Run114: Product master UNKNOWN (not current-substituted), foundation RESOLVED, evidence REVIEW_REQUIRED, outcome REVIEW_REQUIRED, evidence run114.

Security:
- public RPC: anon EXECUTE false; authenticated true; permission-gated by `module:costing-control-center`.
- internal helper functions in `costing`: anon false, authenticated false, service_role only.
- advisor warning on the public RPC is the expected generic authenticated SECURITY DEFINER warning; the RPC contains the explicit permission check and fixed search path. No anonymous execution remains.

Audit discovery: the first scheme normalization treated live `RESOLVED_POLICY` as BLOCKED and regional no-review rows as UNKNOWN; representative READY regression caught this and migration `wp01_readiness_scheme_regional_status_semantics` corrected the semantics before closure.

**Gate remains open for independent audit.** `shared_issues` is still empty. The audit must decide and prove whether global/shared driver-policy defects require deduplicated shared-issue composition, and verify no dependency/owner/route contract has been misclassified. Do not close WP01-G5 before that audit.

### G5 independent audit — shared/global issues and closure proof
Live migration:
- `20260929134520 wp01_readiness_shared_global_driver_issues`

Independent audit conclusions:
- The G3/G4 rule that global driver-policy defects must not be represented as hundreds of independent SKU defects is now implemented through `costing.fn_product_sku_readiness_shared_issues(valuation_date)`.
- The helper evaluates the seven canonical registry elements and invokes the existing specialised policy resolvers for Direct Labour, Production Overhead, QA/QC, Materials/Stores and Marketing. Administrative and Finance/Admin use their approved effective envelope because they intentionally have no specialised workload policy table.
- The helper emits only defective global dependencies into `shared_issues`; healthy global policies are not repeated in every SKU payload. Current 2026-09-10 proof returns `[]`, consistent with all seven registry rows being approved/active/client-ready/data-quality-ready/cutover-active and all specialised resolvers resolving.
- Any emitted shared global issue fails the evidence aggregate closed to BLOCKED and therefore overall severity to BLOCKER. This prevents a global policy failure being hidden by otherwise healthy SKU evidence.
- Shared helper ACL: anon=false, authenticated=false, service_role=true. Public readiness RPC remains anon=false/authenticated=true/service_role=true and permission-gated.
- Security advisor continues to report only the expected generic warning that the intentionally authenticated public RPC is SECURITY DEFINER; internal readiness helpers are not exposed. No readiness-specific performance advisor finding was returned.

Representative post-audit regression remains:
- SKU2 READY / READY / READY;
- SKU1798 foundation RESOLVED, evidence REVIEW_REQUIRED, overall REVIEW_REQUIRED;
- SKU1400 foundation BLOCKED, overall BLOCKER;
- SKU114 incomplete/no-snapshot remains visible and BLOCKED;
- exact Run114 remains pinned to Run114; LIVE_AS_OF Sep-2026 evidence remains pinned to latest successful Run115 and excludes failed Run116.

Repository-governance reconciliation also found and corrected documentation drift before closure:
- MASTER active gate/immediate action updated from implementation to independent audit;
- WP01 Current Gate corrected from stale G1 to G5;
- implementation and focused-verification milestones marked complete;
- PARKED_BACKLOG now records SEC-P01 and the regional-Marketing client-surface gap;
- DEC-006 locks multidimensional server-authoritative readiness;
- DEC-007 locks LIVE_AS_OF latest-success evidence pinning and EXACT_RUN immutability/non-substitution.

**Independent server-contract audit result: PASS.**
No REQUIRED NOW server-contract defect remains from the G5 audit. Repository branch reconciliation against current main is still required before merge because main advanced independently while WP01 was open.

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
