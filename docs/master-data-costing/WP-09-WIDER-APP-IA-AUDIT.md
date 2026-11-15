> **15 NOV 2026 — WP09 G1 AUDIT DELIVERED / OWNER DECISION PENDING (LATEST):** the G1 bulk audit for [issue #432](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/432) is in [WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md](WP09_G1_BULK_AUDIT_REPORT_2026-11-15.md) with evidence in `WP09_G1_EVIDENCE/`, a SELECT-only live capture pack and read-only tests in `scripts/wp09-g1-launcher-audit/`. **Live row-level registry capture is BLOCKED (no DB access in the audit session); live roles NOT TESTED.** Options A/B/C and the owner decision matrix are proposals only: **no G2 design approved, no launcher source, registry, permission, SQL, flag, deploy or Electron-route change made.** WP09 stays OPEN; programme stays 9/13. This replaces the earlier G1-open banner (#433).

# WP-09 — Wider Application Launcher/Section Audit

## Objective
Inspect the wider workspace for granular launchers, duplication and weak grouping after Product + Costing are understood.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified.

## Scope
As defined by the approved programme handoff; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes.

## Current-state findings
G1 source-derived audit (15 Nov 2026, base `5735321c`): see the G1 report for ranked findings F1–F12 (overlaps: two season-profile owners, broken `production-overrides.html`; label-only search; PWA has no search/Quick Access; client fallback injection ordering; 26 Electron-root-only launcher pages). Earlier G0 read-only registry summary:

Live read-only 15 Nov inventory: 85 module definitions, 79 active navigable Electron entries, 41 PWA, 11 active sections, no duplicate active client route URLs and no orphan sections. All 41 PWA entries exist in Electron; 38 active Electron-only. Permission-specific visibility and functional duplication are NOT TESTED. Full evidence/next audit contract: issue #432.

## Approved design / contract
Not yet approved. Options A (hygiene + sub-headings), B (ERP re-sectioning, DB change) and C (collapsible families) are drafted in the G1 report; recommendation A→C, owner choice pending.

## Milestones
- [x] Current-state/audit gate — G1 source audit + options delivered in draft PR (live row capture BLOCKED; owner review pending)
- [ ] Design/contract gate where applicable
- [ ] Implementation gate where applicable
- [ ] Focused verification
- [ ] Independent audit
- [ ] Merge/post-merge proof where applicable
- [ ] Final handover

## Current Gate
`WP09-G1 — wider application launcher/source/registry audit OPEN`

## Gate Status
[~] IN PROGRESS — G1; programme 9/13 (WP09 OPEN)

## Required to close
Entry criteria must be satisfied and the work pack explicitly started.

## Next gate
Owner answers the decision matrix in the G1 report (D1–D5 essential); run the SELECT pack and `registry-verify.mjs`; then G2-0 design freeze. No implementation authorised.

## Server changes
None.

## Client changes
None.

## Tests / verification
G0 read-only SQL inventory (cited): 85 modules, 79 Electron, 41 PWA. G1: source-contract 50/50 PASS, synthetic Chromium launcher 33/33 PASS, WP08 baselines PASS except 2 pre-existing diff-scope guard failures in `wp08-g2-0/source.test.mjs`. Live registry row capture BLOCKED; live role visibility, installed PWA and packaged Electron NOT TESTED.

## Decisions created
None.

## Risks
Premature assumptions; scope drift; duplicated authority; loss of effective-dated/history semantics.

## Parked discoveries
None.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current.

## Final handover
G1 audit package delivered for issue #432 (draft PR); owner design choice pending; no implementation or closure.
