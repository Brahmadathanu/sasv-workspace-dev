# WP08 G2-0 Authenticated PWA Acceptance Evidence - Run 3 (Issue #410)

Date: 14 Nov 2026. Repository: Brahmadathanu/sasv-workspace-dev. Exact main tested: `0a3eeb71a54bea676c52951dc4cd73ba493de987` (includes PR #417 / issue #416: fail-closed controls, mobile viewport, `master-data-write-guard.js`). PWA: https://sasv-utilities-hub.netlify.app/

Earlier reports are preserved unchanged: Run 1 BLOCKED (`...EVIDENCE_2026-11-14.md`, `2d0c7b6`) and Run 2 (`...EVIDENCE_RUN2_2026-11-14.md`, `0578f82`).

**Overall: Phase 1 PASS (new gate token). Positive-role acceptance is BLOCKED: no identity with Product/BOM View or Edit grants was available, so this run again exercised only the DENIED state. The denied-page recheck shows the #416 fixes working except for the items listed below. WP08 remains OPEN.**

Restrictions kept: no registry SQL (Step A not executed), database mutation, permission or flag change, deployment, or writer action. Only HOME (once, on PM BOM) was clicked; the pane viewport was resized. No credentials were requested or handled.

## 1. Provenance (CLI, checkout at exact main)
`node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify https://sasv-utilities-hub.netlify.app` exited 0. Complete output:

```
NORMALIZED /shared/manage-products.html NETLIFY_INJECTED_BANNER_V1 raw=6b7f0b3d40d19fe3da8b5a987ed6e732794afbe12d79a2fb63c974e1fc909e29 normalized=a7a834dcc99dfabd611bf03e6b3b08dbde510717b1897aed3af17dcf57b428a4 expected=a7a834dcc99dfabd611bf03e6b3b08dbde510717b1897aed3af17dcf57b428a4
NORMALIZED /shared/manage-rm-bom.html NETLIFY_INJECTED_BANNER_V1 raw=088692f4f0979b67beb09d0bb77f466645d933e6c97d5ed73c1fab34655530ec normalized=da39f12e8a4d7c131524bd3a7a597f41564b599f8eaa455cdefe4812715ba48f expected=da39f12e8a4d7c131524bd3a7a597f41564b599f8eaa455cdefe4812715ba48f
NORMALIZED /shared/manage-pm-bom.html NETLIFY_INJECTED_BANNER_V1 raw=80cc821f2cf8e21a9ac3a9bbb448706d072827678a19b92d4086e1c8643d9736 normalized=bf55c63a17452fe4f136f394e00ea8654f9da122a78874810811e4cd06260aa8 expected=bf55c63a17452fe4f136f394e00ea8654f9da122a78874810811e4cd06260aa8
NORMALIZED /shared/manage-sp-bom.html NETLIFY_INJECTED_BANNER_V1 raw=d44e5f7f296043dfdf31d1dd409ba1dac920eed01d0a37a8f9688bf3bd797741 normalized=ce45844e8948c0fb2b225eeaeab27089711342631d6dc357f5e5e3770cd2578f expected=ce45844e8948c0fb2b225eeaeab27089711342631d6dc357f5e5e3770cd2578f
GATE PASS
GATE TOKEN g2-0-7508596128ccc98a6c8d54b695693352
```

**New gate token: `g2-0-7508596128ccc98a6c8d54b695693352`** (the previous token `g2-0-2cb6da61...` belonged to the pre-#416 files). The manifest now has 12 files: the four HTML pages are PASS-after-banner-normalization (not byte-identical); the eight JS/CSS files, including `master-data-write-guard.js` (`6faa6fd2b9225f0e`), matched exactly.

| Test | Result |
|---|---|
| 1.1 Gate PASS, new token captured | **PASS** |

## 2. Browser-loaded assets and service worker
In the signed-in browser, each page's resource timing listed `master-data-write-guard.js` and `master-data-platform.js` plus its own module JS, and RM, PM and SP BOM also listed `shared-ui.css` and `sasv-bom.css`. A no-store fetch of each file, hashed (first 16 hex of SHA-256 after CRLF normalisation), matched the manifest:

| File | Hash | Loaded on |
|---|---|---|
| `master-data-write-guard.js` | 6faa6fd2b9225f0e | all four |
| `master-data-platform.js` | 14a6cb9ddf9778ce | all four |
| `products.js` | 69915597214d4973 | Products |
| `manage-rm-bom.js` | f314987e6397f431 | RM BOM |
| `manage-pm-bom.js` | 60741c5451f7fd00 | PM BOM |
| `manage-sp-bom.js` | 6b0b2485e011187a | SP BOM |
| `shared-ui.css` / `sasv-bom.css` | ddd7693c6f91bd30 / cbce6abe1446b038 | RM, PM, SP |

Cache Storage `hub-cache-v393` holds `products.js` and `master-data-write-guard.js` copies whose hashes equal the manifest.

Service worker: the network `/sw.js` (identical to `main`: `hub-cache-v393`, and the network-first pattern lists `master-data-write-guard`) is registered, activated and controlling the page, with no installing or waiting worker after `registration.update()`.
**Observation (PARTIAL):** a same-URL `fetch('/sw.js')` from the page returned an older 8,493-character copy without the guard pattern, while `fetch('/sw.js?x=...')` returned the current 8,517-character file. The page-visible `/sw.js` appears to be served from the cache, and the worker's own script text cannot be read from the page, so I could not independently prove which worker version is running. The loaded guard script and hashes are consistent with the current worker, but not proof of it. Browser SW update fetching bypasses this path, so I treat it as a cosmetic observation and not a failure.

| Test | Result |
|---|---|
| 2.1 Browser loads `master-data-write-guard.js` + updated module JS/CSS (hash-equal) | **PASS** |
| 2.2 Correct service worker | **PARTIAL** (network `sw.js` correct and activated; running worker text not directly verifiable; stale cached `/sw.js` copy observed) |

## 3. Positive-role identities
The only identity available was the existing signed-in session. The Hub shows one tile for it, "Costing Control Center - Read only", and every Product/BOM module denies it. No identity with Product, RM, PM or SP BOM View or Edit grants was available, and I did not ask for or handle credentials.

| Test | Result |
|---|---|
| 3.1 Editor: real read-only acceptance of all four modules | **BLOCKED** (no identity) |
| 3.2 View-only: real read-only acceptance of all four modules | **BLOCKED** (no identity) |
| 3.3 Real data loading | **BLOCKED** |
| 3.4 PM BOM runtime use of `module:pm-templates` | **BLOCKED** (source confirmed in Run 2; runtime grant not demonstrable) |

**Remaining blocker:** an identity with View (and ideally an Edit identity) grants on `manage-products`, `manage-rm-bom`, `manage-sp-bom` and `pm-templates`, signed in personally by the owner in the built-in browser.

## 4. Denied-page recheck (same identity, after #416)
| Test | Products | RM BOM | PM BOM | SP BOM |
|---|---|---|---|---|
| 4.1 Denied message | PASS | PASS | PASS | PASS |
| 4.2 Writer controls | **PASS**: only HOME visible ("+" gone) | **PASS**: Save gone; only HOME, reload, More actions, mode menu visible | **PARTIAL**: Save gone, but Preview and Rebuild tabs, Export, and More actions remain visible and enabled (not pressed) | **PASS**: Save gone; HOME, reload, More actions visible |
| 4.3 Inputs | n/a | refQty/lossPct focusable but `pointer-events:none` | tplCode/refQty/refUom/lossPct focusable but `pointer-events:none` | refQty/lossPct focusable but `pointer-events:none` |
| 4.4 Static placeholder data | none | none | PARTIAL: placeholder row "ITEM001 / 10 / kg / 5%" still shown while denied | none |
| 4.5 HOME navigation | NOT TESTED | NOT TESTED | **PASS** (to `/utilities-hub/index.html`) | PASS in Run 2 |
| 4.6 Console errors | PASS (none) | PASS (none) | PASS (none) | PASS (none) |

The console was read once at the end of the run, after the last page, so errors from earlier pages would have to still be in that log. Treat this as PASS with that limitation.

- The 4.2 and 4.3 rows are for the denied state only. They do not show how the controls behave for a View or Edit identity.
- Preview and Rebuild are privileged-preview surfaces. I did not press them, and their visibility to a denied user should be reviewed.

## 5. Layout (denied state)
| Test | Products | RM BOM | PM BOM | SP BOM |
|---|---|---|---|---|
| 5.1 1280px | PASS (no overflow) | PASS | PASS | PASS |
| 5.2 390px | **PASS** (no overflow) | **PASS** (viewport meta now present; page width 390) | **FAIL**: WP11 UX-P05 retained: page scroll width 567px at a 390px viewport; header actions, pills bar and the lines region extend past the viewport | **PASS**: page width 390; the lines table scrolls inside its own container |

The missing-viewport-meta finding from Run 2 is fixed (all four pages now carry `width=device-width, initial-scale=1`). The PM BOM 390px overflow is not resolved and is not marked PASS.

## 6. Not covered
Registry rows and Electron registrations (not read; Step A not executed), editor and view-only states, and any real read-only data acceptance remain open. HOME on Products and RM BOM was not clicked.
