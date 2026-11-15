# WP-09 — Wider Application Launcher/Section Audit

**15 November 2026 — G1 reconciled and technically ready for owner review. WP09 OPEN; programme 9/13. G2 NOT AUTHORISED.** Existing draft [PR #434](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/434), [issue #432](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/432).

## Objective
Inspect the wider workspace for granular launchers, duplication and weak grouping after Product + Costing are understood. This file is the work-pack authority under `MASTER_PROGRAMME.md`.

## Current gate and evidence
G1 source/live metadata reconciliation and independent review complete in bounded audit scope; owner completion/design decision pending. [Corrected G1 report](WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md) records provenance, exact module mapping, options, test classifications and decisions D1–D8. The original [new-chat handover](WP09_G1_INDEPENDENT_REVIEW_NEW_CHAT_HANDOVER_2026-11-15.md) is preserved unchanged as historical orientation; the corrected report supersedes its mapping-pending status.

Read-only capture: 85 definitions (6 inactive), 79 Electron / 41 PWA registrations, 11 active sections. All 79 exact live Electron keys and 41 PWA keys now map to canonical sources and current routes/sections. No alias substitution, lost child launcher or Option A section move. All 92 source pages are partitioned: 79 mapped canonical owners and 13 shell/auth/redirect/source-only pages. The original Claude container's lack of database access remains historical fact; later ChatGPT capture is complete, not currently BLOCKED.

## Findings and proposed design
A→C remains recommended and **unapproved**. A retains 11 Electron / 7 PWA populated sections with 79 / 41 tiles; C reduces maximum registered top-level tiles to **36 / 24**, with section-scoped families and no registry change. B re-sections into nine domains and requires separate SQL authority. Six Costing modules, including Production Route Manager, remain independent permission and route targets in a proposed family.

Season-profile source writers overlap, but `manage-season-profiles` is unregistered. `production-overrides` is an unregistered broken source shell. Neither is a pair of duplicate live cards. Both local-fallback modules are already live registered, so missing-row fallback injection is dormant. Two lab page/registry permission-name differences require WP12 role/page acceptance; their runtime effect is NOT TESTED.

## Milestones
- [x] Source and captured-metadata audit reconciled
- [x] Exact-key mapping / route / mutation verification
- [x] ChatGPT independent review of Claude audit and corrected deliverables
- [ ] Owner G1 completion and design decisions
- [ ] G2 contract / implementation authorisation
- [ ] Implementation / focused acceptance / independent code review
- [ ] Merge and post-merge evidence
- [ ] Formal WP09 closure

## Verification
Fresh registry **21/21 PASS**, source **50/50 PASS**, mutation **22/22 PASS**. Fresh WP08 G2-1 source **13/13**, resolver **8/8**, SW freshness **15/15 PASS**. Historical G2-0 scope guards retain **2 FAIL of 13**; fresh registry SQL **1 PASS / 17 SKIPPED** (no PostgreSQL binaries). Claude's original synthetic Chromium **33/33** and fail-closed **81/81 PASS** remain historical; fresh browser rerun BLOCKED by browser-launch environment restrictions. Live roles, installed PWA, packaged Electron and Windows release remain **NOT TESTED**, not synthetic PASS.

## Next gate / owner decisions
Accept G1 audit in stated scope; decide A→C vs B, season-profile canonical ownership, legacy-source disposition, six-Costing family, PWA search/Quick Access and naming. Recommendations are in report D1–D8. One [substantial G2 client package](WP09_G2_SINGLE_CLIENT_PACKAGE_2026-11-15.md) is prepared, **not activated**. Owner final approval is required by this task's explicit G2 restriction. No further handover needed.

## Changes and protected boundaries
Audit scripts, evidence and documentation only. No runtime client, server, registry, permission, grant, RLS, migration, feature-flag, deployment or Electron-route change. WP08/PEC not reopened. Historical CRLF-only 20261112 migrations untouched. WP11 PM BOM overflow and SKU Deactivate contrast #429 retained. WP12 inherited security, flags, PWA, Electron/Windows and WP08 eight-case receiving obligations remain OPEN; Pricing unknown destinations stay text-only. No work-pack closure or programme-count advance.
