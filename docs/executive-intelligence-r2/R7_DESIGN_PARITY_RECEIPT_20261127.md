# EI R7 — design-language parity receipt (client only)
Branch `fix/executive-intelligence-r7-design-parity`, from main `a9be99a`. Scope: `public/shared/executive-mis-dashboard.html` only (page-local CSS); no JS, SQL, permission, registry, shared stylesheet, service-worker or Electron source change. Visual evidence is **synthetic-fixture**; it is not genuine production browser acceptance.

## 1. Reference investigation (computed, 1280 px)
Canonical references: Stock Checker, Procurement Execution Console (PEC) and Cost Sheet Review (Costing Suite). Each module sets its tokens through its own `body.sasv-*` stylesheet over the shared `design-tokens.css`; there is no single shared module stylesheet, so the canonical language is the token set plus the values the three modules agree on.
| Element | Reference (SC = PEC = Cost Sheet) | EI before | EI after |
|---|---|---|---|
| Font family | Inter via `--sasv-font-sans` | `system-ui` (page-local stack) | Inter via the token |
| Module title | 18px / 600 / lh 22.5px / -0.01em / `--sasv-text` ink | 18px / **700 / accent colour** | identical |
| Subtitle | 13px / 400 / muted | 13px / 400 (system-ui) | identical |
| Table header | 12px / 600 / 0.02em / uppercase / muted on `--sasv-surface-soft` (SC) | **11px / 800** / no tracking | identical |
| Buttons | 13px / 600 | 13px / 400-600 mixed | 13px / 600 |
| Primary tab (PEC) | 13px / 600, accent fill, white text | 13px / 600 | identical (asserted) |
| Smallest text | 12px | **11px** in 8 places | 12px (token) |
| Weights | 400 / 600 (700 for key figures) | 650 / 700 / 750 / 800 | 600 labels, 700 figures |
| Ink / surfaces | `--sasv-text`, `--sasv-bg`, `--sasv-surface` | legacy `--text/--bg/--panel-bg` with literal fallbacks (`#0f172a`, `#f8fafc`), so ink rendered as the fallback | semantic tokens |
| Palette | semantic tokens | **26 literal colours** (`#2563eb` blue, amber, rgba shadows/overlays) | 0 literals (accent/warning tokens, `color-mix`, shared shadows) |
| Header rule | 1px divider under the header | none | `--sasv-divider` |
| HOME | shared component | already identical (R5) | unchanged |
| Native selects | inherit module font | Arial 16px | Inter 13px (16px kept for phone inputs: iOS focus-zoom floor) |

## 2. Resolutions
All of the above are in one `EI-R7 design-language parity` block plus the token substitutions in the existing rules. No figure, calculation, contract, RPC argument, route or layout structure changed. The 12px minimum raised some phone strips by a few pixels (Production value strip 298px, still below its pre-R5 304px); two R5 assertions were updated for that (12px badge minimum; 304px bound) with comments, nothing was removed.

## 3. Unavoidable differences (documented)
- Filter/search inputs are 13px (SC uses 14px) to keep the EI toolbar compact; phone inputs are 16px (iOS zoom floor), as on the other modules.
- Stock Checker's table header uses a centred layout; EI keeps left/right alignment for numeric columns.
- Each reference defines its card and chart language locally; EI's KPI and chart typography follows the shared tokens (12/13/14px, 600/700) rather than copying any one module's local classes.

