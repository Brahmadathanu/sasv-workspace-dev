# FG-BIT-UX-1 — FG Bulk Internal Transfer UI/UX modernization

Client-only. Base `origin/main` = `b9915b82d6ab818e9f66eb2ab95ca36d08b55bd6`. Branch `feat/fg-bit-ux-1-modernization`.
Not merged, not deployed. No server, Supabase, `public/sw.js`, shared CSS/JS or Electron changes.

## Files
| File | Change |
|---|---|
| `fg-bulk-internal-transfer.html` | theme attr, body scope class, inline `<style>` and style attrs removed, semantic regions/ARIA, canonical Home markup, shared `.btn` buttons, footer reordered (Reset / Cancel / Submit), all IDs kept |
| `public/shared/css/sasv-fg-bulk-internal-transfer.css` | new, scoped to `body.sasv-fg-bit`, tokens only |
| `public/shared/js/fg-bulk-internal-transfer.js` | `mountModuleHome`/close icon, modal lifecycle (focus, trap, inert, restore), row keyboard activation, busy guards. No RPC/date/qty/state-machine change |
| `scripts/fg-bit-ux-1/*` | static + mocked-browser tests, fake Supabase, evidence capture script |
| `docs/fg-bit-ux-1/*` | this record + screenshots |

## Audit findings → fixes
| # | Finding (verified on base by rendering) | Fix |
|---|---|---|
| 1 | No `data-sasv-theme`; Arial, 32px h1, hardcoded colours | theme attr + Inter tokens; h1 18px/600 (matches Manage Activities computed values) |
| 2 | Bespoke orange `#homeBtn` with `!important` | `sasv-home-btn` + `mountModuleHome`; target `index.html` unchanged |
| 3 | Modal 240px/1fr/230px grid, 900px collapse; overlay, body and card bodies each scrollable | 3-col (>1000px) → 2-col (≤1000) → 1-col (≤760); `.modal-body` is the only scroll owner; overlay hidden, cards visible |
| 4 | Footer `position: sticky` inside scroller at ≤520px; message inline with buttons | modal is a grid (header / body / footer); footer never overlaps body; message is full-width row above actions; safe-area insets |
| 5 | `setTimeout(...,60)` focus; no focus restore; no trap | immediate focus on date; Tab/Shift+Tab trap; background `inert`; focus returns to originating row, else the source list region |
| 6 | Rows are mouse-only | `tabindex=0`, Enter/Space |
| 7 | Esc/backdrop/X could close mid-post (Cancel/Reset were disabled, close paths were not) | user close paths ignored while posting; `submitTransfer` returns if already posting |
| 8 | Messages not announced | `role=status`/`aria-live`; errors `role=alert` |
| 9 | Inline hex in JS-rendered summary | class `sum-val-sub` |
| 10 | 100vh body | `100dvh` with `100vh` fallback; flex-fill chain kept |

## Design parity (computed, 1440px — `evidence/after-metrics.json`)
| Property | Before | After | Manage Activities ref |
|---|---|---|---|
| font | Arial | Inter stack | Inter stack |
| h1 | 32px/700 teal | 18px/600 text | 18px/600 text |
| Home bg / fg / radius / size / weight | orange / brown / 6 / 14 / 500 | `rgb(213,239,233)` / `rgb(13,77,70)` / 6 / 13 / 600 | identical |
| search bg / height | `#e8f2fd` / 34px | `rgb(238,248,246)` / 36px | token `--sasv-search-select-bg` / 36px |

## Tests (Node 22.23.4, Playwright Chromium, Linux, in-memory fake, no network)
```
node --test scripts/fg-bit-ux-1/*.test.mjs        # 34 pass / 0 fail / 0 skipped (7 static + 27 browser)
node --test scripts/manage-activities/static.test.mjs scripts/costing-sw-freshness/*.mjs   # 11 pass / 0 fail
node scripts/fg-bit-ux-1/capture-evidence.mjs <root> docs/fg-bit-ux-1/evidence <label>
```
Baseline: the same browser suite on base `main` = 9 pass / 18 fail (of 27). Passing on base: filters/debounce, scroll, cascade, post-success, guidance, Home — i.e. existing behaviour is unchanged; failures are the new a11y/lifecycle/geometry assertions.

Viewport matrix (measured bounding boxes, scroll owners, h-overflow, operability of 11 controls each): 1440×900, 1024×768, 768×1024, 520×800, 390×844, 320×568, short desktop 1280×480, landscape 844×390; 640×400 (≈200% zoom of 1280×800) and 390×340 (soft-keyboard-height emulation). All pass. Column count checked at 1440/1100/900/760/390.

Gate coverage: A contract — static test pins RPC names, 16 payload keys, identity `p_plant_id ?? null`, date computation. C — focus/Esc/backdrop/cancel/X/trap/busy tests. D — see lint.

## Functional preservation checklist
- RPCs untouched: `rpc_fg_bulk_internal_transfer_source_page`, `…_source_by_identity`, `rpc_create_fg_bulk_internal_transfer` (+ tables sections/subsections/areas/plant_machinery reads). ✔ static test
- `source_key` used for highlight only; structured identity for server calls ✔ (code unchanged)
- Debounce 250 ms, pagination 50, sentinel + Load more, stale-response guard ✔ (browser tests)
- Cascade section>subsection>area>plant, same-location rule ✔ tested
- Post success (remains / exhausted), RPC error, network failure, no duplicate post ✔ tested

## PWA / Electron / cache freshness
- URLs, query params and `index.html` Home target unchanged; relative asset paths (`public/shared/...`) as before; no root-absolute URLs (static test). Callers `add-log-entry.html`, `edit-log-entry.html`, `js/update-log-status.js` untouched.
- **Freshness risk (read-only analysis of `public/sw.js`, pin `hub-cache-v393`):** HTML is network-first, but the new CSS (new URL) is fetched fresh, while `fg-bulk-internal-transfer.js` is cache-first. An installed PWA can therefore pair new HTML/CSS with the **old cached JS** until the cache name is bumped. Mitigation in this PR: the HTML is functional with the old JS (same IDs/classes; static Home markup; `.source-table-wrap` kept). Old JS would lack focus trap/restore, keyboard rows and busy guards. **Follow-up requiring owner approval:** bump `CACHE_NAME` at release. Not done here.
- Native Electron and a hosted PWA were **not** tested (unavailable). Electron picks this up in the next packaged release.

## Limitations / BLOCKED
- ESLint: **BLOCKED** — `npm install` was not run; `@eslint/js` missing, so `eslint.config.mjs` cannot load. No repo prettier config found. Syntax check `node --check` passes.
- Real soft-keyboard / `visualViewport` behaviour not testable in headless Chromium; only height emulation. No JS resize hacks added.
- Dark theme: none exists in shared architecture; not added.
- Cross-browser: Chromium only. `inert` relies on Chromium 102+/Safari 15.5+/Firefox 112+.
- Screenshots use synthetic data; the fake is not production.
- Reference comparison is by computed styles + Manage Activities render; Stock Checker / Stock & Purchase Explorer were compared by shared tokens, not rendered.

## Rollback
`git revert <merge-sha>` (UI-only; no data or schema impact). If PWA clients hold stale JS after rollback, the same cache-bump follow-up applies.
