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
- Repository authority advanced independently during the audit; current main at this checkpoint is `8aa68f7d6677a6a34a2047ac7573bd749601705c`. The advance belongs to unrelated work and does not supersede this programme.
- Live Supabase remains authoritative for server behaviour; current main remains authoritative for client/repository reality.

### Evidence-backed lifecycle findings
- Product/SKU existence and operational activation are distinct from downstream costing completeness/readiness.
- Server resolvers, not client-side row-existence checks, define whether contextual foundations resolve.
- Governed PM-BOM revision, effective preferred batch-size reference, manufacturing route/readiness, MRP policy and selling-price/GST policy are blocking costing foundations where required.
- Scheme resolution supports an explicit policy or governed `DEFAULT_NO_SCHEME`; an explicit scheme row is therefore not universally mandatory.
- Common sales allocation uses evidence precedence: positive actual monthly evidence → governed SKU assumption → governed scenario default → unresolved. Actual evidence is READY; assumption/default evidence is REVIEW_REQUIRED; ambiguity/unresolved evidence can BLOCK.
- Regional commercial/Marketing assumptions are conditional evidence/remediation, not universal mandatory rows. Regional Marketing supports actual evidence, approved assumption and governed regional-default paths with review/acceptance semantics.
- Direct Labour, Materials/Stores and QA/QC each have governed effective policy layers. Driver-specific resolver semantics must be preserved rather than flattened into a generic checklist.
- Final SKU costing control is an exact-run diagnosis aggregating material, manufacturing, pricing, selling-price and cost-sheet states.

### Live coverage observations captured during WP00
- Active non-sample population inspected: 610 SKUs.
- MRP: 610 RESOLVED, 0 MISSING, 0 AMBIGUOUS.
- Selling-price policy: 610 RESOLVED, 0 MISSING, 0 AMBIGUOUS.
- Scheme resolution in both IK and OK: 596 explicit policy, 14 `DEFAULT_NO_SCHEME`, 0 blocked.
- Direct Labour, Materials/Stores and QA/QC each had one effective policy at inspection time.
- Run114 (`period_start=2026-09-01`, `valuation_date=2026-09-10`) completed SUCCESS with 636 final SKU rows: 0 BLOCKED, 147 REVIEW_REQUIRED, 489 READY.
- The explicit regional-commercial-assumption resolver was MISSING for the inspected 610 active non-sample SKUs in IK and OK under Run114 context, proving that explicit regional assumptions cannot be classified as universal prerequisites because governed fallback/evidence paths allowed the run to complete.

### Client/admin-surface map
- Product master: `manage-products.html` / `js/products.js`.
- PM governance: `manage-pm-bom.html` plus governed PM RPC/client cutover helpers.
- Preferred/min/max batch-size lifecycle: Supply Batch Plan; `public/shared/js/supply-batch-size-references.js` exposes governed register/create/revise/inactivate RPC adapters and deep links.
- Manufacturing route/readiness: Production Route Manager. Registry exposes route readiness, Product assignments, subgroup mappings, workload preview, route families, mapping/foundation review, cost centres, family/product route editors, historical evidence, effective-route viewer and archives.
- MRP: Pricing Policy Manager → MRP Governance.
- Selling-price/GST and scheme policies: Pricing Policy Manager → Selling & Scheme Policies.
- Final costing diagnosis/remediation: Costing Control Center → Dashboard, Control Workbench, SKU Control Status.
- Materials/Stores and QA/QC remediation: Cost Sheet Review & Approval → dedicated action queues.
- Material rate remediation: Material Cost Manager.
- Cost-driver policy governance: Cost Build Manager → Driver Governance.
- The required foundations are therefore materially distributed across Product, Supply Planning and multiple Costing Suite specialist surfaces. This fragmentation is an evidence-backed current-state finding; no IA redesign decision is made in WP00.

