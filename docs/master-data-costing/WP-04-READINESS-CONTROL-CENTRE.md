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
No work belonging to later gates; no guessed data; no unrelated/e-Aushadhi changes. This record does not itself merge, release, or publish, and it does not start WP05. G8 remains NOT STARTED until the authorized merge and post-merge verification are performed.

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
| WP04-G7 — Authenticated / live verification | [x] COMPLETED AND VERIFIED / PASS — original attempt was blocked, recovered through Track A/B, then formally rerun successfully |
| WP04-G8 — Merge / post-merge closure | [x] COMPLETED AND VERIFIED / PASS |

WP04 is **COMPLETED, VERIFIED, MERGED, AND CLOSED**.

### Original G7 exposure and recovery split

Original G7 signed-in verification exposed:

- native 8-second portfolio instability under the authenticated statement-timeout ceiling;
- material CCC / Readiness UX integration defects.

G7 was blocked. That blocked history is preserved. Recovery was explicitly split into:

- **Track A** — server portfolio indexed-reader / build recovery;
- **Track B** — client CCC / Readiness UX recovery on `fix/wp04-g7-track-b-readiness-ux`.

Recovery closed both tracks. Formal WP04-G7 was then rerun from the beginning and **PASS**.

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
- Readiness RPC unchanged;
- **CSE-P01 unchanged**.

### Track B — ACCEPTED

Track B client recovery remains **ACCEPTED** at runtime candidate:

`47b07b4bdb92f9d2d471c61569045c8f24f1cac5`

Branch: `fix/wp04-g7-track-b-readiness-ux`.

That SHA is the runtime candidate verified by the formal G7 rerun. Documentation-only commits after it — ledger reconciliation `bece900ae75d3292fbb7ea6f4623f1185af0e283`, then this G7 closure record — advance the branch documentation head only. They are not a new runtime candidate. No GitHub CI evidence exists for Track B or this G7 record.

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

### Park for WP05 (not started; remains parked)

- SKU Control Status ↔ Readiness rationalisation candidate;
- wider Costing / Pricing Policy Manager duplication audit;
- dependency audit for parked legacy dashboard-summary server objects (`public.v_costing_pricing_dashboard_summary` / `costing.v_pricing_workflow_dashboard_summary`).

### Formal WP04-G7 rerun — PASS

The original blocked G7 is not rewritten. After Track A/B recovery, formal WP04-G7 was rerun and is **COMPLETED AND VERIFIED / PASS**.

All seven signed-in/native checks passed:

- startup / hard refresh;
- Readiness OPERATIONAL;
- filter / search;
- ALL_EXISTING;
- detail / Membership;
- lens restoration;
- narrow-screen path.

Backend verification after that G7 rerun found:

- no new statement timeout events;
- no new calls to parked `public.v_costing_pricing_dashboard_summary`.

No GitHub CI evidence exists.

## Current Gate
Closed — WP04-G8 completed and verified.

## Gate Status
[x] WP04 **COMPLETED, VERIFIED, MERGED, AND CLOSED** — G0–G8 complete. Formal G7 rerun PASS; Track A CLOSED/APPLIED/PROVEN; Track B accepted at runtime candidate `47b07b4bdb92f9d2d471c61569045c8f24f1cac5`. G8 merged synchronized feature head `836ff0e9e9fd8dbe27061dde2a6346236466b2a4` into `main` `a007cea4d624835dc5406a952657769868619649` as merge commit `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b`. Post-merge verification PASS. No GitHub CI evidence is claimed. WP05 not started.

## Required to close
None. Exit criteria satisfied.

## Next gate
None within WP04. WP05 may open separately when explicitly started.

## Server changes
Track A server recovery is already APPLIED/PROVEN in production (Build 4). No further Track A mutation is authorized by this ledger update. Legacy dashboard-summary server objects remain parked, not dropped.

## Client changes
Track B accepted client runtime candidate `47b07b4bdb92f9d2d471c61569045c8f24f1cac5` on `fix/wp04-g7-track-b-readiness-ux`. After documentation and main-synchronization commits, final synchronized feature head `836ff0e9e9fd8dbe27061dde2a6346236466b2a4` was merged unchanged into `main` by G8 merge commit `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b`.

## Tests / verification
Formal WP04-G7 rerun is PASS for the seven signed-in/native checks listed above. G8 post-merge verification confirmed merge parent 1 `a007cea4d624835dc5406a952657769868619649`, parent 2 `836ff0e9e9fd8dbe27061dde2a6346236466b2a4`, and a merged tree identical to the verified synchronized branch tree. Live Track A remained Build 4 / COMPLETED / current / period 2026-09-01 / valuation 2026-09-10 / Run 115 / 1793 ALL_EXISTING / 611 OPERATIONAL / fingerprint matching; Readiness RPC MD5 remained `590a40c5a53949ca8e9f87dd54404947`; CSE-P01 MD5 remained `68bd9325062299eb8af1291bf4d9393b`. The checked post-merge log window contained no new statement timeout and no new `v_costing_pricing_dashboard_summary` call. No GitHub CI evidence is claimed.

## Decisions created / preserved
DEC-011, DEC-014, and DEC-015 remain LOCKED and are preserved. Historical recovery evidence (2026-10-07) remains recorded. See CHANGELOG_DECISIONS.md for the 2026-10-08 G7 PASS ledger entry.

## Risks
Reopening closed WP04 recovery work without fresh regression evidence; claiming GitHub CI evidence that does not exist; or dropping parked legacy dashboard-summary objects before the WP05 dependency audit.

## Parked discoveries
See PARKED_BACKLOG.md entries PERF-P01, CSE-P01, and the WP05 park candidates recorded from Track B acceptance.

## Exit criteria
All work-pack objectives and required verification gates pass; documentation and handover are current; explicit G8 merge/post-merge proof where applicable.

## Final handover
Complete. WP04 is closed at merge commit `1ff8d13e90b5078dde7e414e3c257cf41aa6f34b`. Preserve Track A/Track B/G7 recovery evidence and parked WP05 candidates; do not reopen WP04 without fresh regression evidence.
