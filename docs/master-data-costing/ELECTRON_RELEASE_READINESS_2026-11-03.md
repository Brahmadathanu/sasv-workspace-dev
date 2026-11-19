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

## Update 19 Nov 2026: release-candidate hardening status

Details: [ELECTRON_RC_DEPENDENCY_HARDENING_REPORT_2026-11-19.md](ELECTRON_RC_DEPENDENCY_HARDENING_REPORT_2026-11-19.md). Nothing published; release remains on **HOLD**.

- **Owner packaged-app acceptance (local unpacked build from `main` `6b415c25`):** PASS, 10/10 modules (owner-reported; recorded in PR #465). Packaged ASAR static checks PASS (30/30 key files identical to git, governed RPC writers only).
- **Dependency advisories:** runtime (shipped) advisories 11 -> **0**; all dependencies 40 -> 10 (0 critical), via a lockfile-only fix plus one tested `overrides` entry. **Open:** Electron 36.x (45 advisories) needs a major upgrade to 42+ (recommend 43/44/45) in its own PR with the owner checklist; remaining others are build-time only.
- **Windows packaging verification (nsis + zip, publish never) on the hardened tree:** PASS. Launch/UI of this dependency set on a packaged build: NOT TESTED.
- **Version:** proposal 6.2.0 (published latest is 6.1.0); bump belongs in a separate release PR re-built on that exact head.
- **Code signing:** installer and executable are unsigned; signing recommended before the fleet cutover; risk acceptance only for a controlled pilot (owner decision).
- **Fleet:** inventory instrument (PR #471) hardened and Windows-CI tested; real-workstation pilot NOT TESTED; Stage B blocked until the fleet gates pass.

### Electron 45.4.1 upgrade (merged to main as #482; #480 merged earlier)
Details: [ELECTRON_45_UPGRADE_REPORT_2026-11-19.md](ELECTRON_45_UPGRADE_REPORT_2026-11-19.md). Owner approved the target Electron 45.4.1 and version 6.2.0 (assigned in the release-candidate PR).
- **Electron advisories:** 45 -> **0** (all dependencies 8, none shipped; runtime 0).
- **Main-process hardening:** static server bound to loopback only, wildcard CORS removed, `webSecurity:false` removed, `open-module-url` restricted to app pages, same-origin window/navigation policy. Automated Electron smoke 9/9 on source and on the built ASAR; Windows packaging pass; updater feed discovery pass on a local feed.
- **Still NOT TESTED:** the packaged `.exe` (would start the real updater), sign-in and authenticated screens in Electron 45 (owner checklist), real-workstation fleet pilot. Release remains on **HOLD**.

### 6.2.0 release candidate (draft PR; NOT published)
Details: [ELECTRON_6_2_0_RELEASE_CANDIDATE_REPORT_2026-11-19.md](ELECTRON_6_2_0_RELEASE_CANDIDATE_REPORT_2026-11-19.md) and [ELECTRON_CODE_SIGNING_PROPOSAL_2026-11-19.md](ELECTRON_CODE_SIGNING_PROPOSAL_2026-11-19.md).
- **Candidate:** version 6.2.0 on Electron 45.4.1; local unsigned x64 build (`--publish never`); ASAR 30/30 key files identical to git; runtime advisories 0; no secrets in the package; updater compatibility and a real-artifact download plus tamper rejection verified on a local feed (nothing installed).
- **Explicit acceptance gates, all NOT TESTED until the office Windows PC is available:** G1 packaged Electron 45 signed-in UI pass (6 Costing + 4 Classification modules, Home/back, print popup); G2 installer over a 6.1.0 install; G3 pilot update path via a GitHub pre-release on 1 to 2 PCs; G4 code-signing decision and signed build; G5 fleet gates F1 to F6; G6 Stage B (blocked until G5, separate approval).
- **Open work packs:** WP10 OPEN (cosmetic leftovers; production writer testing on a disposable fixture or owner-approved scope; fleet gates); WP12 OPEN (V6 positive read inconclusive; Cost Comparison performance under #273 and the 4 s p95 decision; live flag ON/ALL-ON deferred; Windows pilot).
- **Publication:** **HOLD**. Promoting a GitHub release to "Latest" is the fleet cutover; a pre-release is not offered to installed 6.1.0 clients.

### Remote readiness reconciliation (19 Nov 2026; documentation only)
Details: [ELECTRON_6_2_0_REMOTE_READINESS_RECONCILIATION_2026-11-19.md](ELECTRON_6_2_0_REMOTE_READINESS_RECONCILIATION_2026-11-19.md). All results above are preserved.
- **Exact-head CI:** #483 head `e46e3c37`, Windows run 44555940400, 25/25 pass.
- **Pre-release isolation:** verified from electron-updater 6.8.11 source (stable clients read `releases/latest`, which excludes pre-releases); no `v6.2.0` tag or release exists; live proof remains G3.
- **Rollback:** electron-updater never downgrades; pulling a release only contains new downloads; manual downgrade over 6.2.0 is NOT tested (add to G2). The RC report's rollback sentence is clarified there.
- **Signing:** Microsoft Artifact Signing does not list India; DigiCert OV + KeyLocker and GlobalSign OV + HSM are the candidates, price/eligibility UNVERIFIED pending owner-requested quotes. Nothing purchased.
- **Publication:** **HOLD**; WP10, WP12 OPEN; Stage B HOLD.