## Canonical Product/SKU Costing Foundation Dependency Matrix — working inventory
| Dependency | Scope | Authoritative behaviour | Costing classification | Current client/admin surface |
| --- | --- | --- | --- | --- |
| Product master / activation | Product | Governed Product entity/lifecycle | Entity + operational foundation; Active is not Costing Ready | Manage Products |
| SKU master / activation | SKU | Governed SKU entity/lifecycle | Entity + operational foundation | Product/SKU lifecycle surface; exact consolidation still under audit |
| Base UOM / SKU conversion | Product/SKU | Server-validated conversion context | Master foundation | Product/SKU master surfaces |
| PM template/map/override/compiled chain | SKU | Governed PM composition chain | Upstream PM foundation | PM BOM Manager |
| Approved effective PM-BOM revision | SKU | Effective governed revision required downstream | BLOCKING costing foundation when required | PM BOM Manager |
| Preferred/min/max batch size | Product | Effective governed reference; create/revise/inactivate lifecycle | BLOCKING costing/route workload foundation when required | Supply Batch Plan → Batch Sizes |
| Manufacturing route/readiness | Product | Guarded server readiness and governed route lifecycle | BLOCKING costing foundation | Production Route Manager |
| MRP policy | SKU | RESOLVED/MISSING/AMBIGUOUS by valuation date | Missing/ambiguous BLOCKING | Pricing Policy Manager → MRP Governance |
| Selling-price/GST policy | SKU | Effective policy resolver; invalid/missing GST propagates block | Missing/ambiguous/invalid BLOCKING | Pricing Policy Manager → Selling & Scheme Policies |
| Scheme policy | SKU/hierarchy × region | Explicit policy or governed No Scheme default | Resolvable foundation; explicit row not mandatory | Pricing Policy Manager → Selling & Scheme Policies |
| Common sales allocation evidence | SKU | Actual → assumption → scenario default | READY / REVIEW_REQUIRED / BLOCKED by evidence path | Costing/control and planning evidence surfaces; ownership consolidation still under audit |
| Regional commercial assumption | SKU × region | Optional governed assumption in precedence/fallback chain | Conditional remediation/evidence | Specialist costing evidence path; exact edit surface still under audit |
| Marketing allocation policy/evidence | Product/SKU × region | Governed policy + actual/assumption/default evidence | Driver foundation with READY/REVIEW/BLOCKED semantics | Cost Build/Cost Sheet specialist surfaces; exact ownership still under audit |
| Direct Labour policy | Global/effective date | Governed effective driver policy | BLOCKING driver foundation | Cost Build Manager → Driver Governance |
| Materials/Stores policy/evidence | Global + Product/SKU | Governed policy plus RM/PM evidence classifications | Driver foundation; BLOCKED/REVIEW/READY | Driver Governance + Materials / Stores Action Queue |
| QA/QC policy/evidence | Global + Product | Governed effective policy and allocation evidence | Driver foundation; BLOCKED/REVIEW/READY | Driver Governance + QC Action Queue |
| Final SKU costing control | SKU × exact run | Server-produced aggregate control status and recommended route | Final diagnosis, not creation-time master truth | Costing Control Center → SKU Control Status |

## Approved design / contract
None. WP00 is evidence gathering only. WP01 will define the completeness contract after this matrix is independently audited and approved.

## Milestones
- [~] Current-state/audit gate
- [ ] Dependency-matrix consolidation
- [ ] Focused verification
- [ ] Independent audit
- [ ] Documentation merge/post-merge proof
- [ ] Final handover to WP01

## Current Gate
`WP00-G1 — authoritative dependency and client-surface audit`

## Gate Status
[~] IN PROGRESS

## Required to close
Complete unresolved ownership/client-surface cells; verify representative Product/SKU end-to-end against the matrix; independently audit matrix completeness and classification against live server/current main. No redesign.

## Next gate
`WP00-G2 — canonical dependency-matrix consolidation and representative-SKU proof`

## Server changes
None. All Supabase work in WP00 has been read-only inspection.

## Client changes
None. Repository inspection only.

## Tests / verification
- Live resolver coverage checks for MRP, selling-price, scheme and global driver policies.
- Exact-run inspection of Run114 final control counts.
- Repository inspection of Costing Suite registry/route configuration, Product master, PM BOM, Production Route Manager, Pricing Policy Manager and Supply Batch Plan batch-size helpers.
- Current-main reconciliation performed after unrelated main advancement.

## Decisions created
None. Findings are descriptive and do not alter locked programme decisions.

## Risks
Premature assumptions; treating row absence as incompleteness where a governed resolver provides fallback; flattening driver-specific semantics; scope drift into WP01/WP05–WP09 redesign; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None newly created by this checkpoint.

## Exit criteria
Canonical dependency matrix complete; representative Product/SKU proof complete; unresolved cells either resolved or explicitly classified; independent audit passes; WP00 documentation is merged/post-merge verified; handover to WP01 is current.

## Final handover
Not yet complete.
