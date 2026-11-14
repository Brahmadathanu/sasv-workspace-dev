# PEC Phase A R2c — Vendor-wise full-screen detail, filter-sheet focus/typography, Action→Excess load failure (13 Nov 2026)

Issue #377 (parent #284 / R2b acceptance #375). Client only (`public/shared/*`). No SQL, migrations, grants, `public/sw.js`, Electron versions or procurement records; #374 stays separate. **Fixture evidence only. Owner mobile acceptance (R2b and R2c): NOT YET PASSED.**
Base `integration/pec-erp-staging-20261112` @ `b192baf0` (R2b merged).

## 1. Vendor-wise row detail
- Owner decision implemented: the footer (`1 indent line · … Kg`) and the bottom Close are **removed** (also from the Acceptance Audit, for consistency). The header × is the single Close; Escape still closes.
- Phones (≤640px): every `.pec-detail--panel` is a **full-screen** detail (100dvh, no dimmed list visible). The body sits on a neutral canvas (`--sasv-surface-soft`), content top-aligned, long lists scroll inside the body. Quantities (`Total Qty to Buy` in the header, per-line qty/rate/amount), the split-vendor notice and the line cards are unchanged. ≥641px stays a centred panel.
- Dead code removed: `.pec-detail-foot*` CSS, `wireDetailFooterClose`, `#vwlBdSummary` / `#eAuditFootText` markup and JS.

## 2. Filter sheets
- **Root cause (confirmed):** on open, `openFloatingFilterDrawer` focused the first `select/input` (or the trigger's `focusId`, a select). iOS opens a focused native select picker at once. Now on a sheet the **heading (`tabindex=-1`) takes focus**; no data control is ever focused on open. Desktop popovers still focus the first field. Escape / Done / Close return focus to the trigger; Shift+Tab from the heading wraps inside the sheet; scroll lock released on close.
- **Typography:** one scale for all seven panels (five lenses + PR/Indent line filters): labels 12px/600 (legacy uppercase 11px removed), controls 16px on phones (iOS no-zoom floor; deliberate, not oversized by accident) / 13px popover, 36px / 32px control height, section gap 10px, checkbox label 13px, tokens only. Computed-style assertions prove all seven share one scale at 320/390.
- Not testable headless: whether a real iOS picker opens. Asserted instead: `document.activeElement` is the heading and never SELECT/INPUT/TEXTAREA. **Needs the owner's iPhone.**

## 3. Intermittent Action Queue → Excess failure — honest status
**Not reproduced; not claimed fixed.** Inspection + 8 deterministic scenarios (delayed AQ search→clear→switch; 6× rapid AQ⇄Excess switching with overlapping slow requests; stale slow Excess superseded by a search; transient network error; persistent 503; 401; AQ failure; empty result) found **no coupling**: AQ and Excess use independent request generations, abort controllers, loading depths and panels; superseded requests are aborted and dropped; no stuck mask or busy flag. What was wrong, and is fixed:
- Any single failed Excess request (network drop / backgrounded iOS tab / expired JWT / 5xx) showed *“Change the search or filters, or reopen this tab, to retry.”* — blaming an empty search — with no retry. This is the most plausible match for the owner's one-off, but the actual trigger on the device is unknown.
- `rpcPecPaged` now classifies failures (`abort | network | auth | server | client`) and attaches sanitized diagnostics (request id, RPC, HTTP status, code, message — tokens/bearer/apikey/JWTs stripped). Feeds make **one** automatic retry for transient kinds (network/5xx/unexpected abort), never for auth/4xx; superseded requests are never retried. Then an honest, kind-specific error state with diagnostics line and a **Retry** button (PR, Indents, Excess, Action Queue, Vendor-wise). Genuine empty results keep the filter message.
- Load-failure **toasts used the raw server message**; they now use the sanitized one (found by the credential test).
- Server contract unchanged; no timeouts increased.

## Extra defects found (not in #377)
- The × clear buttons in the search fields **never appeared in any lens** (two `style.display = ""` resets fell back to the stylesheet's `display:none`) — fixed (`"flex"`); this also lets the race test clear Action Queue search like a user.
- Shared fixture failures lacked an HTTP status; they now carry 400 / are scripted via `S.fail`, `S.delay`, `S.delayQ`; the stub now simulates abort (an aborted request resolves with an AbortError).

## Evidence
`docs/procurement-execution/evidence/pec-r2c/before` (integration `b192baf0`) vs `after` — 320/390/820/1440; `detail-vwl-short` / `detail-vwl-long`, filter sheets for all lenses, `metrics.json` (e.g. 390px short Vendor-wise modal 216px → 800px full screen). Full acceptance set: `…/visual-acceptance/`.

## Tests (this environment, Node 22 + Chromium; synthetic stub — not genuine-session acceptance)
| Suite | Result |
|---|---|
| `pec-r2c-ui-smoke` (new) | **263 PASS / 0 FAIL** |
| `pec-r2b-ui-smoke` (updated: no footer, full-screen) | 390 PASS / 0 FAIL |
| `pec-phase-a-visual-acceptance` | 164 PASS / 0 FAIL |
| `pec-r2-ui-smoke` 80 · `pec-paging-contract-smoke` 128 · `c2-vendor-selection` 53 · `c1-five-lens-fasttrack` 23 · `c1-static` 17 · `narrow-regression` 8 · `vwl-search-reliability` 39 | PASS, 0 FAIL |
| `pec-erp-c1-layout-smoke` | PASS (re-run after its fixture failure gained an HTTP status) |
| `pwa-cache-freshness` 13 · `vwl-offset-export-integrity` 6 · `protected-path-guard` 1 | pass, 0 fail |
| five-lens-inventory, plm-pm-canonical, wp01-indent-serial, pr-scope, resync-mode (3/3), pr-pdf-continuation-header | exit 0 (own output format) |
Existing assertions changed (intent kept): paged-failure fixtures now carry HTTP 400 (so the new automatic retry does not mask the error state), the second-page-failure fixture fails twice (request + its retry) to reach the Retry UI, Vendor-wise assertions describe the full-screen detail.
**NOT TESTED:** a real iPhone (native select picker, keyboard, landscape), genuine Editor/View-only/no-access sessions, hosted preview, packaged Electron (no electron-builder here; static single-source parity only), the owner's actual intermittent failure.

## Owner checklist (iPhone)
- [ ] Vendor-wise: short (1 line) and long lists are full-screen, no bottom total/Close, nothing dimmed below
- [ ] Opening any filter sheet (all five lenses and PR/Indent line filters) does **not** pop a picker; text sizes look consistent
- [ ] Search × buttons now appear
- [ ] Repeat Action Queue type→clear→Excess; if a load error recurs, send the diagnostics line (RPC · HTTP · code · req id)
