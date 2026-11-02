# WP05-A3 — Proposed Costing navigation architecture (2 Nov 2026)

**Status: PROPOSAL for the WP05 design-review gate. Not approved; no implementation has been started.** Baseline `main` `3d0b618`. Does not replace or overwrite the unified workflow on PR #129.

## 1. Design principles (from MASTER_PROGRAMME locked decisions and this audit)

1. **Presentation grouping only in the first wave.** Navigation derives from `allowedLensIds` and is not permission-filtered; grouping labels does not change any check. Server `require_permission` remains the real boundary.
2. **Keep the six module pages and their six `permissionTarget`s.** The shell loads permissions for **one** route (shell 3493); a single merged "Costing" nav would need per-lens permission evaluation — a high-risk, later-wave change (needs Plan gate).
3. **Daily-work entry first, specialist/history behind progressive disclosure.** No function is deleted; every current lens id and deep link (`?lens=`, `?workspace=`) stays valid (aliases).
4. **Master-detail + contextual actions** for selected records; **context chip** (product / family / route / period / run / as-of) and **breadcrumb** on every module.
5. **Never merge permission domains**: RM vs PM trace, CCC-edit vs MCM-edit, CBM vs PRM edit in Driver Governance, PPM single-edit flag.
6. Respect effective-dating, run-scoping, UNKNOWN≠READY, default-OFF flags.

## 2. Daily tasks → preferred home

| Daily task | Preferred home | Today |
|---|---|---|
| "What needs attention this month?" | CCC → Dashboard | same |
| "Which SKUs are blocked and what fixes them?" | CCC → **SKU Review** (SKU Control Status ⊕ Readiness, two truth-model tabs, run selector, fix links, CSV) | two lenses |
| Triage material blockers / accept reviews | CCC → Control Workbench (authority decision D3 pending vs MCM queue) | two queues |
| Fix a manual RM/PM rate | MCM → Rates | same |
| Inspect confidential RM/PM contribution | MCM → Traces (restricted) | tabs visible to all |
| Map expense heads / classify staff / provisions / driver policy | CBM → grouped nav | 4 flat tabs |
| Set MRP / selling / scheme policy | PPM → grouped workspaces | 10 flat workspaces |
| Review a cost sheet / compare months / scheme viability | CSR | 6 flat lenses |
| Clear QC / M&S blockers | CSR → **Action Queues** (queue switch) | 2 lenses |
| Get a route onto a product | PRM → Readiness → contextual "Assign → Build → Approve" | 13 pills |

## 3. Proposed per-module navigation

### CCC (4 → 3 destinations, no lens id lost)
`Dashboard` · `Control Workbench` · `SKU Review` (alias: `sku-control-status`, `portfolio-readiness` as tabs inside). Combine only after WP05-P01 parity blockers close; until then keep both as tabs of one group (presentation) with separate loaders.

