# Costing preview — bulk Wave A/B/C handback (synthetic, branch-only)

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

## 5. Owner test checklist (6 Nov PC) — localhost only

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

_Filled after the workflow completes on the final head (see PR)._
