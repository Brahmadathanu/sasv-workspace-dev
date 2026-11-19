# SASV Workspace 6.2.0 release candidate: validation report (19 Nov 2026)

**STATUS: RELEASE CANDIDATE, NOT PUBLISHED.** No GitHub release or tag, no staff auto-update, no database privilege change, no production data change. Built from `main` after #480 (dependency hardening) and #482 (Electron 45.4.1 and main-process hardening) plus this PR's changes. Electron publication **HOLD** remains until the gates in section 6 are signed off.

## 1. What this candidate contains
- Version **6.2.0** (`package.json` and lockfile), Electron **45.4.1** (Chromium 156, Node 24.22), `electron-updater` 6.8.11, runtime `npm audit` **0**.
- Costing Suite and the four Classification modules (RPC-only writers) as accepted earlier; loopback-only static server, no wildcard CORS, `webSecurity` on, restricted `open-module-url`, same-origin window and navigation policy.
- This PR adds: the version bump; updater-compatibility and artifact-verification tests; a guard so automated runs never rewrite the developer's Start Menu shortcut; build exclusion of an empty `.env` and `eslint.config.mjs`.

## 2. Artifacts (local build, `electron-builder --win nsis zip --publish never`, unsigned, x64)
| Artifact | Size (bytes) | SHA-256 |
|---|---|---|
| `SASV Workspace Setup 6.2.0.exe` | 141,444,152 | `d88e2a11063ac4bdf0ec8637d540cbee191f448e363aeb61d9d6cf1d0aa44d8b` |
| `SASV Workspace-6.2.0-win.zip` | 177,000,130 | `1e35743094d6365652e506b0957a1461b22118b332ea1cf37e78a583ba10535f` |
| `resources/app.asar` | 63,857,588 | `b316122f2f720b440144a5a659e22389bea8ca3a4aea723b97350d42d26e31f1` |
| `SASV Workspace.exe` (unpacked) | 250,311,680 | `c226ee9bc736246d4d8359817ba6bd88b7c047585a558e7623215293c22fa9c1` |
Builds are not reproducible bit-for-bit across machines; the hashes identify the artifacts validated here. The installer is about 38 MB larger than the published 6.1.0 installer (103.6 MB): Electron 45 and Chromium 156 are bigger; the blockmap lets updates download only changed blocks.

## 3. Automated validation (all remote-capable, this machine and GitHub CI)
| Check | Result |
|---|---|
| Packaged ASAR: 4,522 files; 0 missing; **30/30** key files identical to git; version 6.2.0; no direct classification-table writers; 3 governed RPCs in each of the 4 clients | pass |
| `npm audit` runtime (shipped) / all dependencies | **0** / 8 (0 critical, 1 high, 7 moderate; build and dev tooling only) |
| Secret-pattern scan of the packaged ASAR (private keys, cloud/GitHub/Slack tokens, Supabase secret keys, DB URLs with passwords, `.env`/key files): no hits; the only JWTs present are the 2 public `anon` client keys. An empty `.env` that used to ship is now excluded | pass |
| Electron smoke on the built ASAR (isolated profile and port, unpackaged): boot, preload and context isolation, IPC, loopback-only server, no CORS, `webSecurity`, popups, `open-module-url` validation, PDF and DOCX export, blob and `about:blank` print popups, IPv6 loopback, port-collision message | 12 of 12 pass on this PC (the last, a Start Menu shortcut guard, returns early on machines without the developer shortcut) |
| Updater compatibility on Electron 45, local feed: a 6.1.0 client is offered 6.2.0; a 6.2.0 client is not re-offered 6.2.0; a 6.2.0 client is never moved back to 6.1.0; an unchanged 6.1.0 candidate would **not** have reached 6.1.0 clients (why the bump is required) | pass |
| **Real-artifact update test**: a simulated 6.1.0 client downloads the real candidate installer from a local feed in a redirected profile and electron-updater's sha512 check passes; a tampered copy is rejected; `latest.yml` version, dash-style file name, size and sha512 match the installer | pass (not installed; the real updater cache on this PC was verified untouched) |
| Electron fuses (read-only): `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments`, `GrantFileProtocolExtraPrivileges` enabled; `EnableEmbeddedAsarIntegrityValidation`, `OnlyLoadAppFromAsar`, `EnableCookieEncryption` disabled | **findings, defaults, not changed** (see 5) |
| Real Supabase CORS under `webSecurity` (statuses only): auth settings 200; header-bearing REST/RPC calls 401 but readable | pass; a real sign-in is NOT TESTED |
| Windows CI (clean `windows-latest`) on the final head | see PR checks |

