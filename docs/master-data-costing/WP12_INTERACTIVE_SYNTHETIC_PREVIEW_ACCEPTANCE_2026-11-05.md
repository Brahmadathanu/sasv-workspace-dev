# WP12 — Interactive synthetic Costing preview launcher: verified isolated browser checkpoint

**Date:** 5 November 2026 · **Status:** local interactive synthetic preview **IMPLEMENTED AND VERIFIED ON PREVIEW BRANCH**, **NOT DEPLOYED**, **NOT AUTHENTICATED LIVE ACCEPTANCE**. Formal Costing Suite closure **5/13 (38%)**.

## Tested source, code location and evidence
- Preview branch: `preview/costing-wp05-wp06-wp12-20261105`.
- Exact tested branch commit: `7c028d0557fe4e14af11f59b1961d684f05cdcd0`.
- GitHub Actions run: [#42045362699](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/42045362699); job ID `127307007825`; conclusion **SUCCESS**.
- Source additions on **preview branch only**:
  - `scripts/costing-preview/synthetic-supabase-client.mjs` — fake view-only user and two fictional SKU status records; explicitly denies RPC/table writes.
  - `scripts/costing-preview/synthetic-launcher.html` — local six-module landing page with eleven flags, All OFF / NAV ONLY / All ON / Reset OFF.
  - `scripts/costing-preview/read-only-loopback-server.mjs` — serves real six module pages, replaces the shared Supabase client module **only in local HTTP responses**, injects an unmistakable synthetic preview banner, denies external/backend requests, disallows service workers and binds `127.0.0.1`.
  - `scripts/costing-preview/interactive-synthetic-preview.test.mjs` — actual Chromium checks for real pages, synthetic client, write denial and flag-restoration launcher.
  - Branch-only `.github/workflows/costing-preview-mock.yml` updated to execute all suites.
- No application source `public/shared/js/supabaseClient.js` was changed; no real Supabase instance is contacted.

## Exact results

| Suite | Tests | Passed | Failed | Skipped |
|---|---:|---:|---:|---:|
| Local static server security | 7 | 7 | 0 | 0 |
| Interactive synthetic client + launcher Chromium | 4 | 4 | 0 | 0 |
| Six module / eleven flag existing mock Chromium regression | 29 | 29 | 0 | 0 |
| **Total (three distinct suites)** | **40** | **40** | **0** | **0** |

The synthetic Chromium checks specifically proved that all six real HTML pages load through the local-only server with the **NO REAL DATA** banner; the overridden mock client exports six view-only module permissions, no edit permissions, a clearly fake test email and two fictional SKU examples; a simulated refresh RPC and table UPDATE return `SYNTHETIC_PREVIEW_WRITE_DENIED`; and the served substitute JavaScript contains neither production Supabase URL nor the anonymous JWT literal. It is not a real authentication service. The launcher test verified 6 module links and all 11 flag controls: NAV ONLY activates exactly `COSTING_NAV_GROUPS_V1`, All ON enables 11, Reset returns the tested browser profile flags OFF, and navigation into Cost Sheet Review retains only local preview state.

## Local use — detached Windows/Claude worktree

No deployment URL exists; this is intentionally localhost-only. On a machine with the repository and Node.js 22:

```powershell
git fetch origin preview/costing-wp05-wp06-wp12-20261105
git worktree add --detach ..\sasv-costing-synthetic-preview 7c028d0557fe4e14af11f59b1961d684f05cdcd0
cd ..\sasv-costing-synthetic-preview
node scripts/costing-preview/read-only-loopback-server.mjs
```

Open the **exact localhost URL printed by Node**, ending in `/__preview/`. Only that origin receives browser flag changes; default flags are OFF. The server must remain on `127.0.0.1` and must not be reverse-proxied, publicly exposed or used for real credentials. Press Reset OFF before closing the test profile. Node does not need Supabase access for the local server; Chromium CI dependencies are separate.

**The launcher is a synthetic demonstration.** Most operational data-backed tables cannot populate because deliberately no real backend is connected; two fake SKU status records are not a substitute for populated database acceptance.

## Next acceptance and governance boundary

- **Completed:** source-pinned local prototype, real Costing page display, synthetic auth/fixture, reversible 11-flag interactions, mock read/write denials, explicit user warning, security and regression tests.
- **Still OPEN:** signed-in authenticated view-only role against an approved isolated data source, real working populated-data paths, server-side negative permission testing on all operational RPCs (especially refresh/approval/lock), exact served build provenance, ten Pricing Policy workspaces, owner acceptance decisions and WP12 A14 packaged Windows installer.
- A future **real-data** preview requires a separately reviewed, server-enforced read-only adapter or isolated test Supabase project. Do not point this synthetic origin at the production database, reuse an authenticated session or broaden the local server into an unaudited proxy. Accidental failed refresh #150 demonstrates the importance of this separation.
- Code remains **preview branch only**; no `main` code changes or production PWA/Electron/Supabase configuration, policies, data, flags, costing approvals or deployments occurred.

**Formal work-pack closure remains 5 of 13 (38%).**