## 4. Verification (synthetic fixtures; no genuine production acceptance claimed)
- New `executive-intelligence-r7-parity.test.mjs` (6 tests): computed title/subtitle equal to all three references, table header equal to Stock Checker, button equal to Cost Sheet Review, primary tab equal to PEC; zero hard-coded colours and no legacy fallbacks; every visible text element Inter, >=12px and <=700 across all lenses and six sales views at 1280 and 390; ink/background resolve from shared tokens; authorization (legacy Sales Viewer permission alone is denied and reads no EI data, executive granted, neither denied; client accepts only `module:executive-mis-dashboard` and contains no legacy permission string); keyboard order and no overflow at 320/390/520/768/1280/1440.
- Evidence: `r7-before/` (main) and `r7-after/` — 12 lens/sub-view screenshots at 390 and 1280 each; `r7-after/ref-*` side-by-side reference headers (Stock Checker, PEC, Cost Sheet Review, EI) at 390 and 1280.
- Service worker: R7 changes only the network-first page HTML; the module-local JS cache keys (`ei-r8-1` / `ei-r8=1`) are unchanged so no cache-first asset can be paired with stale HTML; no service-worker change was needed.

## 5. Integration and stable release (recorded after publication)
| Item | Result |
|---|---|
| PR | #546, all checks green (EI `reporting`, WP10 `wp10-offline`, `integrated-pec`); squash-merged into main as `6babbdd945ad36975bd0d133238ed3e41c79bbff` |
| Local regression on the PR head | 192/192 (186 prior + 6 new parity tests), 0 failed/skipped; the two git-base tests were run with `EI_PROTECTED_BASE`/`EI_R5_BASE=origin/main` (they are skipped on CI's shallow clone) |
| WP10 guard | `ei-approved-delta.mjs` pinned to the exact reviewed HTML blob `2080c2b5f8c130d85b683e46c1242e0b86fb0380`; `source.test.mjs` 15/15; no bypass |
| Version state before release | package/lock `6.6.0`; tags up to `v6.5.1`; no `v6.6.0` release or tag (REST ref check 404) |
| Release candidate | `electron-release-candidate.yml` run **45993005118**, event push, head `6babbdd9…` (= main), success; Electron smoke 25/25; installer SHA-256 read from the build log: `c19ebab1b7982db3a52eb94ad0ab0e74c89a2007c20797365de962f378734b1a` |
| Publication | `publish-sasv-release.yml` dispatched on main with version 6.6.0 / run 45993005118 / that SHA-256: run **45993646580** success (guarded draft → verify → promote; no manual upload, no safeguard bypass) |
| Published release | https://github.com/Brahmadathanu/sasv-workspace-dev/releases/tag/v6.6.0 — Latest, not draft, not prerelease, target `6babbdd9…`, tag points to the same commit |
| Assets (GitHub digests = build-log hashes) | installer `c19ebab1…4b1a`; ZIP `471759b2334db5d3fe45d75bbae58df699ceace97c6545595574eb294c508abc`; blockmap `a090bdb1bc2e14732387062a38d81bb0e9fdc3a1f340857325810c579d2e2e87`; `latest.yml` `9b5bd563…2869`; `SHA256SUMS.txt` `53457585…6828` |
| Updater availability | `https://github.com/Brahmadathanu/sasv-workspace-dev/releases/latest/download/latest.yml` serves `version: 6.6.0`, installer path/size 141528380 and sha512 `YtoL20lL…FH5A==`, byte-identical to the published asset. This proves the update feed offers 6.6.0 to existing installs; it does **not** prove installation at any workstation. |
| Hosted PWA | `sasv-utilities-hub.netlify.app` was not reachable from the build environment, so hosted deployment and the served page/service-worker were **not** verified here (the Netlify checks on PR #546 were green). To check: load the page, confirm `EI-R7 design-language parity` is in the served `executive-mis-dashboard.html`. |

## 6. Remaining limitations / next gates
- Visual parity is proven by computed-style tests and synthetic screenshots only; **genuine signed-in production browser acceptance by the owner is still outstanding** (desktop PWA, phone, installed Electron 6.6.0).
- No Windows installed-client run of the packaged 6.6.0 installer by a human; only the CI smoke/updater-compat tests.
- R6 final database retirement of Sales Viewer remains a separate ChatGPT-controlled activity after supported-client acceptance; no object was dropped and no permission or navigation data was touched. Five shared `v_sdv` views and cron17 untouched; G7 7/11 and G8/PWL unchanged.
