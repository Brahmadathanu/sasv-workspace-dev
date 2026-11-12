# PEC Phase A — Client visual, responsive and packaged-Electron acceptance (12 Nov 2026)

**Scope:** client-side browser/visual/Electron verification of the Phase A candidate (PR #347) and correction of confirmed client defects. **No merge, deploy, migration replay/repair, SQL, record change, permission change or credential use.** Tracking #284. Formal G0–G5 remain **0/6 verified**; nothing here advances a gate.

## 1. Identity of what was tested
| Item | Value |
|---|---|
| Base candidate | `origin/integration/pec-erp-staging-20261112` @ `dadbc72c` (PR #347, draft) |
| This branch | `claude/pec-phase-a-visual-acceptance` (draft PR, base = the integration branch so the diff is only this work) |
| Client code under test | `acdbec8d` — the only commit touching `public/shared/*`; every later commit adds tests/docs/evidence only |
| Visual run recorded at | `505d652b` (`evidence/pec-phase-a-claude-visual/report.json`) |
| Electron run recorded at | `acdbec8d` (`evidence/…/electron/electron-report.json`) |
| Environment | Linux VM (Firecracker), Node 22, Playwright Chromium headless shell; Electron 36.8.1 (linux-x64, **electron-builder `--linux dir`** from this branch) under Xvfb; jsPDF 2.5.1 + autotable 3.8.2 installed in a scratch dir (`PEC_JSPDF_ROOT`) and `pdftotext` for PDF text extraction |
| Data | **Synthetic fixtures only** (`scripts/lib/pec-fixture-stub.mjs` replaces `js/supabaseClient.js`; 250 indents, 230 PRs, 450 excess, 250 audit, 500–1500 vendor-wise rows). No real procurement data, accounts, tokens or personal information appear in any committed screenshot. |
| Not reachable | The Netlify deploy preview (`curl` → HTTP 000 from this environment): **no hosted-preview testing was possible**. |

## 2. Client defects found, root cause, fix, regression
Found by `pec-phase-a-visual-acceptance.mjs` layout invariants at 320/390 px (11 failing checks before the fix, 0 after).
| # | Defect (viewport) | Root cause | Fix (smallest) | Regression |
|---|---|---|---|---|
| 1 | Vendor-wise **export menu cut off the left edge** (320/390) | dropdown anchored `right:0` of a button that sits at the left after the pager wraps | `clampExportDropdownToViewport()` on open + `max-width: calc(100vw - 16px)` | narrow regression ✓ |
| 2 | **Pager row wrapped** — next arrow orphaned (320) | `flex-wrap` + 36 px buttons | ≤520 px: nowrap, 32 px buttons, 12 px muted text | ✓ |
| 3 | **Table cells crushed to single characters** (“VIte m 006 1”) | `overflow-wrap:anywhere` shrank min-content | `overflow-wrap: break-word` (word boundaries; table scrolls) | ✓ |
| 4 | **Indent/PR dialog title squeezed to ~40 px** wrapping per syllable (320/390) | title shares one non-wrapping flex row with 5–6 action buttons (inline styles) | ≤520 px: header row wraps, title block `flex: 1 1 100%` | ✓ |
Plus test-infrastructure: the Phase A static guard (`no supabase/ changes`, `sw.js untouched`) failed on the integration branch by design (it carries #317/#323/#342); it now reports an explicit **SKIP** there and is unchanged for client-only PRs.
Fast regression `scripts/pec-phase-a-narrow-regression.mjs` (320 and 390 px): **PASS 8/8 on this branch; 7/8 FAIL on the pre-fix tree** (`dadbc72c`), proving it discriminates.
**Observed, not fixed (cosmetic):** at 320 px the dialog's close “×” wraps onto its own row in the indent dialog.

## 3. Browser acceptance (fixture) — 124 PASS / 0 FAIL
`node scripts/pec-phase-a-visual-acceptance.mjs` → widths **320, 390, 820, 1440**; per width: five lenses, PR/Indents/Vendor-wise/Excess filter drawers, Vendor-wise export menu, Excess audit dialog, accept-excess dialog, draft indent dialog, vendor-selection dialog, Action Queue detail, paged-read **error** state, **empty** state, **view-only** and **no-access** fixtures. Each state is checked for: horizontal page overflow, controls outside the viewport, clipped text, overlapping controls (only the topmost dialog/drawer is compared), clipped table scrollers, dialogs fitting the viewport, correct pager totals, HOME/title with accessible name, JS errors. Screenshots (76 PNG, 7 MB): `evidence/pec-phase-a-claude-visual/<width>px-<NN>-<state>.png`, e.g. `320px-09-vwl-export-menu.png`, `390px-13-indent-modal-draft.png`, `820px-08-vwl-filter-drawer.png`, `1440px-03-vendor-wise.png`.
Paging, Jump to Indent (beyond page 1), vendor selection, operational grouping, CSV/TSV/PDF (>1000 rows), latest-wins and role fixtures are covered by the existing suites re-run below (e.g. `pec-paging-contract-smoke` 94 checks).

## 4. Packaged Electron — Linux unpacked build, fixture session
`node scripts/pec-electron-acceptance.mjs --app <linux-unpacked> --asar <@electron/asar>` → **33 PASS / 0 FAIL / 2 NOT TESTED**.
- **Same canonical source:** `app.asar` contains exactly three PEC files (`public/shared/procurement-execution-console.html`, `js/…js`, `css/sasv-…css`) and no other copy; all three are **byte-identical** to the repo; the packaged app's own Express server (`localhost:3000`, path `/public/shared/…`) serves the same bytes.
- **Real renderer:** the page ran in the packaged binary's Chromium (`Electron/36.8.1`) driven over the DevTools port; five lenses at 1200/820/480 px with no overflow and correct pagers; export menu inside the window; **CSV export** written (501 lines); **PDF export** with real jsPDF inside the packaged renderer (500 distinct items); HOME stays inside the app origin; no JS errors. Window resize used renderer viewport emulation (BrowserWindow bounds not exposed through this DevTools target) — stated in the report.
- **NOT TESTED:** authenticated roles in Electron (needs genuine sessions); Windows/macOS installers (only the Linux unpacked build exists here). **This is packaged-Electron fixture acceptance, not signed-in acceptance, and not the Windows NSIS build owners use.**
- **Observation for owner/ChatGPT (pre-existing, outside PEC, not changed):** `main.js` serves the *whole app directory* with `express.static(__dirname)` plus `Access-Control-Allow-Origin: *` on `localhost:3000`.

## 5. Genuine-session acceptance — NOT TESTED
`scripts/pec-phase-a-operator-browser-check.mjs` (syntax-checked here) is an interactive headed probe that needs a human to sign in personally in a TTY; no legitimate session, credentials or interactive terminal were available to me, and I did not fabricate JWTs, impersonate users, change permissions or use fixtures as security evidence. **PEC Editor, PEC View-only, no-PEC-access: NOT TESTED.** The fixture “view-only”/“no-access” results above prove the client UI gating logic only; server rejection of writes and zero data exposure remain unverified. Worksheet rows A01–A12 in `PEC_PHASE_A_REAL_SESSION_ACCEPTANCE_20261112.md` stay **NOT RUN** (A10: packaged Linux/Electron fixture evidence added above; Windows and real-account parts still open). A09 (installed PWA freshness) and A11 (real latency) are **NOT TESTED**; `pec-pwa-cache-freshness.test.mjs` (13/13) and `sw-freshness` (11/11) are unit-level only.

## 6. Full regression (final tree, `PEC_JSPDF_ROOT` set)
| Suite | Result |
|---|---|
| `pec-paging-contract-smoke` | 94 PASS (incl. real jsPDF PDF over 1500 rows) |
| `pec-erp-c1-layout-smoke` / `c2-vendor-selection` / `c1-five-lens-fasttrack` / `c1-static` | 118 / 53 / 23 / 15 PASS (static: supabase/sw guards SKIPPED on integration by design) |
| `pec-five-lens-inventory` | PASS (FAIL and FIX fatal; 3 unreachable modals DEFER) |
| `pec-phase-a-visual-acceptance` | 124 PASS / 0 FAIL |
| `pec-phase-a-narrow-regression` | 8 PASS (pre-fix: 7 FAIL) |
| `pec-vwl-search-reliability-smoke`, `pec-plm-pm-canonical`, `pec-resync-mode-contract`, `pec-wp01-indent-serial`, `pec-pr-scope`, `pec-pr-pdf-continuation-header` (runtime executed) | PASS |
| `pec-pwa-cache-freshness.test.mjs` / `pec-vwl-offset-export-integrity.test.mjs` / `fg-bit-ux-1/sw-freshness.test.mjs` | 13 / 6 / 11 pass, 0 fail |
| `pec-electron-acceptance` | 33 PASS / 0 FAIL / 2 NOT TESTED (needs `--app/--asar`; excluded from the generic loop) |

## 7. Changed files (this PR vs the integration branch)
`public/shared/js/procurement-execution-console.js` (export-menu clamp), `public/shared/css/sasv-procurement-execution-console.css` (narrow rules), `scripts/lib/pec-fixture-stub.mjs` (extracted from the paging smoke; adds lines/empty/no-access support), `scripts/pec-phase-a-visual-acceptance.mjs`, `scripts/pec-phase-a-narrow-regression.mjs`, `scripts/pec-electron-acceptance.mjs`, `scripts/pec-paging-contract-smoke.mjs` (imports the shared stub), `scripts/pec-erp-c1-static-smoke.mjs`, this document and `evidence/pec-phase-a-claude-visual/`. **No** `supabase/`, `public/sw.js`, package/version or unrelated module changes.

## 8. Remaining blockers (owner / ChatGPT)
Genuine Editor, View-only and no-access sessions (operator must sign in personally; A01–A08); installed-PWA freshness (A09); Windows packaged build and signed-in Electron (A10); measured real latency (A11); ordered merge/deploy authorisation and history-only migration repair (A12) — all outside this work.

## 12 Nov — Independent review correction: protected SQL/SW CI guards

The independent ChatGPT review identified that the original static check skipped SQL/SW protections on **all integration-descendant branches**, rather than exempting only reviewed changes inherited from the integration base. This could conceal new accidental production migration or SW changes in a client-only PR. Corrected directly on draft PR #365 without touching `supabase/` or `public/sw.js`:

- `scripts/lib/pec-protected-path-guard.mjs` permits the precise ten known PEC migration paths plus `public/sw.js` **only on the integration candidate itself**; a descendant client PR has no protected-file exemptions.
- `scripts/pec-erp-c1-static-smoke.mjs` now compares **current PR HEAD against its explicit base tree**, plus staged/unstaged/untracked changes, and fails closed when the base ref is absent. The protected-path guard executes regardless of whether the historical main client JS can be read.
- CI fetches the PR's exact base-tree ref in shallow checkout and runs nine policy cases plus a full static-guard mutation test. The latter creates a temporary untracked SQL migration file and temporarily modifies `public/sw.js`, asserts both are rejected, and restores the working tree; no SQL execution, deployment, or committed migration/SW change occurs.
- Source commits: `6147b001` (policy), `410736ff` (static checker), `c7f5bd2a` (policy tests), `9e572a65` (base fetch), `afe0e420` (real mutation test), `9958d5a9` (CI wiring). 

**CI evidence:** GitHub Actions workflow `PEC Integrated Browser Acceptance`, run `43253246433`, reached and **passed** both the exact-base fetch and policy tests as well as the end-to-end temporary-mutation rejection step. The remaining browser suites must finish before final exact-head CI can be called PASS; do not infer that from this partial step result. The separate Vendor-wise Offset Export workflow is also running. No genuine operator-role acceptance has been performed; formal G0–G5 remains 0/6.
