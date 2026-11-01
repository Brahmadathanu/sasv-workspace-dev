# C1 — Review worklist run context: owner walkthrough (1 Nov 2026)

Client-only, read-only. Ships behind the existing flag `COSTING_REVIEW_WORKLIST_V1` (default OFF). No server change, no new flag, no cache bump in the draft.

## 1. What the browser can and cannot read today

| Data | Browser source (authorised) | Run-scoped? | Run 148 visible? |
|---|---|---|---|
| SKU control rows (status, server codes, `control_note`, run id, valuation date) | `v_costing_pricing_sku_control_status_snapshot` (permission `module:costing-control-center` view) | **No.** The view joins `costing.v_current_successful_costing_refresh_run`: one governed run per month (approved first, else latest success). A `refresh_run_id` filter can only narrow that run. | **No.** October returns approved run 143 only. |
| Period run status (shown run, approved run, newer draft run, active run, server label) | `v_costing_pricing_period_run_status` (same permission; already read by the run-status badge) | Per month | **Yes, as ids/labels only** (`newer_draft_run_id = 148`, label "Approved run 143 (newer DRAFT run 148 - not approved)"). |

So the worklist can say exactly which run it shows and that draft 148 exists, but it cannot list 148's blocked/review SKUs.

## 2. Turning it on and off (per browser)

- On: browser console on a costing page → `localStorage.setItem("COSTING_REVIEW_WORKLIST_V1", "1")`, reload.
- Off (rollback): `localStorage.removeItem("COSTING_REVIEW_WORKLIST_V1")`, reload. Nothing else changes; with the flag off the screen is identical to main.
- Optional: `COSTING_TABLE_TOOLS_V1 = "1"` adds column sort and the formula-safe CSV on the same table.
- Do **not** turn on `COSTING_LOCK_SCREEN_V1` for an open month before CI-049 is approved.

## 3. Opening October 2026

1. Costing Control Center → SKU Control Status. Choose period **2026-10**.
2. The worklist panel shows:
   - "Run shown: 143 · valuation …" (raw values from the loaded rows);
   - "Server run status: Approved run 143 (newer DRAFT run 148 - not approved) [APPROVED_NEWER_DRAFT]" (server text, verbatim);
   - "These rows are from approved run 143.";
   - "Newer draft run 148 exists … Its SKU rows cannot be shown here …";
   - "Loaded rows (run 143): N — BLOCKER … · REVIEW_REQUIRED … · READY …" (counts of what was loaded, raw codes).
3. Expected today: 143 has no blocked/review SKUs, so the group list says "No blocked or review SKUs in the run shown for this period." This is correct for run 143 and says nothing about run 148.

## 4. Inspecting 143 versus 148

- 143: as above, fully visible.
- 148: only its existence and status are visible. Its 514 ready / 113 review / 1 blocked SKUs (server check, 1 Nov) need the read contract in section 7. Until then, use the separate run-status/approval screens (their own flags) for run-level facts; do not expect SKU rows.

## 5. Opening a blocked SKU and its fix screen (when the run shown has one)

1. In the worklist, "Show in table" on the BLOCKER group narrows the existing table to that group.
2. Click the row: the existing drawer opens with the server `control_note` and, where a route is mapped, a button labelled with the resolver's target (for example "Open Production Route Manager").
3. "Open fix screen" on a group (or that drawer button) uses the existing resolver; the period (`periodStart`) is carried to the target. MATERIAL_RATE_MANAGER opens Material Cost Manager › action queue when the row has blocking lines; MATERIAL_RATE_REVIEW opens the Control Centre review workbench; COST_REVIEW_WORKBENCH has no mapped screen yet.
4. Fix screens show **current** source data. Fixes do not change the frozen run; they count only after a separate, approved recalculation.

## 6. States you may see in the run-context block

