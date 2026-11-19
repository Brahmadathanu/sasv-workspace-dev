# SASV Workspace 6.2.0: remote readiness reconciliation (19 Nov 2026)

**STATUS: DOCUMENTATION ONLY. 6.2.0 is NOT published. No release, tag, certificate order, purchase, vendor contact, document submission, updater run or database change was made.** Electron publication **HOLD**, WP10 **OPEN**, WP12 **OPEN**, Stage B **HOLD**. PR #483 stays draft. All earlier acceptance results in the 6.2.0 release-candidate report and the readiness document are preserved unchanged; this file only adds evidence and corrections.

## 1. Exact-candidate CI receipt
| Item | Value |
|---|---|
| PR / head | #483, `e46e3c37d5d54c6f756cdfc8c43b5b3fffc6ceec` (base `bcba7979`, #482 merged) |
| Workflow | "Electron smoke (Windows, isolated profile, loopback)", run `44555940400`, attempt 1, `windows-latest` |
| Result | SUCCESS: **25 tests, 25 pass, 0 fail, 0 cancelled, 0 skipped** (hardening unit tests, Electron main-process smoke, updater-compat) |
| Not run in CI | the real-artifact update test (`updater-artifact-verify.test.mjs`) needs the built installer; its 3/3 result is the local run recorded in the RC report |
| Other checks | Netlify header/redirect rules success, "Pages changed" neutral (no hosted page affected) |
| Candidate artifact hashes | unchanged from the RC report (built locally, unsigned, not reproducible bit-for-bit). CI does not build or upload an installer, so these hashes cannot be re-verified remotely; G1 must record the hash of whatever the owner actually runs |

If any commit is added to #483 (including this documentation PR if it is merged into it), the CI receipt above no longer describes the head and must be re-read; the installer must then be rebuilt from the final SHA before G1.

## 2. Pre-release isolation: verified from source, still to be proven live
Verified against `electron-updater` **6.8.11** (the version locked for 6.2.0) and the repository configuration:
- `main.js` sets the feed to provider `github`, owner `Brahmadathanu`, repo `sasv-workspace-dev`, public, no token, `autoDownload=true`, `autoInstallOnAppQuit=true`, and never sets `allowPrerelease`, `channel` or `allowDowngrade`.
- In electron-updater, `allowPrerelease` is initialised from the installed version: `false` for any stable version such as 6.1.0 or 6.2.0 (`AppUpdater.js`).
- With `allowPrerelease=false`, `GitHubProvider.getLatestVersion` resolves the tag from GitHub's `releases/latest` endpoint, which GitHub defines as the most recent **non-draft, non-pre-release** release, then reads `latest.yml` from that tag. A pre-release is never consulted.
- Current published state: tags and releases `v5.7.5` to `v6.1.0` exist, all `prerelease:false`; **no `v6.2.0` tag or release exists** (checked via the GitHub API on 19 Nov 2026). `v6.1.0` assets: `latest.yml`, `SASV-Workspace-Setup-6.1.0.exe`, its blockmap, `SASV-Workspace-6.1.0-win.zip`.
- The installed 6.1.0 clients' own updater version is not recorded in the repository history reviewed here; the logic above has been stable across 6.x, but the isolation test in section 4 uses the real 6.1.0 package to confirm it.

**Ways isolation can be defeated by operator error (all avoidable, all owner-controlled):**
1. Creating the 6.2.0 release without ticking "Set as a pre-release", or editing a pre-release to un-tick it. Either makes it "Latest" and starts the fleet cutover.
2. Creating the release as a **draft** and publishing it normally (same effect as 1).
3. Using `electron-builder --publish always` or a CI publish job; the documented build uses `--publish never` and no workflow in the repository publishes.
4. Uploading a `latest.yml` to the *existing* `v6.1.0` release (replaces the file stable clients read).
5. Setting `make_latest` on a release created through the API/CLI.
6. Marking a **later non-prerelease** release (for example a 6.1.1 hotfix created after the 6.2.0 pre-release) is safe for isolation but becomes the new Latest; do not ship a hotfix from a branch that carries 6.2.0 by accident.

