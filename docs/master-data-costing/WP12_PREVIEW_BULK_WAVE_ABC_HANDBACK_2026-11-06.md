# Costing preview — bulk Wave A/B/C handback (synthetic, branch-only)

## REVISION R1–R4 (6 Nov 2026, after the owner's Windows PC review of PR #197) — read this first

**Owner decision: REVISE, no merge.** The earlier 64/64 result was engineering regression evidence only; most data-backed screens were empty ("No synthetic fixture…"). This revision replaces placeholder navigation with contract-evidenced synthetic data, tests real interactions in Chromium, and states exactly what is and is not covered. **Nothing here is owner acceptance, formal closure (still 5/13), real-auth proof or populated-production-data proof. No empty screen, offline message or restriction notice is counted as a PASS.**

### R.0 Headline numbers

| | Before (owner walkthrough) | After this revision |
|---|---|---|
| Lenses/workspaces rendering real table data | ~1–3 of 40 | **31 of 40** (CCC 4/4, MCM 1/3, CBM 4/4, PPM 10/10, CSR 6/6, PRM 6/13) |
| Honestly UNSUPPORTED (no safe contract) | not distinguished | 3 (PRM Workload Preview, Mapping Review, Foundation Review) |
| Needs a selection whose detail read is not fixtured | not distinguished | 4 (PRM route editors, historical review, effective-route viewer) |
| Role-restricted by the server (correct for view-only) | 2 | 2 (RM / PM Cost Trace) |
| Automated tests (LF) | 64 | **90 pass / 0 fail / 0 skipped** |
| Same suites on a CRLF (Windows-style) clone | 64 | **90 pass / 0 fail / 0 skipped** |

### R.1 Owner observations → root cause → correction

| Owner observation | Root cause (verified in source/browser) | Correction |
|---|---|---|
| CCC Control Workbench / SKU Control Status: "No synthetic fixture…" | The synthetic client answered only ~4 reads; these lenses read 6+ views (`v_costing_pricing_material_action_queue_snapshot`, `v_costing_material_review_acceptance_register`, `v_costing_pricing_sku_control_status_snapshot`, …). Preview limitation, not a product defect. | Contract-driven fixtures for every view the lens reads. Test asserts 2 / 3 data rows, status chips, search, detail modal. |
| CCC Readiness "Unavailable" | `rpc_get_readiness_governed_periods` and the portfolio RPC had no fixture. | Envelope + assessment shape taken from `scripts/wp04-readiness-client-contract-smoke.mjs` (READY / REVIEW_REQUIRED / BLOCKER). Dependency drill-down arrays are empty because their element shape is not evidenced. |
| **November valuation date "unavailable"** | `rpc_get_cost_period_valuation_context` had no fixture, so the valuation chip had nothing to show. **It is a preview artefact**: the owner's real PWA run on 5 Nov showed draft run 149 with valuation 2 Nov 2026. | Fixture matches the typed `Returns[]`. Tests assert "Valuation 2 Nov 2026" for November and "31 Oct 2026" for October. |
| Material Cost Manager: Manual Rate Manager empty; trace "Restricted" | Missing fixtures (queue, register, history, review views). The trace restriction is **correct**: trace access is a separate server role the view-only identity must not have. | Queue/register/history/review populated (BLOCKER missing-rate and REVIEW manual-rate items). Trace lenses stay RESTRICTED and are never counted as passes. |
| PPM: all ten workspaces "Failed to load…" | 8 views/RPCs without fixtures. | All ten workspaces populated; test opens each by tab and a `?workspace=` deep link and asserts rows + an identifying value. IK (Inside Kerala) / OK (Outside Kerala) shown separately. |
| CSR printable / comparison / historical unavailable | `v_costing_pricing_printable_cost_sheet_product_summary`, `v_cost_sheet_snapshot_sku_monthly_comparison_governed` (defined only in migration `20261019014458`), scheme comparison, QC and Materials/Stores queues had no fixtures. | Populated; month-on-month COP/loaded-cost changes shown; blocked SKU has no cost. Per-line printable sheet and line traceability are **not** fixtured (listed as caveat). |
| PRM: navigation works, no tables | Master-options and list RPCs had no fixtures. | Readiness, assignments, subgroup mappings, route families, cost centres, archive populated from the repository's own normalisers. Three lenses UNSUPPORTED; four need a selection. |
| CBM: 4 checks pending | Evaluation never reached it (all lenses were empty). | Cost Governance (all four sub-tabs), Staff, Manual Provisions and Driver Governance (7 elements) populated and asserted. |
| "Navigation only" unclear | It is a presentation flag, not a feature; the launcher gave no explanation. | See R.2; launcher now explains it; tests assert the exact differences. |

### R.2 What "Navigation only" does (flag `COSTING_NAV_GROUPS_V1`, presentation only)

