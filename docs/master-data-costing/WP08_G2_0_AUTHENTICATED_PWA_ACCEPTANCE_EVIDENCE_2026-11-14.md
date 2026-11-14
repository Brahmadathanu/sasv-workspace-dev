# WP08 G2-0 Authenticated PWA Acceptance Evidence (Issue #410)

Date: 14 Nov 2026. Repository: Brahmadathanu/sasv-workspace-dev. Verified main: `42053bd53ef4f2048654e2c7fd171fa27ff5311a` (#409). PWA: https://sasv-utilities-hub.netlify.app/

**Overall result: BLOCKED at Phase 1 (hosted provenance gate FAIL). Phases 2-4 were not executed, per the instruction "If provenance fails, STOP and record BLOCKED."**
WP08 remains OPEN at 8/13. No permissions, registry SQL, flags or deployments were touched. No writer action was run. No authenticated browsing was performed.

## Phase 1 - Hosted asset verification

Command: `node scripts/wp08-g2-0-shared-master-data/deploy-gate.mjs verify https://sasv-utilities-hub.netlify.app` (run on a checkout at 42053bd).

Output: `GATE FAIL`, no token printed.
- `/shared/manage-products.html`: deployed bytes differ from the reviewed file
- `/shared/manage-rm-bom.html`: deployed bytes differ from the reviewed file
- `/shared/manage-pm-bom.html`: deployed bytes differ from the reviewed file
- `/shared/manage-sp-bom.html`: deployed bytes differ from the reviewed file

The other seven gate files (`products.js`, `manage-rm-bom.js`, `manage-pm-bom.js`, `manage-sp-bom.js`, `master-data-platform.js`, `shared-ui.css`, `sasv-bom.css`) raised no problem, and `sw.js` raised none (it carries the "WP08 G2-0" marker and the network-first patterns; cache name `hub-cache-v393`).

| Test | Result |
|---|---|
| 1.1 Gate verify, 11 files + sw.js | **BLOCKED** (gate FAIL, 4 of 11 files) |
| 1.2 Service-worker freshness | PASS (gate raised no sw problem; read from the same run) |
| 1.3 Browser actually loads updated JS/CSS | **NOT TESTED** (stopped by gate) |

### Diagnosis (read-only, informational - not a waiver)
Each hosted HTML file is 326 bytes larger than the repo file. A line diff of all four (CR stripped) shows only added lines and no removed lines: 3 lines each, an HTML comment inserted at line 6 of `manage-products.html`:

```
<!-- This site is hosted on Netlify. Anyone can build and deploy a site
     like this one for free: https://netlify.new/?utm_campaign=loops&...
     Netlify hosting facts for this site: static/SSR served via Netlify Edge. -->
```

This looks like host-side injection rather than a stale deploy, but the gate as written compares exact bytes and cannot accept it. Neither the gate script nor the hosting configuration was changed by this run. Whether this comment is acceptable provenance is an owner decision; this run did not make it.

## Phase 2 - Authenticated read-only checks

| Test | Result |
|---|---|
| 2.1 manage-products.html: data load, permissions, view-only controls, HOME, console | **BLOCKED** |
| 2.2 manage-rm-bom.html: same | **BLOCKED** |
| 2.3 manage-pm-bom.html: same; confirm `module:pm-templates` | **BLOCKED** |
| 2.4 manage-sp-bom.html: same | **BLOCKED** |
| 2.5 Responsive 390px / 1280px, all four | **BLOCKED** |
| 2.6 PM BOM 390px overflow | Known issue, carried as **WP11 UX-P05**; not re-observed, **not PASS** |

## Phase 3 - Role checks

| Test | Result |
|---|---|
| 3.1 Editor state | **NOT TESTED** |
| 3.2 View-only state | **NOT TESTED** |
| 3.3 Denied state | **NOT TESTED** |

## Phase 4 - Restoration

| Test | Result |
|---|---|
| 4.1 Four PWA registry rows remain absent | **NOT TESTED** (no registry access in this run; nothing was applied by it) |
| 4.2 Original Electron registrations unchanged | **NOT TESTED** |
| 4.3 Browser state | Not applicable: no browser session was opened and no flags were set |

## Next step (owner decision)
Choose one:
1. Authorise a re-run that accepts the host-injected comment as a documented, normalised difference (for example comparing HTML with that comment stripped, or fixing the gate). This needs an explicit decision, because it changes what the gate certifies.
2. Redeploy or reconfigure hosting so the served bytes equal the reviewed bytes, then re-run Phase 1.
Phases 2-4 would then run in full.
