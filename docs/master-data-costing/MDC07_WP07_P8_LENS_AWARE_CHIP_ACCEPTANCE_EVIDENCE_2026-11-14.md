# MDC-07 WP07 — P8 lens-aware context-chip authenticated acceptance evidence (14 November 2026)

**Status: WP07 remains OPEN. Programme remains at 7/13.** This records a bounded, read-only, authenticated browser acceptance of the P8 correction (issue #395, merged as PR #397). It does not close WP07, change application code, flags in production, permissions or deployment, and does not rewrite earlier evidence.

- Issues: #367 (coordination), #380 (Workload Preview Product carry-over — resolved earlier), #395 (P8 lens-aware chips).
- Fix under test: PR #397, merged as `a171504`; expected main `a17150467238483e7fd496f0823146ac1ea68544` (confirmed `origin/main` at the time of the run).
- Preserved unchanged: the 13 Nov evidence and addendum, and `MDC07_WP07_AUTHENTICATED_POST_FIX_ACCEPTANCE_EVIDENCE_2026-11-14.md` (the earlier P0–P11 run that recorded P8 PARTIAL/FAIL).

## 1. Method and scope

| Item | Value |
|---|---|
| Date | 14 November 2026 |
| Browser | Claude desktop built-in browser pane (Chromium), existing signed-in session (persisted; the owner had signed in earlier; the agent handled no credentials) |
| Identity | The existing authorised view-only SASV account |
| Origin | `https://sasv-utilities-hub.netlify.app/` |
| Flags | Only `COSTING_NAV_GROUPS_V1` and `COSTING_PRM_NAV_CONTEXT_V1`, browser-local, under the owner's standing bounded authorisation. U11 untouched. Both removed at the end (Phase 4). |
| Not done | No writer operation, Save/Apply/Create, privileged preview, permission change, account creation, deployment, closure. |
| Chip terminology | **Transient chip** = visible only while the destination lens is still loading. **Residual chip** = still visible after the lens finished loading. Only residual chips are defects. Chips were sampled every 100–150 ms from the moment of the click. |
| Controls | Interactions were real UI clicks, select changes and typing, except lens-pill clicks that were issued as scripted `click()` calls (so timelines could be sampled) and the in-app history navigations in checks 6, noted where used. |

## 2. Results summary

| Check | Result | One-line observation |
|---|---|---|
| Phase 1a — hosted assets vs main | **PASS** | Served-assets verifier: `VERIFIED [HOSTED]`, 73/73 assets, cache `hub-cache-v393`. |
| Phase 1b — browser-loaded files | **PASS** | Network and cached copies of both target files equal `a171504` blobs. |
| Phase 2 — flags OFF | **PASS** | Navigation and Workload Preview functional; no chips; 495/592/384/16/226. |
| 3.1 — Product 678 chips | **PASS** | Product and Family chips shown on the Effective Route Viewer. |
| 3.2 — Workload Preview | **PASS** | 495 rows, no `product_id`, no chips once loaded (transient 764 ms). |
| 3.3 — non-identity lenses | **PASS** | 7 lenses visited; no residual chips on any. |
| 3.4 — return to identity lens | **PASS** | Product 678 and chips restored. |
| 3.5 — explicit deep link | **PASS** | `product_id=678`: 1 row, filter functional, no Product/Family chip. |
| 3.6 — second Product | **PASS (limited)** | No stale A chips or data. B reached by history navigation / deep link, not the picker (see §8). |
| 3.7 — rapid navigation | **PASS** | Final chips always matched the final lens; no late restore after settling. |
| 3.8 — 390px | **PASS** | No horizontal overflow; chips wrap on two lines (visually inspected). |
| Phase 4 — restoration | **PASS** | Both keys `null`; no costing flag keys; flat navigation; no console errors. |

**P8 outcome:** the stale-chip presentation defect recorded as PARTIAL/FAIL on 14 Nov is **not reproduced** on the merged build in this run. Data-filtering behaviour from #380 remains correct.

## 3. Phase 1 — asset verification

**1a. Hosted verifier** (unauthenticated static GETs only):

```
node scripts/costing-acceptance/verify-served-assets.mjs https://sasv-utilities-hub.netlify.app a17150467238483e7fd496f0823146ac1ea68544
VERIFIED [HOSTED] … vs a171504…: 73/73 assets match; cache hub-cache-v393; bundle a49d542054ded62f…
2 HTML file(s) verified after removing the documented NETLIFY_INJECTED_BANNER_V1 comment
```

**1b. Signed-in browser** (Production Route Manager loaded; service worker `/sw.js` active and controlling; cache `hub-cache-v393`). For each file, SHA-256 (LF-normalised) of a `cache: no-store` network fetch and of the Cache Storage entry, against the blob at `a171504`:

| File | Expected (`a171504`) | Network | Cache |
|---|---|---|---|
| `costing-suite-production-route-nav-context.js` | `48e44784f940f55a188f3a5b9b074200dd8e432d8226ff079a9f2034aa3ee642` | match | match |
| `costing-suite-production-route.js` | `5789069e39a7f949a92c95a1fcd21d0cc39ef7bd9b527ec2752e49387e5bc9e7` | match | match |

Further evidence that the running page uses the new source: a dynamic `import()` of the nav-context module (same URL the controller imports) exposes the new `isPrmIdentityLens` export, returning `false` for `shared-workload-preview` and `true` for `effective-route-viewer`; resource-timing shows both files served with `transferSize 0` (service-worker/cache). Limitation: this proves the module instance for that URL is the new code; it does not instrument the controller instance directly. The cache name did not change (`hub-cache-v393`), as in earlier runs (the service worker serves these files network-first).

## 4. Phase 2 — flags OFF

Both keys `null`, no `.cp-nav-group`, no context bar. Observed (fresh session state):

| Lens | URL | Count |
|---|---|---|
| Workload Preview (direct) | `?lens=shared-workload-preview` | **495 rows** |
| Route Readiness | `?lens=route-readiness` | 592 rows |
| Product Assignments | `?lens=product-route-assignments` | 384 rows |
| Subgroup Mappings | `?lens=product-subgroup-mappings` | 16 records |
| Archived Routes | `?lens=archived-routes` | 226 records |
| Effective Route Viewer | `?lens=effective-route-viewer` | (no selection) |

With `product_id=678` on the Effective Route Viewer and then the Workload Preview pill: 495 rows, no `product_id`, zero chips. No console errors.

## 5. Phase 3 — flags ON (read-only)

Flags set, page reloaded: five `.cp-nav-group` elements, context bar present.

- **3.1 PASS.** Product 678 was selected through the Effective Route Viewer picker (typed "Ilaneer", clicked the option). URL `?lens=effective-route-viewer&product_id=678`; breadcrumb `Production Route Manager › Build › Effective Route Viewer`; chips `Product: Ilaneer Kuzhambu (#678)` and `Family: Ilaneer Kuzhambu — Product-Specific Route (#113)`.
- **3.2 PASS.** Workload Preview pill: **495 rows**, URL `?lens=shared-workload-preview` (no `product_id`), no Product/Family/Route chip. *Transient:* chips of the previous lens were visible for 764 ms during the load and were gone afterwards.
- **3.3 PASS.** For each of seven non-identity lenses, the Effective Route Viewer was re-entered first (chips present each time), then the lens pill clicked:

| Lens | URL after load | Count | Chips after load | Transient chips |
|---|---|---|---|---|
| Route Readiness | `?lens=route-readiness` | 592 rows | none | 2093 ms |
| Manufacturing Route Families | `?lens=route-families` | 87 rows | none | 646 ms |
| Subgroup Mappings | `?lens=product-subgroup-mappings` | 16 records | none | 443 ms |
| Archived Routes | `?lens=archived-routes` | 226 records | none | 238 ms |
| Mapping Review | `?lens=route-family-mapping-review` | (no rows counter) | none | 2071 ms |
| Foundation Review | `?lens=route-family-foundation-review` | (no rows counter) | none | 2108 ms |
| Cost Centres | `?lens=production-cost-centres` | (no rows counter) | none | 652 ms |

  Transient duration tracks how long the lens takes to finish loading (the chips are removed when the load is accepted, not at click time). Residual chips: none.
- **3.4 PASS.** Return to the Effective Route Viewer: chips `Product: Ilaneer Kuzhambu (#678)` / `Family …(#113)` reappeared (≈0.6 s), picker value `Ilaneer Kuzhambu`, route detail shown. URL after the pill click carries only `lens=effective-route-viewer` (the identity is restored by N4 hydration, not the URL). Product Assignments then showed the chips and **1 row of 384** (the remembered Product narrows this *identity* lens, disclosed by the chips — N4's accepted behaviour since 13 Nov); Historical Evidence Review also showed the chips.
- **3.5 PASS.** `?lens=shared-workload-preview&product_id=678` (address-bar load): **1 row** (Product 678), URL keeps `product_id=678`, no Product/Family chip (only the "Fixed historical context · not the current costing run" basis chip).
- **3.6 PASS (limited).** From Product A (678, chips shown) an in-app history navigation to `?lens=effective-route-viewer&product_id=1` (Abhayarishtam) was made: chips changed to `Product: Product #1` (name not yet known at that moment) and `Family: Arishtam / Asavam — Controlled Fermentation & Serial Clarification (#20)`; no A content (`Ilaneer`, `#678`, `#113`) anywhere. Workload Preview pill: **495 rows**, no chips (transient 777 ms). Returning to the Effective Route Viewer: `Product: Abhayarishtam (#1)` with the same Family, picker `Abhayarishtam`; again no A content.
- **3.7 PASS.** Rapid navigation (all scripted pill clicks; final state sampled for 6 s):

| Sequence (gap) | Final lens | Final chips | Observation |
|---|---|---|---|
| Route Readiness › Product Assignments › Workload Preview › Mapping Review › Effective Route Viewer › Archived Routes (120 ms) | Archived Routes (226 records) | none | Transient chips until 999 ms after the last click; none after. |
| Workload Preview › Route Readiness › Subgroup Mappings › Effective Route Viewer (100 ms) | Effective Route Viewer | Product #1 + Family #20 | Chips none at 456 ms, restored at 792 ms, stable. |
| Effective Route Viewer › Archived Routes › Product Assignments › Foundation Review › Route Readiness (30 ms) | Route Readiness (592 rows) | none | Transient chips until 1984 ms; none after; no late flip back. |

- **3.8 PASS.** Viewport emulation 390×812 (real emulation, mobile UA). Navigation is the `#lensSelect` dropdown at this width (changed with real select input). Effective Route Viewer: chips `Product: Ilaneer Kuzhambu (#678)` and `Family: …(#113)` **wrapped onto two lines** (two distinct chip rows, rightmost edge 364 px of 390), confirmed in a screenshot with no clipping; `scrollWidth` 390 = `innerWidth` 390 (**no horizontal overflow**). Workload Preview via the dropdown: 495 rows, no chips, no overflow. Back to the Effective Route Viewer: chips restored, same layout. Route Readiness: 592 rows, no chips, no overflow. Emulation was reset to desktop afterwards.

## 6. Phase 4 — restoration

Both keys removed with `removeItem`, page reloaded: `COSTING_NAV_GROUPS_V1` = `null`, `COSTING_PRM_NAV_CONTEXT_V1` = `null`; no `COSTING*`/`FLAG` keys in localStorage (one non-costing authentication key remains; name and value not recorded); no costing/PRM keys in sessionStorage; zero `.cp-nav-group` elements; zero context-bar elements; the flat 13-pill navigation returned (Route Readiness 592 rows); the console reported no errors. Limitation: the console reading covers the page since its last reload, not the entire session.

## 7. Distinguishing transient from residual chips

Every chip observation above on a non-identity lens was sampled from click to settle. Chips from the previous identity lens remain visible for the duration of the destination lens's load (238 ms–2.1 s in this run; longest on Route Readiness, Mapping Review and Foundation Review) because the presentation changes when the load is accepted (as designed in #395 and noted in its PR). **No chip remained after any lens finished loading, and no stale response restored chips afterwards.** Whether the transient window is acceptable is a presentation judgement for the owner; it was not a defect under the issue's acceptance criteria.

## 8. Limitations and observations

1. **Product B was not chosen through the picker.** The Effective Route Viewer picker offered only Ilaneer Kuzhambu (#678) in this account (typing "Abhayarishtam" or "Abhaya" returned "No results"; the unfiltered list showed only #678). A longer list of other Products appeared briefly while typing before the filter applied and then narrowed; it was not available for selection. B was therefore reached by history navigation to a deep link, as in the earlier P9 limitation. The Product-switch requirement was exercised through the deep-link path only.
2. Emptying the picker clears the remembered Product/Family (and its chips), as documented in WP-07 N4; this run did so once while probing the picker.
3. A Product reached by deep link shows `Product #<id>` until its name is available, then the name (names are never invented — N4 design).
4. Product Assignments (an identity lens) narrows to the remembered Product (1 of 384) with flags ON; this is disclosed by the chip and is not the Workload filtering defect.
5. Lens-pill clicks were issued programmatically so chips could be sampled; the picker, dropdown, resizing and address-bar loads used normal controls. History navigation in 3.6 used `pushState` + `popstate`, not the browser Back button.
6. Not retested in this run: P5 (history contract — see the earlier P5 clarification), R4 (`product_route_id` retention), R5 (other identities), R6 (new-tab behaviour), R7, R8 (U11), R10 (CRLF), R11 (clipboard), R12–R14, and writer paths. These retain their earlier classifications.

## 9. Residual status after this run

| Item | State |
|---|---|
| #380 Workload Preview data filtering | Resolved (confirmed again: 495 rows, no `product_id`, explicit deep link 1 row). |
| P8 stale Product/Family chips on non-identity lenses | **Resolved on the merged build** for the seven non-identity lenses visited, at desktop and 390 px. |
| Transient chip window during lens load | Observed, bounded (≤ ~2.1 s); owner may accept or request earlier clearing. |
| R9 stale PWA controller | Cleared for the two target files and the controller (hash-verified in the browser). |
| P5 checklist wording, R4, R5–R8, R10–R14 | Unchanged; see §8.6. |

## 10. Recommendation for final owner closure review

WP07 stays OPEN at 7/13 until the owner decides. The two defects that blocked closure — the #380 data-filtering carry-over and the P8 stale-chip presentation — are both demonstrably resolved on the hosted, hash-verified build with the existing view-only identity, with flags restored. I recommend **CONDITIONAL closure** for the owner's review, subject to the owner explicitly accepting: (a) the transient chip window of up to about two seconds on slow lenses; (b) the unverified residuals R4–R8 and R10–R14 and the P5 contract note; and (c) the limitation that a second Product could not be chosen through the picker in this account. Status changes and the programme count remain the owner's decision.
