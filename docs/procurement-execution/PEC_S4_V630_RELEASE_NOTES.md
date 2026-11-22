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
