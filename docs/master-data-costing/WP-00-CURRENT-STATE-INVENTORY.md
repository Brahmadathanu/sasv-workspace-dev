# WP-00 — Authoritative Current-State Inventory

## Objective
Audit the complete Product → SKU → Costing lifecycle and produce the canonical Product/SKU Costing Foundation Dependency Matrix.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
WP-1 Repository Programme Control Plane is completed, independently verified, merged, and post-merge verified.

## Scope
Audit Product master, SKU master, activation, UOM/conversion, PM template/override/compiled/governed revision chain, preferred/min/max batch size, manufacturing route and route foundation, labour, MRP, selling-price/GST, schemes, sales assumptions/defaults, Materials/Stores, QA/QC and other proven costing-driver dependencies. For each dependency identify authoritative source/resolver, lifecycle/effective-date semantics, ownership/admin surface, activation/costing requirement, BLOCKED versus REVIEW behaviour, and missing client surface.

## Explicit exclusions
No Product/Costing redesign; no completeness implementation; no guessed data; no server/client mutation; no unrelated/e-Aushadhi changes.

## Current-state findings
### Repository/server authority reconciliation
- WP-1 is complete. WP00 has genuinely started.
- Repository authority advanced independently during the audit. The first WP00 checkpoint was merged and current main at this matrix checkpoint is `a1ed951fe6780f243c65094b3169b45196d4a259`. Unrelated main advances remain permissible but must be reconciled before each controlled write.
- Live Supabase remains authoritative for server behaviour; current main remains authoritative for client/repository reality.

### Evidence-backed lifecycle findings
- Product/SKU existence and operational activation are distinct from downstream costing completeness/readiness.
- Server resolvers, not client-side row-existence checks, define whether contextual foundations resolve.
- Governed PM-BOM revision, effective preferred batch-size reference, manufacturing route/readiness, MRP policy and selling-price/GST policy are blocking costing foundations where required.
- Scheme resolution supports an explicit policy or governed `DEFAULT_NO_SCHEME`; an explicit scheme row is therefore not universally mandatory.
- Common sales allocation uses evidence precedence: positive actual monthly evidence → governed SKU assumption → governed scenario default → unresolved. Actual evidence is READY; assumption/default evidence is REVIEW_REQUIRED; ambiguity/unresolved evidence can BLOCK.
- Regional commercial/Marketing assumptions are conditional evidence/remediation, not universal mandatory rows. Regional Marketing supports actual evidence, approved assumption and governed regional-default paths with review/acceptance semantics.
- The canonical driver registry contains seven governed cost elements: Direct Labour, Production Overhead, Quality Control Overhead, Materials/Stores Overhead, Administrative Overhead, Finance/Admin Overhead and Marketing Expense. Driver-specific resolver and evidence semantics must be preserved rather than flattened into a generic checklist.
- Direct Labour, Production Overhead, QA/QC, Materials/Stores and Marketing have specialised governed policy/evidence architectures. Administrative and Finance/Admin Overhead are approved governed policy envelopes using the common sales-allocation basis.
- Current projection and persisted exact-run evidence are different authorities for different questions. A later current status may legitimately differ from a frozen successful run after policy/evidence changes; historical run truth must be read from exact-run/snapshot context.
- Final SKU costing control is an exact-run diagnosis aggregating material, manufacturing, pricing, selling-price and cost-sheet states.

### Live coverage observations captured during WP00
- Active non-sample population inspected: 610 SKUs.
- MRP: 610 RESOLVED, 0 MISSING, 0 AMBIGUOUS.
- Selling-price policy: 610 RESOLVED, 0 MISSING, 0 AMBIGUOUS.
- Scheme resolution in both IK and OK: 596 explicit policy, 14 `DEFAULT_NO_SCHEME`, 0 blocked.
- Direct Labour, Materials/Stores and QA/QC each had an effective policy at inspection time. The driver registry also showed approved active Production Overhead, Administrative Overhead, Finance/Admin Overhead and Marketing governance.
- Run114 (`period_start=2026-09-01`, `valuation_date=2026-09-10`) completed SUCCESS with 636 final SKU rows: 0 BLOCKED, 147 REVIEW_REQUIRED, 489 READY.
- The explicit regional-commercial-assumption resolver was MISSING for the inspected 610 active non-sample SKUs in IK and OK under Run114 context, proving that explicit regional assumptions cannot be classified as universal prerequisites because governed fallback/evidence paths allowed the run to complete.
- A later current-state inspection found 637 active SKUs under active Products, with zero parent Products missing base-UOM/conversion context. This is a current-state observation only and does not alter Run114's immutable 636-row population.

