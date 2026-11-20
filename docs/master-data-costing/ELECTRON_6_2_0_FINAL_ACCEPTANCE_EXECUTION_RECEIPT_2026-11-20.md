# SASV Workspace 6.2.0: final acceptance execution receipt (20 Nov 2026)

**STATUS: 6.2.0 NOT PUBLISHED. G1 PASS (owner-reported; see 4a). No tag, release, SQL, grant, flag or fleet change.** WP10 and WP12 remain **OPEN**; Stage B **HOLD**.

## 1. Candidate identity (supersedes the earlier-SHA references)
The procedures document (19 Nov) names code head `e46e3c37` of #483. #483 is now merged: the accepted source is `main` at
`ebb59a4954b245bc7912e9872682d440f318f6ed` (verified equal to `origin/main` on 20 Nov 2026; clean detached worktree, 0 modified files). The code is the same as `e46e3c37` plus documentation; rule in procedures section 0 applies to any later change under the path-filtered Electron paths.

## 2. Build and verification (isolated worktree, `npm ci`, `install-electron`, `electron-builder --win nsis zip --publish never`)
| Item | Result |
|---|---|
| `npm run test:electron` | 20/20 pass (Electron 45.4.1) |
| Electron binary | 45.4.1 |
| Runtime `npm audit` (`--omit=dev`) | 0 vulnerabilities (no regression) |
| Full `npm audit` | 8 (7 moderate, 1 high), build/dev tooling only: same as RC report |
| Exe `ProductVersion` / `FileVersion` | 6.2.0.0 / 6.2.0 |
| Authenticode | NotSigned (expected) |
| ASAR | 5,125 entries; no `.env`, key or `.pem` files (only third-party `eslint.config.mjs` inside `node_modules`) |
| Source after build | unmodified (0 changes) |
| `latest.yml` | version 6.2.0, `SASV-Workspace-Setup-6.2.0.exe`, size 141,444,151, sha512 matches installer |

| Artifact | Bytes | SHA-256 |
|---|---|---|
| `SASV Workspace Setup 6.2.0.exe` | 141,444,151 | full hash below |
| `SASV Workspace-6.2.0-win.zip` | 177,000,130 | full hash below |
| `win-unpacked\SASV Workspace.exe` | 250,311,680 | `c226ee9bc736246d4d8359817ba6bd88b7c047585a558e7623215293c22fa9c1` |
| `win-unpacked\resources\app.asar` | 63,857,588 | `b316122f2f720b440144a5a659e22389bea8ca3a4aea723b97350d42d26e31f1` |

Full hashes:
- Installer: `AE9AF8561648921CE92F290C7FFD15841821516979BE8CBED082EB772958AA9A`
- ZIP: `B88C78D20EEE2731B2E45B9F346CF7AF2E0C9681C5DBE4D95D348157513E89AD`

The exe and ASAR hashes equal the RC report's; the installer and ZIP differ (NSIS/ZIP containers are not byte-reproducible).

## 3. GitHub read-only baseline (20 Nov 2026)
Latest release `v6.1.0`; no `v6.2.0` tag or release; `v6.1.0` `latest.yml` digest `415b54fe...28aaca7` and installer digest `0884f2bc...8557f4` unchanged. `v6.0.1` and `v6.1.0` assets untouched.

## 4. G1 status
Desktop automation tools are not available in this session and sign-in needs the owner's credentials, which must not be entered by the agent. The hosted PWA is not a substitute. At the time of the first build all seven G1 rows were NOT TESTED (superseded by 4a). Owner launcher: `D:\ELECTRON PROJECTS\sasv-620-g1-launch-G1.bat` (isolated `--user-data-dir` and redirected `LOCALAPPDATA`; the installed profile `%APPDATA%\SASV Workspace` and `daily-worklog-app-updater` cache are not used). Pass/fail rows are in the procedures document section 2.

