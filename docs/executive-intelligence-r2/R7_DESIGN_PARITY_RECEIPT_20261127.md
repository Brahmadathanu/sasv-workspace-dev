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
