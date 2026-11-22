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
