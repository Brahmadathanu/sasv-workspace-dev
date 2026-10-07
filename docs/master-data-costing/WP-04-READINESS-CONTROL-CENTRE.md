# WP-04 — Central Master Data / Costing Readiness Control Centre

## Objective
Audit existing SKU/status surfaces and establish an authoritative portfolio readiness/remediation capability only if justified. Reuse proven authorities and surfaces; no second readiness calculator.

## Why this work pack exists
See MASTER_PROGRAMME.md and the approved programme handoff. This file is the durable authority for this work pack.

## Entry criteria
All prerequisite work packs in MASTER_PROGRAMME.md are completed and verified. Satisfied: WP00–WP03 and the control plane remain completed/verified/merged where applicable. WP03 is not reopened.

## Scope
As defined by the approved programme handoff and subsequent WP04 gate packages; refine only from audited live architecture and explicit decisions.

## Explicit exclusions
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes. No merge/release/publish without explicit G8 authorization. WP05 and G8 are not started by this ledger.

## Programme ledger reconciliation (2026-10-07)

This recovery-branch copy of the WP04 ledger was stale (still showing G0 / not started). The record below reconciles workflow state to the independently verified recovery outcome. Historical G0–G6 detailed findings and packages remain preserved in prior WP04 documentation commits and GitHub issue #43; they are not rewritten here.

### Gate summary

| Gate | Status |
| --- | --- |
| WP04-G0 — Current-state / entry audit | [x] COMPLETED AND VERIFIED (preserved) |
| WP04-G1 — Design / contract | [x] COMPLETED AND VERIFIED (preserved) |
| WP04-G2 — Implementation package / feasibility | [x] COMPLETED AND VERIFIED (preserved) |
| WP04-G3 — Bounded server/client decomposition | [x] COMPLETED AND VERIFIED (preserved) |
| WP04-G4 — High-risk server package / C contract | [x] COMPLETED AND VERIFIED (preserved; DEC-015 measured limitation remains) |
| WP04-G5 — Client implementation | [x] IMPLEMENTATION ACCEPTED at `db7544f2ebdf30f515f249ade9e12a660a364476` (preserved) |
| WP04-G6 — Independent implementation audit | [x] PASS (preserved; no GitHub CI evidence claimed) |
| WP04-G7 — Authenticated / live verification | [!] BLOCKED after original signed-in attempt; recovery Tracks A/B now closed/accepted; **formal G7 not yet rerun** |
| WP04-G8 — Merge / post-merge closure | [ ] NOT STARTED |

WP04 remains **ACTIVE** and is **not yet merged or closed**.

### Original G7 exposure and recovery split

Original G7 signed-in verification exposed:

- native 8-second portfolio instability under the authenticated statement-timeout ceiling;
- material CCC / Readiness UX integration defects.

G7 was blocked. Recovery was explicitly split into:

- **Track A** — server portfolio indexed-reader / build recovery;
- **Track B** — client CCC / Readiness UX recovery on `fix/wp04-g7-track-b-readiness-ux`.

### Track A — CLOSED / APPLIED / PROVEN

Track A production recovery is closed. No Track A rerun is required without fresh defect evidence.

Recorded proven state:

- production Build **4**;
- status **COMPLETED**;
- **current**;
- period **2026-09-01**;
- valuation **2026-09-10**;
- evidence **Run 115**;
- **1793** ALL_EXISTING;
- **611** OPERATIONAL;
- OPERATIONAL canonical mismatch **0**;
- source fingerprint current/matching;
- indexed portfolio reader under the native **8-second** ceiling;
- fail-closed stale / absent / incomplete behavior proven;
- **CSE-P01 unchanged**.

### Track B — ACCEPTED

Track B client recovery is **ACCEPTED** at:

`47b07b4bdb92f9d2d471c61569045c8f24f1cac5`

Branch: `fix/wp04-g7-track-b-readiness-ux`.

Accepted Track B evidence includes:

- CCC-global KPI / search / filter / period / valuation integration;
- adaptive per-lens filters;
- unified table / work-surface language;
- no normal paginator / progressive scrolling;
- Readiness keyset infinite scrolling;
- governed Readiness period handling;
- Membership Exceptions bounded / keyset modal;
- desktop / narrow behavior;
- full-page narrow detail modal;
- disclosure behavior;
- lens-exit / restoration;
- startup timeout root cause and repair;
- Scheme / Margin Risk corrected from duplicate **1764** to governed **882**.

Track B has **no GitHub CI evidence**; do not state otherwise.

### Startup timeout diagnosis (accepted)

- Failing PostgREST path: legacy `public.v_costing_pricing_dashboard_summary`.
- Normal CCC startup no longer queries that view.
- Legacy server view is retained / parked for later dependency / rationalisation audit (WP05).
- Repeated fresh-load verification passed after correction.
- No new timeout / legacy-view log events in the verification window.

### Park for WP05 (not started)

- SKU Control Status ↔ Readiness rationalisation candidate;
- wider Costing / Pricing Policy Manager duplication audit;
- dependency audit for parked legacy dashboard-summary server objects (`public.v_costing_pricing_dashboard_summary` / `costing.v_pricing_workflow_dashboard_summary`).

## Current Gate
`WP04 G7 restart boundary`

## Gate Status
[~] WP04 ACTIVE — G0–G6 preserved complete; Track A CLOSED/APPLIED/PROVEN; Track B ACCEPTED at `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`; formal G7 not yet rerun; G8 not started; no merge/release/publish.

## Required to close
Restart and complete formal G7 signed-in/native verification from the beginning against the frozen candidate branch/head, then obtain explicit G8 merge/post-merge authorization. Do not reopen completed recovery work unless fresh evidence proves a defect.

## Next gate
Formal WP04-G7 signed-in/native verification restart against `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`. Do not start G8 or WP05 in this gate.

## Server changes
Track A server recovery is already APPLIED/PROVEN in production (Build 4). No further Track A mutation is authorized by this ledger update. Legacy dashboard-summary server objects remain parked, not dropped.

## Client changes
Track B accepted client head `47b07b4bdb92f9d2d471c61569045c8f24f1cac5` on `fix/wp04-g7-track-b-readiness-ux`. This documentation commit does not change implementation files.

## Tests / verification
Track B acceptance rests on targeted local checks/smokes and signed-in verification evidence already recorded for the recovery path. Track B has no GitHub CI evidence. Formal G7 matrix has not been rerun after recovery.

## Decisions created / preserved
DEC-011, DEC-014, and DEC-015 remain LOCKED and are preserved. See CHANGELOG_DECISIONS.md for the 2026-10-07 recovery acceptance ledger entry.

## Risks
Restarting G7 without freezing the accepted head; reopening Track A/B without fresh defect evidence; claiming CI evidence that does not exist; starting WP05/G8/merge prematurely; dropping parked legacy dashboard-summary objects before WP05 dependency audit.

## Parked discoveries
See PARKED_BACKLOG.md entries PERF-P01, CSE-P01, and the WP05 park candidates recorded from Track B acceptance.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current; explicit G8 merge/post-merge proof where applicable.

## Final handover
Not complete. WP04 is still active at the G7 restart boundary.
