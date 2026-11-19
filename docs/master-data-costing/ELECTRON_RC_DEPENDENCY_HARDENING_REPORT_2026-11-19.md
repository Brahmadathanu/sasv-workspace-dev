# Electron release candidate hardening: dependency advisories, version, signing (19 Nov 2026)

**STATUS: DRAFT PREPARATION. Nothing is published, no installer is distributed, no updater is run, no database privilege changes.** Base: `main` `6b415c25` (Electron build owner-accepted 10/10 modules on a local unpacked build). This change touches only `package.json` (`overrides`) and `package-lock.json`, plus this documentation.

## 1. Dependency advisories (`npm audit`, live registry, 19 Nov 2026)
| Scope | Before | After this change |
|---|---|---|
| All dependencies | 40 (2 critical, 32 high, 5 moderate, 1 low) | **10** (0 critical, 3 high, 7 moderate) |
| **Runtime (shipped, `--omit=dev`)** | **11** (1 critical, 9 high, 1 moderate) | **0** |

### What was done (controlled, no `--force`)
1. `npm audit fix --package-lock-only` (lockfile only, **no `package.json` range changes**, no major bump of a direct runtime dependency). It cleared every runtime advisory except one and also the two critical findings (`proxy-addr`, `tar`).
2. The one remaining runtime advisory was `image-size` (DoS in JXL/HEIF/ICNS parsers). Its only consumer is `html-to-docx` (SOP export in `main.js`), which pins `^1.0.0`; the fix is in 2.1.0 (a major). A scoped `overrides` entry (`html-to-docx` -> `image-size ^2.1.0`) was added, and **html-to-docx conversion was functionally tested** with embedded PNG, JPEG, an image without size attributes, and a table (all produced valid DOCX), so the override is compatible for the code paths the app uses.
3. Versions that now ship inside `app.asar` (read from the built ASAR): `electron-updater` 6.6.2 -> **6.8.11**, `builder-util-runtime` 9.3.1 -> **9.7.0** (the updater's cross-origin redirect token-leak and search-path advisories), `body-parser` 2.4.0, `proxy-addr` 2.0.8, `path-to-regexp` 8.4.2, `qs` 6.17.1, `ws` 8.23.0, `lodash` 4.18.1, `js-yaml` 4.3.2, `nanoid` 5.1.16, `image-size` 2.1.0. `express` 5.1.0, `@supabase/supabase-js` 2.55.0, `pg` 8.16.3 are unchanged.
4. Build-time tools moved within their ranges: `electron` 36.8.1 -> 36.9.5, `electron-builder` 26.0.12 -> 26.18.0, `supabase` CLI 2.72.0 -> 2.122.1 (dev only). ESLint, globals, sharp and glob did not change.

### Remaining 10 (none in the shipped runtime dependency set)
| Package | Severity | Kind | Disposition |
|---|---|---|---|
| `electron` 36.9.5 | high (45 advisories: 12 high, 24 moderate, 9 low) | direct, **shipped binary** | **Owner decision, section 1.1**: needs a major upgrade |
| `extract-zip` | high | transitive of `electron`'s install-time downloader | build-machine only; resolved by the Electron upgrade |
| `sharp` 0.34.5 | high (libvips/libheif/librsvg) | direct dev, used only by the branding-asset script | not shipped; bump to 0.35 in a branding-tooling change (major) |
| `glob`, `minimatch` | moderate | dev tooling | not shipped; glob 14 is a major |
| `electron-builder`, `app-builder-lib`, `dmg-builder`, `@electron/universal`, `electron-builder-squirrel-windows` | moderate | build tooling for macOS dmg / universal builds; this project builds Windows nsis+zip only | not shipped; audit's suggested "fix" is a downgrade to 25.1.0 and is **not** recommended |

### 1.1 Electron: the one material open item
Electron 36 is out of the supported window and the audit lists 45 advisories against it (use-after-free classes, context-isolation bypass, permission-origin errors; several are macOS-only or need attacker-controlled content). Latest release of each major, counted against the advisory ranges:
| Major (latest) | Advisories (high / moderate / low) |
|---|---|
| 36.9.5 | 45 (12 / 24 / 9) |
| 38.8.6 | 32 (9 / 16 / 7) |
| 39.8.10, 40.10.6 | 12 (5 / 4 / 3) |
| 41.10.7 | 8 (1 / 4 / 3) |
| **42.11.18, 43.8.12, 44.11.5, 45.4.1** | **0** |
Only 42 and later are clean. **Recommendation:** a dedicated Electron-upgrade PR targeting the newest stable major that the owner accepts (43, 44 or 45), after this PR, with the full owner checklist and a main-process smoke run. It was **not** done here because a 36 -> 43+ jump changes Chromium and Node and cannot be validated without launching the app and driving the UI, which this environment cannot do. Context for risk weighing, from `main.js`: windows use `nodeIntegration:false` and `contextIsolation:true` (good), but the main window sets `webSecurity:false`, there is no `setWindowOpenHandler`/`will-navigate` restriction in the main window, and the app loads only first-party content from `http://localhost:3000` plus the Supabase API. Until the upgrade, the exposure is reduced (not removed) by loading no third-party pages in Electron renderers.

## 2. Version proposal and auto-update compatibility
- Published latest is **v6.1.0** (18 Aug 2026); the candidate in `package.json` is also 6.1.0, so `electron-updater` would not offer it. **Proposal: 6.2.0** (new Costing Suite surfaces and RPC-only classification clients plus dependency security work justify a minor bump). The existing readiness plan requires the bump in a **separate release PR** re-built on that exact head, so this PR keeps 6.1.0; a 6.2.0 trial build was made only to prove the packaging path.
- Compatibility checked: same publish target (GitHub provider, owner/repo unchanged), `latest.yml` uses the dash-style asset name (`SASV-Workspace-Setup-<version>.exe`) like the published release; the nsis `blockmap` is produced; `autoDownload` and `autoInstallOnAppQuit` behaviour in `main.js` is unchanged. Installer upgrade over a per-user 6.1.0 install is expected to use the same NSIS `guid` (unchanged) but was **not run**.
- Note for later: electron-builder 27 requires a code-signing publisher name for updates unless `win.verifyUpdateCodeSignature` is disabled; this PR stays on 26.x.

## 3. Regression and packaging verification
| Check | Result |
|---|---|
| `npm ci` from the updated lockfile (622 packages) | pass |
| Runtime modules load and work under Electron's Node (`ELECTRON_RUN_AS_NODE`): express (routes, JSON body, query), pg, supabase-js, docx, marked, luxon, sanitize-filename, playwright-core, electron-updater, chart.js, flatpickr, tom-select, html-to-docx (DOCX with images) | pass (`electron-prompt` only loads inside a renderer by design) |
| WP10/WP09/protected-path suites (`scripts/wp10-*`, `wp09-g1-launcher-audit`, `pec-protected-path-guard`) | 200 pass, 10 fail; the **same 10 fail on the unmodified base** (pre-existing, unapplied-SQL and Windows-path items) |
| ESLint | 812 existing problems; ESLint, `@eslint/js` and globals versions are unchanged, no source file changed |
| Windows packaging: `electron-builder --win nsis zip --publish never` on the exact PR head (6.1.0) | pass; no publish, no signing |
| Packaged `app.asar` of that build: 4,523 files; 30/30 key files byte-identical to git (`package.json` excepted, it carries the override); 0 missing; 4 classification clients with 3 governed RPCs each and 0 direct writes; no direct classification writer anywhere in packaged JS/HTML | pass |
| Installer / ASAR / exe hashes of the PR-head build | installer `e6ac5c0254cb0f27…`, asar `ffd22ecce1354f31…`, exe `d2e6b4c4b1fa2829…` (SHA-256 prefixes; reproducibility across machines not claimed) |
| Launching the packaged app, sign-in and UI regression of the new dependency set | **NOT TESTED** by this session (no desktop control); the owner's 10-module pass was on the previous build |

## 4. Code signing: evaluation
Current state: installer and executable are **NotSigned** (`no code signing certificate configured`).
| Option | Notes |
|---|---|
| **A. Sign (recommended before staff-wide auto-update)** | Gives publisher identity, reduces SmartScreen and antivirus friction, and enables the updater's own signature check on downloaded updates (`publisherName` is embedded in `app-update.yml` when electron-builder signs). Routes: Microsoft Artifact Signing (formerly Trusted Signing; GA Jan 2026; low monthly cost; identity validation in the Azure portal; availability depends on region and country, so the live eligibility table must be checked, with reports of validation delays), or an OV/EV certificate with a hardware or cloud-HSM key from a certificate authority (annual cost, longer onboarding). |
| **B. Documented risk acceptance (interim only)** | Without signing, update integrity rests on HTTPS to GitHub and the `sha512` in `latest.yml`; anyone who can alter a GitHub release or its manifest could push code to every staff PC. Acceptable only for a small controlled pilot with compensating controls: 2FA and restricted write access on the repository and releases, no auto-update rollout beyond named pilot machines, out-of-band SHA-256 confirmation of each artifact, and a signing date committed by the owner. |
Recommendation: signing is required before the fleet cutover; risk acceptance is only suitable for a pilot. Owner decision.

## 5. Other findings (outside dependencies, not changed here)
- `main.js` embeds an Express static server that calls `listen(3000, ...)` **without a host**, so it listens on all interfaces, serves the app directory, and sends `Access-Control-Allow-Origin: *`. Recommend binding to `127.0.0.1` and dropping the wildcard CORS outside development; both need a UI regression pass, so they are proposed for the same follow-up as the Electron upgrade.
- `webSecurity:false` on the main window (comment says it works around CORS) should be revisited together with the above.

## 6. Remaining blockers and owner actions
1. **Owner:** choose the Electron major (43/44/45 recommended) so a follow-up PR can upgrade, rebuild and re-run the 10-module checklist.
2. **Owner:** signing decision (sign vs pilot-only risk acceptance), and the exact release version (proposal 6.2.0).
3. **Owner/IT:** fleet inventory (PR #471 tool pilot) and the installed-migration gates; Stage B stays blocked until they pass.
4. Launch/UI verification of this dependency set on a packaged build (owner checklist, about 10 minutes).
5. Release approval; rollback keeps v6.1.0 and 6.0.1 assets.

**Rollback:** revert this PR (lockfile and override only). No schema, data or published artifact is affected.