| | Flag OFF (flat) | Navigation only ON |
|---|---|---|
| CCC lens buttons | `Dashboard · Control Workbench · SKU Control Status · Readiness` in one row | Grouped under labels **OVERVIEW / WORKBENCH / SKU REVIEW** |
| Context under the title | breadcrumb only | breadcrumb plus chips such as **Governed period 2026-11-01** and **Run-scoped · frozen data of the governed costing run** (explains that SKU Control Status is frozen to a run while Readiness is live) |
| Material Cost Manager | RM / PM Cost Trace shown; click gives a restriction notice | RM / PM Cost Trace **hidden** for a role without trace access |
| Data, permissions, RPCs | identical | identical (asserted: same row counts on all 31 populated lenses) |
| Pricing Policy Manager | own workspace navigation | unchanged |

Screenshots: `20-nav-flat-off.jpg` vs `21-nav-only-on.jpg`.

### R.3 Exact coverage matrix (generated from the manifest and a live Chromium audit; 40 rows)

Legend: *Safe fixture* = every column used exists in `types/supabase.ts`, the migration SQL or the client's own select list (enforced by `synthetic-fixtures.test.mjs`); numbers are round fictional placeholders, not costing results. *Real-data status* is NOT TESTED for every row until the authenticated read route in R.7 is executed by the account holder.

