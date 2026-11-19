# SASV Workspace 6.2.0: acceptance, pilot, rollback and isolation procedures (19 Nov 2026)

**STATUS: DOCUMENTATION ONLY (procedures, not executed).** 6.2.0 is NOT published. No release, tag, updater run, purchase, vendor contact or database change. Electron publication **HOLD**; WP10 and WP12 **OPEN**; Stage B **HOLD**; PRs #483 and #484 stay **draft**. All evidence in the RC report, the reconciliation report and the readiness document is preserved. Nothing here authorises a release: each step that publishes or purchases needs its own owner decision.

## 0. Candidate identity and the CI-rerun rule
- **Candidate code head:** `e46e3c37d5d54c6f756cdfc8c43b5b3fffc6ceec` (#483). CI receipt: Windows run 44555940400, 25/25 pass. Unchanged since it was recorded (re-checked 19 Nov 2026).
- PR #484 and this document change **documentation only** under `docs/`. The Electron workflow is path-filtered (`main.js`, `preload.js`, `package*.json`, `electron/**`, `scripts/electron-smoke/**`, its own file), so documentation commits neither trigger nor invalidate it; #484 therefore shows no CI checks, which is expected.
- **Rule:** any commit that touches a path above, or any change to #483's head, requires the Windows workflow to be re-run and re-read on that exact head, and the G1 installer to be rebuilt from that SHA. A merge of #484 into #483 changes the #483 head SHA (documentation only); re-read the receipt then and state the new SHA. The code to be accepted is identical.
- Record for every acceptance: source SHA, `package.json` version, Electron version, exe `ProductVersion`, installer/exe SHA-256.

## 1. Signing-provider quotation requirements (to send, by the owner, through each vendor's own sales or support channel)
Do not send documents through GitHub or chat. Nothing is purchased by asking. Ask each of DigiCert (OV code signing + KeyLocker) and GlobalSign (organisation code signing + HSM or cloud key vault) the same questions and keep the written replies:

| # | Question | Why it matters here |
|---|---|---|
| 1 | Can an organisation registered in India (legal name to be chosen by the owner) obtain OV code signing, and with what validation documents and lead time? | eligibility; Artifact Signing excludes India |
| 2 | Is the private key generated and held non-exportable in the vendor HSM / cloud HSM / managed key vault, with no hardware token posted to staff? | key never on staff PCs or the owner's laptop |
| 3 | Total first-year price in INR including GST, and the renewal price. Itemise certificate, key-holding or HSM service, any per-signature or per-month signing limits, support. | budget; the small fleet signs a few builds a year |
| 4 | What is the exact publisher (subject) string that will appear? Can it match the Santhigiri/SASV legal entity? | must equal `publisherName` in electron-builder |
| 5 | Is signing supported from GitHub Actions on `windows-latest` and from a single Windows PC, and with `signtool` (or `smctl`) called from an electron-builder custom `sign` hook (electron-builder 26.x)? Share the vendor's current Electron/GitHub guide. | integration cost |
| 6 | Which RFC 3161 timestamp server is supported and is it included? | signatures must outlive the certificate |
| 7 | What credentials does CI need (API token, client auth certificate, vault identity), can they be scoped and rotated, and what is the revocation and re-issue process if they leak? | secret handling: repository secrets and a protected environment only |
| 8 | Does the plan need a separate cloud subscription (for example an Azure subscription for Key Vault)? Who pays and who administers it? | GlobalSign route may add a second paid service |
| 9 | FIPS level of the key store (the vendor's own materials disagree between 140-2 Level 2 and Level 2 or 3). | conformance with the CA's requirement |
| 10 | Expected SmartScreen behaviour for a new OV certificate versus EV, and whether EV is offered in India for this use. | user-visible warnings during the pilot |
| 11 | Revocation, certificate replacement and what happens to already-signed releases if the account lapses. | continuity |

**Decision table to complete (owner):** vendor, plan name, INR total, legal entity named, validation documents requested (names of documents only, no copies in the repository), lead time, CI method, key-store FIPS level, timestamp service, quote date and validity, owner's choice and date. Mark anything not confirmed in writing as UNVERIFIED. **Disqualifiers:** a key that must live on a USB token held by an individual; credentials that must be committed to the repository; a publisher name that is not the intended legal entity.

## 2. Final Windows acceptance checklist (G1; owner, read-only, one screen)
**Pre-flight (5 minutes, office PC):**
1. Check out `e46e3c37` (or the new head if #483 changes), `npm ci`, `npx install-electron`, then `npx electron-builder --win nsis zip --publish never`. Record SHA-256 of `SASV Workspace Setup 6.2.0.exe` and `dist\win-unpacked\SASV Workspace.exe` (will differ from the RC report's; builds are not bit-for-bit reproducible).
2. **Close any installed or running SASV Workspace first.** The app takes a single-instance lock and its default profile is shared with an installed app. To keep the installed 6.1.0 profile and session untouched, launch the unpacked build as: `"dist\win-unpacked\SASV Workspace.exe" --user-data-dir="%TEMP%\sasv-g1-profile"` after `set LOCALAPPDATA=%TEMP%\sasv-g1-local` in the same Command Prompt window (this also redirects the updater cache). You will sign in fresh; delete both folders afterwards.
3. Do **not** run the installer for G1 (that is G2). No `v6.2.0` release exists, so the updater, which runs automatically at start, finds 6.1.0 as the latest and must report "no update". If any download or "update ready" message appears: **stop, close the app, report it.**

**Pass/fail screen** (PASS / FAIL / NOT TESTED each; write symptoms; no credentials, patient, employee or business data, and no costing figures in screenshots):
| # | Check | Result |
|---|---|---|
| 1 | Login screen loads; sign-in succeeds; landing screen correct; no error dialog | |
| 2 | Six Costing: Control Center, Material Cost Manager, Cost Build Manager, Pricing Policy Manager, Production Route Manager, Cost Sheet Review: each shows an authorised view or a legitimate empty state; no writer activated | |
| 3 | Four Classification: Categories, Sub-Categories, Product Groups, Sub-Groups: same, and no create/rename/delete performed | |
| 4 | Home/back from two different modules: no path or navigation error | |
| 5 | One read-only print/report popup renders and closes (no printing to a printer) | |
| 6 | No blank pages, CORS/loading errors or exception dialogs; updater reports no update | |
| 7 | Sign-out works; profile folder and updater-cache folder deleted afterwards | |
Record: source SHA, installer and exe SHA-256, exe `ProductVersion`, Electron version, Windows build, date, tester. **G1 passes only if all 1 to 7 are PASS.** A FAIL stops the programme; a NOT TESTED item keeps G1 open.

## 3. Pilot migration and rollback procedures (G2 and G3; each step needs owner approval, none executed)
**G2: installed migration on one disposable or named pilot PC with 6.1.0 already installed** (requires G1 PASS):
1. Before: record installed version (Settings, Apps), shortcut targets (Desktop, Start Menu), the profile folder `%APPDATA%\SASV Workspace` (size, file list) and the updater cache the updater cache under `%LOCALAPPDATA%` (a folder ending in `-updater`, normally `daily-worklog-app-updater`; confirm the name on the PC). Copy the profile folder to an owner-controlled backup. Keep the 6.1.0 installer offline (`sha256:0884f2bc3acc2d8a06c565784c11526f98c03728ee8cd3be96b4e261438557f4`).
2. Run the 6.2.0 installer manually (per-user NSIS, one-click; same app GUID so it upgrades in place). Record any SmartScreen/AV prompt (unsigned: expected; a different prompt is an abort condition).
3. After: version 6.2.0 in Settings, exe `ProductVersion`, shortcuts still valid, launch, session continuity (still signed in or clean re-login), G1 rows 1 to 6 on the installed app, updater reports no update.
4. **Downgrade rehearsal (disposable PC only, not a staff PC):** reinstall 6.1.0 over 6.2.0 (and if refused, uninstall then install 6.1.0). Record what survives: profile, login, shortcuts. This determines whether "manual reinstall" is a usable rollback; until done, rollback is documented as forward-fix (6.2.1).
5. Uninstall 6.2.0 cleanly (`deleteAppDataOnUninstall` is false: profile is kept by design); record leftovers.

**G3: pre-release pilot on 1 to 2 named PCs** (requires G1 PASS, a signing decision or a dated named-pilot unsigned risk exception, and the section 4 safeguards completed):
1. Owner creates the release as a **pre-release** (section 4). Install manually on the named PCs only, after verifying SHA-256 against the out-of-band record.
2. Observe a working day: startup, login, role-appropriate navigation, the six Costing and four Classification modules, no CORS or missing-module errors, updater silent.
3. Confirm on one **unpatched 6.1.0 client** (a PC that stays on 6.1.0 for this purpose) that no update is offered.
4. Only then may the owner consider "Latest" promotion, as a separate decision after G5.

**Abort immediately** on: a signature or trust warning beyond the accepted exception; any stable client seeing or downloading 6.2.0; authentication failure or role mismatch; broken navigation, CORS or missing modules; lost session or data; any external access to the embedded server (it must be loopback only).

**Rollback sequence if a pilot PC fails:** (1) stop further installs; (2) capture evidence: version, logs, screenshots without data; (3) keep the release a pre-release, do not promote; (4) if the PC must work, uninstall 6.2.0 and install 6.1.0 manually, restore the profile backup only if the profile proves incompatible; (5) record installed versions; (6) forward-fix as 6.2.1 and re-run G1. Deleting a release stops only new downloads. **Never** touch the existing `v6.1.0` and `v6.0.1` releases, tags or assets.

## 4. Pre-release isolation safeguards (checklist before and after any pre-release; owner executes, none executed)
**Baseline to record now (read-only, 19 Nov 2026):** latest published release `v6.1.0` (not pre-release, not draft); `latest.yml` asset digest `sha256:415b54fecf9e17736914f794c906cafdffc6b3798a537a4d7dcbc1b8f28aaca7`; no tag or release `v6.2.0`.

**Before creating the release:**
1. 2FA on the GitHub owner account; release rights limited to the owner; consider a tag ruleset that restricts creating and deleting `v*` tags and blocks force-push on `main`.
2. Create the release **as a draft first**: tag `v6.2.0`, target the accepted SHA, **"Set as a pre-release" ticked**, **"Set as the latest release" NOT ticked**, assets: installer, blockmap and `latest.yml` only (plus an out-of-band SHA-256 list). Do not use `electron-builder --publish always`; the documented build uses `--publish never`, and no workflow in the repository publishes.
3. Do not upload or replace any asset on `v6.1.0`.
4. Publish the draft only after the owner re-reads this checklist.

**Immediately after publishing (all must hold, otherwise convert it back to draft and stop):**
- `GET /repos/Brahmadathanu/sasv-workspace-dev/releases/latest` still returns `v6.1.0` (the page https://github.com/Brahmadathanu/sasv-workspace-dev/releases/latest still opens 6.1.0).
- The 6.2.0 release shows the **Pre-release** badge and not "Latest".
- `v6.1.0`'s `latest.yml` digest is unchanged.
- The unpatched 6.1.0 client (or the real 6.1.0 package in an isolated profile and cache, as in the RC real-artifact test) reports no update.

**Never:** untick "pre-release" or set it "Latest" outside an approved fleet cutover; publish a non-draft release carrying `latest.yml` for 6.2.0 without the pre-release flag; edit a pre-release's `latest.yml` after hash recording. Why this works: stable clients (`allowPrerelease` false) read GitHub's `releases/latest`, which excludes pre-releases (verified from electron-updater 6.8.11 source; live proof remains G3).

## 5. Readiness for the owner-dependent milestone
**The release candidate is ready for the authenticated Electron 45 / 6.2.0 Windows acceptance test (G1)** in the sense that everything remote is done: code head `e46e3c37` has green exact-head CI (25/25), the local real-artifact update test and packaging checks are recorded, no `v6.2.0` release or tag exists, and sections 1 to 4 are written. It is **not** ready for any publication, pilot release or signing purchase.

**Minimum owner actions for G1:**
1. On the office PC, build from `e46e3c37` and launch with the isolated profile as in section 2 (about 5 minutes of setup).
2. Sign in with a normal account and complete the seven-row screen; return the PASS/FAIL results with the hashes and version.
That is all that G1 needs. The signing quotes (section 1) and the pilot decisions can follow in parallel or after.

## 6. Still owner-dependent, not started
Signing route and quotes; pilot authorisation (G2/G3); fleet go-live and Stage B (G5/G6); WP10 and WP12 open items.