### Client/admin-surface map
- Product and SKU lifecycle: `manage-products.html` / `js/products.js`; the server create/update/activation RPCs are governed by `module:manage-products` and write immutable Product/SKU audit records.
- PM governance: `manage-pm-bom.html` plus governed PM RPC/client cutover helpers.
- Preferred/min/max batch-size lifecycle: Supply Batch Plan; `public/shared/js/supply-batch-size-references.js` exposes governed register/create/revise/inactivate RPC adapters and deep links.
- Manufacturing route/readiness: Production Route Manager. Registry exposes route readiness, Product assignments, subgroup mappings, workload preview, route families, mapping/foundation review, cost centres, family/product route editors, historical evidence, effective-route viewer and archives.
- MRP: Pricing Policy Manager → MRP Governance.
- Selling-price/GST and scheme policies: Pricing Policy Manager → Selling & Scheme Policies.
- Common SKU sales assumptions plus company-wide and regional governed sales-allocation defaults: Pricing Policy Manager → Commercial Sales Assumptions. Saved evidence affects future governed refreshes; completed runs remain unchanged.
- Final costing diagnosis/remediation: Costing Control Center → Dashboard, Control Workbench, SKU Control Status.
- Materials/Stores and QA/QC remediation: Cost Sheet Review & Approval → dedicated action queues.
- Material rate remediation: Material Cost Manager.
- Cost-driver policy governance: Cost Build Manager → Driver Governance. The canonical registry covers all seven cost elements; Direct Labour and Production Overhead also expose Production Route Manager-owned route/workload foundations.
- Regional Marketing evidence acceptance is server-governed by `costing.rpc_accept_regional_marketing_review` under Costing Control Center permission with fingerprinted acceptance evidence. A current-main client write/remediation path invoking that acceptance RPC was not found; this is a missing client surface, not a missing server contract.
- The required foundations are therefore materially distributed across Product, Supply Planning and multiple Costing Suite specialist surfaces. This fragmentation is an evidence-backed current-state finding; no IA redesign decision is made in WP00.