<!-- generated by scripts/costing-preview/build-coverage-matrix.mjs; status counts {"POPULATED":31,"RESTRICTED":2,"UNSUPPORTED":3,"SELECTION_REQUIRED":4} -->
| Module / lens | Read dependency (observed + contract) | Contract evidence | Safe fixture? | Rendered 1280px | 390px | Nav-only | Mock-test status | Real-data status | Blocker / proposed resolution |
|---|---|---|---|---|---|---|---|---|---|
| costing control center / **Dashboard** | `v_costing_pricing_business_kpi_summary`<br>`v_costing_pricing_control_dashboard_snapshot`<br>`v_costing_pricing_control_integrity_audit_snapshot`<br>`v_costing_pricing_period_run_status`<br>`rpc_get_cost_period_valuation_context` | types/supabase.ts Row; valuation Returns[] typed | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| costing control center / **Control Workbench** | `v_costing_pricing_material_action_queue_snapshot`<br>`v_costing_material_review_acceptance_register` | types/supabase.ts Row; ACTIVE/ACTIVE_MATCHED vocab from material-cost.js | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| costing control center / **SKU Control Status** | `v_costing_pricing_sku_control_status_snapshot` | types/supabase.ts Row; status codes from costing-status-labels.js | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| costing control center / **Readiness** | `rpc_get_readiness_governed_periods`<br>`rpc_get_product_sku_readiness_portfolio`<br>`rpc_get_readiness_product_gaps` | envelope + assessment shape from scripts/wp04-readiness-client-contract-smoke.mjs; dependency drill-down arrays left empty (shape not evidenced) | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| material cost manager / **Manual Rate Manager** | `v_costing_manual_rate_manager_action_queue`<br>`v_costing_material_manual_rate_register`<br>`v_costing_material_manual_rate_history`<br>`v_costing_material_manual_rate_review` | types/supabase.ts Row | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| material cost manager / **RM Cost Trace** | `role:material-cost-rm-trace (server)` | shell restriction notice; trace needs a separate server role | No | message: Restricted RM contribution detail | message: Restricted RM contribution detail | hidden (role) | RESTRICTED (correct for view-only) | NOT TESTED (real auth) | Role-gated by server; needs real authenticated test with the trace role |
| material cost manager / **PM Cost Trace** | `role:material-cost-pm-trace (server)` | shell restriction notice | No | message: Restricted PM contribution detail | message: Restricted PM contribution detail | hidden (role) | RESTRICTED (correct for view-only) | NOT TESTED (real auth) | Role-gated by server; needs real authenticated test with the trace role |
| cost build manager / **Cost Governance** | `v_costing_unmapped_expense_heads_for_mapping`<br>`v_costing_expense_head_mapping_register`<br>`v_costing_expense_allocation_pool_options`<br>`v_costing_cost_pool_monthly_summary` | types/supabase.ts Row (default sub-tab: Unmapped heads) | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost build manager / **Staff Governance** | `v_costing_unclassified_staff_for_costing`<br>`v_costing_staff_costing_class_options`<br>`v_costing_staff_classification_register`<br>`v_costing_staff_cost_pool_summary` | types/supabase.ts Row | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost build manager / **Manual Provisions** | `v_costing_manual_cost_pool_provision_register`<br>`v_costing_manual_provision_pool_options`<br>`v_costing_manual_provision_type_options`<br>`v_costing_cost_pool_monthly_summary` | types/supabase.ts Row | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost build manager / **Driver Governance** | `rpc_get_cost_driver_policy_registry` | registry normaliser + seven-row payload in scripts/driver-governance-helpers-smoke.mjs — *Seven canonical cost-element names are configuration, not data, so no SYNTHETIC text is shown; lifecycle statuses are fixture values* | Yes | 7 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **SKU MRP Policies** | `v_sku_mrp_current` | types/supabase.ts Row | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Product Derivation Policies** | `v_product_mrp_reference_readiness`<br>`v_product_mrp_derivation_current` | types/supabase.ts Row | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **MRP Proposals** | `v_product_mrp_proposal_register` | types/supabase.ts Row; proposal status lifecycle DRAFT/SUBMITTED/APPROVED/APPLIED | Yes | 4 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Proposal Decisions** | `v_product_mrp_proposal_register` | types/supabase.ts Row | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Approved for Application** | `v_product_mrp_proposal_register` | types/supabase.ts Row | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Applied Proposal History** | `v_product_mrp_proposal_register`<br>`v_sku_mrp_policy_history` | types/supabase.ts Row; v_sku_mrp_policy_history has no fixture, drill-down shows offline message — *Per-line trace drawer not fixtured* | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **SKU Policy Overview** | `v_costing_policy_manager_sku_overview`<br>`v_costing_policy_manager_scheme_options` | types/supabase.ts Row; IK = Inside Kerala, OK = Outside Kerala | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Scheme Master** | `v_costing_scheme_master_register` | types/supabase.ts Row | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Scheme Rule Register** | `v_costing_scheme_policy_rule_register`<br>`v_costing_scheme_policy_scope_options` | types/supabase.ts Row; rule_status ACTIVE/CLOSED from pricing-policy.js (Current shows ACTIVE; History tab shows CLOSED) | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| pricing policy manager / **Commercial Sales Assumptions** | `v_costing_pricing_commercial_sales_basis`<br>`rpc_get_sales_allocation_default_policies`<br>`rpc_get_regional_sales_allocation_default_policies` | types/supabase.ts Row; sales-policy Returns[] typed | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost sheet review / **SKU Cost Details** | `v_costing_pricing_sku_selector`<br>`v_costing_pricing_sku_detailed_cost_sheet` | types/supabase.ts Row | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost sheet review / **Cost Sheet (printable)** | `v_costing_pricing_printable_cost_sheet_product_summary`<br>`v_costing_pricing_cost_sheet_line_traceability (drill-down)` | types/supabase.ts Row; line-level printable view has no fixture — *Product summary table only; per-line printable sheet not fixtured* | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost sheet review / **Cost Comparison** | `v_cost_sheet_snapshot_sku_monthly_comparison_governed` | migration 20261019014458 (public view column list) | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost sheet review / **Scheme Comparison** | `v_costing_pricing_sku_scheme_comparison` | types/supabase.ts Row | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost sheet review / **QC Action Queue** | `rpc_get_qc_action_queue` | {row_data,total_count}[] per types; row fields read by qc-action-queue.js; seed action codes from QC_ACTION_TYPE_SEED | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| cost sheet review / **Materials / Stores Action Queue** | `rpc_get_materials_stores_action_queue` | same envelope; MS_ACTION_TYPE_SEED codes | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| production route manager / **Route Readiness** | `rpc_get_production_route_manager_readiness`<br>`rpc_get_production_route_master_options` | PRM_READINESS_STATUSES + normalizeReadinessPayload; master options per normalizePrmMasterOptions | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| production route manager / **Product Assignments** | `rpc_get_production_route_manager_product_assignments` | normalizePrmProductAssignmentsPayload | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| production route manager / **Subgroup Mappings** | `rpc_get_production_route_manager_subgroup_mappings` | normalizePrmSubgroupMappingsPayload | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| production route manager / **Workload Preview** | `rpc_get_production_route_manager_workload_preview` | no payload shape evidenced in smoke tests/types (Json) | No | message: This operation has no synthetic fixture; the mod | ok, no overflow | same | NOT TESTED (UNSUPPORTED offline) | NOT TESTED (real auth) | Needs batch-size and route-step evidence payload contract; do not invent |
| production route manager / **Manufacturing Route Families** | `rpc_get_production_route_master_options` | normalizePrmRouteFamilyMasterRow | Yes | 2 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| production route manager / **Mapping Review** | `rpc_get_route_family_mapping_review_candidates` | nested candidate-group payload not evidenced | No | message: This operation has no synthetic fixture; the mod | ok, no overflow | same | NOT TESTED (UNSUPPORTED offline) | NOT TESTED (real auth) | Needs candidate-group contract |
| production route manager / **Foundation Review** | `rpc_get_route_family_foundation_review` | 10-argument evidence payload not evidenced | No | message: This operation has no synthetic fixture; the mod | ok, no overflow | same | NOT TESTED (UNSUPPORTED offline) | NOT TESTED (real auth) | Needs foundation-review contract |
| production route manager / **Cost Centres** | `rpc_get_production_cost_centres`<br>`rpc_get_production_route_master_options` | normalizePrmProductionCostCentresPayload; type codes EQUIPMENT/PROCESS_AREA/SERVICE_CENTRED — *Location catalogues (plants/sections) not fixtured; header notes unavailable* | Yes | 3 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |
| production route manager / **Route Family Route Editor** | `rpc_get_route_family_route_detail (after selection)` | detail payload not evidenced | No | selection prompt / no rows | ok, no overflow | same | NOT TESTED (selection needs detail fixture) | NOT TESTED (real auth) | Editor needs a selected Family Route; detail RPC not fixtured |
| production route manager / **Product Route Editor** | `rpc_get_product_route_detail (after selection)` | detail payload not evidenced | No | selection prompt / no rows | ok, no overflow | same | NOT TESTED (selection needs detail fixture) | NOT TESTED (real auth) | Editor needs a selected Product Route; detail RPC not fixtured |
| production route manager / **Historical Evidence Review** | `rpc_preview_product_process_route_candidate (after preview click)` | preview payload not evidenced | No | selection prompt / no rows | ok, no overflow | same | NOT TESTED (selection needs detail fixture) | NOT TESTED (real auth) | Explicit scope + preview required; preview RPC not fixtured |
| production route manager / **Effective Route Viewer** | `rpc_get_effective_product_process_route (after product search)` | effective-route payload not evidenced | No | selection prompt / no rows | ok, no overflow | same | NOT TESTED (selection needs detail fixture) | NOT TESTED (real auth) | Needs a selected product; effective-route RPC not fixtured |
| production route manager / **Archived Routes** | `rpc_get_archived_production_route_architecture` | normalizePrmArchivedRoutesPayload | Yes | 1 data row(s) | ok, no overflow | same | MOCK TESTED (populated) | NOT TESTED (real auth) | Real-data render needs the authenticated read route (R3) |