### 4a. G1 closure (20 Nov 2026, owner-reported)
**G1: PASS (owner-reported, all seven rows).** Owner completed, on the packaged 6.2.0 build above (isolated profile via the launcher): login; six Costing modules; four Classification modules; Home/back; one print popup; no errors, CORS or blank pages; no unexpected updater download; sign-out. Evidence is the owner's report; no screenshots or data retained. No writers were activated.
Cleanup, verified before deletion: launcher uses `%TEMP%\sasv-g1-profile` (21.2 MB, no reparse points) and `%TEMP%\sasv-g1-local` (0 MB of files; no updater cache was created, consistent with no download). App not running. Only those two folders were deleted. Untouched: installed profile `%APPDATA%\SASV Workspace`, `%LOCALAPPDATA%\daily-worklog-app-updater`, the dev folder, `sasv-release-test`, `dist\` artifacts and an unrelated `sasv-updater-compat-*` temp folder.

### 4b. Office-PC unsigned pilot: BLOCKED before install (20 Nov 2026)
Owner authorised (20 Nov 2026, in chat) an unsigned 6.2.0 install on this PC only, provided backup and rollback prerequisites pass. No GitHub release, tag, upload, other PC, auto-update or database change authorised.
| Prerequisite | Result |
|---|---|
| 6.1.0 actually installed? | **No.** `%LOCALAPPDATA%\Programs\daily-worklog-app` exists but is empty (0 items, no exe, no uninstaller). A stale per-user uninstall registry entry "SASV Workspace 3.12.0" points at the missing uninstaller. The app was previously run with `npm start`, not installed. This PC is a fresh-install case, not a 6.1.0 to 6.2.0 upgrade. |
| 6.2.0 installer SHA-256 | PASS: `AE9AF856...72958AA9A` equals the accepted build. |
| Profile and updater cache located | `%APPDATA%\SASV Workspace` (778 MB) and `%LOCALAPPDATA%\daily-worklog-app-updater` (holds a 6.0.1 `pending` installer). Not running. |
| Backup | PASS: profile (caches excluded, 1,577 files, 326 MB) and updater cache copied to `D:\ELECTRON PROJECTS\sasv-pilot-backup-20261120` (local only, not uploaded; contains session data, treat as confidential). |
| 6.1.0 rollback installer matches documented checksum | **FAIL.** Only local copy: `sasv-release-test\dist\SASV Workspace Setup 6.1.0.exe`, SHA-256 `A3E7436F...E1D792`, a local build. Documented published value is `0884f2bc...8557f4`. They differ, so it is not the accepted 6.1.0 artifact. |
**Result: BLOCKED. 6.2.0 was not installed.** Unblock by authorising download of the published `SASV-Workspace-Setup-6.1.0.exe` from the v6.1.0 release (about 103.6 MB) and verifying it against `0884f2bc...8557f4`, or by supplying a verified copy. Even then, evidence is a fresh install and will not prove the upgrade path (G2 stays NOT TESTED).

### 4c. Office-PC unsigned pilot: FRESH INSTALL (20 Nov 2026) - not a 6.1.0 to 6.2.0 migration
Owner then approved downloading the published 6.1.0 installer. **Rollback installer verified:** `gh release download v6.1.0` from `Brahmadathanu/sasv-workspace-dev` (non-pre-release), 103,567,655 bytes, full 64-hex SHA-256 equals the documented value `0884f2bc3acc2d8a06c565784c11526f98c03728ee8cd3be96b4e261438557f4` (compared programmatically against both the procedures document and the GitHub release asset digest), stored at `D:\ELECTRON PROJECTS\sasv-pilot-backup-20261120\rollback-6.1.0\`. Never executed. Unsigned, as published.
Install: `SASV Workspace Setup 6.2.0.exe` (SHA-256 `AE9AF856...72958AA9A`) run once per-user; no SmartScreen or UAC prompt required.
| Check | Result |
|---|---|
| Installed version | PASS: `%LOCALAPPDATA%\Programs\daily-worklog-app\SASV Workspace.exe` ProductVersion 6.2.0.0, SHA-256 equals the accepted exe (`C226EE9B...22FA9C1`); uninstall entry "SASV Workspace 6.2.0" added |
| Shortcut | PASS: Start Menu `SASV Workspace.lnk` targets the installed exe; the `SASV Workspace Dev` shortcut (dev electron) untouched; no Desktop shortcut |
| Launch | PASS: window title "SASV WORKSPACE \| Login" (signed-out login page) |
| Embedded server | PASS: listens on `[::1]:3000` only; no LAN listener on 3000 (a transient 192.168.x socket seen in one query was an outbound Chromium socket, not a server) |
| Updater | PASS (no download): cache holds the 6.0.1 `pending` files (unchanged timestamps) and `installer.exe`, which is the NSIS installer's own stored copy (hash equals the 6.2.0 installer), not a downloaded update |
| Login, six Costing, four Classification, Home/back, print popup on the installed app | **NOT TESTED** (needs the owner's sign-in; owner checklist pending) |
Notes: the stale "SASV Workspace 3.12.0" uninstall entry (different GUID) remains; it is a pre-existing orphan. The existing shared profile `%APPDATA%\SASV Workspace` (backed up) was used. Rollback: close app, uninstall 6.2.0 (profile kept), run the verified 6.1.0 installer manually, restore the profile backup only if incompatible.

### 4d. Office-PC pilot: installed copy blocked by Bitdefender (20 Nov 2026)
- ~12:05: Bitdefender Total Security (Advanced Threat Defense, "SuspiciousBehavior" detection) blocked and quarantined files of the freshly installed, unsigned 6.2.0 after the app was launched from PowerShell. The installed `SASV Workspace.exe` became unreadable; the owner restored items and added exclusions; the blocked folder was uninstalled/removed and 6.2.0 reinstalled from the verified installer (exe SHA-256 `C226EE9B...22FA9C1`, ProductVersion 6.2.0.0, readable). Embedded app launches to Login from the Start Menu.
- The installed copy then failed to sign in: console `ERR_CACHE_READ_FAILURE` and `esm.sh/@supabase/supabase-js@2 ERR_NETWORK_ACCESS_DENIED` (repeated after the regenerable web caches in the profile were cleared). The PC itself reaches esm.sh (HTTP 200) and Windows Firewall has no blocking rule; the owner could not find a Bitdefender firewall-rules screen.
- Control test: the identical binary (same SHA-256) run from `dist\win-unpacked` with an isolated profile signed in successfully (owner-reported). Conclusion (inference, not proven): Bitdefender restricts the installed copy's network access; the app and code are not at fault.
- **Result: installed-app login, navigation and print NOT TESTED. Pilot NOT complete.** Finding for the fleet: unsigned builds can be blocked by Bitdefender ATD; this strengthens the signing requirement and means each PC needs an AV allowance or a signed build before rollout. Fresh-install pilot only; G2 upgrade path NOT TESTED.

### 4e. Office-PC pilot: RESOLVED, installed fresh-install PASS (20 Nov 2026)
Root cause of the sign-in failure (owner finding): a firewall block on the installed exe (the owner had been looking in the Windows Firewall rules rather than the Bitdefender firewall); once corrected, the installed app signed in. The conclusion in 4d that Bitdefender restricts the installed copy's network access is therefore confirmed in kind (AV/firewall, not code or profile); the exact Bitdefender setting changed was not captured.
Owner-reported results on the **installed** 6.2.0 (SHA-256 of installed exe `C226EE9B...22FA9C1`, ProductVersion 6.2.0.0), isolated temporary profile then the real profile:
| Check | Result |
|---|---|
| Sign-in (temporary profile) | PASS |
| Six Costing + four Classification modules | PASS |
| Home/back from two modules | PASS |
| Read-only print popup | PASS (owner-reported) |
| Errors / update prompts | PASS: none |
| Sign-out | PASS |
| Start Menu launch, real profile, sign-in, sign-out | PASS |
| Updater | PASS (no download): cache holds only the installer's own stored copy and the old 6.0.1 files (unchanged 14 Aug timestamps) |
Temporary test profiles removed after verification (isolated paths only). Real profile `%APPDATA%\SASV Workspace` retained; its regenerable caches were cleared on 20 Nov and a backup exists. Rollback installer (`0884f2bc...8557f4`, verified) kept at `D:\ELECTRON PROJECTS\sasv-pilot-backup-20261120\rollback-6.1.0\`.
**Scope:** a FRESH install on one PC. It is not a 6.1.0-to-6.2.0 migration test (G2 NOT TESTED) and no pre-release exists (G3 NOT TESTED). Fleet finding: Bitdefender ATD quarantined the unsigned exe on first launch and a firewall allowance was needed; every staff PC with similar AV needs an allowance or a signed build.

### 4f. PUBLICATION: SASV Workspace v6.2.0 stable (20 Nov 2026, owner-directed, comment #7040209259)
Owner waived G2 (**G2 NOT TESTED, owner-accepted waiver, not PASS**); G3 NOT TESTED (no pre-release stage was used). Signing deferred; unsigned stable release accepted, with the Bitdefender/firewall risk acknowledged and no antivirus policy changed.
**Pre-publication gate (all passed):** `main` = `ebb59a4954b245bc7912e9872682d440f318f6ed`, identical to the accepted candidate (no commits since); worktree clean; installer SHA-256 `AE9AF856...72958AA9A`, ProductVersion 6.2.0.0; `latest.yml` version 6.2.0, url/path `SASV-Workspace-Setup-6.2.0.exe`, size 141,444,151 and sha512 recomputed and equal; blockmap present; no `v6.2.0` tag or release existed. Updater contract: the 6.1.0 tag's `package.json` has no `publisherName`, so electron-updater in installed 6.1.0 clients (autoDownload and install-on-quit, `allowPrerelease` false) does no publisher-signature check and accepts an unsigned installer whose sha512 matches; no signature control was bypassed.
**Published:** https://github.com/Brahmadathanu/sasv-workspace-dev/releases/tag/v6.2.0 (created as draft, assets uploaded and digests compared, then published as stable and Latest). Tag `v6.2.0` -> `ebb59a49...`.
| Asset | Bytes | SHA-256 |
|---|---|---|
| `SASV-Workspace-Setup-6.2.0.exe` | 141,444,151 | `ae9af8561648921ce92f290c7ffd15841821516979be8cbed082eb772958aa9a` |
| `SASV-Workspace-Setup-6.2.0.exe.blockmap` | 149,086 | `7062f620a081255a1bfe082e828a05a33cdb6ec06d134cb90b2a5805ad085569` |
| `SASV-Workspace-6.2.0-win.zip` | 177,000,130 | `b88c78d20eee2731b2e45b9f346cf7af2e0c9681c5dbe4d95d348157513e89ad` |
| `latest.yml` | 357 | `63350ac0be0d026912ce59fd31abd5abd9a7d4575cdba4da4dbe6c1e154afeb7` |
**Independent post-publish verification:** `releases/latest` = v6.2.0 (not draft, not pre-release); public `releases/latest/download/latest.yml` serves version 6.2.0; a fresh public download of the installer matches size, SHA-256 and the manifest sha512; blockmap URL returns 200. v6.1.0 and v6.0.1 assets unchanged (digests identical to the earlier baseline, incl. 6.1.0 installer `0884f2bc...8557f4`).
**Consequence:** existing 6.1.0 clients with auto-update will now download 6.2.0 and install on quit. No staff installation was performed or verified. **Outstanding risk:** antivirus (Bitdefender) quarantined the unsigned exe on the owner's PC; staff PCs may need local allowances. Rollback: 6.1.0 and 6.0.1 assets intact; a bad release is corrected by a 6.2.1 forward-fix (electron-updater does not downgrade). WP10/WP12 OPEN and Stage B HOLD unchanged.

## 5. G2/G3, signing
G2/G3 not started (require G1 PASS and explicit owner approval). This PC has an installed profile and updater cache, so it is not a disposable G2 target without a profile backup. Signing is unresolved: choose A (signed, needs a valid identity and signed-artifact checks) or B (unsigned pre-release pilot on one or two named PCs, only with a separate dated owner risk acceptance and after G1 PASS).

## 6. Owner decision matrix (evidence from the RC report and #465; nothing closed here)
| Item | Class | Status / proposed disposition |
|---|---|---|
| WP10 classification governance and permissions | Security | Server-side read gate applied; accepted earlier. Keep as evidence. |
| WP10 production writer testing | Security-adjacent | OPEN: needs disposable fixture or owner-approved scope. Do not close without it. |
| WP10 cosmetic leftovers | Deferrable | Propose documented owner deferral. |
| WP12 confidentiality / negative-access | Security-critical | Seven sensitive-view negatives and independent role proofs NOT TESTED: stays OPEN. |
| WP12 V6 positive read (HTTP 500) | Security-neutral, evidence gap | Inconclusive: needs one re-read by an authorised role; or owner-documented acceptance. |
| Cost Comparison performance (4 s p95, #273) | Deferrable | Owner threshold decision; not security. |
| Feature-flag ON / ALL-ON acceptance | Deferrable | Remains deferred; no flag activated. |
| Electron G1, G2, G3 | Release gates | G1 owner-interactive; G2/G3 follow. |
| Fleet gates F1-F6 (G5) | Release gate | Open. |
| Stage B direct-DML revocation (G6) | Security-critical, separate approval | HOLD until G5. |

Formal Costing closure: 11/13 packages CLOSED; WP10 and WP12 **OPEN**.