## 4. Updater compatibility summary
- Feed: GitHub provider, public repository, `latest.yml` uses `SASV-Workspace-Setup-6.2.0.exe` (GitHub converts spaces to dashes, as for the published 6.1.0).
- Installed 6.1.0 clients have `allowPrerelease` false, so a GitHub **pre-release** 6.2.0 is invisible to them; promoting it to "Latest" is the step that triggers fleet-wide download and install-on-quit. Treat that promotion as the fleet cutover.
- Unsigned: no publisher check applies today (see the signing proposal).
- NOT TESTED: an actual install over 6.1.0 (NSIS per-user, data and settings retention), a real GitHub-fed update, restart-and-apply on a client.

## 5. Security findings for the owner (none blocks building the candidate)
1. **Unsigned installer and executable** (signing proposal: `ELECTRON_CODE_SIGNING_PROPOSAL_2026-11-19.md`).
2. **Electron fuses are at defaults.** Hardening candidates, each needing its own test: disable `RunAsNode` and `EnableNodeOptionsEnvironmentVariable` (blocks abuse of the app binary as a Node interpreter; confirm the e-Aushadhi worker does not rely on it), enable `EnableEmbeddedAsarIntegrityValidation` and `OnlyLoadAppFromAsar` (tamper resistance of `app.asar`), `EnableCookieEncryption`. Not applied in this candidate.
3. **IPC sender validation** (`auth:setSession`, `sop:*`, updater channels) is not checked per frame; with `webSecurity` on and navigation restricted the exposure is reduced, but sender-origin checks are a sensible next hardening PR.
4. The 8 remaining `npm audit` items are build or dev tooling (`sharp`, `glob`/`minimatch`, electron-builder macOS packagers) and are not shipped.

## 6. Acceptance gates that remain (all need the office Windows PC or later work; marked NOT TESTED)
| Gate | Status |
|---|---|
| **G1** Packaged Electron 45 UI pass (6.2.0 build, signed-in): six Costing and four Classification modules, Home/back, one print or report popup, no error dialogs, no writers | **NOT TESTED** |
| **G2** Installer run over a 6.1.0 install on a test PC (data and settings retained, shortcut, uninstall) | **NOT TESTED** |
| **G3** Pilot update path: 6.2.0 as a GitHub pre-release, manual install on 1 to 2 PCs, then a controlled promotion test | **NOT TESTED** |
| **G4** Code signing decision and signed build | open (owner) |
| **G5** Fleet gates F1 to F6 (inventory pilot with the hardened PR #471 tool, installed-migration verification, post-cutover negative tests) | open |
| **G6** Stage B direct-DML revocation | blocked until G5; separate approval |
| WP10 | OPEN: server-side read gate (Option B) applied; remaining: cosmetic leftovers, production writer testing on a disposable fixture or owner-approved scope, fleet gates |
| WP12 | OPEN: V6 positive HTTP 500 inconclusive; Cost Comparison performance under #273 and the 4 s p95 decision; live flag ON/ALL-ON deferred (owner); Windows pilot |

## 7. Release procedure proposal (not executed)
1. Merge this RC PR (version only; no publication).
2. Owner completes G1 on the office PC with the artifacts above (or a rebuild of the merged head).
3. Signing per the proposal (or a dated owner risk acceptance for a pilot).
4. Create the GitHub release **as a pre-release** with the installer, blockmap and `latest.yml`; install manually on the pilot PCs and verify the SHA-256 (G2, G3).
5. Only after G1 to G5, promote to Latest (fleet cutover), then the post-cutover checks, then a separate decision on Stage B.
**Rollback:** keep v6.1.0 and 6.0.1 assets; a bad promotion is reversed by marking 6.2.0 as a pre-release again and publishing a corrected 6.2.1 (electron-updater does not downgrade clients).
