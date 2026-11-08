# WP05-PAR1 — S2 / S9-PARITY real-data parity record (8 November 2026)

**Status: PREFLIGHT COMPLETE; LIVE READ-ONLY PARITY EXECUTED 8 November 2026 (section 8): S2 PASS on two SKUs and PARTIAL on the BLOCKER SKU (costs NULL by design); S9-PARITY PASS for November and October.** WP05 remains OPEN; programme **6/13**. AE1's accepted classification (**13 P / 4 historical F / 2 NA / 21 NT**) is unchanged. This record does not propose 7/13 or any B1 scope decision. Sections 0 to 6 are the original preflight record and still describe the state before the live run (they say NOT TESTED); **section 8 supersedes them for results**.

Tracking: issue #234, assignment "WP05-PAR1 S2/S9". Base: `origin/main` = `5a79b94a529d958fba445c0a3ae3bbb8a596d497`, in a fresh worktree on branch `claude/wp05-par1-s2-s9-read-parity`; the owner's WP06 and AE2 checkouts were not touched.

## 0. What was and was not done

| Item | Result |
|---|---|
| Phase 0 source-only preflight | **Done** (sections 1-3). Repository files and one local metadata read only. |
| Phase 1 browser reads (S2, S9) | **Not performed.** No verified ID-V signed-in context was made available (section 4). No browser was launched, no site was opened, no network request was made to production. |
| Production SQL, RPC calls, writes, flags, code, tests, migrations, deployment, cache bump, dependency install, C:/D: cleanup | **None.** |
| Credentials, session/token files, screenshots | **Not opened, copied or committed.** The folder holding the ID-V permission extract was listed by filename only; the file was not opened. |

Per the assignment ("if production identity/build is not verified, stop after documenting preflight"), the run stops here. Nothing below is a measured parity result, and no number is invented.

## 1. Preflight source contract

All paths are relative to the repository root at `5a79b94a`. "Allow-list" means `scripts/costing-acceptance/lib/allowlist.mjs` `classifyRequest`: the read-only network guard used by the acceptance runner.

### 1.1 Surfaces and read sources

| Surface | Route / lens | Read source (client) | Read kind | Allow-list status |
|---|---|---|---|---|
| SKU Cost Details | Cost Sheet Review, lens `sku-cost-sheet` | selector `v_costing_pricing_sku_selector` (shell `VIEW_BY_LENS`, `costing-suite-shell.js:2445`); detail `v_costing_pricing_sku_detailed_cost_sheet` filtered by `period_start` + `sku_id`, `limit(1)`, **no run filter** (`costing-suite-shell.js:7558-7570`) | REST GET on a view | `rest-read` permitted |
| Printable Cost Sheet (list) | Cost Sheet Review, lens `printable-cost-sheet` | `v_costing_pricing_printable_cost_sheet_product_summary` (`costing-suite-cost-sheet.js:620`, `loadPrintableLensRows` at 5900) | REST GET | permitted |
| Printable Cost Sheet (sheet) | open one product | `v_costing_pricing_printable_cost_sheet_lines` filtered by `period_start`, `valuation_date`, `refresh_run_id`, `product_id` (`costing-suite-cost-sheet.js:889-931`) | REST GET | permitted |
| CCC Dashboard KPI strip | Costing Control Center, lens `dashboard` | `v_costing_pricing_control_dashboard_snapshot` by `period_start` (`costing-suite-control-center.js:597-606`); fallback `v_costing_pricing_business_kpi_summary` (586-595); KPI strip `renderKpiStrip` (700-) | REST GET | permitted |
| SKU Control Status | CCC, lens `sku-control-status` | `v_costing_pricing_sku_control_status_snapshot` by `period_start`, paged 1000 (`costing-suite-control-center.js:672-698`) | REST GET | permitted |
| Run pointer / label | run-status badge (all lenses) | `v_costing_pricing_period_run_status` by `period_start` (`costing-run-status-badge.js:139-141`) | REST GET | permitted |
| Valuation context | period bar | `rpc_get_cost_period_valuation_context` (`costing-suite-cost-period-valuation-helpers.js:10`) | RPC | matches `READ_RPC` pattern `rpc_get_*`; see 1.4 |
| Permission read | session start | `get_user_permissions` | RPC | explicitly in `READ_RPC` |

### 1.2 Identity, grain, cost and status definitions

