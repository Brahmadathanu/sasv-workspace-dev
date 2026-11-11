# FG-BIT-UX-1 — FG Bulk Internal Transfer UI/UX modernization

Client-only. Base `origin/main` = `b9915b82d6ab818e9f66eb2ab95ca36d08b55bd6`. Branch `feat/fg-bit-ux-1-modernization`.
Not merged to main or deployed to production. No server, Supabase, shared global CSS/JS or Electron packaging changes. `public/sw.js` has one targeted rule added (review round 2, see below); cache name unchanged.

## Files
| File | Change |
|---|---|
| `public/shared/fg-bulk-internal-transfer.html` | **single canonical HTML** for PWA and Electron: SASV theme, modal, form, guidance and actions |\n| `fg-bulk-internal-transfer.html` | **compatibility redirect only**, preserving `item`, `bn` and hash for existing Electron deep links |
| `public/shared/css/sasv-fg-bulk-internal-transfer.css` | new, scoped to `body.sasv-fg-bit`, tokens only |
| `public/shared/js/fg-bulk-internal-transfer.js` | `mountModuleHome`/close icon, modal lifecycle (focus, trap, inert, restore), row keyboard activation, busy guards. No RPC/date/qty/state-machine change |
| `scripts/fg-bit-ux-1/*` | static + mocked-browser tests, fake Supabase, evidence capture script |
| `docs/fg-bit-ux-1/*` | this record + screenshots |

## Audit findings → fixes
| # | Finding (verified on base by rendering) | Fix |
|---|---|---|
| 1 | No `data-sasv-theme`; Arial, 32px h1, hardcoded colours | theme attr + Inter tokens; h1 18px/600 (matches Manage Activities computed values) |
| 2 | Bespoke orange `#homeBtn` with `!important` | `sasv-home-btn` + `mountModuleHome`; Electron target now `../../index.html` from canonical shared page; PWA target `/utilities-hub/index.html` |
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

## Review round 2 (independent review #6797019477)
### 1. PWA freshness — implemented
`public/sw.js`: `/shared/js/fg-bulk-internal-transfer.js` and `/shared/css/sasv-fg-bulk-internal-transfer.css` were added to the **existing** network-first-with-offline-cache-fallback branch (the one used by e-Aushadhi/costing assets). 5 lines added, 1 line changed. `CACHE_NAME` stays `hub-cache-v393`; no cache sweep; all other rules untouched. Regexes are unanchored at the start, so they match both `/shared/...` and `/public/shared/...` hosting.
`scripts/fg-bit-ux-1/sw-freshness.test.mjs` (vm-mocked caches/fetch, 11 tests): reconstructed pre-fix SW serves stale JS (proves the risk); JS, CSS and `/public`-prefixed JS are served fresh online, the cache is refreshed, and offline falls back to the refreshed copy; offline with no cache rejects; unrelated files (`sasv-module-chrome.js`, `ui-icons.js`, `sasv-stock-checker.css`, `style.css`, `fg-bulk-stock.js`) stay cache-first and never hit the network; existing network-first rules still work; non-GET is not intercepted; pin unchanged; CRLF-converted SW behaves identically. Static test updated accordingly.
Residual: `sasv-module-chrome.js` (imported by the page) remains cache-first as before. `mountModuleHome`/`mountModuleIcon` already exist in it on `main`, so a stale copy still satisfies this page.

### 2. ESLint — run
`npm ci` succeeded (ESLint 9.33.0; npm audit advisories not addressed, out of scope).
`npx eslint public/shared/js/fg-bulk-internal-transfer.js public/sw.js scripts/fg-bit-ux-1/*.mjs` → exit 0, 0 errors, 0 warnings (after fixing one `no-regex-spaces` error in my own test). Prettier: no repo config; not run.

### 3. True visual references — rendered
`node scripts/fg-bit-ux-1/compare-references.mjs docs/fg-bit-ux-1/evidence` renders FG-BIT, Stock Checker and Stock & Purchase Explorer (desktop 1440 and phone 390; Supabase/CDN stubbed) and compares computed styles. Output: `evidence/reference-comparison*.json`, `evidence/ref-*.png`.
Of 18 properties (body font/bg/colour; h1 font/size/weight/colour; Home bg/fg/border/radius/size/weight/min-height; search bg/border/radius/size): **18/18 equal to Stock & Purchase Explorer, 17/18 equal to Stock Checker.** The one difference is search font-size (13px vs 14px): the first text input on Stock Checker is a different control from its main search, so this is a selector artefact, not verified drift. Layout rhythm (header with divider, Home at right, light-filled search) was compared by eye on the screenshots.
Stubbed data means the references show empty states; table/row visuals were not compared against them.