Loading · approved · not approved (draft or reference run shown) · mismatch (rows from run A, server now shows run B: reload) · mixed runs / other period (should not happen; reload) · active run in progress · status read error (list still shown; the run's current designation is reported as not verified, and the rows keep their stored run id) · no status row (no run or no permission) · no SKU rows at all (no run or no permission).

## 7. Backend blocker and proposed read contract (NOT implemented; pending owner approval, after the October finalise)

Proposed `public.v_costing_pricing_sku_control_status_by_run` (read-only view, `security_invoker = true`):

- **Inputs:** filtered by the client with `period_start` and `refresh_run_id` (both required by the screen).
- **Source:** `costing.sku_costing_control_status_snapshot` joined to `costing.costing_refresh_run` on `refresh_run_id` (+ the same direct-labour left join as the current view so codes match), restricted to `overall_status = 'SUCCESS'` and `valuation_context_source = 'CAPTURED_AT_REQUEST'`.
- **Fields:** the current view's columns unchanged, plus `run_overall_status`, `run_designation` (from `costing.v_costing_run_effective_designation`), `is_displayed_run` (equals the governed run of the month).
- **Row-level authorisation:** same predicate as today (`current_user in (service_role, postgres) or app_has_permission('module:costing-control-center','view')`); `grant select … to authenticated, service_role` only; no costing-schema exposure.
- **Frozen semantics:** values are the run's stored snapshot; never recomputed; approved/historical runs read-only by construction.
- **Indexes:** confirm an index on `sku_costing_control_status_snapshot (refresh_run_id, period_start)` (or equivalent) before release.
- **Error/empty cases:** unknown run or failed run → zero rows; no permission → zero rows (same as today); the client then shows its "no rows" text.
- **Client follow-up (separate PR):** a run selector limited to `displayed_run_id`, `approved_run_id`, `newer_draft_run_id` from the period status view, feeding the existing load path, grouping, table, drawer and links.

## 8. Cache and coordination

The draft does not touch `public/sw.js` or any pin. Before merge, the cache must move to the next free number (v388 per the 1 Nov state, after confirming no other branch reserved it), Jarvis must be told first, and the current `hub-cache-v387` pin sites updated (see the PR body for the list).

---

## C1B addendum — read-only run selector (stacked on C1; same flag)

The owner has since deployed `public.v_costing_pricing_sku_control_status_by_run` (SELECT-only for `authenticated`, `service_role`; `security_invoker = true`; same 40 columns as the snapshot view). C1B uses it read-only. The governed snapshot view is unchanged and still drives the default screen. Browser JWT tests (permitted and denied user) are **still to be done by the owner** in a real browser.

**What C1B adds (flag `COSTING_REVIEW_WORKLIST_V1` only):**
- A **Run** selector in the worklist, listing only the runs the server advertises for the month in the period run-status view: `displayed_run_id`, `approved_run_id`, `newer_draft_run_id` (deduplicated). No other id is accepted (not from the URL, not typed).
- Default = the displayed run (October: 143, "Approved — displayed for this period"; an approved run is labelled for its own period only, never as the current pricing basis). Choosing 148 ("Draft — not for pricing") reads the run-scoped view with **both** `period_start` and `refresh_run_id`, pages through all rows, checks that every row belongs to that period and run, and then feeds the same worklist groups, table, drawer and fix links.
- While 148 is shown: a prominent "Draft run 148 — not for pricing" notice, the loaded counts by severity and the groups by server `first_control_status` (from the rows actually returned; nothing hard-coded). Valuation date only from the loaded rows.
- Switching back to 143 restores the governed rows (no extra read). Period change, reload or lens switch always return to the displayed run; late answers are discarded (`ROWS_LOAD_GENERATION`).
- Empty answer (no permission or no rows), failed read and rows of another run are reported; the table keeps the previous run.

**Owner steps (browser):**
1. Enable: `localStorage.setItem("COSTING_REVIEW_WORKLIST_V1", "1")`, reload. Disable (rollback): `localStorage.removeItem("COSTING_REVIEW_WORKLIST_V1")`, reload.
2. SKU Control Status → period 2026-10 → worklist shows Run = "Run 143 — Approved — displayed for this period".
3. Choose "Run 148 — Draft — not for pricing". Expect the draft notice, "Run shown: 148 · valuation 2026-10-31", and groups from the live rows (preflight: 1 MATERIAL_COST_BLOCKED, 110 PRIME_COST_REVIEW_REQUIRED, 2 MATERIAL_REVIEW_REQUIRED, 1 PRICING_BRIDGE_REVIEW_REQUIRED; live data may differ and is what is shown).
4. Blocked SKU: "Show in table" on the BLOCKER group → open the row (drawer) → "Open fix screen" (Material Cost Manager › action queue, same period). Prime-cost and pricing-bridge groups show the honest "no dedicated screen link yet" text (COST_REVIEW_WORKBENCH unmapped).
5. Choose 143 again → back to the approved run. Change period → selector resets to that month's displayed run.
6. Repeat step 3 as a user **without** Control Centre view permission: expect "No SKU rows were returned for run 148 …" and no SKU results.

**Known limits (open points):**
- **Drawer evidence is not draft evidence.** The SKU drawer's per-line material evidence comes from `v_costing_pricing_material_action_drilldown_snapshot`, which is pinned to the displayed (governed) run of the period; it cannot represent draft 148's evidence (it may be empty or missing). The drawer's "current source diagnosis" is today's data, not the frozen run. While a non-default run is shown, the worklist states this as a warning line ("Row drawer evidence is not this run's evidence."). A run-scoped evidence view would be a separate, owner-approved backend item.
- COST_REVIEW_WORKBENCH remains unmapped (no fix link for 111 of the 114 draft review/blocked SKUs).
- The cause split of the 110 prime-cost reviews still needs its own read contract.