| Dimension | Printable Cost Sheet | SKU Cost Details | SKU Control Status | CCC Dashboard KPI |
|---|---|---|---|---|
| Identity key | `product_id` + `sku_id` (`sku_column_label` = `pack_size pack_uom`) | `sku_id` (+ `product_id`) | `sku_id` (+ `product_id`) | `period_start` only (one summary row) |
| Grain | **SKU columns within a product sheet**; list level is product (`sku_count`, `line_count`) | SKU | SKU | period aggregate |
| Run scope | `valuation_date` + `refresh_run_id` on every line | view reads `costing.v_sku_detailed_cost_sheet_current`; exposes `refresh_run_id`/`valuation_date`; **definition not in repository** | joined to `costing.v_current_successful_costing_refresh_run` on period, valuation date and run id | the dashboard view is wrapped with the same join (`20260807135753_stage05_current_run_public_projections.sql`) |
| Loaded cost field | line `Internal Loaded Cost` (`section_code` `B_INTERNAL_COST`, `line_order` 130), numeric in `value_numeric` | `internal_loaded_cost_per_sku` | none (control view carries `material_cost_per_sku`, not loaded cost) | none |
| Other comparable lines | `Total Material Cost` (A_COP 30), `Manufacturing COP` (A_COP 80), `MRP: Inside Kerala` (C_IK_PRICING 210) | `material_cost_per_sku`, `manufacturing_cop_per_sku`, `mrp_ik` | `material_cost_per_sku`, `mrp_ik` | none |
| Status field and vocabulary | `cost_sheet_status`: READY / REVIEW_REQUIRED / BLOCKED | `cost_sheet_status`, `internal_loaded_cost_status` | `control_severity` READY / REVIEW_REQUIRED / **BLOCKER**; also `cost_sheet_status` | `ready_sku_count`, `review_required_sku_count`, `blocked_sku_count` |
| Status derivation | **composite**: BLOCKED if the exact material snapshot, either frozen scheme-policy context or either scheme-viability row is missing or BLOCKED; READY only if `d.cost_sheet_status`, IK viability **and** OK viability are all READY (`20261019134900_tb2_costing_view_permission_gate.sql` ~1226-1260) | cost-sheet status from the detail source only (no scheme-viability term visible) | its own severity logic, including a direct-labour-route override to BLOCKER (`20260917113016_expose_exact_run_context_on_sku_control_snapshot_view.sql`) | counts of the same severity set |
| Period | `period_start` (month start) | `period_start` | `period_start` | `period_start` |

### 1.3 Findings that govern testability

1. **Printable vs SKU detail is comparable at SKU grain.** The printable sheet is a product-level *document* but is made of per-SKU columns whose `value_numeric` rows map one-to-one to SKU Cost Details fields (Internal Loaded Cost, Manufacturing COP, Total Material Cost, MRP IK). No product-to-SKU apportionment is needed. Pack size and unit (`pack_size`, `pack_uom`) are on both sides and must be matched before comparing numbers.
2. **Status words are not the same quantity.** The printable `cost_sheet_status` includes scheme-viability terms; the SKU Cost Details status does not appear to. A READY vs REVIEW_REQUIRED difference between them is therefore **not automatically a parity defect**; it must be explained from the notes before it is called FAIL. The canonical READY / REVIEW / BLOCKER source for choosing the three SKUs is the SKU Control Status `control_severity`, then each surface's own status is read and reported separately.
3. **SKU Cost Details has no explicit run filter.** It relies on the `_current` source view. Run equality with the printable sheet must be read from the returned `refresh_run_id` / `valuation_date` columns, not assumed from the label.
4. **S9 has no aggregate on the control view.** The KPI strip is a pre-aggregated snapshot row; the SKU Control Status lens is rows, so counts per severity must be derived from the lens' own total and filter, with the same population (see 1.5).
5. **Dashboard fallback.** If `control_dashboard_snapshot` has no value, the KPI strip substitutes `business_kpi_summary` fields (`firstNumber`). A matching KPI could then come from a different source than the snapshot; the live step must confirm the snapshot row existed.
6. **Population wording.** Historical figures show two different populations: 628 SKUs per run (run-scoped SKU control; CDE-2 contract corrections) versus 603 operational SKUs from 1,793 in the November readiness build #6 (portfolio readiness, LIVE_AS_OF). The assignment asks that these are not equated. S9-PARITY compares dashboard KPIs with the **SKU Control Status** lens only; readiness is not a comparison side.
7. **Candidate SKU 105 is unverified.** No repository evidence fixes its current status; it must be confirmed in `control_severity` before use.

