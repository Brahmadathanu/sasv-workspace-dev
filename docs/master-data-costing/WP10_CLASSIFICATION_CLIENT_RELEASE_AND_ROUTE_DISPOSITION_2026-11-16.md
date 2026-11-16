# WP10 — Classification client release receipt and remaining acceptance (2026-11-16)

## Observed release state
- Client-only PR [#445](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/445) **squash-merged** to `main`, commit `13168b29939cf88be42bc6a56d4d22fe1be6d220`; confirmed current `main` identical to that commit after merge.
- Included only four classification client JS modules, two shared client security/HTML-escaping helpers, explicit Product Group kind selector, narrow `public/sw.js` network-first rule while retaining `hub-cache-v393`, and focused verification code. The five unrelated PEC migrations were not touched.
- Exact client PR head `1a1de6884a3e2750c36bb44a973813fb7912ef7a`: **all eight GitHub Actions workflows completed SUCCESS**, including `wp10-offline` and the new isolated `wp10-classification-client` job.
- Existing live backend: all 12 governed RPCs had already been applied with production postflight **12/12 catalog, 4/4 grants unchanged**, see `WP10_SERVER_FIRST_PRODUCTION_INSTALLATION_RECEIPT_2026-11-16.md`. No SQL applied during client release.

## Critical route distinction — do not claim hosted PWA delivery
`docs/master-data-costing/WP09_G1_EVIDENCE/source-page-inventory.json` identifies all four pages as root Electron-only and `pwaRoute: null`, `pwaReachable: false`:
1. `manage-categories.html`
2. `manage-subcategories.html`
3. `manage-product-groups.html`
4. `manage-subgroups.html`

These root pages are not PWA-reachable merely because `main` auto-deploys to Netlify. The network-first SW change is a compatibility/freshness provision for any matching asset URL, **not proof that the four management routes are exposed in PWA**. Public Netlify URL retrieval was inaccessible to the chat's web environment when checked; no served-byte proof or Netlify dashboard deployment receipt was recorded. PWA module and signed-in role acceptance are **NOT TESTED / NOT APPLICABLE under current Electron-only route inventory**. Exposing the four masters in PWA would be a distinct, owner-approved navigation/permission/publication decision.

## Electron acceptance yet required
- A packaged, signed/installed Electron release with `main` commit `13168b29939cf88be42bc6a56d4d22fe1be6d220` or newer must be produced through normal release controls. No Electron installer, updater rollout or on-device build provenance verified here.
- With genuine authenticated accounts (do not synthesize sessions): Editor verifies Category/Subcategory/Product Group (including mandatory kind)/Sub-group create, rename and guarded delete using bounded fixtures; View-only verifies lists with all writer controls absent and RPC denials; No-access verifies module entry gating and direct-route behavior. Include 390 px and desktop view as supported by installed Electron runtime.
- Capture positive/negative server RPC evidence, no unexpected direct-table writes from these four clients, real-world named constraints and dependency delete errors. Mocked browser checks are not live-role evidence.
- Prior installed Electron versions still direct-write the four tables. Existing authenticated SELECT/INSERT/UPDATE/DELETE grants remain unchanged. The future four-table REVOKE is a distinct compatibility/owner approval gate after fleet cutover.
- WP10 G2 proposal 04/05, CL15 parent-lock correction, Route Manager mapping concurrency and privileged subgroup reassignment remain open and were not included in PR #445.

## Disposition
**Client source integration PASS; production Electron installation NOT TESTED; PWA route acceptance NOT APPLICABLE to these root-only modules; WP10 formal closure OPEN.** Keep PR #444 as separate review/unmerged package. Do not mark deployed or tested on PWA without new provenance and a route-enablement decision.
