# Full-programme audit, client review-lane findings and implementation briefs — 3 Nov 2026

Worker: Claude Code cloud (client-side engineering/verification only). Baseline Git `main` `4bbadf8802b1f7a6df02d207b1a8e3cca117ca09` (re-verified before branching). Read-only: **no** Supabase access, no flag change, no merge, no deploy, no cache bump, no version. e-Aushadhi WP-07 and PR #137 untouched. All figures about runs 143/148/149 are the owner/assistant's frozen snapshot figures from the brief; **they were not re-queried here** (no database access in this session).

## 1. Baseline regression (pristine `main` 4bbadf8, full history, unshallowed)

| Run | Tests | Pass | Fail | Skipped | Cancelled | TODO |
|---|---|---|---|---|---|---|
| LF (explicit `scripts/**/*.test.*`, 40 files) | 605 | 605 | 0 | 0 | 0 | 0 |
| CRLF (separate worktree, `core.autocrlf=true`, CRLF checkout verified) | 605 | 605 | 0 | 0 | 0 | 0 |

Chromium is installed (`/opt/pw-browsers`); 11 test files drive it (`cross-links*`, `route-dialogs-browser`, `nav-groups-*`, `n2-browser`, `prm-corrections-browser`, `prm-nav-context-browser`, `readiness-usability`, `responsive`, `w6-browser`) and none is skipped. Trap found and recorded: the cloud clone is **shallow by default**; `review-worklist.test.mjs` diffs against historical base `be20ea6` and fails or mis-reports without full history. Always `git fetch --unshallow` first. Also never set `core.autocrlf` repo-wide: it silently converts every worktree.

## 2. Client review/approval lane (run 148)

### 2.1 What the client actually contains
| Surface | File | Mutation? | Contract |
|---|---|---|---|
| Review worklist (run picker, groups, table, drawer, fix links) | `costing-review-worklist.js` + shell/control-centre wiring | **None** — read-only (no `.rpc(`, asserted by `review-worklist.test.mjs`) | views `v_costing_pricing_sku_control_status[_by_run]`, run status view; flag `COSTING_REVIEW_WORKLIST_V1` |
| Per-component **material** review acceptance | `costing-suite-material-cost.js` `saveMaterialReviewAcceptance` (≈L3150) | **Yes** | `rpc_accept_material_review_action(p_period_start, p_stock_item_id, p_material_area, p_action_severity, p_recommended_ui_route, p_issue_codes, p_warning_codes, p_action_required_summary, p_acceptance_reason ≥10 chars, p_acceptance_note)`; close: `rpc_close_material_review_acceptance(p_acceptance_id, p_close_reason ≥10)`. Eligible only `REVIEW_REQUIRED` + route `MATERIAL_RATE_REVIEW`, not hard-blocked; edit permission guarded client-side by `guardMaterialCostWriteAction` |
| Run-level approve/finalise | `costing-approval-screen.js` | Yes, explicit button | preview `rpc_costing_preview_approval_impact`, then `rpc_costing_approve_run_with_preview` / `rpc_costing_finalize_monthend_run_with_preview`; legacy approve/supersede/lock RPCs listed in `FORBIDDEN_RPCS` |

The worklist (find the item) and run approval (decide the run) are distinct and must stay so.