### 4. Strengthened regressions (all in `scripts/fg-bit-ux-1/page.test.mjs`)
- 320×400: wheel scroll moves only `.modal-body`; page, overlay and background list do not move; no horizontal overflow; footer stays on screen.
- 390×340: real clicks on Submit/Reset/Cancel; error visible in footer; last field (`#remarks`) not covered; body keeps ≥80px.
- Source refresh while modal open (post, stock remains, real re-render proven via detached node): focus stays inside dialog, selection re-highlighted, background still inert, body is the sole scroll owner, Cancel returns focus to the *new* row element for the same `source_key`.
- Post exhaustion: modal hidden, `inert`/scroll-lock removed, focus on list region, count 50 of 119, row gone, Tab moves into the page, list scrolls, Enter reopens a row.
- Dropped one planned test (opener removed before close) because closing re-renders the list from state, so the row reappears by design; the exhaustion test covers the real fallback.

## Responsive typography refinement — owner screenshot check (11 Nov)
- Compared desktop and narrow-screen modal screenshots: native date/select/number values appeared disproportionately large against labels on narrow screens. Revised control typography as one hierarchy: desktop controls 14px, labels 13px; narrow controls 16px, labels 14px, consistent line-height/min-height and native date segment alignment. The 16px mobile floor is intentional to avoid iOS focus zoom.
- Corrected the `Plant / Machinery` HTML select to be semantically optional (removed lingering `required` attribute); governed `Section → Sub-section → Area` hierarchy remains required.
- Posting Summary now uses a human-readable day-month-year date, suppresses orphaned units for blank quantities, and omits placeholder '-' segments in locations; **RPC date and payload unchanged**.
- Added browser tests for typography across 1440, 768, 390, 320 CSS-pixel widths and for summary formatting.
- **Not yet independently executed:** new visual browser tests/ESLint at this commit; retain draft/merge hold until latest-head checks are recorded.

## Classification governance correction — owner second hands-on inspection
Verified in live Supabase (read-only): `areas` has 88 records, **all 88 have non-null `subsection_id`**; `plant_machinery` occurs in only 25 distinct areas, leaving 63 areas without assigned plants. The posting wrapper `rpc_create_fg_bulk_internal_transfer` forwards nullable `p_to_plant_id` to its core; the core does not require a plant ID.
- Destination hierarchy for this live master: Section → Sub-section → Area (all required). Area options do not appear until the chosen subsection, and a selected area must belong to that subsection. The misleading "(optional)" label was removed from Sub-section.
- Plant / Machinery is an optional finer classification; its selection is not required for readiness or submit validation. Empty destination plant remains `null` in the existing RPC payload. Cases with zero plants must allow area-level posting.
- Narrow Guidance uses a right-justified **double-chevron** icon that reverses when expanded, with `aria-expanded` preserved. Earlier inline single-glyph indicator was removed.
- Browser fixture now models actual area-to-subsection relationships and includes an area with no plant; regression tests cover no-plant valid submission and nullable RPC payload. Old assertions that permitted any area without selecting a subsection are updated.
- No Supabase table, function, permission or RLS changes. Full test/lint run on latest head is still required before merge.

## Owner acceptance round 3 — pending rerun at current head
- Source of truth: canonical `public/shared/fg-bulk-internal-transfer.html`, shared JS `public/shared/js/fg-bulk-internal-transfer.js`, module-scoped CSS. Root page is a small Electron legacy compatibility redirect, not a second full application.
- Electron legacy query parameters (`item`, `bn`) and hash are carried into the canonical shared path; Electron Home/login use `../../index.html` and `../../login.html` from the shared file path, while hosted PWA routes to the Utilities Hub.
- Guidance now shows a chevron on narrow screens; expanded state visibly changes.
- Load more remains only for unsupported IntersectionObserver or recoverable paging failures; normal auto-paging hides the manual button.
- Wide three-column modal cards stretch to equal outer heights; stacked layouts retain natural height.
- Narrow date/number/select controls use consistent 16px text to avoid mobile input zoom.
- Submit starts disabled, remains disabled until valid required fields are entered, becomes disabled again after reset/partial post; server validation and RPC contracts remain unchanged.
- New regression assertions cover canonical HTML, redirect query preservation, visual card height, guidance affordance, normal invisible paging fallback and Submit readiness.
- **Evidence caveat:** Previous 49-pass/ESLint results below belong to the earlier head `44cde3e7`; the above owner-round-3 changes have **not been independently executed/revalidated** in this GitHub-only session. Rerun and attach current-head results before merge.
- Final owner review is still required on the current Netlify preview. Live PWA module registry activation is deferred until the validated canonical page is merged and served in production.

