# WP11 actual 390px PM BOM, PWA freshness and flags — receipt (17 Nov 2026)

**Evidence status: owner-supervised sign-in in the Claude desktop in-app browser, owner-confirmed as an authorised test environment. Read-only; no edit, Save, Deactivate, flag change or credential handling. Not owner sign-off; closes no workpack.**

## Results

| Check | Result | Evidence |
|---|---|---|
| Hosted bytes vs PR head `fc0db903` | PASS | `verify-served-assets.mjs`: 74/74, `hub-cache-v393` |
| Active service-worker controller | PASS | Controller `/sw.js`, scope `/`, registration active |
| Installed cache version | PASS | `caches.keys()` = `["hub-cache-v393"]` only |
| Eleven Costing flags default-OFF | PASS (browser overrides) | All 11 localStorage override keys absent in this browser; no override active. Server-side flag defaults not inspected |
| **Actual 390px PM BOM, populated template** | **FAIL (confirmed defect)** | Real emulated viewport (outerWidth 390, visualViewport 390). Before selecting a template: scrollWidth = clientWidth = 390. After selecting a populated template: `documentElement.scrollWidth` 847 vs `clientWidth` 390, `innerWidth` 847. Reproduced twice after fresh load. `scrollX` could not move (body is `overflow-x:hidden`), so the content is clipped rather than scrollable |
| Internal table scrolling | PASS | Lines grid and its top scrollbar scroll internally (scrollWidth 712 vs clientWidth 325); `scrollLeft` moved 0 → 200 |
| Deactivate legibility | PASS (desktop, retained) | Not repeated, never clicked |
| Cost Comparison normal request | NOT TESTED | Cost Sheet Review loaded but no comparison request was reached; capture saw no Supabase calls (possibly cross-origin or page still loading). No body captured |
| Role matrix, seven negative GETs | NOT TESTED | No canonical identity proofs; no restricted identities |

## Defect: PM BOM header toolbar unreachable at phone width

- **Observed:** with a template selected, the panel toolbar (QA chip, Reload `#reloadBtn`, Save `#saveBtn`, menus) is laid out at x=663–992 inside a 358px panel that clips (`overflow:hidden`). Editors cannot reach Save/Reload at 390px; the document reports scrollWidth 847.
- **Root cause:** `public/shared/manage-pm-bom.html` sets `.panel-header .hdr-top { flex-wrap: nowrap }`; `product-heading-label` (min-width 220px) and `erp-pills-bar` (min-width 280px) then force the actions off-canvas. The ≤640px media block only changed `flex-basis` and never restored wrapping.
- **Correction (draft PR, not merged):** [PR #467](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/467), branch `review/wp11-pm-bom-header-wrap-20261117`, source SHA `0653e25b5c8d350b003f0470d95b59e031f2c2fe`. At ≤1100px `.hdr-top` wraps and the label/pills min-widths are dropped (the same overflow also occurred at 768px: 792). `hub-cache-v393` → `hub-cache-v394` (owner-approved).
- **RM BOM / SP BOM:** evaluated; `.hdr-top` already `flex-wrap: wrap`, unchanged.
- **Local regression (real Chromium, mobile emulation, populated 4-line template, stubbed network):** `pm-bom-responsive` 7/7 — populated @390/768/1280 no page overflow and QA chip/Reload/Save inside viewport and hit-testable; internal table scroll; mutation test (WP11 rule stripped) reproduces the overflow, so the suite fails on the original CSS. `sw-update-lifecycle` 1/1 — a v393 client updates to v394 via the normal lifecycle, old cache purged, corrected page served. G2-0 browser + fail-closed 125/125; 15 smoke scripts exit 0. 16 historical branch-relative scope-guard failures are identical on the pre-change base.
- **Deployed-build genuine acceptance (Netlify deploy preview of PR #467 `0653e25b`, owner-signed-in, real data, read-only, nothing edited): PASS.** Actual 390px viewport (`innerWidth` 390 = `visualViewport` 390). Template "100 g_Powder PP Packing", 2 populated lines. `documentElement.scrollWidth` 390 = `clientWidth` 390 (v393 production: 847). QA chip x=31–70, Reload 140–176, Save 196–232, all inside the viewport. Lines grid scrolls internally (`scrollLeft` moved); page `scrollX` stays 0. Installed cache `["hub-cache-v394"]`. Preview origin: `deploy-preview-467--sasv-utilities-hub.netlify.app`.
- **CI on PR #467:** 13 checks pass. `hosted-provenance` and `release-receiver` compare production (still v393) with the v394 candidate and are expected to pass only after deployment; `wp10-offline` S4/S5 and `integrated-pec` `public/sw.js` guard flag the approved PM BOM page / `sw.js` change and need allow-list updates (owner decision).
- **Still required for WP11:** production deployment of the candidate and owner closure. WP11 is NOT closed.

## Impact on status

WP11 stays OPEN. The prior source/mock 390px PASS is superseded by this genuine FAIL until the fix ships and is re-measured. Electron release remains on HOLD.