### 2.2 Journey and gaps, by class (draft 148 snapshot: 514 READY / 113 REVIEW / 1 BLOCKED)
1. **110 `PRIME_COST_REVIEW_REQUIRED`.** Per `rpc_refresh_sku_prime_cost_snapshot` (G1 evidence, `closure/evidence/G1/def_rpc_refresh_sku_prime_cost_snapshot.sql`) prime status is a *roll-up*: REVIEW_REQUIRED when material, direct-labour **or** internal-conversion component status is REVIEW_REQUIRED; BLOCKED when a component is missing/blocked. **No client or server per-SKU "accept prime-cost review" action exists** (grep of `public/` and `supabase/` for prime/bridge acceptance found none; server-side live definitions were not queried). Resolution is upstream: fix/accept at the component owner (material acceptance; direct-labour allocation/route governance; conversion), then a new refresh run. The worklist correctly shows "no dedicated screen link yet" (`COST_REVIEW_WORKBENCH` appears nowhere in client JS). **Server-contract question SC-1:** a read contract splitting the 110 by component cause (material vs direct-labour vs conversion) — owner already noted this is missing (C1 walkthrough). Mutation lane for these: **STOP — none exists.**
2. **2 `MATERIAL_REVIEW_REQUIRED`.** The acceptance UI exists (Material Cost Manager › action queue) but is **period-scoped and reads the live action queue**; it then runs a staged costing refresh (`runStagedCostingRefreshAndReload`). Accepting does **not** edit frozen draft 148; it takes effect only in a later refresh run. The worklist drawer already states "Drawer evidence is not this run's evidence" when a non-default run is shown. Needs authorised role; nothing executed here.
3. **1 `PRICING_BRIDGE_REVIEW_REQUIRED`.** The code `PRICING_BRIDGE_REVIEW_REQUIRED` is not defined anywhere in client code, migrations or work-pack docs except the C1 walkthrough (it comes from live server data); its recommended route was not verified here. No acceptance RPC found by grep of `public/` and `supabase/`. Owner decision/server question SC-2: is this accepted in Pricing Policy Manager (policy fix) or does it have an acceptance contract?
4. **1 BLOCKED (SKU 105, Kolakulathadi Choornam 1000 g, missing PM rate as of the run).** Fix path = Material Cost Manager rate screen (existing link). Whether the **current** master still has the defect is a separate read-only check; a frozen snapshot is not proof.
5. **Visibility.** Run-scoped rows are loaded with `fetchAllRows(..., 1000)` page loops filtered by period **and** run, validated (`validateReviewWorklistRunRows`: empty/foreign rejected), so all 114 non-ready rows reach the worklist without silent truncation. No defect reproduced.

### 2.3 Defect disposition for `claude/costing-review-client-closure`
No deterministic, client-only defect was reproduced that an existing contract unambiguously specifies, so **no code PR is opened for this lane** (the brief forbids inventing approvals/transitions). Open items are SC-1, SC-2, plus D3 (A5): CCC-edit permission can accept reviews without MCM-edit — a permission policy decision, not changed here. If SC-1 is delivered, the follow-up client brief is: add a read-only cause column/groups to the worklist (new group key from the server cause code), tests proving no mutation and unchanged OFF path.

## 3. U11 terminology package (PR from `claude/costing-u11-terminology`)
Finding: worklist group chips humanise `first_control_status` into Title Case ("Prime Cost Review Required") while every other Costing status label is sentence case ("Review required"). Change (flag `COSTING_UX_CONSISTENCY_V1`, exact `"1"`, existing flag — no new flag): explicit sentence-case labels for the four codes in the live data (`MATERIAL_COST_BLOCKED`, `MATERIAL_REVIEW_REQUIRED`, `PRIME_COST_REVIEW_REQUIRED`, `PRICING_BRIDGE_REVIEW_REQUIRED`); unmapped codes keep legacy fallback. Proven unchanged: raw codes, group keys/order, routes, RPCs, permissions, legacy OFF labels (pinned by the existing worklist test). Skipped as governance-sensitive / owner decision: renaming "Blocker"↔"Blocked", draft/approved wording, LIVE_AS_OF vs run wording — these affect governance meaning.

## 4. Residual-work register WP05–WP12 (essential vs gate vs optional)

