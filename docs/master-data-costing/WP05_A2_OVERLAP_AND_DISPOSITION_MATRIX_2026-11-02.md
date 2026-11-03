# WP05-A2 — Functional overlap and disposition matrix (2 Nov 2026)

Baseline `main` `3d0b618`. Evidence tags as in [A1](WP05_A1_LENS_AND_WORKSPACE_INVENTORY_2026-11-02.md). Dispositions: RETAIN / COMBINE / RELOCATE / SIMPLIFY / INVESTIGATE. **Disposition is a recommendation for the design-review gate, not an approved decision.** Principle: similar titles ≠ duplicate responsibility; nothing is removed on title alone.

**G2 correction — grouping ≠ consolidation.** Dispositions below use two distinct terms. **GROUP** = share a navigation group/label only (first, presentation-only wave): all six modules, 32 lens ids, 10 PPM workspaces, deep links, controllers, permissions, data models and RPC/view sets stay exactly as they are. **COMBINE (conditional)** = merging controllers/screens; *not* part of the first wave, each needing its own evidence, owner decision and Plan gate. Where earlier text said COMBINE for QC/M&S queues, SKU Control ↔ Readiness, and the three PRM evidence lenses, the first-wave disposition is GROUP.

## 1. Genuine overlaps vs label-only similarity

| # | Items | Verdict | Evidence | Consequence |
|---|---|---|---|---|
| O1 | CCC SKU Control Status ↔ Readiness | **Genuine partial overlap** (both are SKU-level remediation indexes) but *different data models*: SKU Control Status is run-scoped (governed run; frozen draft/approved runs only under `COSTING_REVIEW_WORKLIST_V1`); Readiness is **LIVE_AS_OF** (server contract, not run-frozen) | A1 §2; parity doc `WP05_P01_...`; code-confirmed: Readiness has no run selector, no fix navigation, no shared CSV | **GROUP** in one nav group; keep two lenses, two loaders, two data models. Grouping must not imply equivalent valuation/run context (label each). Merge into one screen = conditional later work (D2) |
| O2 | CCC Control Workbench ↔ MCM Manual Rate Manager action queue | **Genuine overlap** (two material action queues; different views, **different edit rules**: CCC-edit vs MCM-edit) | `material-cost.js` 18/5862 vs control-center.js 629-660; shell 1722-1729 | INVESTIGATE. Not safe to merge until the authority question is decided (Owner decision D3) |
| O3 | CCC KPI strip on every CCC lens ↔ Dashboard | **Redundant load**, not redundant function | shell 4592-4599 | SIMPLIFY (show KPI strip on Dashboard only, or lazy) — presentation/perf |
| O4 | CSR SKU Cost Details drawer "Scheme Comparison" tab ↔ CSR Scheme Comparison lens | **Intentional drill-down** over the same view `v_costing_pricing_sku_scheme_comparison` (one SKU vs all SKUs) | shell 7476-7478; scheme-comparison.js 8 | RETAIN both; cross-link |
| O5 | CSR printable Cost Sheet ↔ SKU Cost Details | **Same numbers, different grain/task** (product A4 document + sign-off vs SKU analysis); two view families (`printable_*` vs `sku_detailed_cost_sheet`) could diverge [A, unverified] | cost-sheet.js 70/67; shell 7466 | RETAIN both; add reconciliation check (INVESTIGATE divergence) |
| O6 | CSR Cost Comparison ↔ others | **Distinct** (cross-period; keyed on `snapshot_period_start`, governed run per month) | shell 2443-2444, 4872 | RETAIN; clarify period semantics in label |
| O7 | CSR QC queue ↔ Materials/Stores queue | **Structural similarity** (same RPC param shape, state machine, copy buttons, permission handling); action vocabularies, RPCs (`rpc_get_qc_action_queue` vs `rpc_get_materials_stores_action_queue`) and remediation targets differ | qc-action-queue.js 225; ms-aq.js ~205 | **GROUP** under an "Action Queues" nav group; separate controllers retained. Shared queue shell/controller = conditional later refactor only |
| O8 | PPM SKU Policy Overview "Status" tab ↔ CSR SKU Cost Details "Diagnostics" tab | **Partial overlap**: bridge status from different views; PPM not period-scoped (may be stale vs period) | pricing-policy.js 7570-7574 vs shell 7680-7695 | SIMPLIFY: label PPM status "policy-side"; link to CSR diagnostics for the period |
| O9 | PPM SKU MRP Policies ↔ MRP tab in SKU Policy Overview | **Genuine overlap by design** (same `v_sku_mrp_current`, same modal `onPolicyDataChanged` 2839) | pricing-policy.js 7154/7278 | RETAIN both entry points |
| O10 | PPM Policy History (drawer) ↔ SKU MRP "Policy History" ↔ Applied Proposal History | **Label-only** (different sources: selling/scheme history, MRP policy history, proposal-line trace) | A1 §3 | RETAIN; disambiguate labels |
| O11 | PPM Scheme Master ↔ Scheme Rule Register ↔ SKU scheme policy | **Distinct layers** (definition / hierarchy rule / SKU-region assignment) | A1 §3 #7-9 | RETAIN; add a one-line mental-model help |
| O12 | **Policy creation (PPM) ↔ viability analysis (CSR Scheme Comparison)** | **Not duplication.** PPM *sets* policy (no period/run); CSR Scheme Comparison *reads outcomes* for a period (148-line read-only view). Gap = **no cross-link either way** | scheme-comparison.js; pricing-policy.js 317-318/416-418 (validators forbid Scheme Comparison in PPM) | Add contextual links only; do not merge (SC1/SC4 decision preserved) |
| O13 | PRM Mapping Review ↔ Foundation Review ↔ Historical Evidence Review | **Related read-only evidence views** over different RPCs (`rpc_get_route_family_mapping_review_candidates`, `_foundation_review`, `rpc_preview_*_candidate`); first two use fixed fixture run contexts (A5 C5) | A1 §7 #6, #7, #11 | **GROUP** as "Evidence & Review" nav group; each lens stays independently accessible with its own id/deep link. Single tabbed lens = conditional later work |
| O14 | PRM Product Route Editor ↔ Family Route Editor | Shared shape, **different lifecycle semantics** (family approve supersedes server-side; product has explicit Supersede) | ED 1501; MAIN 7164, 10409-10416 | Keep separate behaviours; may share one "Route Editor" frame with Family/Product mode (INVESTIGATE, later pack) |
| O15 | PRM Effective Route Viewer ↔ Product Route Editor | Viewer read-only resolved route (has product picker); editor edits deltas (no picker) | MAIN 10862-10890; ED 1463 | **GROUP** adjacent in Build group; viewer stays its own lens. Read-tab merge conditional later (after picker exists, P02) |
| O16 | PRM Subgroup Mappings ↔ Product Assignments ↔ Group mapping (inside Route Families) | Same lifecycle shape, three locations | A1 §7 | **GROUP** as "Assign & Map"; keep three registers |
| O17 | PRM Archived Routes ↔ history inside editors | Read-only history; distinct (post-archival) | SA 68-69 | RETAIN, expose as "History" filter entry |
| O18 | CSR remediation routes ↔ MCM / LIMS / PPM-CSA | **Not overlap — handoffs.** CSR is read-only; fixes live elsewhere | A1 §4 | RETAIN boundary; open targets in context (period/product) |
| O19 | "Request Costing Refresh" button on CCC / CSR / PPM (shared chrome) | Same write on three pages; neither CSR nor PPM edits inputs except PPM policy/CSA changes | shell 2690, 1718-1720 | INVESTIGATE (D6) — do not remove without owner decision |

