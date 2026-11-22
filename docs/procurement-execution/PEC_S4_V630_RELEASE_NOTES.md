# SASV Workspace v6.3.0 — PEC S4 release candidate

**Status:** CANDIDATE ONLY — NOT APPROVED FOR PUBLICATION  
**Source:** `main` merge commit `c691736fd996a6565acf82668c4ac0187158187b`, PR #496  
**Release branch:** `release/v6.3.0-pec-s4`  
**Published production Electron version:** v6.2.0 until explicit owner publication approval.

## User-facing changes

- RM/PM replenishment now uses the greater of independent stock-netted MRP and historical consumption coverage, not the sum.
- Consumption estimates use the last 12 completed calendar months, including zero-use months, and the selected 1–6-month horizon.
- Approved/issued outstanding indent balances, applicable MOQ and count-UOM rounding are accounted for.
- Materials with credible consumption requirements can appear even where MRP is zero or omitted.
- Unreliable input evidence is surfaced for explicit review without fabricating purchase quantities.
- PR generation presents a preview, review cases, acknowledgement and frozen per-item sourcing evidence.
- Eligible same-day legacy draft PRs support governed reconciliation with manual edits retained, stale-token rejection and permissions preserved.
- Legacy Electron creation calls route through the S4 hybrid calculation.

## Acceptance record and mandatory release gates

- PR #496 merged as `c691736fd996a6565acf82668c4ac0187158187b`.
- Earlier pinned implementation `53dbd2a339627530c759ebcf5ae3180a870c0c2c` passed integrated browser workflow #45004505941 and vendor-wise offset export workflow #45004505916. Later changes in #496 were handover documentation only.
- Nine S4 migration versions were already registered on the production Supabase project. Do **not** reapply them.
- Transactional server reconciliation evidence was rolled back. The real draft PR-2026-07 and PR-2026-08 remain unchanged until *separate, consolidated owner approval* after review exceptions are inspected.
- **Pending:** verify production PWA is serving the merge; authenticated View-only and Editor browser previews, including 390px; record zero live test writes.
- **Pending:** Windows isolated-profile Electron smoke, dependency install, package/update compatibility, embedded S4 assets, installer/ZIP/blockmap/`latest.yml` SHA-256 and pilot-install acceptance.
- **Hold:** no GitHub v6.3.0 release publication, no updater metadata changes, no general staff rollout, and no #305 closure without explicit owner acceptance.

## Pilot and rollback

Package on a trusted Windows builder using the release candidate; never publish during testing. Verify the generated NSIS setup and ZIP alongside the blockmap and `latest.yml`, including matching version and digest evidence. Pilot on the developer PC or one authorised staff PC; inspect signed-in S4 previews and permissions without generating real requisitions. Keep the known-working v6.2.0 installer and updater metadata intact until owner approves v6.3.0 publication and rollout.

**Reference:** `docs/procurement-execution/PEC_S4_E2E_RELEASE_PACKET_20261122.md` and issue #305.

## 22 November 2026 — Windows release-candidate smoke receipt

- Candidate head: `51312ed44ff73e8222b2b0a80cd62d6287512db1`.
- GitHub Actions `Electron smoke (Windows, isolated profile, loopback)` run **#45007239246**: **SUCCESS**; job `smoke` #137161419005 **SUCCESS**.
- Passed steps: repository checkout; Node setup; dependency and Electron binary install; hardening unit tests and Electron main-process smoke with a throwaway profile and loopback port.
- **Important test boundary:** the smoke uses the **unpackaged application with the updater inactive**. It does not verify an NSIS installer, ZIP, blockmap, `latest.yml`, auto-update download/install or signed-in production pilot.
- Run reported **no downloadable build artifacts**. No installer digest or release archive can yet be validated.
- PWA origin and deploy preview could not be inspected through available public browsing; actual deployed commit/cache/controller and authenticated 390px Editor/View-only screens remain **NOT TESTED**.
- Do not infer successful Netlify production deployment from the GitHub merge alone.
- PR-2026-07 and PR-2026-08 remain guarded and not reconciled; #305 remains open and release publication HOLD remains unchanged.

## 22 Nov 2026 — Exact synchronized release-candidate artifact receipt

- PEC S4 accepted UX merged via PR #498 into `main`: `d90104a24327f2a8d5e7823777b8b03be71b19d1`.
- Main history synchronized into release branch via PR #499: candidate source commit `7dc3f034e44457619a3db9a67c2e4d21f8bf9ab1`; release-only changes limited to the 6.3.0 manifests, unpublished packaging workflow and two release documentation files.
- Windows isolated-profile loopback smoke GitHub Actions [#45030214059](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45030214059): **SUCCESS**, updater inactive.
- Windows NSIS+ZIP non-publishing package GitHub Actions [#45030214044](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45030214044): **SUCCESS**. The workflow verified `latest.yml` version `6.3.0`, matched installer SHA-512 digest to the manifest, computed and printed SHA-256 values, and uploaded the private candidate archive.
- Private GitHub Actions [artifact ID 14757671795](https://github.com/Brahmadathanu/sasv-workspace-dev/actions/runs/45030214044/artifacts/14757671795), `sasv-v630-unpublished-windows-candidate`, 318,248,389 bytes, retention 3 days, not a GitHub Release. CI upload archive SHA-256: `a05ab2f57a1f343896f2aea776e1f01cc55db25d16f8450d28525f3b5525612c`.
- Component SHA-256 values from verified Windows job log (actual artifact bytes have **not** been independently redownloaded here):

| File | SHA-256 |
|---|---|
| `SASV Workspace Setup 6.3.0.exe` | `42e7d6b2bd01f0227ec44b7244df6ceab9ba4079ef7c2d0f48432df636d07010` |
| `SASV Workspace-6.3.0-win.zip` | `9199673a794a142deb777a5321a2bdc0ed5d1093d07466836099baa355ae7f8f` |
| `SASV Workspace Setup 6.3.0.exe.blockmap` | `4fe863ee1a5b80f503b46fa6e638cfea504922f4d669bd0cb72f4a38519a34ab` |
| `latest.yml` | `3a900a51bfc8eb1cd7050d0af0891c5b9397836ce680f610fa31236bcf9b357b` |

**Security/operational limitation:** `electron-builder` reports no Windows code-signing certificate configured; EXE, staged elevation helper and uninstaller were built unsigned. Windows SmartScreen/reputation prompts may occur. Signing was also absent in prior candidate builds; do not misrepresent signing as passed.

**Still unverified:** authenticated production PWA serving merged SHA; installed Windows pilot and live updater retrieval/update behavior. The available public browser could not inspect the Netlify production PWA origin. Owner's earlier authenticated preview acceptance passed. **Do not publish/merge release PR or alter `latest.yml` updater feed until the separate owner publication decision.** PR-2026-07 and PR-2026-08 still require genuine Editor execution and date-guard compliance; remain unchanged.
