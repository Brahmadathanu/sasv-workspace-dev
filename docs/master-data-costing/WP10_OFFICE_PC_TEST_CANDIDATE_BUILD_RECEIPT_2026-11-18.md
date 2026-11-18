# WP10/WP12 — Office-PC TEST candidate: implementation and unpublished build receipt (18 November 2026)

**UNPUBLISHED TEST CANDIDATE. NOT A RELEASE. NOT UPLOADED, TAGGED, MERGED, DISTRIBUTED OR INSTALLED. Electron release HOLD remains.** Implements the "safe next technical package" of [PR #474's preparation document](WP10_OFFICE_PC_UNPUBLISHED_ELECTRON_CANDIDATE_PREPARATION_2026-11-18.md) as a separate draft PR against `main`. Pinned baseline: `main` `8c7648fab72f2cf2e40bacc74e8fe59bedca2777`. No Supabase/SQL/permission/flag change; `public/`, `js/`, `preload.js`, root `package.json` and `package-lock.json` are byte-identical to the baseline.

## 1. What changed (candidate-only; normal app and `npm start` unchanged)
| Item | Mechanism |
|---|---|
| Separate identity | `electron/candidate/electron-builder.office-test.json`: appId `com.brahmadathanu.sasvworkspace.officetest`, productName `SASV Workspace OFFICE TEST`, new NSIS GUID `7E24F336-164C-4D66-85A4-8D38A617BCE5` (production GUID differs), shortcut/uninstall names, artifact names `SASV-Workspace-OFFICE-TEST-<version>.<ext>`, package name `sasv-workspace-office-test`, version `6.1.0-officetest.1`, no desktop shortcut, `deleteAppDataOnUninstall=false`. |
| Separate user data | `main.js` calls `electron/candidate/office-test-isolation.js` first (before the single-instance lock): `app.setPath("userData", %APPDATA%\SASV Workspace OFFICE TEST)`. All app data, including the e-Aushadhi worker profile/logs, uses `app.getPath("userData")`. |
| Updater OFF | A **build-time marker** (`sasvOfficeTestCandidate`) is injected into the packaged `package.json` only by the candidate config (`extraMetadata`). When present: `canCheckForUpdates()` returns false (startup, 30-min interval, focus, resume and manual all inert), no feed is set, no check is scheduled, `autoDownload`/`autoInstallOnAppQuit` forced false, `updater:restart` refuses, **and** `publish: null` means no `app-update.yml`/`latest.yml` is produced. Renderer UI is unchanged (state stays `idle`). |
| Fail-closed identity | A present-but-ambiguous marker (production appId, wrong data folder, non-40-hex SHA such as the committed `UNSET`, updater not disabled…) makes the app show an error and exit(3). |
| Port 3000 guard | The static server must stay on `http://localhost:3000` (Supabase CORS/reset redirects), so **the candidate cannot run at the same time as SASV Workspace or `npm start`**. If the port is taken the candidate shows a message and exits instead of loading another app's pages. |
| Visible marking | Window titles are prefixed `[OFFICE TEST]`. |
| Normal build untouched | No marker in the repo `package.json` ⇒ `activate()` returns `null`, no side effects; all `main.js` additions are `if (OFFICE_TEST)`-gated. |

Existing guard changed (needs reviewer attention): `scripts/wp10-g2-safeguards/source.test.mjs` S4 diffs `main.js`/`electron/` against `origin/main` and allow-lists exact paths; three exact paths were added (`main.js`, `electron/candidate/office-test-isolation.js`, `electron/candidate/electron-builder.office-test.json`), no wildcards.

## 2. Tests
- New `scripts/office-test-candidate/isolation.test.mjs`: **15/15 PASS**. Includes the **real `main.js` loaded with Electron/updater/express mocked** in three modes: normal packaged (production AUMID, GitHub feed + startup check + autoDownload exactly as before, restart works), normal unpackaged/`npm start` (dev AUMID, no checks), candidate (userData set *before* the single-instance lock, candidate AUMID, zero `setFeedURL`/`checkForUpdates`/`quitAndInstall` across startup/focus/resume/manual/restart, title prefix, port-3000 error → exit 2); invalid marker → exit 3. Also: baseline `package.json` equality, changed-path allow-list against the baseline, identity-guard mutants, ASAR/package mutants, env scrubbing, PE helpers.
- Regression set run on **pinned `main` (clean worktree) and this branch**: `csr-comparison-verifier`, `csr-scoped-rpc-client`, `csr-pwa-freshness`, `costing-wp12-flag-sweep/console-rpc-allowlist`, `wp10-client-release-contract`, 12 non-browser `wp10-g2-safeguards` suites. **Pinned `main`: 134/134. This branch: 149/149** (134 + the 15 new tests). During development S4 failed once (candidate-induced: it flags any new `main.js`/`electron/` path) until the three exact paths were allow-listed. Note: on the #472 documentation branch seven of these WP10 guards fail because they diff against `origin/main`; that does not occur on `main`-based branches. Browser/Playwright suites and hosted-site scripts were not run.
- Lint: new files clean; `main.js` has no new lint errors (pre-existing unused-variable findings only).
- **Not tested:** the packaged Windows binaries were never executed (no Windows host here); updater inertness is proven by source + mocked-Electron tests, not by a real installed run.

## 3. Build (unpublished) — status BUILT AND STRUCTURALLY VERIFIED, NOT INSTALL-TESTED
`node scripts/office-test-candidate/build.mjs --out <dir outside repo> --sha <sha>` exports the exact commit with `git archive`, installs from the lockfile, strips `GH_TOKEN`/`GITHUB_TOKEN`/`CSC_*` from the build environment, runs `electron-builder --win nsis zip --publish never` with the generated config, then verifies. Build host: Linux x64 cross-build with Wine 9.0 (`wine64` + `wine32`) for the NSIS uninstaller and exe resource editing; electron-builder 26.0.12, Electron 36.8.1, Node 22.23.4. **This differs from the "clean Windows build environment" preferred in the preparation document**; treat as a test build.

**Candidate source commit built: `f590817946f29455224b212b6c94a5e5f2fb2e52`.** Later commits on this branch change only tests and documentation/evidence (`main.js`, `electron/candidate/*`, `build.mjs` logic at build time are those of `f590817`; confirmed by `git diff --stat f590817 HEAD` listing no runtime file).

| Artifact (kept private, outside the repository) | SHA-256 | Bytes |
|---|---|---:|
| `SASV-Workspace-OFFICE-TEST-6.1.0-officetest.1.exe` (NSIS) | `855ba8218605f393c55bb9f38d60d7b6e9886135285f3b7c288c15d4f0afa994` | 106,402,644 |
| `SASV-Workspace-OFFICE-TEST-6.1.0-officetest.1.zip` | `28b341edd1a7e05d9815eea8ba1c87f401e9a43e7c76086ee0c50dda348172b6` | 141,411,758 |
| `app.asar` | `2c178f2096d8c3e2a89ece6fe328bb4f7cc80923889f3e3370ea24b7a5c91ab0` | 62,242,628 |

Verified by the build script (`evidence/office-test-candidate-f590817/manifest.json`, verdict `VERIFIED`, 0 problems): packaged `package.json` carries the exact source SHA, candidate name/version/productName and marker; ASAR holds the four classification pages + JS, the WP10 safeguards, the 74 Costing assets, `sw.js` and the isolation module; no `docs/`, `scripts/`, `supabase/`, `sql/`, `.env`, key files, `app-update.yml` or `latest.yml`; **429/429 ASAR files byte-identical to the committed blobs**; secret scan 0 hits (3 public anon-key occurrences counted, no values recorded); `.exe` version resources carry `SASV Workspace OFFICE TEST` / `6.1.0-officetest.1`; no production executable name; ZIP and the 7-Zip-extracted installer payload contain an `app.asar` identical to the hashed one; PE certificate tables are 0 bytes ⇒ **UNSIGNED** (Windows SmartScreen will warn).

**Limits of the verification — do not over-read:** the NSIS GUID could not be extracted from the compressed installer header; it is verified from the exact builder input only (`builder.generated.json`). Hashes are **not reproducible across builds** (a rebuild produces different bytes; compare the committed SHA-256s only against the specific files from this build). The artifacts exist only in the ephemeral cloud session scratch space: **they are not committed, uploaded or attached anywhere**; delivery to the owner needs a separate decision (see §6).

## 4. Findings recorded for the owner
1. **Baseline hygiene:** `main` tracks an empty (0-byte) `.env`, so every normal production package ships it. It contains no secret; the candidate excludes it. Consider removing it from version control separately.
2. Setting a custom `TMPDIR` crashes Wine's rcedit (reproduced); the build script runs the builder with the default temp dir.
3. The verifier caught two real defects during development (packaged `productName` still production; `.env` in the ASAR); both fixed before the final build.
4. The baseline's packaged `package.json` still contains the production `build` block (appId/GUID/GitHub publish). It is inert at runtime (electron-updater reads `app-update.yml`, which this build does not produce) but visible to anyone inspecting the ASAR.

## 5. Receiving procedure deltas versus the preparation document §C
Close SASV Workspace **and** any `npm start` session before starting the test app (port 3000). Check the test app's window title starts `[OFFICE TEST]`, Start Menu entry is `SASV Workspace OFFICE TEST`, and data appears under `%APPDATA%\SASV Workspace OFFICE TEST`. Confirm a quit/restart triggers no download. Do not run the installer unless the SHA-256 of the received file equals §3. Role validation, seven sensitive-view negative GETs and the p95 remain separate OPEN gates.

## 6. Owner decisions needed (nothing below is authorised by this receipt)
1. Review the candidate PR (code + the S4 allow-list change). 2. Decide how, if at all, the private artifacts reach the office PC (e.g. owner-run rebuild on a Windows machine with the script, or an explicitly approved private transfer); a rebuild will have different hashes. 3. Whether a clean **Windows** rebuild is required before any install. 4. Separate approval for any installation test. Publication, tagging, release notes, staff rollout and lifting the Electron HOLD remain **NOT APPROVED**.
