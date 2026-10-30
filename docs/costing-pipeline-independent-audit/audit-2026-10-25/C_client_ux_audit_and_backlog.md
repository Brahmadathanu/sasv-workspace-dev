> **Status (30 Oct 2026): PARTLY SUPERSEDED — 25 Oct 2026 code review. CW-01 (lock) is the next Codex package, CW-02 approval screen shipped in PR #99, Refresh with date shipped in PR #100 (both flags OFF). The CW list is still the backlog reference.** Current view: [../../master-data-costing/ALIGNED_STATUS_2026-10-30.md](../../master-data-costing/ALIGNED_STATUS_2026-10-30.md). Kept as a dated record; do not act on its status lines.

# Part C: client gap and UI/UX audit, with backlog

Code read on `origin/main` (worktree /workspace/audit-wt), 25 Oct 2026. Preview pages need a login, so this is a code review; nothing was clicked.

## 1. Screen inventory (6 suites, 37 lenses, from js/costing-suite-registry.js)

| Suite (page) | Lenses | Main live objects | Writes? |
|---|---|---|---|
| Costing Control Center (costing-control-center.html, 141 KB) | Dashboard, Control Workbench, SKU Control Status, Readiness | `v_costing_pricing_control_dashboard_snapshot`, `_business_kpi_summary`, `_material_action_queue_snapshot`, `_sku_control_status_snapshot`, readiness RPCs, run-status badge (`v_costing_pricing_period_run_status`), cost-period valuation (`rpc_set_cost_period_valuation_date`, `rpc_request_costing_refresh`) | Yes: valuation date, refresh request |
| Material Cost Manager (material-cost-manager.html, 150 KB) | Manual Rate Manager, RM Cost Trace, PM Cost Trace | manual-rate views; `rpc_set_material_manual_rate`, `rpc_close_material_manual_rate`, `rpc_accept_material_review_action`; trace RPCs | Yes |
| Cost Build Manager (cost-build-manager.html, 129 KB) | Cost Governance, Staff Governance, Manual Provisions, Driver Governance | expense-head mapping, staff class, provisions, driver policy envelope RPCs | Yes |
| Pricing Policy Manager (pricing-policy-manager.html, 223 KB) | MRP Governance, Selling & Scheme Policies (+ commercial sales assumptions, MRP proposals/decisions/apply/history) | `rpc_set_sku_mrp_policy`, `rpc_set_sku_selling_price_policy` (incl. per-SKU contingency %), scheme RPCs, `rpc_generate/submit/apply_product_mrp_proposal`, sales-assumption RPCs | Yes |
| Cost Sheet Review & Approval (cost-sheet-review.html, 148 KB) | SKU Cost Details, Cost Sheet (printable), Cost Comparison, Scheme Comparison, QC Action Queue, Materials/Stores Action Queue | printable cost sheet views, `v_cost_sheet_snapshot_sku_monthly_comparison_governed`, explain RPCs | Read-only (despite "Approval" in the title) |
| Production Route Manager | 13 lenses (route readiness, assignments, families, editors, cost centres, archive…) | ~70 route RPCs | Yes (heavy) |

## 2. Server capability with no screen