## Canonical Product/SKU Costing Foundation Dependency Matrix — audited inventory
| Dependency / foundation | Grain | Authoritative source / resolver | Lifecycle / fallback semantics | Costing classification | Current owner / client surface | Representative / audit evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Product master / activation | Product | Governed Product RPC lifecycle + immutable audit | Create/update/activate/deactivate; activation does not validate downstream costing foundations | Entity + operational foundation; Active != Costing Ready | Manage Products | Product 1350 is Active |
| SKU master / activation | SKU | Governed SKU RPC lifecycle + immutable audit | Create/update/activate/deactivate independently of downstream costing foundations | Entity + operational foundation; Active != Costing Ready | Manage Products | SKU1798 is active, non-sample |
| Base UOM / conversion context | Product | `products.uom_base`, `products.conversion_to_base` with server validation | Product-level base context; SKU separately carries pack size/UOM | Master foundation; do not model as a separate SKU conversion row | Manage Products | Product1350: Kg / 0.001; SKU1798: 100 g. Current 637 active SKUs have no parent missing base context |
| PM template / map / overrides / compiled BOM | SKU | `plm_sku_pack_map`, template/override tables, `plm_sku_bom_effective` | Editable composition chain used to compile effective PM composition | Upstream PM authoring foundation; not historical costing truth by itself | PM BOM Manager | SKU1798 source template id 5 |
| Approved effective frozen PM-BOM revision | SKU x valuation date | `plm_bom_revision` + `plm_sku_bom_revision_as_of` | APPROVED/SUPERSEDED effective interval; frozen lines/hash; ambiguity/missing fails governed resolution | BLOCKING costing foundation where required | PM BOM Manager | SKU1798 revision 683, rev1, effective 2026-09-10, Run110 repair approval |
| Preferred/min/max batch-size reference | Product x effective date | `production_batch_size_ref` + governed create/revise/inactivate RPCs | Effective-dated Product reference; revision closes predecessor | BLOCKING workload/costing foundation where required | Supply Batch Plan → Batch Sizes | Product1350: 35/35/35 from 2026-09-10 |
| Manufacturing route / route readiness | Product x as-of / exact run | `costing.fn_product_process_route_readiness` and PRM readiness RPCs | Route-family assignment/inheritance can validly resolve without Product-specific route | BLOCKING when route readiness is not READY | Production Route Manager | Product1350 READY through inherited `DRY_COARSE_POWDER_WASH_DRY` family route |
| MRP policy | SKU x valuation date | SKU MRP resolver / governed MRP policy | RESOLVED/MISSING/AMBIGUOUS; effective-dated | Missing/ambiguous BLOCKING | Pricing Policy Manager → MRP Governance | SKU1798 MRP ₹150 IK/OK from 2026-09-10 |
| Selling-price / GST policy | SKU x valuation date | `costing.fn_resolve_sku_selling_price_policy_as_of` | Effective policy; missing/ambiguous/invalid GST propagates failure | BLOCKING when unresolved/invalid | Pricing Policy Manager → Selling & Scheme Policies | SKU1798 policy 1320, GST 5%, effective 2026-09-01 |
| Scheme policy | SKU/hierarchy x region x date | `costing.fn_resolve_selected_scheme_policy_as_of` | Explicit policy or governed `DEFAULT_NO_SCHEME` fallback | Resolvable foundation; explicit row not universally mandatory | Pricing Policy Manager → Selling & Scheme Policies | Population proof: 596 explicit + 14 default-no-scheme per IK/OK, 0 blocked |
| Common sales-allocation evidence | SKU/Product x period/run | Canonical commercial sales basis resolver/snapshot | Positive actual → SKU assumption → governed scenario default → unresolved | READY from actual; REVIEW_REQUIRED from governed assumption/default; ambiguity/unresolved can BLOCK | Pricing Policy Manager → Commercial Sales Assumptions | SKU1798: `DEFAULT_NEW_PRODUCT_NO_HISTORY`, 10 units, REVIEW_REQUIRED |
| Regional sales assumption/default evidence | SKU x region x valuation/run | Regional assumption/default resolvers and snapshots | Actual → approved regional assumption → governed regional default → no eligible history; explicit assumption not universal | Conditional evidence/remediation, not universal master prerequisite | Pricing Policy Manager → Commercial Sales Assumptions | SKU1798 IK/OK resolve via governed regional defaults, 10 units each |
| Direct Labour policy / allocation | Global policy + Product/SKU x run | `costing.fn_resolve_direct_labour_workload_policy` + workload/allocation snapshots | Exactly one APPROVED effective policy required; route/workload + monthly basis feed allocation | BLOCKING policy foundation; SKU evidence may be READY/REVIEW/BLOCKED | Cost Build Manager → Driver Governance; PRM for route/workload explain | SKU1798 Run114 calculated and REVIEW_REQUIRED |
| Production Overhead policy / allocation | Global policy + Product/SKU x run | `costing.fn_resolve_production_overhead_workload_policy` + Product workload/step + SKU allocation snapshots | Separate governed workload policy with route step scopes/factors | BLOCKING policy/workload foundation; allocation may be REVIEW_REQUIRED from quantity evidence | Driver Governance + Production Route Manager workload foundation | SKU1798 Run114 ₹61.3263/SKU, REVIEW_REQUIRED |
| QA/QC policy / allocation | Global policy + Product/SKU x run | `costing.fn_resolve_qc_workload_policy` + QC snapshots/explain RPCs | Exactly one ACTIVE effective policy required | BLOCKING policy foundation; allocation evidence can READY/REVIEW/BLOCK | Driver Governance + Cost Sheet Review → QC Action Queue | SKU1798 Run114 calculated, REVIEW_REQUIRED |
| Materials/Stores policy / allocation | Global policy + Product/SKU x run | `costing.fn_resolve_materials_stores_workload_policy` + MS snapshots/explain RPCs | Resolver selects latest active effective policy; downstream refresh validates RM/PM evidence and classifications | Driver foundation; allocation/evidence can READY/REVIEW/BLOCK | Driver Governance + Cost Sheet Review → Materials/Stores Action Queue | SKU1798 Run114 calculated, REVIEW_REQUIRED |
| Administrative Overhead | Global policy envelope + SKU x run | Cost-driver policy envelope + admin/finance allocation snapshot | Approved envelope; common governed sales-allocation basis; no route workload required | Driver foundation; SKU allocation inherits sales-basis evidence quality | Cost Build Manager → Driver Governance | SKU1798 Run114 ₹5.0440/SKU, REVIEW_REQUIRED |
| Finance/Admin Overhead | Global policy envelope + SKU x run | Cost-driver policy envelope + admin/finance allocation snapshot | Approved envelope; common governed sales-allocation basis; no route workload required | Driver foundation; SKU allocation inherits sales-basis evidence quality | Cost Build Manager → Driver Governance | SKU1798 Run114 ₹6.7198/SKU, REVIEW_REQUIRED |
| Marketing allocation policy / regional evidence | Global policy + SKU x region x run | `costing.fn_resolve_marketing_allocation_policy`, regional basis/expense snapshots | Exactly one approved effective Marketing policy; actual/assumption/default evidence chain; eligible REVIEW can be accepted by evidence fingerprint | Policy can BLOCK; evidence may READY/REVIEW/BLOCK; accepted eligible review can become effective READY | Driver Governance; assumptions/defaults in Pricing Policy Manager; explanation in Cost Sheet Review | SKU1798 Run114 IK/OK calculated via governed regional defaults and acceptance-eligible REVIEW_REQUIRED |
| Regional Marketing review acceptance | SKU x region x exact evidence fingerprint | `costing.rpc_accept_regional_marketing_review` + `regional_marketing_evidence_acceptance` | Governed acceptance only for server-eligible evidence; reason required; acceptance fingerprinted | Remediation evidence, not a creation-time foundation | Server owner: Costing Control Center permission; current client write surface not found | Missing client/admin remediation surface recorded for later work pack |
| Final SKU costing control | SKU x exact run | Persisted exact-run control/snapshot and detailed cost-sheet evidence | Historical exact-run status is immutable context; current projections may later differ | Final diagnosis, not Product/SKU creation truth | Costing Control Center → Dashboard / Control Workbench / SKU Control Status | Run114 SUCCESS: 636 rows, 0 BLOCKED / 147 REVIEW_REQUIRED / 489 READY |

