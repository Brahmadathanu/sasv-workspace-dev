> **Independent design hardening — 4 Nov 2026, after A7 #146 merge:** CDE-1a may proceed as a **mock-only client implementation draft PR**, not production data access, feature activation or release. Until CDE-2 is approved, production must show **"Draft-run component evidence unavailable — provider not connected" / UNKNOWN**, not fixture values or READY. Preserve the existing **"Row drawer evidence is not this run's evidence"** warning for *all governed-run-pinned fields not covered by an identity-verified provider*; narrow it only for covered component fields. `selected-not-approved` must be cross-validated against the server-advertised permitted runs for that period (never arbitrary URL/typed run IDs). Never fetch monetary evidence and then hide it client-side: CDE-2 must suppress monetary columns at the server boundary. New `main` after A7 is `195b13c4df32a5fdcf22ee304066e96c1b138481`. Mock fixtures only in tests, no production adapter. This addendum overrides any conflicting statement below.

# CDE-1 — Draft-run component evidence panel: mock-backed UI design — 4 Nov 2026

Status: **design only. No code, no RPC, no server object, no flag change.** Implements the client side of the gate in `CLIENT_DRAFT_RUN_EVIDENCE_IMPLEMENTATION_GATE_2026-11-03.md` (PR #142). Baseline `main` `cf26ae5`. Nothing below may be coded against production until the owner approves a protected read contract (CDE-2). Until then the only permitted build is a mock-only panel behind an injected provider.

## 1. Where it lives (existing surfaces only)
| Item | Fact (current main) |
|---|---|
| Host | the existing SKU Control Status row drawer, inside the Review Worklist (`COSTING_REVIEW_WORKLIST_V1`, default OFF). No new tab/module/lens. |
| Today | when a non-default run is selected, `renderReviewWorklistRunDiagnosisHtml` (`costing-review-worklist.js` ≈L494) states **"Row drawer evidence is not this run's evidence."** The drawer's material evidence comes from a governed-run-pinned view. |
| Change | add one collapsed section **"Draft run component evidence"** to the drawer, shown only while the selected run is a non-approved server-advertised run (`selected-not-approved`), replacing the generic warning for the components it covers. |
| Pure code | new pure functions (state → HTML) in `costing-review-worklist.js` (the single writer); drawer mounting where `renderReviewWorklistDrawerGroupHtml` is mounted (`costing-suite-shell.js` ≈L6071). OFF path byte-identical (asserted by existing OFF-parity tests). |

## 2. Provider interface (the only data seam)
The panel never touches `costing.*`, `costingFrom`, or a named RPC. It receives an injected provider:

```js
// shape only — the real implementation is CDE-2/owner-approved and is NOT part of this design
provider.readSkuEvidence({ periodStart, runId, skuId, signal })
  -> Promise<{ status: "ok" | "empty" | "forbidden" | "error" | "foreign-run" | "stale",
               record?: DraftRunComponentEvidence, error?: string }>
```
`DraftRunComponentEvidence` (field names illustrative; **must be verified against the approved live contract**):

| Group | Fields |
|---|---|
| Identity | `period_start, refresh_run_id, valuation_date, sku_id, product_name, evidence_source_run_id, refreshed_at` |
| Material | `material_costing_status` (+ reason) |
| Direct labour | `direct_labour_allocation_status, allocation_reason_code, allocation_basis_status, allocation_resolution_status, allocation_resolution_note, direct_labour_component_model_code` |
| Conversion | `internal_material_conversion_status` |
| Regional Marketing | per region IK/OK: `regional_basis_source, regional_basis_status, marketing_expense_allocation_status, note` |
| Control | `first_control_status, control_severity` |

Rules: **no monetary figures** (the existing regional queue RPC returns marketing sales value and per-SKU cost — keep those out unless the owner explicitly approves); request is for one `(period, run, sku)`; the client sends the id of a run the server advertised in the run picker, never URL/typed input; the response must echo `period_start`/`refresh_run_id`/`sku_id` and the client rejects any mismatch (`foreign-run`).

## 3. States (never default to READY)
| State | Panel shows |
|---|---|
| not requested | collapsed header + "Load draft evidence" button (explicit click; no auto-fetch for 114 rows) |
| loading | `role=status` "Loading draft-run evidence for run 148…"; late answers discarded (same latest-only pattern as `createLatestOnlyLoader`/`ROWS_LOAD_GENERATION`) |
| ok | grouped table below + banner **"Draft run 148 · not for pricing"** and "Frozen at {refreshed_at}; not current master data" |
| empty | "No component evidence was returned for this SKU in run 148." Component statuses render as **UNKNOWN**, not READY |
| forbidden | "You don't have permission to read Control Centre evidence." |
| error | message + Retry; row table/drawer unaffected |
| foreign-run / stale | refuse to render; "Evidence belongs to another run/period. Reload." |

## 4. Layout (ok state)
```
Draft run 148 · not for pricing            Frozen 2026-11-01 02:00 · valuation 2026-10-31
┌ Component ──────────────┬ Status ─────────┬ Why (server code → label) ────────────────┬ Fix here (existing screen) ┐
│ Material                │ Ready           │ —                                          │ —                          │
│ Direct labour           │ Review required │ Direct-labour component foundation         │ Production Route Manager ›  │
│                         │                 │ Allocation basis: OK / No SKU sales /      │ Driver Governance ›         │
│                         │                 │ No product sales in lookback               │ Commercial Sales Assump. ›  │
│ Internal conversion     │ Ready           │ —                                          │ —                          │
│ Regional Marketing  IK  │ Ready           │ Regional actual units                      │ —                          │
│ Regional Marketing  OK  │ Review required │ Region-scaled common basis (no regional    │ Commercial Sales Assump. ›  │
│                         │                 │ actual units or governed assumption)       │                            │
└─────────────────────────┴─────────────────┴────────────────────────────────────────────┴────────────────────────────┘
This is a frozen review of run 148, not an approval. Fixing the cause creates evidence only in a NEW refresh run.
```
- Status words use existing label helpers (`costingStatusDisplayLabel`; sentence case when `COSTING_UX_CONSISTENCY_V1`, as U11). Raw codes in a `title`/small code span; unknown codes shown verbatim.
- "Fix here" links reuse the existing `resolveRecommendedUiRouteTarget`/nav-context helpers and carry the governed period only (never the draft run id into pricing/master screens). Production Route Manager and Driver Governance already exist; Commercial Sales Assumptions is a Pricing Policy Manager workspace.
- **No accept/approve button anywhere in this panel.** Regional acceptance is CDE-3 (separate). Material acceptance stays in Material Cost Manager (A7 covers it).
- Accessibility: section is a `<details>`/button-controlled region with `aria-expanded`; table has caption and scope headers; status not by colour alone; works at 360 px (stack rows as definition lists).
- Escape every server string (reuse the worklist's `escapeHtml`).

## 5. Worklist-level addition (optional, same contract)
A read-only **cause summary** above the groups for run 148 ("109 direct-labour foundation · 52 basis OK · 32 no SKU sales · 25 no product sales · 1 conversion · 1 regional Marketing (OK)") needs a **bulk** read of the same record for the run's 114 non-ready SKUs. This is a larger contract (strict batch limit, pagination) and is deferred behind per-SKU evidence; counts must come from loaded rows, never hard-coded.

## 6. Mock harness (what can be built now)
- Fixtures in the test directory only: SKU A (direct labour, basis OK), SKU B (NO_SKU_SALES_IN_LOOKBACK), SKU C (NO_PRODUCT_SALES_IN_LOOKBACK), SKU D (conversion-only review), SKU 41 (IK Ready / OK region-scaled), SKU 105 (blocked, PM rate as-of run), plus `empty`, `forbidden`, `error`, `foreign-run`, `stale`, slow/late responses.
- Provider is a stub object; a test asserts the panel module imports no supabase client, no `costingFrom`/`costingRpc`, contains no `costing.` table string and no `.rpc(`.
- Package split: **CDE-1a (mock-only, safe now after owner OKs the design):** pure render functions + loader-state machine + tests; provider injected but unwired (no production caller). **CDE-1b (after CDE-2 approved + read-back verified):** wire the real provider.

## 7. Test plan (checked in with CDE-1a)
1. Identity: request carries exactly `(period, run, sku)` of the selected drawer row; run must be server-advertised.
2. Response identity echo mismatch → `foreign-run`, nothing rendered; 143 never rendered under 148 label and vice versa.
3. Grouping: 110 prime fixtures → 109 direct-labour (52/32/25 split rendered from codes) + 1 conversion; counts derive from fixtures.
4. SKU 41: IK Ready, OK Review required with region-scaled wording; SKU 105 shows missing-rate cause only if the contract provides it, else UNKNOWN (no inference).
5. States: loading/late-answer discard, empty→UNKNOWN (never READY), forbidden, error+retry, double-click single request.
6. Sanitisation: HTML in notes/names escaped.
7. Safety: no mutation call exists in the module; no button names matching accept/approve; OFF-parity (flag OFF → drawer HTML byte-identical, provider never called); default-OFF flags untouched; U11 label ON/OFF variants.
8. Chromium: mount in the worklist drawer with stub provider; keyboard toggle, 360 px and 1280 px, no horizontal overflow.
9. Full LF + CRLF suite + Chromium, 0 skipped.

## 8. Contract blockers (genuine)
| ID | Blocker | Needed from |
|---|---|---|
| B-1 | No approved read contract: preferred = one run-specific read-only RPC or `security_invoker` view for one `(period, run, sku)`; CCC-view permission; run must belong to period and be a permitted display/review run; strict batch limits. Field names above are unverified. | Owner approval + server owner (CDE-2) |
| B-2 | `costing.*` base tables must not be exposed to the browser (RLS/ACL state: DL snapshot RLS+SELECT grant not Data-API assumed; prime snapshot no authenticated SELECT; regional snapshot no RLS/no SELECT). | CDE-2 design review |
| B-3 | Existing `rpc_get_regional_marketing_evidence_review_queue` (CCC view, 1–200 SKU ids) could supply the regional rows read-only today, but returns monetary columns; owner must decide whether to consume it (and strip money client-side is **not** an acceptable control) or wait for the minimal contract. | Owner |
| B-4 | SKU 105: whether the contract can state the as-run missing-PM-rate cause or only the status. | CDE-2 |
| B-5 | CDE-3 regional acceptance write (existing `rpc_accept_regional_marketing_review`) is a separate owner-approved action; not in this panel. | Owner |

No server object, SQL, grant, flag or write is proposed by this document.