| Server capability (live) | Client today | Gap |
|---|---|---|
| Governed period lifecycle W2: `rpc_costing_period_governance_context`, `_lock_period`, `_close_period`, `_reopen_period`, `_open_next_period` | None on main. Panel parked on branch `costing/w2-period-runs-panel` (d5f92af, 19 Oct, 1,589 lines incl. tests) | **No screen**; period actions need SQL/agent |
| Run approval / supersession: `rpc_costing_approve_run`, `_authorise_supersession`, `_supersede_approved_run`, `_preflight_run`, `_finalize_monthend_run` | None (only the read-only run badge, PR #90) | **No screen**; STEP166 plan only |
| CI-037 profit columns 65–79 and `costing.sku_pricing_bridge_profit_snapshot` | No client file mentions `estimated_profit` or `profit_calculation_status` | **Not shown anywhere**; the feed is not readable by logged-in users, so a gated public view/RPC is needed first. Data arrives with the November run |
| Contingency rate policy `costing.costing_contingency_rate_policy` (2%) | Only per-SKU contingency in Selling policy (pricing-policy.js:6014–6192) and a cost-sheet column | Global policy not visible |
| Missing-data / profit-calculation status | None | Needed alongside profit columns |
| Run labels (W1) | Shell badge (PR #90) | DONE |
| Approved price-revision feed | Sheets only (by design) | No in-app view of "what Sheets sees"; optional |
| Readiness queue | Readiness lens | DONE |
| Cost-pool review (`v_costing_cost_pool_monthly_summary`) | Cost Build Manager | DONE (CI-033 screen check by owner still pending) |
| Regional Marketing evidence review (`rpc_get_regional_marketing_evidence_review_queue`, `rpc_accept_regional_marketing_review`) | None | **No screen** (UX-P01) |
| Capacity readiness (`costing.v_plant_capacity_readiness`, CI-011 74 blocked) | None | No screen to enter/see machine capacity gaps |
| Lab repeat-analysis approvals | Queue on Lab Analysis Entry only (PR #89) | No notification / pending count for approvers |

## 3. UI/UX findings (file:line on main)

| # | Area | Finding |
|---|---|---|
| U1 | Duplication | The 5 suite HTML pages are near-copies: cost-build-manager.html shares 1,660 of 1,757 unique lines with costing-control-center.html; cost-sheet-review 1,608/1,988; material-cost 1,543/2,062; pricing-policy 1,621/2,711. ~790 KB of HTML. Any fix must be made 5 times |
| U2 | Giant files | costing-suite-production-route.js 11,945 lines (461 KB); -production-route-helpers.js 8,696; -shell.js 9,585 (318 KB); -pricing-policy.js 8,220 (277 KB); -material-cost.js 6,384; -cost-sheet.js 6,150. Hard to review, slow first load |
| U3 | Tables | No column sorting in the shared table (renderTable at shell.js:6163; no sort keys in shell). CSV export exists only in the shell (`exportCsvForRows`, shell.js:7599) and RM/PM trace (material-cost.js:5246, 5362) |
| U4 | Browser dialogs | `window.prompt("New approved draft route ID:")` production-route.js:10384; `window.prompt("Manufacturing Route Family name:")` :10750; `window.confirm` :10324 and production-route-candidates.js:301. No validation, no keyboard-friendly form, ugly on mobile |
| U5 | Misleading title | "Cost Sheet Review & Approval" (cost-sheet-review.html:6, :2913) has no approval action; approval lives only in SQL/agent |
| U6 | Jargon | Raw codes shown to users, e.g. `REVIEW_REQUIRED` in control-center.js:648, 684, 861 and readiness.js:21, 569; run label "DRAFT run 82 - not approved" mixes caps. Needs a plain-English label map |
| U7 | Dead reference | `VIEW_BY_LENS.dashboard = "v_costing_pricing_dashboard_summary"` (shell.js:2412) though the dashboard loads via `loadDashboardRows` (shell.js:4615) |
| U8 | Narrow screens | sasv-costing.css has only 4 media queries (1080/900/520px) for 2,317 lines; large tables likely scroll sideways. UNVERIFIED visually |
| U9 | Inline styles | 59 `style=` in costing-control-center.html, 37 in control-center.js, 30 in material-cost.js: inconsistent spacing/colours |
| U10 | Focus | OK: inputs replace outline with a 3px focus ring (sasv-costing.css:494–498, 513–517); 36 focus rules |
| U11 | Navigation | 37 lenses in 6 suites; Production Route Manager alone has 13 lenses. Overlap: SKU Control Status vs Readiness (CCC-P01) |
| U12 | Loading/empty/error states | Present in shell (41 such messages), but each module has its own wording; not standardised. UNVERIFIED per lens |

## 4. Client backlog

| ID | Goal (plain English) | Why it matters | Files | Server dependency | Risk | Size | Needs Nov run? |
|---|---|---|---|---|---|---|---|
| CW-01 | Period & runs panel: see each month's status and lock/close/reopen with reason | Only screen for live period controls; today needs SQL | rebase d5f92af: costing-period-governance.js, shell, css | W2 RPCs (live) | Writes period state, owner-only, confirm step | M | Build now as draft; merge after first Nov run |
| CW-02 | Run approval & supersession screen (preflight → approve / supersede) | Approving a run is the key monthly step; now agent-only | new module + Control Center | `rpc_costing_preflight_run`, `_approve_run`, `_authorise_supersession`, `_supersede_approved_run` | Writes; can replace an approved run. Owner-only server guard | M | Design now; first real use is Nov |
| CW-03 | Show profit after scheme (CI-037) per SKU, IK/OK, with status | Owner's main pricing question | cost-sheet / scheme comparison lens | needs a permission-gated public view over the 15 columns (server step, Aryabhatta) | Read-only | M | Yes (data empty until Nov run) |
| CW-04 | Plain-English labels and a status glossary | Users see codes like REVIEW_REQUIRED | shared label map + all lenses | none | Read-only | S | No |
| CW-05 | Sortable columns, consistent CSV export, column help on all tables | Basic table usability | shell renderTable, css | none | Read-only | M | No |
| CW-06 | Replace `prompt/confirm` with proper dialogs in route manager | Prevent typos in approved routes | production-route.js, candidates.js | none | Touches write flows (same RPCs) | S | No |
| CW-07 | Rename "Cost Sheet Review & Approval" or link it to CW-02 | Title promises an action that does not exist | cost-sheet-review.html, registry | none | None | S | No |
| CW-08 | One shared HTML shell for the 5 suite pages | Fix once instead of 5 times | 5 HTML pages, shell | none | Medium regression risk, no data writes | L | No |
| CW-09 | Split giant JS files (shell, pricing-policy, production-route) | Reviewability, load time | those files | none | Regression risk | L | No |
| CW-10 | Pending-approvals badge (lab repeat requests, MRP proposals) | Approvers don't know something waits | hub/menu | read counts | Read-only | S | No |
| CW-11 | Regional Marketing evidence review screen (UX-P01) | Server ready, no screen | new lens | 3 live RPCs | Writes acceptance | M | No |
| CW-12 | Capacity gaps view (CI-011) | 74 machines blocked; production team needs a list | new read lens | needs gated read of `v_plant_capacity_readiness` | Read-only | S | No |
| CW-13 | Narrow-screen pass and inline-style clean-up | Phones/tablets | css + html | none | Low | M | No |
| CW-14 | Remove dead `VIEW_BY_LENS.dashboard` reference; then retire legacy views (CCC-P03) | Tidy | shell.js:2412 (+ server drop later) | server drop is a separate gated step | Low | S | No |

### Grouping
- **Must-do before 1 Nov:** CW-01 built as draft PR (not merged), CW-02 design brief agreed, CW-04, CW-07. Server-side (Aryabhatta, not Cursor): check cron 66 after 26 Oct 02:00 IST, decide Jul/Aug open periods, prepare the gated profit view for CW-03.
- **Next (November):** CW-03 (after first Nov run), CW-02 build, CW-05, CW-06, CW-10, CW-12.
- **Later:** CW-08, CW-09, CW-11, CW-13, CW-14.

### Who does what
- **Cursor (heavy client work):** CW-01, CW-02 build, CW-04, CW-05, CW-06, CW-07, CW-08, CW-09, CW-10, CW-13, CW-14, and the client half of CW-03/CW-11/CW-12. One PR each, draft first.
- **Aryabhatta:** server prerequisites (gated profit view, capacity read view, cron/period checks), CW-02 design with owner, PR reviews against live, doc refresh.