### 1.4 Read-RPC review

| Name | Definition found in repository | Result |
|---|---|---|
| `get_user_permissions` | allow-list name | permission read for the session; not re-reviewed here |
| `rpc_get_cost_period_valuation_context(date)` | `supabase/migrations/20260807071710_harden_cost_period_valuation_governance_client_contract.sql` | `stable`, `security definer`, calls `require_permission`; a scan of the body found **no insert/update/delete**. Latest repository definition only; the live definition was not inspected (no production DB access in this task). Treated as read-safe **in repository**, `live not verified`. |
| Any `rpc_preview_*`, `rpc_set_*`, refresh, approve, decide | present elsewhere in the app | **Not needed for S2/S9; not to be called.** Per standing finding F1 (issue #234/selector acceptance), `rpc_preview_route_family_route_steps` remains unreviewed and was not touched. |

No RPC needed for S2 or S9 is unknown, mutating or outside the pattern, so **no S2/S9 step is BLOCKED on an RPC**. All data reads are REST GETs on views. Note the guard allows a GET on **any** table or view name, so "allow-listed" for views means "GET is permitted", not "reviewed"; the view definitions above were read from migrations, but the live definitions were not checked.

### 1.5 Other source gaps

- `costing.v_sku_detailed_cost_sheet_current` has no definition in `supabase/migrations`; the origin of SKU Cost Details' run basis is `SOURCE_NOT_IN_REPO`.
- The writer of `costing.costing_control_dashboard_snapshot` (what population `ready_sku_count` counts) is not in the migrations; only its read wrapper is. The dashboard denominator `total_sku_count` is therefore not source-confirmed.
- Repository migrations may lag the live schema (several are marked "backfilled from live schema_migrations").

## 2. Local D: summaries (Phase 0, step 4)

Read-only, structure and non-sensitive metadata only: `D:\claude-sessions\acceptance-out\run-20261108\report.json` (key names and the fields below; no screenshots, no authentication files, no product or cost values).

| Field | Observed |
|---|---|
| Served build / cache | `git_sha` `9661c169e0cb7a635c98b3fd6cc151a128ff6f0e`, `hub-cache-v391`, build verdict VERIFIED, `hosted_proof: true` |
| Identity / matrix | ID-V, `standard` matrix, evidence class HOSTED, started 2026-11-08T05:35:53Z |
| Run summary | 119 observations, 5 claim failures, 29 no-data, 0 violations, 0 blocked, flags restored `true` |
| Dashboard, Nov 2026 | `rows=1`, run label `DRAFT run 149 - not approved` (1280 and 390 px, OFF/NAV_ONLY; `Draft 149` under ALL_ON) |
| Dashboard, Oct 2026 (1280 px, OFF) | `rows=1`, `Approved run 143 (newer DRAFT run 148 - not approved)` |
| SKU Control Status, Nov 2026 | `rows=50`, `DRAFT run 149`; `rows` is a **page size**, not a population total |
| Cost Sheet (SKU) / Printable | `rows=25` per page, `DRAFT run 149`; Oct SKU sheet `Approved run 143 (newer DRAFT run 148)` |

**Conclusion:** the summaries hold row counts, period and run labels only. They contain **no KPI values, no per-SKU costs and no per-SKU statuses**, and rows are page sizes. They cannot support numeric S2 or S9 parity and nothing was reused as such. They do corroborate, at v391/OFF, the expected run pointers (Nov latest successful draft 149; Oct approved 143 with newer draft 148) on the dashboard and SKU cost sheet; **no run label for SKU Control Status in October is recorded**, and no run 150 label appears for any of the four lenses. This is label-level evidence only, not run-scoped KPI parity.

Historical, owner-reported, not independently timed and not credited here: 5 Nov authenticated acceptance reported CCC dashboard "121/628 ready, 506 review, 1 blocked" for draft 149 (`AUTHENTICATED_PWA_SIX_MODULE_ACCEPTANCE_2026-11-05.md`); the 8 Nov readiness build reported operational READY 121 / REVIEW_REQUIRED 479 / BLOCKER 3 = 603 (`CURRENT_CHECKPOINT_AND_CLAUDE_HANDOVER_2026-11-08.md`). The 121 READY coincidence across a 628 and a 603 population is a lead to verify, not a result.

## 3. Test design for the live step (ready to execute once Phase 1 is permitted)

Read-only controls only; any forbidden request aborts the step.

**S2 (3 SKUs).**
1. Period Nov 2026. In SKU Control Status, pick three SKUs (opaque index S2-A/B/C) with `control_severity` READY, REVIEW_REQUIRED and BLOCKER; record SKU 105's status if it appears, without presuming it.
2. For each, open the SKU in Cost Sheet Review SKU Cost Details and read `refresh_run_id`, `valuation_date`, `pack_size`/`pack_uom`, `internal_loaded_cost_per_sku`, `manufacturing_cop_per_sku`, `material_cost_per_sku`, `mrp_ik`, `cost_sheet_status`.
3. Open the printable sheet for the SKU's product, locate the SKU column by `sku_column_label`, and read the same lines (`Internal Loaded Cost`, `Manufacturing COP`, `Total Material Cost`, `MRP: Inside Kerala`), `Cost Sheet Status`, and the line `refresh_run_id` / `valuation_date`.
4. Compare only after run id, valuation date, pack size and unit match. Delta = printable minus detail, same unit and rounding; classify status mismatches against the composite definition (1.2) before calling FAIL.
5. Repeat the BLOCKED-class SKU reading with the understanding that blocked lines may legitimately carry NULL numerics (that is `NOT COMPARABLE`, not FAIL).

**S9-PARITY.**
1. For Nov 2026 then Oct 2026 (UI period control only), read the run label, the KPI strip (Costing Readiness x/y, Costing Blocked, Costing Review) and confirm the dashboard used the snapshot row, not the `business_kpi_summary` fallback.
2. In SKU Control Status for the same period, determine the population total and READY / REVIEW_REQUIRED / BLOCKER counts using the lens' own total and filters; record page size, filters applied and any mismatch of denominator.
3. Confirm the run pointer matches on both lenses and that run 150 never appears.
4. Repeat at 1280 and 390 px.

## 4. Browser / permission / build evidence (Phase 1)

| Requirement | Status |
|---|---|
| Owner's existing restricted ID-V signed-in context made available for this bounded test | **No.** The built-in browser pane was not open and held no tab or session. The ID-V storage state used by the selector acceptance was deleted at the end of that run (selector acceptance, section 6). No login automation, credential entry or token request is permitted by this assignment, and none was attempted. |
| Verified ID-V permissions (six view, zero edit, no other grant) in this session | **NOT TESTED** (no session). The earlier canonical extract exists on D: but belongs to the earlier run and was not opened. |
| Served build SHA, asset parity digest, cache name | **NOT VERIFIED for this task.** Source cache name at `main` is `hub-cache-v392` (`public/sw.js`). Prior documented parity: `main@51cd26f3...` (selector run) and `main@883a9f1c...` (WP06 baseline), both v392; the 8 Nov D: run was v391. The three-file v391/v392 difference means v391 evidence is not v392 parity. `verify-served-assets.mjs` was not run (no reason to verify a build with no authenticated session to test against). |
| Flags | Not read this task. All `COSTING_*_V1` overrides are browser-local; no session existed to inspect. Nothing was set. |
| HTTP / error summary, request-name metadata, blocked requests | **None; no requests were made.** |

`NOT TESTED: AUTHENTICATED_CONTEXT_NOT_AVAILABLE`.

## 5. Results

### 5.1 S2: printable Cost Sheet vs SKU Cost Details

| SKU (redacted index) | Status (canonical, control) | Period / run / valuation / pack | Printable value | SKU detail value | Delta | Result |
|---|---|---|---|---|---|---|
| S2-A (READY) | not selected | not read | not read | not read | n/a | **NOT TESTED** |
| S2-B (REVIEW_REQUIRED) | not selected | not read | not read | not read | n/a | **NOT TESTED** |
| S2-C (BLOCKED / BLOCKER) | not selected | not read | not read | not read | n/a | **NOT TESTED** |

Testability from source: **comparable at SKU grain** (1.3 item 1), with a status-definition caveat (item 2). Not "NOT COMPARABLE BY DESIGN".

### 5.2 S9-PARITY: CCC Dashboard vs SKU Control Status

| Period | Governed run (expected, not verified here) | Dashboard READY / REVIEW / BLOCKED / total | SKU Control READY / REVIEW_REQUIRED / BLOCKER / total | Result |
|---|---|---|---|---|
| November 2026 | latest successful draft 149 (label seen on v391, section 2) | not read | not read | **NOT TESTED** |
| October 2026 | approved 143 with newer draft 148 (dashboard label seen on v391; SKU Control label not recorded) | not read | not read | **NOT TESTED** |

## 6. Findings, severity and impact on W5-05

| # | Finding | Severity | Smallest next proof |
|---|---|---|---|
| P1 | No authenticated ID-V context is available; S2 and S9-PARITY cannot be tested. | Blocker for W5-05 live parity (process) | Owner makes an ID-V signed-in context available for a bounded read session (or runs the section 3 steps and supplies redacted numbers), on a build whose digest is verified. |
| P2 | Printable `cost_sheet_status` is composite (cost plus IK and OK scheme viability); SKU Cost Details and SKU Control use other status logic. | Medium (interpretation risk) | Read status and note on all three surfaces; explain any difference from the notes before classifying. |
| P3 | SKU Cost Details has no explicit run filter and its `_current` source view is not in the repository. | Medium | Read `refresh_run_id`/`valuation_date` from the returned row; owner or reviewer supplies the live definition if run basis is disputed. |
| P4 | Dashboard KPI strip can fall back to `business_kpi_summary`; population writer not in repository. | Low-Medium | Confirm the snapshot row existed; document denominator source. |
| P5 | Local D: summaries contain labels and counts only. | Informational | None; do not reuse for numeric parity. |
| P6 | No S2/S9 step needs an unknown, mutating or unreviewed RPC. `rpc_get_cost_period_valuation_context` is stable and write-free in the repository definition; live definition unverified. | Informational | None required to run; optional read-back of live volatility by a reviewer. |

**Impact on W5-05:** the gate row stays **PARTIAL**. S2 and S9 move from "not specified" to a precisely defined, source-confirmed, read-only test with no RPC blocker, but still carry no observed result. No AE1 count changes, no 7/13, no B1 decision.

## 7. Declarations

No production SQL, Supabase query, RPC call, browser automation, authenticated request, business-data write, feature-flag change, application-code edit, migration, test run, deployment, cache change, dependency install or C:/D: cleanup was performed. No secret, token, session file or screenshot was opened, copied or committed. Local D: access was read-only and limited to `report.json` metadata plus filenames and sizes. **WP05 remains OPEN; programme completion stays 6/13.**

## 8. Live read-only execution (8 November 2026)

Evidence for the owner's acceptance record. It is not sign-off and closes no work pack. Absolute cost values, user identifiers, hashes and session material are **not** in this document; the numbers are in a local report outside the repository.

### 8.1 Build and identity gates (both passed before any S2/S9 read)

| Gate | Result |
|---|---|
| Hosted build | `verify-served-assets.mjs` on `https://sasv-utilities-hub.netlify.app`: **VERIFIED [HOSTED], 72/72 Costing assets match**, served cache `hub-cache-v392`, bundle digest prefix `eee101ce729da672`. Two HTML files matched only after removing the documented `NETLIFY_INJECTED_BANNER_V1` comment. |
| Commit under test | Recorded as `fb535de9be9e39099e831fa34d4a023b2bcc532e` (`origin/main` at the run). **Caveat:** `5ed0d6dc` and `bc40689a` give an identical VERIFIED result because their Costing assets are byte-identical, so the deployed commit cannot be told apart from the assets alone. The evidence is bound to the served Costing bytes, not to a unique SHA. |
| Identity | ID-V session permission read: **six Costing view grants, zero edit grants, no other grants**; rows identical to the owner's canonical extract; **user hash agrees** with the extract. |
| Process note | The first canonical extract belonged to a different user than the signed-in account (rows identical, user hash different). The user-hash comparison is a step of the full acceptance runner; this work did **not** execute `acceptance-runner.mjs`. A bounded ad-hoc harness reused the runner's identity logic (`evaluateIdentity`) and re-implemented the same user-hash comparison, and it refused the pair. The owner then rebuilt the extract from the Auth account record with a SELECT-only procedure, the previous extract was kept as a protected backup, and the harness check passed on the rebuilt extract. No comparison was weakened. |

### 8.2 Method and guard

Periods Nov 2026 and Oct 2026; **all eleven `COSTING_*_V1` flags OFF** (browser overrides removed in every context). Every request went through the runner's request-classification logic (`classifyRequest`, reused by the bounded harness; the full acceptance runner was not executed): only REST GET on views and the read RPCs `get_user_permissions` and `rpc_get_cost_period_valuation_context` were issued; **no request was blocked and no write or non-read RPC was attempted**. Numbers were read through the app's own client from the documented views (the views the surfaces read, paged at 1000), and the surfaces were observed in a browser at 1280 px and 390 px. The SKU Control lens pages at 50 rows and shows no population total in its page text, so the lens population was taken from the same view read the lens performs. No individual SKU was clicked through in the UI. The full acceptance crawler was not run.

**Reproducibility limit.** The identity, S2 and S9 comparison scripts were temporary harnesses held outside the repository (not committed). The results here are therefore **not independently reproducible from the committed documentation alone**; they rest on the local evidence report and the method described above. An independent reviewer can re-derive them only by repeating the stated view reads (sections 1.1 and 8.2) with their own guarded session.

### 8.3 S2: Printable Cost Sheet vs SKU Cost Details (November 2026)

SKU choice: lowest SKU id in each control class. Redacted index only.

| SKU | Control class / status (control, detail, printable agree) | Run / valuation date / pack, printable vs detail | Internal Loaded Cost | Manufacturing COP | Total Material Cost | MRP: Inside Kerala | Result |
|---|---|---|---|---|---|---|---|
| S2-A | READY / READY | run 149 / 2026-11-02, identical | MATCH (delta 0) | MATCH (delta 0) | MATCH (delta 0; equals control view) | MATCH | **PASS** |
| S2-B | REVIEW_REQUIRED / REVIEW_REQUIRED | run 149 / 2026-11-02, identical | MATCH (delta 0) | MATCH (delta 0) | MATCH (delta 0; equals control view) | MATCH | **PASS** |
| S2-C | BLOCKER / BLOCKED (SKU 105, the only blocker in the population) | run 149 / 2026-11-02, identical | NOT COMPARABLE (NULL both sides) | NOT COMPARABLE (NULL both) | NOT COMPARABLE (NULL both) | MATCH | **PARTIAL** (status, run, valuation date and MRP agree; blocked costs are NULL by design) |

The composite-status caveat (finding P2) produced no difference: all three surfaces carried the same status word for each SKU. Printable scheme-policy resolution was `RESOLVED_POLICY` for S2-A and S2-B and `DEFAULT_NO_SCHEME` for S2-C. SKU 105 is confirmed BLOCKER at run 149.

### 8.4 S9-PARITY: CCC Dashboard vs SKU Control Status

| Period | Run / valuation date | Dashboard READY / REVIEW / BLOCKED / total | SKU Control READY / REVIEW_REQUIRED / BLOCKER / total | Result |
|---|---|---|---|---|
| November 2026 | draft run 149 / 2026-11-02 on both | 121 / 506 / 1 / 628 | 121 / 506 / 1 / 628 (628 distinct SKUs) | **PASS** |
| October 2026 | approved run 143 / 2026-10-22 on both (label: newer DRAFT run 148 not approved) | 627 / 0 / 0 / 627 | 627 / 0 / 0 / 627 (627 distinct SKUs) | **PASS** |

- The dashboard used the **control snapshot row** (present for both periods). The business KPI summary row was also present and equal, so no fallback substitution occurred (finding P4 resolved for these periods).
- Run 150 appeared nowhere. Run labels were identical on the dashboard and the SKU Control lens at both widths.
- The KPI strip at 1280 px and 390 px matched the data for both periods (Costing Readiness 121 / 628 and 627 / 627; Blocked 1 and 0; Review 506 and 0). No horizontal overflow on the dashboard, SKU Control lens, SKU Cost Details or Printable lens at either width.
- Population wording: 628 (Nov) and 627 (Oct) are run-scoped SKU control populations. They are not the 603 operational readiness population and were not equated with it. The 121 READY in section 2's historical figures is a coincidence of values across different populations, not evidence for either.

### 8.5 New observations (not S2/S9 failures)

| # | Observation | Severity | Next proof |
|---|---|---|---|
| L1 | The October dashboard strip shows **Selling Policy Coverage 628 / 627** (numerator above denominator); Scheme Policy Coverage shows 600 / 627 on the same basis. **Population-scope defect confirmed in the repository (live schema verification pending).** See 8.5.1. | Medium for historical periods (display / definition); none for S9 parity | Verify the live view definition and the November/October behaviour read-only; then a separately governed server-side correction (8.5.1). |
| L2 | The deployed commit is not uniquely identifiable from Costing assets (section 8.1). | Informational | Netlify deploy record, if a unique SHA is needed. |
| L3 | The SKU Control lens shows 50 rows per page without a visible population total. | Informational | None for this gate. |

#### 8.5.1 L1: Selling Policy / Scheme Policy coverage population scope (source analysis, 8 November 2026)

- **Numerators.** `selling_policy_complete_count` and `scheme_policy_complete_count` come from the `policy` CTE in `supabase/migrations/20261013183522_wp05_s1_kpi_view_rebuild.sql`, which counts rows of `public.v_costing_policy_manager_sku_overview`. Per migration `20260809071519` that view is the **latest-period projection** for the current successful governed run.
- **Denominator.** The dashboard denominator is `total_sku_count` from the control snapshot (the business KPI `total_pricing_sku_count` is the fallback), which belongs to the **selected period and costing run** (October: run 143, 627 SKUs).
- **Defect.** The final select of the view uses `CROSS JOIN policy p` with no period or run condition, so the latest-period policy population is attached to every period row. Observed: the numerators were identical in both periods (Selling Policy 628, Scheme Policy 600) while the denominators differed (628 in November, 627 in October). This is an **inconsistent population scope** (latest-period projection against a period- and run-scoped denominator). It is not evidence of a stale snapshot or a run mismatch.
- **Which figures are affected.** The Selling Policy Coverage and Scheme Policy Coverage cards, their review/ready colouring (driven by the `*_missing_count` values), the dashboard table row and the "Selling Price SKUs" figure in the key-value panel. **This record does not claim that the historical-period coverage KPIs are correct**; for any period other than the latest they should be treated as not period-scoped. November (the latest period) uses matching populations in the observed data (628 / 628 and 600 / 628) but was not independently checked beyond that.
- **S9 parity is not invalidated.** The S9 results in 8.4 compare Costing Readiness, Costing Review and Costing Blocked, which are read from the period- and run-scoped control snapshot and were matched against the SKU Control Status lens. L1 does not involve those fields and does not change the S9 PASS results. Source reading also shows no costing calculation or profitability result depends on these two policy counts (they feed display KPIs); that is a source reading, not a live check.
- **Pending.** The live view definition was **not** verified (repository migrations may lag the live schema), and whether the run snapshots carry per-run selling and scheme policy presence was not established. No SQL was run for this analysis.
- **Recommendation (not implemented).** A future, separately governed server-side correction should scope the `policy` CTE to the selected `period_start` and run from run-scoped snapshots instead of cross-joining the latest-period projection, after a read-only check of the live definition and snapshot columns. Until then, a UI-only mitigation could label these two cards as a current policy population (not period-scoped) for non-latest periods. Either change needs its own review and is outside this evidence PR.

### 8.6 Effect on the gate

Evidence only. The S2 and S9-PARITY rows now have observed results (S2 PASS on two SKUs and PARTIAL on the BLOCKER SKU; S9-PARITY PASS for two periods), bounded to one build and one view-only identity. WP05 remains **OPEN**; programme completion stays **6/13**; no count or B1 decision changes. Closure is the owner's act.

### 8.7 Declarations

No production SQL by this work (the owner separately ran a SELECT-only identity extract), no write, flag change, application-code edit, preview, save, refresh, approve, lock, deployment or permission change. No credential, token, UUID, hash or session content is in this document or the PR.

**Security cleanup status (8 November 2026).** The temporary session file was removed with **ordinary file deletion** (not a secure overwrite) and its absence was confirmed afterwards; its contents were never opened. **ID-V password rotation and session revocation remain pending** (owner action). Because a replayable refresh token may exist in recoverable bytes of the deleted file, rotation alone is not sufficient: existing sessions should also be revoked. The canonical extract, its protected backup and this evidence were preserved.
