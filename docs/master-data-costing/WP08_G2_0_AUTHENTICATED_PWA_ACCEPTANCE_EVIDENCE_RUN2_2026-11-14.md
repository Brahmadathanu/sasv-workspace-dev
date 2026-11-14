# WP08 G2-0 Authenticated PWA Acceptance Evidence - Run 2 (Issue #410)

Date: 14 Nov 2026. Repository: Brahmadathanu/sasv-workspace-dev. Exact main tested: `ad57ad11d0c55309b6d1b643059009bcae918791` (includes PR #413). PWA: https://sasv-utilities-hub.netlify.app/

**This is a NEW run. The original BLOCKED report (`WP08_G2_0_AUTHENTICATED_PWA_ACCEPTANCE_EVIDENCE_2026-11-14.md`, branch `docs/wp08-g2-0-acceptance-evidence`, commit `2d0c7b6`) is preserved separately and is not modified.**

**Overall: Phase 1 PASS. Phases 2-4 PARTIAL. The one signed-in identity available was DENIED on all four modules, so real data loading, editor and view-only states were not exercised. WP08 remains OPEN; programme 8/13.**

Restrictions kept: no registry SQL, permission changes, deployments, global flags or writer operations. No Save, "+", Mode, More actions, Preview or Rebuild control was pressed. The only controls clicked were HOME (once, on SP BOM) and the pane viewport.

## Phase 1 - Provenance (CLI, checkout at exact main)

Command: `node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify https://sasv-utilities-hub.netlify.app` (exit 0). Complete output:

```
NORMALIZED /shared/manage-products.html NETLIFY_INJECTED_BANNER_V1 raw=34cbd536abacb838d6e6d2fd18cab8d84639e1e95e43e7af7f683e2abf55afdb normalized=657c2b5e719b3bae1ab6ae3d0dba743be02db2fc43f6e35501feb99229878aae expected=657c2b5e719b3bae1ab6ae3d0dba743be02db2fc43f6e35501feb99229878aae
NORMALIZED /shared/manage-rm-bom.html NETLIFY_INJECTED_BANNER_V1 raw=6ae6dc5a71b368fc0af6fcd62a9d5b351b2481e9f63866e613a559031893c99e normalized=c3eca5fb6810c6b2ab3cd6b83a1ad376605a96775f8a3625c84730f43fb2b30c expected=c3eca5fb6810c6b2ab3cd6b83a1ad376605a96775f8a3625c84730f43fb2b30c
NORMALIZED /shared/manage-pm-bom.html NETLIFY_INJECTED_BANNER_V1 raw=75e58639995fa1c93c33579c713c0140432ee60ad89489ec156d8e18e5047cb0 normalized=dc189c748f12d9efb3a2ccb917a944ab2678196edda16b8050ba952ff259c3c8 expected=dc189c748f12d9efb3a2ccb917a944ab2678196edda16b8050ba952ff259c3c8
NORMALIZED /shared/manage-sp-bom.html NETLIFY_INJECTED_BANNER_V1 raw=9a3358d12518702776d912eb711c676250e5625f5e921f364cbab71afa81ca86 normalized=6335d7a905c3a5d6cd601b3bc2f8bff10b362e4163c7b8cb24fe31e70c8cba9f expected=6335d7a905c3a5d6cd601b3bc2f8bff10b362e4163c7b8cb24fe31e70c8cba9f
GATE PASS
GATE TOKEN g2-0-2cb6da61e0f896616188681ef0b7b13a
```

The four HTML pages are verified **after normalization only**: the raw served bytes differ from Git by the documented Netlify banner and are not byte-identical. The other seven files (four module JS files, `master-data-platform.js`, `shared-ui.css`, `sasv-bom.css`) matched exactly, and the service-worker checks passed (the gate prints no problem and issues a token). The token equals the one embedded for step A.

| Test | Result |
|---|---|
| 1.1 Gate: 11 assets + service-worker checks | **PASS** (4 HTML PASS-after-normalization, 7 exact) |
| 1.2 Browser-loaded JS/CSS equal expected hashes | **PASS** (below) |
| 1.3 Service worker freshness | **PASS**: served `sw.js` is `hub-cache-v393`; the SW is registered, active and controlling the page |

### 1.2 Browser-loaded assets
In the signed-in browser, each page's resource timing listed the module scripts. For each file I fetched the served copy (`cache: no-store`), normalised CRLF, and compared the first 16 hex characters of its SHA-256 with `deploy-gate.mjs manifest`. All matched:

| File | sha256 (first 16) | Listed as loaded on |
|---|---|---|
| `products.js` | c9762a68e63123df | Products |
| `manage-rm-bom.js` | b1b9c48429371107 | RM BOM |
| `manage-pm-bom.js` | 70bb91417d2e3e2e | PM BOM |
| `manage-sp-bom.js` | 80e4ba3d94fe4a28 | SP BOM |
| `master-data-platform.js` | 14a6cb9ddf9778ce | all four |
| `shared-ui.css` | ddd7693c6f91bd30 | RM, PM, SP (Products does not link it) |
| `sasv-bom.css` | cbce6abe1446b038 | RM, PM, SP (Products does not link it) |

Caveat: I hashed a fresh network copy, not the Cache Storage entry, and the HTML was not byte-compared in the browser because of the banner.

## Phase 2 - Authenticated read-only checks
Identity: the existing signed-in session in the built-in browser (hub shows "Signed in"). Its role or username was not inspected. Every module showed its denied message.

| Test | Products | RM BOM | PM BOM | SP BOM |
|---|---|---|---|---|
| 2.1 Real data loading | NOT TESTED (denied) | NOT TESTED (denied) | NOT TESTED (denied) | NOT TESTED (denied) |
| 2.2 Permission state shown | PASS: "You do not have permission to open Product Master." | PASS: "You do not have permission to view this module." | PASS: same message | PASS: same message |
| 2.3 View-only controls | **FAIL/FINDING** (below) | **FAIL/FINDING** | **FAIL/FINDING** | **FAIL/FINDING** |
| 2.4 HOME navigation | NOT TESTED (button present) | NOT TESTED (button present) | NOT TESTED (button present) | **PASS** (to `/utilities-hub/index.html`) |
| 2.5 Console errors | PARTIAL: none | PARTIAL: not read per page | PARTIAL: not read per page | PARTIAL: none |
| 2.6 Layout 1280px | PASS (no horizontal overflow) | PASS | PASS | PASS |
| 2.7 Layout 390px | **PASS** (no overflow, header wraps cleanly) | **PARTIAL** (below) | **FAIL**: WP11 UX-P05 retained | **PARTIAL** |

- **2.3 view-only controls:** on the denied pages, writer-looking controls are rendered and not disabled, including `newInlineBtn` ("+") on Products and `saveBtn` on the three BOM pages (RM BOM also showed enabled quantity and loss inputs). The pickers are `pointer-events:none`, no data is loaded, and PM BOM shows its static placeholder row (ITEM001). None of them was pressed, so I did not establish whether any can write. This needs review; I am not asserting a defect.
- **2.5:** the console was read as clean after SP BOM and again after the last Products visit. It was not read after each page, so this stays PARTIAL.
- **2.7:** the RM, PM and SP BOM pages have no `<meta name="viewport">` (Products has one), so at a 390px device the layout width was 980px. RM and SP did not overflow that 980px layout, but they were not responsive at 390px. On PM BOM, content extends to about 1581px against the 980px layout. This is the known **WP11 UX-P05** overflow; it remains FAIL and is not marked PASS.
- **PM BOM permission target:** source confirms `MODULE_ID = "pm-templates"` and a lookup of `module:pm-templates` (`manage-pm-bom.js` lines 150 and 207). At runtime the page was denied for this identity, consistent with that check but not proving the grant. Result: **PARTIAL** (source PASS, runtime not demonstrable).

## Phase 3 - Role checks
| Test | Result |
|---|---|
| 3.1 Denied state | PASS (observed on all four modules, one identity) |
| 3.2 Editor state | **NOT TESTED** (no editor identity available) |
| 3.3 View-only state | **NOT TESTED** (no view-only grant on these modules available) |

No credentials were requested or handled.

## Phase 4 - Restoration
| Test | Result |
|---|---|
| 4.1 Four PWA registry rows absent | **NOT TESTED** (no registry read authorised; nothing applied by this run) |
| 4.2 Original Electron registrations unchanged | **NOT TESTED** |
| 4.3 Browser restoration | PASS: viewport emulation cleared; no flags, storage keys or permissions were set |

## Follow-up for the owner
- Completing Phases 2-3 needs an identity with view or edit grants on the four modules.
- Finding 2.3 and the missing viewport meta on the three BOM pages need review; the viewport issue is a candidate for WP11 alongside UX-P05.
- Phase 4 needs a read-only registry check by someone authorised.