## 3. Rollback prerequisites (checked, not exercised)
- Known-good installers exist and are intact on GitHub: 6.1.0 (`SASV-Workspace-Setup-6.1.0.exe`, 103,567,655 bytes, GitHub digest `sha256:0884f2bc3acc2d8a06c565784c11526f98c03728ee8cd3be96b4e261438557f4`) and 6.0.1. Before any pilot the owner should save an offline copy and record these digests.
- electron-updater with `allowDowngrade=false` never moves a client to a lower version. A client that has installed 6.2.0 stays on 6.2.0 until a **higher** version (for example 6.2.1) is Latest, or the owner reinstalls 6.1.0 manually.
- Correction to the RC report's rollback sentence: marking 6.2.0 as a pre-release again (or deleting the release) stops *new* downloads by stable clients, but does nothing for machines that already downloaded or installed it (install-on-quit applies the downloaded update). Treat "pull the release" as containment only.
- **Manual reinstall of 6.1.0 over 6.2.0 is NOT tested.** The NSIS installer may refuse or ignore a downgrade and profile/session compatibility after a downgrade is unproven. G2 should include, on a disposable test PC only, one rehearsal of: install 6.1.0, upgrade to 6.2.0, record profile state, reinstall 6.1.0 (or uninstall and reinstall), and record what survives. Until then the documented rollback is "forward-fix with 6.2.1 after incident capture", not "downgrade".
- Release-asset hygiene for the pilot pre-release: installer, blockmap and `latest.yml` only; SHA-256 recorded out of band (not only in the release text, which an account compromise could also edit).

## 4. Isolation test to run before any pre-release exists (owner or a later remote task; nothing is published)
1. Using the unchanged 6.1.0 package or the unpacked 6.1.0 build in an **isolated profile and updater cache** (as the RC real-artifact test does), point it at a local feed that mimics GitHub: Latest = `v6.1.0` JSON, Atom feed listing a `v6.2.0` entry flagged as a pre-release. Expect: "update not available".
2. Repeat with the 6.2.0 build as the client: expect no offer of 6.2.0 itself and no downgrade.
3. Record the exact updater log lines. This simulates, but does not replace, the one real GitHub proof: that the first real pre-release is invisible to a real 6.1.0 install (G3).

## 5. Signing providers (vendor research only; every price, plan, country and timeline is UNVERIFIED pending an owner-requested written quote)
**Microsoft Artifact Signing (Public Trust).** The official quickstart lists organization eligibility for the US, Canada, EU, UK, Australia, New Zealand, Japan, South Korea, Singapore, Switzerland, Norway and Israel; **India is not listed**. Microsoft Q&A posts in 2026 report a shorter list (US, Canada, EU, UK; FAQ updated 22 Jun 2026) and individual onboarding limited to the US and Canada. Azure resource region does not change identity eligibility. Conclusion: treat as **not available** to an India-registered organisation unless Microsoft's live page says otherwise on the day of purchase. This supersedes option A as "recommended first" in the signing proposal (updated there).
Source: <https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart>

**DigiCert OV code signing + KeyLocker (cloud HSM).**
- Private key stays in DigiCert's cloud HSM; signing via the KeyLocker KSP with `signtool`, or `smctl`. DigiCert publishes an Electron/electron-builder KSP guide and a GitHub Actions guide: register the KSP (`smctl windows ksp register`), sync certificates (`smctl windows certsync`), then call `signtool sign` with the certificate thumbprint and a timestamp server. Credentials are an API token plus a client authentication certificate, stored as repository secrets and **never in the repository**.
- Open questions for the vendor: whether the organisation (legal entity in India) can be validated and what documents are required; whether the OV certificate and KeyLocker are one plan or two; per-signing limits; INR total including GST; issuance time; revocation and recovery.
- Sources: <https://docs.digicert.com/en/digicert-keylocker/> and the KSP/GitHub pages under it.

