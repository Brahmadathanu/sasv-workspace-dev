# WP10/WP12 — Office-PC Electron candidate: safe preparation and receiving protocol
**Prepared 18 November 2026. PREPARATION ONLY — NO INSTALLER BUILT, UPLOADED, RELEASED, MERGED OR INSTALLED. Electron release HOLD remains.**

## A. Exact baseline and why a normal `npm run build` is NOT yet approved
- Source baseline: `main` at **`8c7648fab72f2cf2e40bacc74e8fe59bedca2777`**. The experimental docs/research draft PRs #472/#473 are not release source; do not combine them into the installer.
- The baseline `package.json` declares **`version=6.1.0`**, `productName=SASV Workspace`, `appId=com.brahmadathanu.sasvworkspace`, Windows `nsis` and `zip` targets, output `dist`, an NSIS `guid=A3F5C8D2-14BE-4E7A-9B3C-6D0E2F1A4B87`, per-user installation, and GitHub publication metadata.
- In packaged mode, `main.js` configures `electron-updater` GitHub feed, `autoDownload=true`, `autoInstallOnAppQuit=true`, checks at startup/interval/focus/resume. `app.isPackaged` suppresses updates only in un-packaged dev mode. **`--publish never` prevents publishing; it does NOT disable the packaged application's GitHub auto-update behaviour.**
- An installer built from the unmodified baseline would share the staff application identity, installer GUID and version. On an office PC this may collide with an existing installation, AppData, Start Menu shortcuts and the production update channel. **NO-GO: do not execute a standard NSIS installer from this baseline on the owner's PC.**
- `npm start` development workflow is separate; maintain it, do not run packaging from the owner's mutable development working tree, and do not copy user profiles, credentials, browser sessions or Supabase secrets into artifacts.

## B. Safe candidate isolation: requirements before building an installable test binary
Prepare a **candidate-only source branch** from the pinned baseline. Make reviewable, candidate-only changes which:
1. Give the test application a unique **app ID**, **product/display name**, **NSIS GUID**, executable/shortcut names, and **separate userData location**. Never overwrite or uninstall `SASV Workspace`, and do not assume changing the installer name alone isolates the user profile.
2. Make the GitHub `electron-updater` startup, periodic, focus/resume and manual update checks **inert for the test candidate**, via an explicit, verifiable packaged-build marker. Neither relying on `NODE_ENV` nor `--publish never` suffices. The production update path must remain unchanged outside the isolated candidate.
3. Distinguish the candidate version/build identity from the currently documented `6.1.0` and show the exact release SHA in the receiving receipt. Do not select a production release number, create a GitHub Release/tag or upload `latest.yml` as if it were a release.
4. Use `electron-builder --win nsis zip --publish never` only **after** the above guards pass and the exact candidate branch/SHA is documented. Run packaging on a suitable clean Windows build environment with pinned Node/npm lockfile. Prevent any implicit publish through credentials or environment.
5. Preserve the four current governed `rpc_wp10_*` CRUD flows and the Costing Suite source exactly; the candidate must not reintroduce direct classification CRUD or activate default-OFF Costing flags.
6. Check ASAR includes four master classification JS/HTML routes, approved Costing assets and updater isolation marker. Create SHA-256 digests for NSIS, ZIP and `app.asar`, keep artifacts private/unpublished, and scan the included files for secrets before distribution to the owner.
7. Use non-production/disposable fixtures for any writer testing. **No production writes** to classification masters or costing runs.

**Stop gate:** if any isolation mechanism is absent or uncertain, produce only the source preflight report, not an installer or a passing install receipt. Ask for review of the exact candidate implementation rather than applying ad hoc environment overrides.

## C. Office Windows PC receiving procedure (owner, after candidate is actually built and reviewed)
1. On the office PC, check whether normal `SASV Workspace` is already installed and record only version and install type (no machine name, user identity or private paths in GitHub). Save local restore/uninstall information. Keep `npm start` repo and npm dependencies untouched.
2. Verify exact candidate release SHA, test-only product identity, installer SHA-256 and that auto-updating is disabled. **Do not run the installer** if any of these fail.
3. Install test identity separately; verify app display name, Start Menu and installation/userData folders do not collide with the normal production identity or development shortcut. Confirm install/restart/uninstall does not delete ordinary SASV app data.
4. In an authorised existing account, read-only verify login, six Costing modules, November Cost Comparison, WP11 PM BOM responsive/Deactivate label, four classification screens, and Procurement Execution Console. Preserve previously accepted evidence; do not repeat unrelated tests unless the build materially changed.
5. Verify a normal quit/restart does not initiate a download or install from the GitHub production update feed. Candidate updater must be inert. Capture local-only package/version and source/ASAR digest.
6. **Role validation remains separate:** independently identified Editor, View-only and No-access sessions are needed for signed-in negative security acceptance. Do not impersonate accounts or treat missing role evidence as PASS.
7. Uninstall test-only identity and verify production app, development workflow and data locations remain unaffected. After any future four-master ACL hardening, never roll back to a legacy direct-DML binary.

## D. Gate matrix / explicit holds
| Gate | Status as of preparation | Required before claiming PASS |
|---|---|---|
| Source pin, packaging/updater risk review | VERIFIED from main source | Source review complete |
| Candidate identity and auto-update isolation | **NOT IMPLEMENTED** | Reviewed candidate-only code + checks |
| Build NSIS/ZIP and app.asar | **NOT BUILT** | Windows builder output + digests |
| Signed-in office-PC installation | **NOT TESTED** | Owner receives separate test binary |
| Staff Electron fleet versions and migration | **NOT TESTED** | Actual version counts, not GitHub updater inference |
| WP10 four-table direct-DML hardening | **CONFIRMED OPEN RISK** | Fleet compatibility, separately approved security SQL |
| WP12 independent roles, sensitive-view denials, 4s p95 | **NOT TESTED/OPEN** | Legitimate independent sessions and bounded acceptance |
| Installer publication, staff rollout | **NOT APPROVED** | Separate owner exact-version approval |

## E. Safe next technical package for Claude Code/cloud
Implement the candidate-only isolation in a **new draft PR against main**, preserving baseline application production semantics and avoiding changes to project `main.js` that would automatically ship to production without feature/build gating. Include static/source tests for unique appId/GUID/product/userData, updater OFF, version/provenance, ASAR contents and hard-fail protections against a standard package identity. Demonstrate an isolated Windows or CI package build before requesting the owner to install. The candidate must be unpublished; do not merge, tag, create GitHub Release, enable production updater, change Supabase, or change any staff installation.

## Programme posture
WP00–WP09 and WP11 CLOSED (11/13). WP10/WP12 OPEN. Electron combined release **HOLD**. Optional WP10 SQL PR #463 unapplied; optional fleet inventory PR #471 draft. Cost Comparison owner-reported mobile installed PWA visual PASS after stats maintenance; no p95 claim. No direct-table ACL changes authorized here.