**WP05** (open): all N-packs/P01/P02 merged. Essential residual: reconcile A1–A7 against merged code; client defects C1–C3 fixed under P02; **C2/C3 evidence should be re-verified against main** (not re-done here). Owner gates: D3, D5 (runs 80/82 fixed contexts; server selection contract first), D7 (maker-checker for MRP proposal decisions — no server check found), C9. Tier-2 optional: merge of Readiness/SKU Control lenses (D2), Commercial Sales Assumptions relocation (D4).
**WP06** (open): W6 merged. Essential: task-flow audit of Pricing Policy Manager, legacy deep-link retest, period-scope assessment; C9 registry metadata (`policy-manager.periodScoped:false`, registry L158) needs separate authority. Brief G06 below.
**MDC-07** (open): essential: U11 (this PR), permission/deep-link/context review, signed-in ON/OFF UX, 32 lens IDs/10 workspaces retest (cloud can run the mock part).
**WP08**: not started; repo files `manage-products.html`, `manage-rm-bom/pm-bom/sp-bom`, `production-route-manager`, `pricing-policy-manager`. Navigation is server-driven (below).
**WP09**: not started; launcher is DB-driven (`app_nav_sections`, `v_app_module_registry` via `module-registry.js`), so layout/role evidence requires **read access to those tables** — not available in this session. Owner gate S6.
**WP10**: not started; **policy gate first**. WP03 explicitly parked three decisions: Malayalam-name requirement, Product status at creation (default/force Inactive), and refusing SKU activation unless readiness is READY. WP01: no authoritative `MASTER_COMPLETE→…→COSTING_READY` state machine exists in server vocabulary; client must not invent one.
**WP11**: U11 (done in part), Manage Products UX-P02, sort/dialog/readability/width issues; non-governance label work can proceed; see §3.
**WP12**: acceptance matrix §6.

None of WP08–WP12 is treated as optional for release.

## 5. Implementation briefs (next coding waves, one writer per shared file)
- **G06**: audit `costing-suite-pricing-policy.js` task flows against W6 groups; bounded client fixes behind existing `COSTING_NAV_GROUPS_V1`; no maker-checker change; C9 only after owner authority. Tests: extend `costing-w6-pricing-nav`.
- **IA08**: produce Product/SKU/BOM/route/policy navigation map from repo pages + `app_modules` read (owner/DB read required); only after owner design choose NAV-P01/P02. Files: hub index + registry are single-writer.
- **IA09**: inventory hub sections/roles from `v_app_module_registry` (read-only SQL by authorised session), include e-Aushadhi as read-only; no edits to paused code.
- **GOV10** (policy first): owner answers three WP03 decisions + warn-vs-block rule; then server contract (separate governance) before any client guard; client must fail closed on UNKNOWN and keep Activate separate until decided.
- **UX11**: remaining label/sort/dialog/width items from audit; Manage Products UX-P02.
- **SC-1/SC-2**: server read-contract requests above.

## 6. WP12 acceptance matrix
| Check | Cloud-runnable | Needs |
|---|---|---|
| Full LF + CRLF node suite incl. Chromium, 0 skipped | Yes (done for main; per-PR heads) | — |
| Legacy `scripts/*-smoke.mjs` classification (stale cache pins; 51/63 production-route smokes failed on earlier main per WP-07) | Yes — run and triage | owner view on retire/repin |
| 32 lens IDs / 10 workspaces / deep links / flag ON-OFF | Yes (mock) | signed-in role proof later |
| Review/approve/finalise client governance transitions (mock RPC, negative/permission) | Yes (mock) | live decisions: authorised humans |
| SKU creation → readiness journey, period history | Mock only | signed-in populated data |
| Narrow screens | Yes (`costing-responsive`) | — |
| Packaged Electron NSIS/ZIP, installer/reopen/updater/rollback | **No** | Windows runner/human |
| Live role/populated-data proof | **No** | signed-in staff |

## 7. Recommended order
1. Review/merge docs PR → U11 PR (file-disjoint) → decide SC-1/SC-2 and D3 → G06/UX11 client packages → owner WP10 decisions → IA08/IA09 → WP12 final run on final head → Electron gate (Windows).