### R.4 Functional test evidence (real Chromium, real pages; zero skips)

| Gate | File | Tests | What it proves |
|---|---|---|---|
| Fixture contract | `synthetic-fixtures.test.mjs` | 5 | Every served view has a repository contract; no invented columns; ids ≥ 900000; labels SYNTHETIC; READY/REVIEW/BLOCKED and approved + FAILED run present; manifest has exactly 40 entries and states a blocker for every non-populated one |
| Lens coverage | `lens-coverage.test.mjs` | 5 | Live inventory equals the manifest; every POPULATED lens shows ≥ minRows data rows, no failure banner, no unsupported read, SYNTHETIC value, no overflow, no write attempt; non-populated lenses show **zero** data rows and the explicit message; Navigation Only keeps data identical and hides exactly the two trace lenses; 390px works for all 31 |
| Functional workspaces | `functional-workspaces.test.mjs` | 12 | Search narrows, row opens detail modal, period switch Nov↔Oct (KPIs 1/3→3/3, run label, valuation date), sub-tabs, all ten PPM workspaces + deep link, IK/OK columns, Scheme Rule History tab, blocked SKU has no cost, view-only vs edit-claiming identity (writes denied either way, data unchanged), Navigation Only differences, 390px select navigation |
| Accessibility | `accessibility.test.mjs` | 4 | Launcher + 6 populated pages at 1280/390: `lang`, title, single `h1`, named buttons/fields, table headers, target size ≥ 20px; keyboard Tab→Enter lens switching with visible focus; launcher flags operable by keyboard |
| Transport / security | earlier suites | 19 | Unchanged (loopback, Host/Origin, proxy, traversal, symlink, no writes) |
| Earlier interactive + hardening | earlier suites | 16 | Updated for the contract fixtures; source-wide check that no mutating RPC can ever succeed and only `rpc_get_*` fixtures answer |
| Six-module mock regression | existing | 29 | Unchanged |

Reproduce: `node scripts/costing-preview/crlf-clone-validation.mjs --full` (CRLF clean clone, all suites) and `node scripts/costing-preview/capture-screenshots.mjs <dir>`.

**Screenshots (synthetic data only)** — `docs/master-data-costing/assets/preview-r-2026-11-06/`: `01` launcher · `02` CCC Nov FAILED run · `03` CCC Oct approved run · `04` SKU Control Status · `05` SKU detail modal · `06` Control Workbench · `07` Readiness · `08` Manual Rate Manager · `09` Cost Governance · `10` Driver Governance · `11` PPM SKU Policy Overview (IK/OK) · `12` Scheme Master · `13` MRP Proposals · `14` Cost Sheet detail · `15` Cost Comparison · `16` QC Action Queue · `17` Route Readiness · `18` Route Families · `19` **UNSUPPORTED Workload Preview (shown honestly)** · `20/21` flat vs Navigation Only · `22–24` 390px mobile.

### R.5 Defects found by the engineer's own browser review and corrected