### MCM (3 lenses, 2 groups)
**Rates:** Manual Rate Manager. **Traces (restricted):** RM Cost Trace, PM Cost Trace — separate roles retained; hide tab when the role view flag is absent (improvement over today's visible-then-restricted; `[A]` verify UX with owner).

### CBM (4 lenses, 3 groups)
**Mapping & classification:** Cost Governance, Staff Governance. **Provisions:** Manual Provisions. **Policy approval:** Driver Governance (per-action `required_module` check untouched).

### PPM (10 workspaces, 4 groups; registry lenses become aliases)
**SKU policies:** SKU Policy Overview (landing), Selling & scheme in drawer. **MRP:** SKU MRP Policies, Product Derivation, then workflow group **MRP change workflow:** Proposals → Decisions → Approved for Application → Applied History. **Schemes:** Scheme Master, Scheme Rule Register. **Costing inputs:** Commercial Sales Assumptions (RELOCATE candidate; D4). Add contextual link *Scheme Comparison (CSR)* ↔ SKU Policy Overview. Policy creation stays in PPM; viability analysis stays in CSR.

### CSR (6 lenses → 5 destinations)
**Review:** SKU Cost Details (default), Scheme Comparison, Cost Comparison. **Documents:** Cost Sheet. **Action Queues:** QC / Materials-Stores (one lens, queue switch). Remediation handoffs open targets with period/product context; CSR remains read-only. Request Costing Refresh placement: D6.

### PRM (13 pills → 5 groups, one context chip)
| Group | Lenses |
|---|---|
| **Readiness** (landing) | Route Readiness |
| **Assign & Map** | Product Assignments, Subgroup Mappings, Route Families |
| **Build** | Product Route Editor (with Effective Route read tab), Route Family Route Editor, Cost Centres |
| **Review** | Evidence & Review (Mapping Review · Foundation Review · Historical Evidence tabs), Workload Preview |
| **History** | Archived Routes |

Requirements: persistent selected Product/Family/Route/as-of chip; breadcrumb; back to Readiness/Product Summary; Product Route Editor entry from the group via a product picker; run context for exact-run lenses shown explicitly (currently hard-coded run 82 — D5). Single `can_edit` remains; lifecycle semantics untouched.

## 4. Current → proposed mapping (every registered lens and every nested PPM workspace)

Pack legend: **WP05** = this audit/design; **WP06** = Pricing Policy Manager simplification; **MDC-07** = Costing navigation/IA implementation; **WP11** = UX consistency; **Later** = needs separate design/owner decision.

| Current | Proposed | Change type | Pack |
|---|---|---|---|
| CCC `dashboard` | CCC Dashboard (KPI strip scoped) | SIMPLIFY | MDC-07 |
| CCC `costing-review-workbench` | CCC Control Workbench | RETAIN (+INVESTIGATE D3) | WP05 decision |
| CCC `sku-control-status` | SKU Review › Authoritative controls tab | COMBINE | MDC-07 (after WP05-P01 parity) |
| CCC `portfolio-readiness` | SKU Review › Live readiness tab (+fix nav, CSV) | COMBINE + parity | WP05-P01 then MDC-07 |
| MCM `manual-rate-manager` | MCM › Rates | RETAIN, group | MDC-07 |
| MCM `rm-cost-trace` | MCM › Traces › RM | RETAIN, group (+role-aware tab) | MDC-07 |
| MCM `pm-cost-trace` | MCM › Traces › PM | RETAIN, group | MDC-07 |
| CBM `cost-governance` | CBM › Mapping & classification | group | MDC-07 |
| CBM `staff-governance` | CBM › Mapping & classification | group | MDC-07 |
| CBM `manual-provisions` | CBM › Provisions | group | MDC-07 |
| CBM `driver-governance` | CBM › Policy approval | group | MDC-07 |
| PPM `mrp-governance` (loader id) | alias for workspaces 1-6 | SIMPLIFY | WP06 |
| PPM `policy-manager` (loader id) | alias for workspaces 7-10 | SIMPLIFY | WP06 |
| PPM WS `sku-mrp-policies` | MRP | RETAIN | WP06 |
| PPM WS `product-derivation-policies` | MRP | RETAIN | WP06 |
| PPM WS `mrp-proposals` | MRP change workflow | RETAIN, group | WP06 |
| PPM WS `proposal-decisions` | MRP change workflow | RETAIN (+INVESTIGATE maker-checker, D7) | WP06 |
| PPM WS `approved-for-application` | MRP change workflow | RETAIN | WP06 |
| PPM WS `applied-proposal-history` | MRP change workflow (read-only tab) | RETAIN | WP06 |
| PPM WS `sku-overview` | SKU policies (landing; + CSR link) | RETAIN | WP06 |
| PPM WS `scheme-master` | Schemes | RETAIN | WP06 |
| PPM WS `scheme-rule-register` | Schemes | RETAIN | WP06 |
| PPM WS `commercial-sales-assumptions` | Costing inputs group (RELOCATE candidate) | RELOCATE? | Later (D4) |
| CSR `sku-cost-sheet` | Review › SKU Cost Details | RETAIN (+links) | MDC-07 |
| CSR `scheme-comparison` | Review › Scheme Comparison (+PPM link) | RETAIN | MDC-07 |
| CSR `cost-comparison` | Review › Cost Comparison | RETAIN | MDC-07 |
| CSR `printable-cost-sheet` | Documents › Cost Sheet | RETAIN | MDC-07 |
| CSR `qc-action-queue` | Action Queues › QC | COMBINE | MDC-07 |
| CSR `materials-stores-action-queue` | Action Queues › Materials/Stores | COMBINE | MDC-07 |
| PRM `route-readiness` | Readiness | RETAIN | MDC-07 |
| PRM `product-route-assignments` | Assign & Map | group | MDC-07 |
| PRM `product-subgroup-mappings` | Assign & Map | group | MDC-07 |
| PRM `route-families` | Assign & Map | group (+C3 fix) | WP05-P02 / MDC-07 |
| PRM `shared-workload-preview` | Review | RELOCATE nav | MDC-07 (D5 for run) |
| PRM `route-family-mapping-review` | Review › Evidence & Review | COMBINE | MDC-07 |
| PRM `route-family-foundation-review` | Review › Evidence & Review | COMBINE | MDC-07 |
| PRM `historical-candidate-review` | Review › Evidence & Review (+C2/C3 fixes) | COMBINE + fix | WP05-P02 then MDC-07 |
| PRM `production-cost-centres` | Build | RELOCATE nav | MDC-07 |
| PRM `route-family-route-editor` | Build | RETAIN, group | MDC-07 |
| PRM `product-route-editor` | Build (+picker, gated Supersede, +Effective tab) | SIMPLIFY | WP05-P02 / MDC-07 |
| PRM `effective-route-viewer` | Build › Product Route › Effective tab | COMBINE | MDC-07 |
| PRM `archived-routes` | History | RETAIN | MDC-07 |

Cross-cutting: terminology/status-label consistency, context chip styling, responsive behaviour → **WP11** (CW-04/CW-13 already merged for part of this). Server `app_modules` label alignment ("Cost Sheet Review & Approval" in Utilities Hub) → server-governed metadata change, **outside client packs**.

## 5. Explicitly out of scope of this proposal
Merging the six pages into one; removing any lens id; changing permission strings; run-approval/period-governance screens (CW-01/CW-02, server-owned flows); new top-level modules (locked decision).