**GlobalSign organisation code signing with an HSM-held key.**
- Documented options: physical HSM, or cloud HSM (Azure Key Vault managed HSM RSA-HSM, non-exportable, 4096-bit, or AWS CloudHSM), signed with `signtool` and Azure Key Vault tooling. Issued in the name of a legally registered organisation only. A reseller page quotes 3 to 10 business days for validation (unverified marketing claim).
- Conflict to resolve with the vendor: one datasheet requires FIPS 140-2 Level 2 or higher, the Azure guide cites Level 2 or 3. Nothing found on India-specific validation documents; requires the owner to ask.
- This route also needs the owner to run an Azure subscription and Key Vault (a second paid service and an owner-held cloud credential for CI).
- Sources: <https://www.globalsign.com/en/code-signing-certificate> and <https://support.globalsign.com/code-signing/code-signing/code-signing-azure-key-vault-and-azure-signtool>

**electron-builder integration (checked against the locked `app-builder-lib` 26.18.0 type definitions).** `win.signtoolOptions` supports `sign` (a custom hook function or module path), `certificateSubjectName`, `signingHashAlgorithms`, `rfc3161TimeStampServer`, and `publisherName`; `win.verifyUpdateCodeSignature` exists. Either vendor therefore fits through a custom `sign` hook calling `signtool`/`smctl`. Two cautions: (a) with a custom hook electron-builder cannot infer the certificate, so `publisherName` must be set to the certificate subject exactly, or electron-updater rejects updates once the check is on; (b) electron-builder 27 renames these keys (`win.sign`), so the config must be migrated when that upgrade happens (`electron-builder migrate-schema`).
Source: <https://www.electron.build/v26/docs/features/code-signing/code-signing-win/>

**Signing prerequisites to fix before a signed build can be rehearsed (owner, no purchase needed to decide):**
1. The exact legal entity whose name appears as publisher (and matches the future `publisherName`).
2. Who holds vendor account, repository-secret and release rights, with 2FA.
3. Whether signing runs on GitHub Actions (needs a Windows runner job added, secrets and a protected environment) or on the office PC.
4. First signed release is also the update-path rehearsal: installed unsigned 6.1.0/6.2.0 clients must accept the first signed update and later updates become publisher-checked (6.2.0 config embeds no publisher name; unverified live).

## 6. G1 and G2 one-screen checklist
Kept exactly as in PR #483's owner comment of 19 Nov 2026 (G1 steps 1 to 6; G2 installed-migration; no credentials or business data in screenshots). Additions from this review:
- G1 must record: installer/exe SHA-256, `ProductVersion`, source SHA, **and** whether the SHA matches the hashes in the RC report or a rebuild (a rebuild invalidates section 1's hash table, not the CI receipt).
- G1 must run with updater inactive (no release `v6.2.0` exists today, so a packaged run will find nothing newer than itself, but offline testing is still preferred).
- G2 additionally records the **downgrade rehearsal** result from section 3 on a disposable PC.

## 7. Owner decisions that remain (nothing else is blocking remote work)
1. **Signing route:** commission written quotes from DigiCert (OV + KeyLocker) and GlobalSign (OV + HSM/Key Vault) for the correct legal entity, or record a dated, named-pilot unsigned risk exception. Procurement and any identity documents are the owner's action, through the vendor's own channel, not GitHub or chat.
2. **Pilot authorisation:** whether, after G1 PASS, a GitHub **pre-release** of 6.2.0 may be created for 1 to 2 named PCs. Not authorised by anything in this document.
3. **Fleet go-live** ("Latest" promotion): separate approval after signing, fleet inventory and installed-migration evidence.
4. **Stage B** direct-DML revocation: separate approval after G5.

## 8. Remaining NOT TESTED (unchanged)
G1 (packaged Electron 45 signed-in UI, Costing and Classification, print popup), G2 (installer over 6.1.0, downgrade rehearsal), G3 (real GitHub pre-release pilot), G4 (signing), G5 (fleet gates), G6 (Stage B), real sign-in under Electron 45, Electron fuse hardening, IPC sender validation.