1. Preview banner was `position:fixed` and covered the page header at 390px → now sticky, non-overlapping.
2. Cost Comparison "MoM COP change %" blank → percent/profit columns added to the fixture.
3. Cost Governance "Unmapped heads" and Excluded tab empty → fixtures added; Excluded keys on `mapping_status = EXCLUDED` (found in `costing-suite-cost-build.js`).
4. Scheme Rule Register showed 0 rows → current rules use `rule_status` ACTIVE/SCHEDULED, history CLOSED (found in `costing-suite-pricing-policy.js`).
5. Cost-centre list ignored `rows`; client expects `{cost_centres:[…]}` → corrected.
6. Manual-rate queue fixture initially reused the wrong view's columns; the new contract test caught it → corrected.
7. Run-display view reused period-status columns; corrected to the approval screen's own select list.
8. Launcher said "Two fictional SKUs" (three exist) → corrected; also mobile overflow from long paths.
9. The crawler's regex first reported toast text from a previous lens against the next one → toasts are cleared between lenses.
10. A stale `sku_costing_control_status_snapshot` alias (not a contract object the app reads) was removed.

### R.6 Outstanding limitations (nothing hidden)

* **Not covered:** PRM Workload Preview, Mapping Review, Foundation Review (no payload contract; do not invent); PRM Route Family Route Editor, Product Route Editor, Historical Evidence Review, Effective Route Viewer (need a selected route/product and detail RPCs with no fixture); per-line printable cost sheet and line traceability; SKU MRP history drawer; readiness dependency drill-down; RM/PM Cost Trace (server role).
* Fixtures are shape-matched to repository contracts, **not** verified against live views; vocabulary for a few status codes is only partially evidenced (`display_status`, `source_trigger`, `rule_status` CLOSED, `mapping_status` ACTIVE). Numbers are fictional.
* The preview cannot show real-data behaviour: real November readiness is `READINESS_BUILD_ABSENT` (database dependency), Cost Sheet Review printable/comparison hit statement timeouts (SQLSTATE 57014) in production logs on 5 Nov, and November run 150 FAILED (PM BOM dates). None of these can be reproduced or cleared by synthetic data.
* Linux CRLF clone is not a real Windows runtime; Electron / A14 installer untested.
* Production Supabase, flags, PWA, Electron, e-Aushadhi, run 143/148/149/150: untouched.

### R.7 Real authenticated READ-ONLY acceptance route (design and checklist; nothing executed)

Sources audited: `VIEW_ONLY_TEST_IDENTITY_GRANTS_2026-11-05.md`, `AUTHENTICATED_ROLE_ACCEPTANCE_GATE_2026-11-05.md`, `AUTHENTICATED_PWA_SIX_MODULE_ACCEPTANCE_2026-11-05.md`, SEC-A1/SEC-A2 records, `CDE2_LIVE_SOURCE_CONTRACT_AUDIT_2026-11-05.md`.

**Facts that shape the route**
* The existing test account has six Costing grants `can_view=true, can_edit=false` (verified 5 Nov) but **also 52 unrelated edit grants**: it is Costing-scoped view-only, not globally read-only. Never use it to claim "cannot write anywhere".
* A local origin still talks to **production** Supabase; a signed-in run is a production read.
* Protected snapshots (`sku_prime_cost_snapshot`, regional marketing snapshot) have **no authenticated SELECT**; draft component evidence needs the CDE-2 projection RPC, which does not exist (D1–D5 are owner decisions). Those panels stay NOT TESTABLE until then.
* Real-data blockers already known: November readiness build absent; two statement-timeout reads in Cost Sheet Review; draft run 149 and failed run 150 must not be approved/retried.

**Checklist (account holder performs; no passwords/tokens shared)**
1. Confirm the served bundle: source commit ≥ merged `main` containing PR #178, asset digests recorded, service-worker cache noted. If it cannot be proven, mark every row NOT TESTED.
2. Sign out/in to refresh permissions. Confirm six navigation entries, no edit actions, CCC shows the view-only explanation and **no** "Review for approval".
3. Run `node scripts/costing-preview/rpc-inventory.mjs` and filter DevTools → Network by `rpc_`. **Any request whose name is in the MUTATING (88) or UNKNOWN (6) lists means a write path was triggered — stop and report.**
4. Walk only the read lenses in the coverage matrix (flag OFF first; then **Navigation only** alone). Never press Preview, Approve, Finalise, Refresh, Recalculate, Lock, Accept, Close, Save, Create, Request draft, Apply or Decide.
5. Per lens record: period, run label, valuation date, row count, any red message, network count; compare with the synthetic matrix only for *structure* (columns, status vocabulary), never for numbers.
6. Record screenshots at 1280px and 390px; restore all flags OFF; list defects.
7. Server-side denial proofs (SEC-A1/SEC-A2) remain NOT TESTED until a separately approved no-side-effect plan exists; do not call writers to "prove" denial.

**Remaining server/owner decisions:** CDE-2 D1–D5; read gateway vs isolated database (see §4); whether November readiness is to be built (separate governed action); Cost Sheet Review statement-timeout remediation (separate read-only investigation).

### R.8 Owner walkthrough (visual judgements only; 10–15 minutes)

