# SASV Workspace — Electron Release Readiness Gate (3 Nov 2026)

**Status: SOURCE INTEGRATED; DISTRIBUTABLE RELEASE NOT YET AUTHORISED.** This is a gate/checklist, not an instruction to publish, deploy or activate. It belongs to the single Costing Suite programme control plane.

## Evidence verified from GitHub (3 Nov 2026)

- Integrated `main`: `d395d7e8031a28e56ea1b0997424932997a36636` (N1/N2/N3/N4/W6 all merged, plus guard fix #138).
- Final pre-merge W6 head: `5c3869acd849c20355278d8c265e4a85479e01b1` — LF 605/605, CRLF 605/605, zero failed/skipped/cancelled/TODO and 61 Chromium tests on each, as recorded in PR #139; full-history worktrees. Git tree/blob comparison of final head and squash-merged main returned **2,271 exact matching entries, zero mismatches**, confirming no content drift. **No new post-merge test execution is claimed.**
- Root package version: `6.1.0`; most recent published GitHub Release: `v6.1.0` on 18 Aug 2026, with installer/zip/`latest.yml`. A new release must use an owner-approved new version. No replacement or overwrite of the existing v6.1.0 release.
- `public/sw.js` remains `hub-cache-v390`; live PWA deployment and cache provenance not verified here. A cache bump is *not* authorised by source integration.
- Electron `main.js` uses `electron-updater` with GitHub feed and `autoDownload=true`, `autoInstallOnAppQuit=true`; releasing is a user-impacting action and therefore must be separately approved.
- Mock-backend Chromium has passed. **Signed-in populated-data acceptance, Windows packaged runtime proof and cross-module colleagues' smoke testing are outstanding.** Default-OFF feature behaviour is the accepted release baseline. C9 shared-registry correction deferred; e-Aushadhi WP-07 integration paused; retention PR #137 parked.

## Controlled Windows pre-release verification — no publishing

1. Use clean, full-history `main` at the exact reviewed SHA; do not test an unmerged feature branch. Confirm `git rev-parse HEAD`, `git status --short` (empty), `git rev-parse --is-shallow-repository` (`false`), `node --version`, `npm --version`.
2. Restore pinned dependencies via `npm ci` (do not regenerate the lockfile). Confirm Playwright/Chromium executable installation and **do not accept skipped browser tests**.
3. On Windows PowerShell, run a complete test suite with explicit file enumeration; do not pass a directory expecting Node to discover every test:
   ```powershell
   $tests = @(Get-ChildItem scripts -Recurse -File | Where-Object { $_.Name -match '\.test\.' } | Sort-Object FullName | ForEach-Object { $_.FullName })
   node --test $tests
   ```
   Preserve the full output and summary (tests/pass/fail/skipped/cancelled/TODO/browser). Record exact tested SHA and CRLF settings. The LF/CRLF proof on the identical merged file tree is already recorded; a fresh post-merge run is an additional gate, not to be fabricated.
4. Build **locally without publishing** on the intended Windows environment. As an internal baseline, `npx electron-builder --win nsis zip --publish never`; do not invoke `--publish always` or `electron-builder --publish` unintentionally. Check that `dist` contains valid Windows NSIS and zip artifacts and inspect packaged app resources. An unversioned QA build at `6.1.0` must never be shared or published as an update.
5. Test the locally packaged candidate under a controlled test account/session: launch and sign-in; open Dashboard/Costing Control Center, readiness, Material Cost, Cost Build, Pricing Policy Manager, Cost Sheet Review and Production Route; verify visibility/permissions, legacy deep links, default-OFF behaviour, no unexpected writes and no broken render. Include other colleague-critical non-Costing modules as an independent cross-module smoke (not assumed proven by Costing tests). Test save/close/reopen, local path/asset behaviour, and update UX without publishing an update.
6. Document installer/zip size, build logs, version, signing/signature expectations (if any), artifact SHA256, `latest.yml` version/filenames/update target behaviour, and an explicit rollback strategy retaining v6.1.0.
7. Select and approve a **new** semantic version and release notes only after these checks. Apply version bump in a separate release PR and re-build/re-test that exact release head; obtain a separate owner approval before GitHub publishing, installer distribution, production activation, any feature flags or service-worker cache/deployment changes.

## Decision and outstanding blockers

- **Navigation package integration:** COMPLETE (4/4).
- **Repository post-merge code equivalence:** PASS; no content drift.
- **Independent fresh post-merge execution:** NOT PERFORMED.
- **Windows packaged installer + authenticated smoke:** NOT PERFORMED.
- **New version selection and release candidate:** NOT APPROVED / NOT BUILT.
- **Electron GitHub publish/update rollout:** **HOLD**.
- **PWA deployment/cache/feature-flag activation:** **HOLD**, independent of an Electron installer release.
- **Programme:** WP05, WP06, MDC-07 and later work packs remain open until their separate requirements close; U11 terminology is not part of the four completed navigation packages.

**Next execution owner:** Windows/Claude local worker runs pre-release checks and submits a versioned release-candidate report without publishing; assistant independently reviews; owner approves release/version/rollout. No new engineering work or feature scope should be added to this audit merely to satisfy documentation.
