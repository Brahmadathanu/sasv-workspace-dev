# SASV Workspace v6.3.1 — PEC S4 reconciliation dialog patch (stable)

**Authority:** owner approval recorded in issue #500 (22 Nov 2026). Supersedes the v6.3.0 pre-release for staff rollout; v6.3.0 binaries, tag and metadata are immutable and untouched, as is v6.2.0.

## Changes (client only)
- Reconciliation dialog: acknowledgement checkbox is a 22px top-aligned control beside its text (shared `.pec-s4-ack` layout; the earlier `.pec-ccf-ack` rules were scoped to another dialog), content-sized capped dialog, one scroll region (the body), actions pinned above the safe-area inset, no nested list scrollbar.
- Escape: `s4ReconcileModalBackdrop` is in the topmost-dialog stack above PR detail. First Escape closes only reconciliation and returns focus to *Reconcile*; second closes PR detail. Escape, X, Cancel and backdrop are inert while the reconciliation writer is in flight.
- No SQL, migration, permission, stock, MOQ, purchasing-record or writer change. PR-2026-07/08 were not touched.

## Verification
Synthetic-fixture browser tests (`scripts/pec-erp-c1-layout-smoke.mjs`, 1440px and 390px): the new `#500` checks fail on the previous code and pass on this change. Before/after screenshots: `docs/procurement-execution/evidence/issue-500/`. Windows smoke, NSIS+ZIP packaging, ProductVersion, manifest SHA-512 and SHA-256 checks run in `.github/workflows/electron-release-candidate.yml` on the exact merged commit.

## Release safeguards
Publication is the manually dispatched `publish-sasv-release.yml`: provenance of the build run (success, exact `main` SHA), installer SHA-256 supplied independently, hashes and `latest.yml` (version, url/path, sha512, size) verified, **draft first**, asset digests checked, then promoted to Latest, with a live `releases/latest` check, served-manifest comparison, an updater-resolution simulation (6.2.0 → this version, no `allowPrerelease`) and a check that the previous stable release's assets are unchanged. Asset names equal the `latest.yml` url (`SASV-Workspace-Setup-<version>.exe`).

## Honest limits
The installer is **unsigned** (SmartScreen/antivirus may warn). No physical Windows upgrade pilot from an installed 6.2.0 client has been run by Claude; that gate is NOT TESTED unless recorded below by an operator.