Run `node scripts/costing-preview/read-only-loopback-server.mjs`, then open the printed `/__preview/` URL (random port, localhost only).
1. Click **Navigation only**, open Costing Control Center → SKU Control Status. Compare with screenshots 20/21: do the group labels and the two context chips help you? (Judgement, not a pass/fail of data.)
2. CCC Dashboard: switch Nov 2026 ↔ Oct 2026. Does "FAILED run, not approved" versus "Approved run" read clearly? Is the valuation date visible?
3. Pricing Policy Manager → SKU Policy Overview: are IK and OK columns, scheme choices and the READY / REVIEW / BLOCKED statuses what you expect to see?
4. Cost Sheet Review → Cost Comparison: is the layout of cost, previous month and change usable? (Numbers are fictional.)
5. Note any screen that looks wrong in layout or wording. Anything marked UNSUPPORTED in the matrix is intentionally not shown; do not report it as a defect.

**Owner sign-off is requested only after the independent engineer verification above (CI on the exact head).**

### R.9 Evidence and head

Recorded at the end of this file (§8) once the workflow has run on the final head.

---

# (Earlier record, 6 Nov early morning — superseded where it conflicts with R.0–R.9)

**Issue:** [#196](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/196) · **Worker branch:** `claude/costing-preview-bulk-20261106` · **Base:** `preview/costing-wp05-wp06-wp12-20261105` @ `7c028d0557fe4e14af11f59b1961d684f05cdcd0` (production `main` @ `bdf2644844db15a36ce24bb62ff4eb1935424d97` not touched).

**Status: WORKER EVIDENCE ONLY. NOT an owner acceptance, NOT a formal work-pack closure (still 5/13), NOT real-auth or populated-data proof.** Real Supabase, the Windows A14 installer and CDE-2 D1–D5 remain open. This is the single consolidated note for Waves A–C; it extends the [unified workflow](COSTING_SUITE_UNIFIED_WORKFLOW_2026-11-02.md) and is not a new work pack.

## 1. What changed (preview tooling only; no `public/` application source touched)

| Area | Change |
|---|---|
| Synthetic client (`scripts/costing-preview/synthetic-supabase-client.mjs`) | **Deny by default.** Only explicit per-read fixtures succeed: `get_user_permissions`, run-status view (two runs: SYNTHETIC approved Oct run 900001, SYNTHETIC **FAILED** Nov run 900002), control dashboard snapshot, KPI summary, three SKU status cases (READY / REVIEW_REQUIRED / BLOCKED, ids 900001–900003), scheme and scope options, plus named *empty* option lists. Every other RPC/table/storage read returns `SYNTHETIC_PREVIEW_UNSUPPORTED_OFFLINE` (previously silent `[]` success). Mutating names return `SYNTHETIC_PREVIEW_WRITE_DENIED`. Denial never depends on the permission fixture. `?synthetic_priv=edit-claimed` makes the fake permissions claim `can_edit=true` to prove writes are still refused. |
| Launcher (`synthetic-launcher.html`) | Read-only **operation log** (operation names only, no payloads; session-scoped; cleared by Reset), explanatory "why a module may look empty" card, Reset also removes any `COSTING_*` localStorage key, 390 px layout rule. |
| Server (`read-only-loopback-server.mjs`) | Exact `Host:port` match (DNS-rebinding), refuse any `Origin` that is not the same loopback origin (incl. `null`), refuse `Sec-Fetch-Site` other than same-origin/none. Still GET/HEAD only, loopback only, `connect-src 'none'`, no service workers. |
| Tests | `wave-a-synthetic-hardening.test.mjs` (12, real Chromium), `transport-negative.test.mjs` (12, raw HTTP/socket), `crlf-clone-validation.mjs` (CRLF checkout of committed HEAD), `assert-tap.mjs` (fails on any skip/empty report). Two stale fixture assertions in the earlier interactive test were updated (3 SKUs; unsupported table now errors). |
| CI (`.github/workflows/costing-preview-mock.yml`) | Also runs on `pull_request` into the preview branch and on the worker branch; `contents: read`, no secrets; Node `22.23.4`, Playwright `1.62.1` pinned and asserted, exact-SHA clean-tree verifier, minimum test counts per suite, zero skips, CRLF clean-clone rerun of all suites. |

**What the real pages now show with synthetic data:** Costing Control Center renders the dashboard KPIs (readiness 1/3, blocked 1, review 1) and "SYNTHETIC Run 900002 FAILED – not approved". With edit controls exposed, the real toolbar Refresh → *Request a recalculation* → *Request draft* is **denied and logged**. Other lenses that need views/RPCs without fixtures show an explicit offline error rather than invented data. Figures are fictional and are never official costing values.

## 2. Verified results (fill from the exact commit below)

See PR description for the final head SHA and workflow URL; table in §6 is updated by the final docs commit.

Local (Node v22.23.4, Playwright 1.63.0 global, Chromium 1243 headless) at commit `576ce2f`:

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| Transport (`read-only-loopback-server` 7 + `transport-negative` 12) | 19 | 19 | 0 | 0 |
| Interactive (4) + Wave A hardening (12), real Chromium | 16 | 16 | 0 | 0 |
| Six-module mock regression (29) | 29 | 29 | 0 | 0 |
| **LF total** | **64** | **64** | **0** | **0** |
| **CRLF clean clone (`core.autocrlf=true`)** — same suites + exact-SHA verifier | 64 | 64 | 0 | 0 |

Defects found and fixed during the wave: (1) earlier interactive tests asserted the old 2-SKU/silent-empty fixture — updated; (2) the CRLF clone first failed the verifier because a `node_modules` symlink dirtied the tree — linked after the verifier; (3) `rpc_costing_authorise_supersession` was not recognised as a mutation name (it still failed closed as UNSUPPORTED) — added; (4) `rpc_get_*` reads containing words such as `run` were mislabelled as denied writes — read-shaped names are now classified separately.

## 3. Isolation evidence

* Browser: every page asserted `connect-src 'none'`; Playwright context listeners record zero requests to any non-loopback host or to `/rest/v1`, `/auth/v1`; zero service-worker registrations.
* Source-wide test: all 155 `rpc_*` names found in the six-module client source are called through the shim — **none succeeds** (each is denied or UNSUPPORTED offline; only `get_user_permissions` and the named table fixtures answer).
* Mutations tested: toolbar refresh/recalculation dialog, approval-finalise, period lock, table `update`, and 12 further RPC/table writes under both a view-only and an edit-claiming permission fixture → all `SYNTHETIC_PREVIEW_WRITE_DENIED`, fixture rows unchanged.
* Served shim and launcher contain no Supabase origin, JWT-shaped string, `service_role` or `createClient`.
* Server negative tests: wrong/spoofed/missing/wrong-port Host, `Origin: null`/foreign, cross-site fetch metadata, all non-GET verbs, raw `CONNECT`, absolute-form and `//` proxy requests, backend prefixes in case/encoding variants, plain/encoded/double-encoded/backslash/null-byte traversal, symlink and symlinked-directory escape, unlisted types and dotfiles, service-worker paths, headers on every response.
* No production Supabase call was made by any test, script or document in this wave.

## 4. Threat model / design note — future authenticated, populated-data **read-only** route (design only; nothing implemented)

**Inventory (from source, six module screens):** 155 `rpc_*` names + `get_user_permissions`; ~50 `v_costing_*`/`v_*` views read directly plus `inv_stock_item`. Name-based classification: **61 READ-shaped** (`get/list/preview/validate/explain/export`), **88 MUTATING** (create/update/upsert/delete/submit/approve/supersede/set/apply/…), **6 UNKNOWN by name** (`rpc_accept_material_review_action`, `rpc_costing_approve_run`, `rpc_costing_approve_run_with_preview`, `rpc_costing_authorise_supersession`, `rpc_costing_health_check`, `rpc_costing_preview_approval_impact` — the first four are write-like by behaviour but must be confirmed). **Name-based is evidence, not proof:** `preview_*`, `validate_*` and `export_*` RPCs need function-body review (side effects, audit inserts, `SECURITY DEFINER`) against the live contract before any is called READ. No live DB was consulted in this wave (blocked by the no-production-operations rule), so **no RPC is certified READ**; CDE-2 live audit remains the only live evidence (protected source tables have no authenticated SELECT).

**Options (owner decision, not selected here):**
1. **Server-enforced read gateway** (Edge Function / small service): allowlist of exactly the certified READ names and views, rejects everything else, maps one preview identity to a read-only DB role; browser never holds a general token. Strongest control; one new component to host.
2. **Isolated database** (branch or restored copy, no write path to production): lets real pages run unchanged but data is stale and a copy of production data must be governed (retention, access).
3. **Client-side filtering only — rejected:** a patched client or direct REST call bypasses it.

**Required controls for any option:** dedicated read-only role with `SELECT`/`EXECUTE` only on certified objects; **no `service_role`** anywhere in the preview path; short-lived, audience-restricted preview token never reusable against production APIs; preview hosted on a separate domain/origin from the production PWA (no shared service worker or storage); `SECURITY DEFINER` functions pinned `search_path`, `PUBLIC`/`anon` EXECUTE revoked; per-request statement timeout and row caps (see CSR timeout work); audit log of every read; CSP and no third-party scripts.

**Negative auth tests to write first (red before green):** anonymous and expired token rejected; view-only user denied each of the 88 mutating names; preview token cannot call production URL; unlisted RPC/view returns 403 not empty; cross-user and cross-period reads blocked; `service_role`/JWT absent from served assets (extend the existing shim scan); direct REST `POST/PATCH/DELETE` rejected at DB role level (not only the gateway); failed run 150 and approved run 143 unaffected.

**Not decided here:** CDE-2 D1–D5, which option, data-retention policy, any public RPC, migration, grant or database branch.

## 5. Owner test checklist (6 Nov PC) — localhost only *(SUPERSEDED by R.8 and R.3; kept for history)*

Start (Windows PowerShell or any shell, from the repo root at the commit under test): `node scripts/costing-preview/read-only-loopback-server.mjs` → open the printed `http://127.0.0.1:<port>/__preview/`. Port is random; do not use any hosted URL. Open DevTools (F12) Console and Network and keep them open.

Legend — **MOCK** = automated result at the PR head; **REAL AUTH** = not testable here; **OWNER** = to be filled on the PC (PASS/FAIL, initials, note).

| # | Check | MOCK TESTED | NOT TESTED (real auth) | OWNER PASS/FAIL |
|---|---|---|---|---|
| 1 | Launcher shows red SYNTHETIC banner; six module links open; each page shows the SYNTHETIC banner | Yes | Real login/permissions | |
| 2 | Presets: **All OFF**, **Navigation only**, **All eleven ON**, **Reset / restore OFF** change the counter (0/1/11/0 of 11) | Yes | — | |
| 3 | Each of the **11 flags** toggles on its own (only that box ON), then OFF | Yes (all 11) | Behaviour of each flag with real data | |
| 4 | After Reset: no `COSTING_*` keys (DevTools → Application → Local storage) | Yes | — | |
| 5 | Costing Control Center shows 1/3 ready, 1 blocked, 1 review and "SYNTHETIC Run 900002 FAILED" (turn on *Run status* flag for the run panel) | Yes | Real figures | |
| 6 | Pricing Policy Manager: **all 10 workspaces** open from the left list (SKU Policy Overview, SKU MRP Policies, Product Derivation, MRP Proposals, Proposal Decisions, Approved for Application, Applied History, Scheme Master, Scheme Rule Register, Commercial Sales Assumptions); empty ones show an explicit offline message, not fake rows | Page loads/labels only; per-workspace content mostly **UNSUPPORTED offline by design** | Real policy data | |
| 7 | Period / run context: period chips Nov 2026 / Oct 2026; deep links `…/cost-sheet-review.html?period=2026-10-01`, `…/pricing-policy-manager.html?period=2026-11-01&lens=sku-policy-overview`, `…/production-route-manager.html?lens=route-readiness` load with banner | Load only | Server-authoritative run labels | |
| 8 | View-only prohibition: on a module add `?synthetic_priv=edit-claimed`; turn on *Recalc with date*; click toolbar refresh → **Request draft** → expect an error/denial, never success | Yes | Real view-only grant | |
| 9 | Launcher → **Refresh log**: entries show READ / UNSUPPORTED / DENIED, no secrets or payloads; **Clear log**/Reset empties it | Yes | — | |
| 10 | Console/Network: no request leaves `127.0.0.1`; CSP errors for blocked CDN scripts (jsPDF) are expected and harmless; no service worker in Application → Service Workers | Yes (no external/Supabase request) | — | |
| 11 | Desktop (≥1280 px) and **390 px** mobile width (DevTools device toolbar): no horizontal page scroll on launcher; modules usable | Launcher 390 px yes; modules not width-tested | — | |
| 12 | Close server (Ctrl+C); confirm nothing else remains running | n/a | — | |

**Not covered, do not mark PASS:** signed-in acceptance, populated production data, packaged Windows installer (A14), PWA/service worker behaviour, any write. Report console errors other than the CSP/CDN and "UNSUPPORTED_OFFLINE" messages as defects.

## 6. Next-action decision table

| Decision | Options | Recommendation |
|---|---|---|
| Review this draft PR into the preview branch | merge / revise / close | Owner review after PC walkthrough; merge only by the owner |
| Populated read-only preview route | gateway / isolated DB / none | Owner chooses (§4); CDE-2 D1–D5 first |
| More synthetic lenses | add fixtures per RPC contract | Only with a live-contract-verified shape; otherwise leave UNSUPPORTED |
| Promotion to `main` | selective cherry-pick of tooling only | Separate owner decision; never merge the preview branch wholesale |
| Formal WP05/WP06/WP12 closure | not requested | Remains open (5/13) |

Final commit SHA, workflow run URL and CI totals for the PR head are recorded in the PR description and in §7 once green.

## 7. CI record

Green GitHub Actions run (PR event, read-only token, no secrets): https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42053762200 at **`8ecf66133ae428bcb694a000496ec1584ab3a759`** — Node 22.23.4, Playwright 1.62.1, Chromium installed by the pinned Playwright; every step succeeded: exact-SHA verifier, transport 19, interactive+hardening 16, six-module mock 29 (asserted zero fail/skip by `assert-tap.mjs`), CRLF clean-clone rerun of all 64. Earlier run 14 (`576ce2f`) failed only the CRLF step because CI TAP files dirtied the checkout; fixed in `8ecf661`. Commits after `8ecf661` are documentation-only (this section); the PR checks show their runs.

## 8. Revision evidence (R1–R4)

_Filled after CI completes on the final head (see PR #197)._