## Tests (Node 22.23.4, Playwright Chromium, Linux, in-memory fake, no network)
```
node --test scripts/fg-bit-ux-1/*.test.mjs      # 49 pass / 0 fail / 0 skipped (7 static + 31 browser + 11 SW); 3 consecutive runs stable
node --test scripts/manage-activities/*.test.mjs scripts/costing-sw-freshness/*.mjs   # 143 tests: 125 pass / 0 fail / 18 skipped
npx eslint public/shared/js/fg-bulk-internal-transfer.js public/sw.js scripts/fg-bit-ux-1/*.mjs   # exit 0
```
Adjacent suites reading `sw.js`/cache pin: 100 script files run individually; **71 fail identically with and without the `sw.js` change** (diff of failure lists empty), so they are pre-existing and unrelated; 29 pass. Not investigated here.
Baseline: the same browser suite on base `main` = 9 pass / 18 fail (of 27). Passing on base: filters/debounce, scroll, cascade, post-success, guidance, Home — i.e. existing behaviour is unchanged; failures are the new a11y/lifecycle/geometry assertions.

Viewport matrix (measured bounding boxes, scroll owners, h-overflow, operability of 11 controls each): 1440×900, 1024×768, 768×1024, 520×800, 390×844, 320×568, short desktop 1280×480, landscape 844×390; 640×400 (≈200% zoom of 1280×800) and 390×340 (soft-keyboard-height emulation). All pass. Column count checked at 1440/1100/900/760/390.

Gate coverage (viewport matrix here is from round 1): A contract — static test pins RPC names, 16 payload keys, identity `p_plant_id ?? null`, date computation. C — focus/Esc/backdrop/cancel/X/trap/busy tests. D — see lint.

## Functional preservation checklist
- RPCs untouched: `rpc_fg_bulk_internal_transfer_source_page`, `…_source_by_identity`, `rpc_create_fg_bulk_internal_transfer` (+ tables sections/subsections/areas/plant_machinery reads). ✔ static test
- `source_key` used for highlight only; structured identity for server calls ✔ (code unchanged)
- Debounce 250 ms, pagination 50, sentinel + Load more, stale-response guard ✔ (browser tests)
- Cascade section>subsection>area>plant, same-location rule ✔ tested
- Post success (remains / exhausted), RPC error, network failure, no duplicate post ✔ tested

## PWA / Electron / cache freshness
- The root Electron entry is a backward-compatible redirect into the shared canonical HTML; query params and hash are preserved. Relative assets are resolved from `public/shared/` in Electron and `/shared/` in the hosted PWA. Callers `add-log-entry.html`, `edit-log-entry.html`, `js/update-log-status.js` untouched.
- Freshness: resolved by the targeted SW rule above (no version bump). Older installed clients still need one online visit to receive the new `sw.js` itself (HTML is network-first, so they get it).
- Native Electron and a hosted PWA were **not** tested (unavailable). Electron picks this up in the next packaged release.

## Limitations / BLOCKED
- Real device soft keyboard, native Electron and hosted-PWA install/offline behaviour: **not tested**; post-merge smoke items.
- Real soft-keyboard / `visualViewport` behaviour not testable in headless Chromium; only height emulation. No JS resize hacks added.
- Dark theme: none exists in shared architecture; not added.
- Cross-browser: Chromium only. `inert` relies on Chromium 102+/Safari 15.5+/Firefox 112+.
- Screenshots use synthetic data; the fake is not production.
- Earlier reference screenshots include stubbed renders of Stock Checker and Stock & Purchase Explorer; new owner-round-3 visual changes still require recapture.

## Rollback
`git revert <merge-sha>` (UI/SW-rule only; no data or schema impact). After a revert the SW rule disappears too, so installed clients may hold the cached new JS under cache-first until a version bump; the old HTML would not be compatible-checked. Prefer reverting together with an owner-approved cache bump.