### Representative Product/SKU proof — Product1350 / SKU1798
- Trigger item: **Mahamanjishtadi Kashaya Choornam 100 g**.
- Product is Active; SKU is active/non-sample. This alone did not guarantee costing readiness.
- Product base context is Kg with conversion 0.001; SKU pack is 100 g.
- Governed PM-BOM revision 683/revision 1 is APPROVED from 2026-09-10 with approval reference `PLM-PM-BOM-RUN110-REPAIR-SKU1798-2026-09-10`.
- Governed Product batch-size reference is 35 preferred/min/max from 2026-09-10.
- Manufacturing route resolves READY through route family `DRY_COARSE_POWDER_WASH_DRY`; Product-specific route absence is valid because family inheritance resolves.
- MRP resolves to ₹150 in IK and OK. Selling policy 1320 is effective from 2026-09-01 with GST 5%.
- Common sales basis resolves through `DEFAULT_NEW_PRODUCT_NO_HISTORY` at 10 units and therefore requires review rather than blocking.
- Regional Marketing resolves IK and OK separately through governed regional defaults at 10 units each; explicit regional assumptions are absent and not required.
- Run114 driver allocations calculate successfully. Direct Labour, Production Overhead, Materials/Stores, QA/QC, Administrative Overhead, Finance/Admin Overhead and Marketing evidence carry REVIEW_REQUIRED where governed fallback/monthly evidence requires review.
- Run114 is the historical proof authority for this valuation context: SUCCESS, 636 final rows, 0 BLOCKED / 147 REVIEW_REQUIRED / 489 READY.
- Later current-control/diagnosis projections can differ after evidence/policy changes. They must not be used to rewrite Run114's persisted historical truth.

