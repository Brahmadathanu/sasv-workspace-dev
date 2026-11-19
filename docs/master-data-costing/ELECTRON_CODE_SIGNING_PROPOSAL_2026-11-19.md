# Electron code signing: proposal for the small staff fleet (19 Nov 2026)

**STATUS: PROPOSAL for owner decision. Nothing is signed, published or distributed. Electron publication HOLD unchanged.**

## 1. Why it matters here
- The installer and executable are **NotSigned** (`no code signing certificate configured`).
- `main.js` sets `autoDownload=true` and `autoInstallOnAppQuit=true` against the public GitHub release feed (`app-update.yml`: provider github, owner `Brahmadathanu`, repo `sasv-workspace-dev`). Without a publisher signature, update integrity rests only on HTTPS to GitHub and the `sha512` in `latest.yml`. Anyone who can change a release or its `latest.yml` could push code that every staff PC installs on next quit. Signing plus electron-updater's publisher check adds an independent barrier.
- Unsigned installers also trigger SmartScreen and antivirus friction (already seen locally).
- electron-builder 27 and later refuses to build an updater config without a signing publisher name unless `win.verifyUpdateCodeSignature` is disabled; the project is on 26.18, so this does not block 6.2.0 but will matter on the next major upgrade.

## 2. Options
| Option | Cost / effort | Security | Fit for a small fleet |
|---|---|---|---|
| **A. Microsoft Artifact Signing** (formerly Trusted Signing; GA Jan 2026) | low monthly fee; identity validation in the Azure portal; electron-builder 26.18 supports it (`win.azureSignOptions`, present in the installed `app-builder-lib`) | keyless (no private key to steal), publisher identity, enables the updater signature check | best if the organisation or individual is eligible; availability depends on country and region (check Microsoft's live table; validation delays are reported) |
| **B. OV code-signing certificate with a cloud/HSM key** (for example from a commercial CA's cloud signing service) | annual fee; vendor onboarding; signing via a sign hook or `signtoolOptions` | publisher identity; key stays in the vendor HSM | solid fallback if A is unavailable; EV mainly adds faster SmartScreen reputation |
| **C. Private (self-issued) certificate trusted on staff PCs** | free, but needs a root plus Trusted Publishers install on every PC (GPO or manual) | updater signature check works only where the cert is trusted; no public identity; key custody burden on the owner | only if every PC is owner-managed; not recommended as the long-term answer |
| **D. Unsigned with compensating controls (interim)** | none | update channel unprotected beyond HTTPS and sha512 | acceptable only for a named pilot, never for fleet-wide automatic updates |

## 3. Recommended approach
> **Update 19 Nov 2026:** Microsoft's quickstart does not list India among eligible Public Trust organisation countries, so option A is expected to be unavailable to an India-registered organisation (verify on Microsoft's live page). Option B (DigiCert OV + KeyLocker, or GlobalSign OV + HSM/Key Vault) is now the working recommendation, pending written vendor quotes. Details: [ELECTRON_6_2_0_REMOTE_READINESS_RECONCILIATION_2026-11-19.md](ELECTRON_6_2_0_REMOTE_READINESS_RECONCILIATION_2026-11-19.md).

1. **Decision now (superseded by the note above):** pursue **A**; if the owner cannot pass identity validation, use **B**. Both keep the private key off staff PCs and off the owner's laptop.
2. **Until signing exists (interim, option D controls):**
   - Do **not** make 6.2.0 the GitHub "Latest" release. electron-updater only considers pre-releases when the *installed* version is itself a pre-release (the installed 6.1.0 has `allowPrerelease` false), so a GitHub **pre-release** is invisible to existing clients. Publish 6.2.0 as a pre-release first and install it **manually on one or two pilot PCs**, confirming the installer's SHA-256 against the value in the release notes (recorded out of band).
   - Require 2FA, restricted push and release rights, and branch protection on the repository; keep release creation to the owner only.
   - Only promote 6.2.0 to "Latest" (the step that triggers fleet-wide auto-update) after signing is in place or the owner records a dated risk acceptance, and after the fleet gates in the readiness document pass.
3. **When signing is added:** set the signing configuration in `package.json` (`win.azureSignOptions` or the CA's sign hook), keep `win.verifyUpdateCodeSignature` at its default, rebuild, and verify with `Get-AuthenticodeSignature` that the installer and `SASV Workspace.exe` are `Valid` with the expected publisher. The first signed release then also becomes the update-path rehearsal: unsigned 6.1.0 clients are expected to accept the first signed update (their config embeds no publisher name; confirm during the pilot), and every later update is publisher-checked.
4. **Do not** store the certificate or signing credentials in the repository or in this tooling; use repository secrets or the cloud signing service's identity, created by the owner.

## 4. Owner decisions
1. Sign with A, B or accept D for the pilot only (recommended: A or B before fleet rollout).
2. Who holds the signing identity and the repository release rights.
3. Whether the pilot (1 to 2 PCs, manual install from a pre-release) may start before signing.