## 2. Disposition by lens (all 32)

| Module | Lens | Disposition | Specialist function that must stay reachable |
|---|---|---|---|
| CCC | dashboard | RETAIN (SIMPLIFY KPI strip) | Integrity audit snapshot |
| CCC | costing-review-workbench | RETAIN; INVESTIGATE vs MCM queue (O2) | Accept/Close review acceptance |
| CCC | sku-control-status | RETAIN; GROUP with Readiness (O1); merge conditional | Run-scoped selector, by-run view, recommended-route resolver |
| CCC | portfolio-readiness | RETAIN (LIVE_AS_OF); GROUP; P01 adds supported links/CSV/LIVE_AS_OF info only — **no run selector** | Keyset readiness RPCs, product-gap view |
| MCM | manual-rate-manager | RETAIN | Manual rate set/close, vendor offers |
| MCM | rm-cost-trace | RETAIN (separate role, confidential) | Separate view/export roles |
| MCM | pm-cost-trace | RETAIN (separate role) | Separate view/export roles |
| CBM | cost-governance | RETAIN (nav-group with Staff) | Expense-head map/close |
| CBM | staff-governance | RETAIN | Classification |
| CBM | manual-provisions | RETAIN | Provision save/deactivate |
| CBM | driver-governance | RETAIN (separate policy authority) | Dual-module per-action approval |
| PPM | mrp-governance (loader id → WS 1-6) | SIMPLIFY (retire the lens/workspace dual vocabulary) | Effective-dated MRP; proposal→decision→apply chain |
| PPM | policy-manager (loader id → WS 7-10) | SIMPLIFY; RELOCATE WS10 CSA (INVESTIGATE) | Selling/scheme policy; CSA scoped revise with preview |
| CSR | sku-cost-sheet | RETAIN (+ links to PPM / queues) | Diagnostics, bridge |
| CSR | printable-cost-sheet | RETAIN | PDF, sign-off, exact-run Explain |
| CSR | cost-comparison | RETAIN | MoM/YoY governed snapshot |
| CSR | scheme-comparison | RETAIN (+ link to PPM) | Margin band / viability |
| CSR | qc-action-queue | RETAIN; GROUP "Action Queues"; controller merge conditional | QC remediation routes |
| CSR | materials-stores-action-queue | RETAIN; GROUP "Action Queues"; controller merge conditional | MCM routes, Explain |
| PRM | route-readiness | RETAIN (hub) | Guarded readiness RPC |
| PRM | product-route-assignments | RETAIN (nav-group "Assign & Map") | Approval-reference lifecycle |
| PRM | product-subgroup-mappings | RETAIN (nav-group) | Mapping lifecycle |
| PRM | shared-workload-preview | RETAIN; GROUP under Review (nav only); fixed fixture run context — D5 | Explain modals |
| PRM | route-families | RETAIN (family master hub) | Governed create/approve/map |
| PRM | route-family-mapping-review | RETAIN; GROUP "Evidence & Review" | Map-from-evidence handoff |
| PRM | route-family-foundation-review | RETAIN; GROUP "Evidence & Review" | Historical foundation |
| PRM | production-cost-centres | RELOCATE nav (master prerequisite; keep editor blocker link) | Cost-centre lifecycle |
| PRM | route-family-route-editor | RETAIN (INVESTIGATE shared frame) | Validate/submit/approve |
| PRM | product-route-editor | SIMPLIFY (picker, status-gated lifecycle) | Delta authoring, Supersede |
| PRM | historical-candidate-review | RETAIN; SIMPLIFY (C2/C3 fixes, P02); GROUP "Evidence & Review" | Draft staging only |
| PRM | effective-route-viewer | RETAIN; GROUP with Build; read-tab merge conditional | Resolved route |
| PRM | archived-routes | RETAIN | Post-archival history |