### Independent omission/classification audit findings
- PASS after correction: all seven canonical driver elements are now represented explicitly.
- Corrected Product-level ownership of base UOM/conversion; SKU contributes pack size/UOM.
- Corrected PM authoring chain versus frozen approved effective PM-BOM revision; these are different lifecycle objects.
- Corrected common/regional sales-assumption ownership to Pricing Policy Manager → Commercial Sales Assumptions.
- Preserved driver-specific resolver semantics: Direct Labour, QA/QC and Marketing explicitly enforce their effective-policy invariants; Materials/Stores uses latest-active resolution with downstream refresh validation rather than an invented universal resolver rule.
- Preserved route inheritance as valid governed readiness rather than requiring a Product-specific route row.
- Preserved explicit scheme and regional-assumption absence as valid where authoritative governed fallback resolves.
- Added the missing regional-Marketing acceptance client-surface finding without redesigning it.
- Preserved current-state versus exact-run distinction throughout.

## Approved design / contract
None. WP00 is evidence gathering only. WP01 will define the completeness contract after this matrix is independently audited and approved.

## Milestones
- [x] Current-state/audit gate
- [x] Dependency-matrix consolidation
- [x] Focused verification
- [x] Independent audit
- [~] Documentation merge/post-merge proof
- [ ] Final handover to WP01

## Current Gate
`WP00-G3 — documentation diff audit and merge gate`

## Gate Status
[~] IN PROGRESS

## Required to close
Persist the audited matrix/proof to the controlled docs branch; independently verify the branch diff is docs-only and complete; obtain explicit merge approval; merge and post-merge verify; then record final WP00 handover to WP01.

## Next gate
`WP00-G4 — post-merge proof and WP01 handover`

## Server changes
None. All Supabase work in WP00 has been read-only inspection.

## Client changes
None. Repository inspection only.

## Tests / verification
- Live resolver coverage checks for MRP, selling-price, scheme and all seven canonical driver elements.
- Representative end-to-end proof for Product1350 / SKU1798 across Product/SKU, UOM, PM-BOM, batch size, route, commercial policy/evidence and all driver layers.
- Exact-run inspection of Run114 final control counts and frozen driver snapshots.
- Repository inspection of Manage Products, PM BOM, Supply Batch Plan, Production Route Manager, Pricing Policy Manager/Commercial Sales Assumptions, Driver Governance, Cost Sheet Review queues and Costing Control Center.
- Independent omission/classification audit completed; corrections incorporated before documentation merge.
- Current-main reconciliation performed before controlled documentation write.

## Decisions created
None. Findings are descriptive and do not alter locked programme decisions.

## Risks
Premature assumptions; treating row absence as incompleteness where a governed resolver provides fallback; flattening driver-specific semantics; scope drift into WP01/WP05–WP09 redesign; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
- Regional Marketing evidence acceptance has a governed server RPC/register but no current-main client write/remediation surface was found. Preserve for later readiness/Costing Suite UX work; do not redesign in WP00.
- SEC-P01 remains separately parked: five previously identified public tables have RLS disabled and require a dedicated security treatment; unrelated to WP00 unless later evidence proves otherwise.

## Exit criteria
Canonical dependency matrix complete; representative Product/SKU proof complete; unresolved cells either resolved or explicitly classified; independent audit passes; WP00 documentation is merged/post-merge verified; handover to WP01 is current.

## Final handover
Not yet complete.
