# SASV Workspace 6.2.0: final acceptance execution receipt (20 Nov 2026)

**STATUS: 6.2.0 NOT PUBLISHED. G1 NOT TESTED (owner-interactive). No tag, release, SQL, grant, flag or fleet change.** WP10 and WP12 remain **OPEN**; Stage B **HOLD**.

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
Desktop automation tools are not available in this session and sign-in needs the owner's credentials, which must not be entered by the agent. The hosted PWA is not a substitute. All seven G1 rows: **NOT TESTED**. Owner launcher: `D:\ELECTRON PROJECTS\sasv-620-g1-launch-G1.bat` (isolated `--user-data-dir` and redirected `LOCALAPPDATA`; the installed profile `%APPDATA%\SASV Workspace` and `daily-worklog-app-updater` cache are not used). Pass/fail rows are in the procedures document section 2.

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
