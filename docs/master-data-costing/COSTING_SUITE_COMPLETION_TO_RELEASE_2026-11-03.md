# Costing Suite Completion-to-Release Plan — 3 November 2026

> **Current control statement:** The owner prefers to finish the Costing Suite before publishing the next SASV Workspace Electron version, rather than publishing immediately after the N1–N4/W6 navigation merge. This is a release sequencing preference, **not** approval for flag activation, server writes, publication, new features or unconditional closure of work packs. Source of truth: current Git `main` for code, live Supabase for server/run facts, dated owner decisions for governance. Historical snapshots below remain evidence, not current status.

## 1. Verified baseline and progress measures

- Code merged on `main`: `d395d7e8031a28e56ea1b0997424932997a36636`. WP05-P02 #131 and P01 #132; navigation N1 #133, N3 #134, N2 #136, N4 #135, W6 #139; N2/N3 historical test correction #138.
- Last LF/CRLF full suite: 605/605 each, 0 skipped/fail/cancel/TODO; 61 Chromium tests each, executed on W6 tested head `5c3869a`. Squash-merged `main` has exactly the same Git tree (2,271 entries, no mismatch). No independent fresh merged-head execution reported.
- **Navigation implementation wave = 4/4 packages merged** (N2/N3/N4/W6, N1 prerequisite). This is *not* whole-programme percentage.
- **Master-data formal work-pack ledger = 5/13 substantive WP00–WP12 completed** (WP-1 prerequisite separately complete). WP05, WP06, MDC-07 remain formally open; WP08–WP12 not formally closed, with WP08–WP10 predominantly future scope.
- New feature flags default OFF, no new PWA cache/release. Latest published Electron v6.1.0 (18 Aug 2026); root package remains 6.1.0; service worker code `hub-cache-v390`.

## 2. Costing Suite completion release — acceptance gates

| Gate | Completion evidence / disposition required | Present status | Owner/worker |
|---|---|---|---|
| CS-R1 Repository/ledger alignment | Current work-pack pages, A6 package plan and unified workflow reflect actual merge sequence and explicitly separate historical dated reports | This docs PR #140 (pending) | Assistant audit; owner merge approval |
| CS-R2 Navigation/UX release scope freeze | Confirm delivered P01/P02/N1–N4/W6 behaviour, decide whether U11 terminology package is necessary for this release; keep Tier-2 merges/C9 outside scope unless separately authorised | Wave merged; U11 not started; scope decision open | Owner + client worker |
| CS-R3 Operational costing/run reconciliation | **Read-only** check live approved vs draft valuation period, blocked/review reasons, cron/refresh, price-view semantics, readiness freshness, unresolved CI-048/049 and any outstanding October finalisation *before* deciding whether server action is required | **PARTIAL LIVE CHECK:** October OPEN, approved 143 for pricing, draft 148; November OPEN, draft 149; other checks outstanding (see §2A) | Assistant/Supabase read-only |
| CS-R4 Governed production corrections | For any live-blocking issue from CS-R3, document SQL/RPC contract, impact, approval/rollback and run evidence; no automatic writes, migrations, finalise or approval | Conditional, no authorisation yet | Owner and server worker |
| CS-R5 Signed-in acceptance and flag plan | Authorised role-based, populated-data walkthrough of P01/P02, all six Costing modules, deep links, historical/run-context separation and ON/OFF flag states. No flag ON merely because tests passed | Outstanding | Owner/test operators |
| CS-R6 Full integration regression | Clean full-history source checkout, full Node/Chromium LF+CRLF, historical guards, critical server contracts and no skipped tests; separate legacy smoke expectations triaged, not silently waived | Full pre-merge proof + exact tree equivalence; fresh post-merge run and legacy smoke triage outstanding | Claude/Windows/cloud test worker |
| CS-R7 Documentation/work-pack sign-off | Record final disposition of WP05, WP06, MDC-07 and U11 in a single closure report: complete, deferred with rationale, or separately gated. **Do not mark WP05/WP06/MDC-07 complete just because navigation merged.** | Open | Assistant audit; owner |
| CS-R8 Electron release candidate | New owner-approved version; reproducible Windows NSIS/ZIP build without publishing, packaged sign-in/module smoke, updated `latest.yml` QA, rollback, no PWA cache change unless separately approved | Not started; see `ELECTRON_RELEASE_READINESS_2026-11-03.md` | Windows/Claude worker; owner |
| CS-R9 Publishing approval | Explicit owner approval after CS-R1–R8; publish GitHub release/distribute installer; validate update behaviour | HOLD | Owner |

**A release is not declared ready merely because a gate is “not applicable”: document the evidence and explicit disposition.** Flag ON requires its own signed-in acceptance and approval; default-OFF release may be evaluated independently after governance review.

## 2A. Initial LIVE operational evidence — read-only Supabase query (3 Nov 2026)

Queried canonical `public.v_costing_pricing_period_run_status` in project `qhmoqtxpeasamtlxaoak`. This is **actual live status at query time**, not a proposal or cached October chat summary.

| Period | Status | Pricing-approved run | Latest successful/draft | Interpretation |
|---|---|---|---|---|
| November 2026 | OPEN | none | 149 / 149 | Draft 149; not for pricing |
| October 2026 | OPEN | **143** (valuation 22 Oct) | 148 / 148 | Approved 143 remains in use for pricing; newer draft 148 (31 Oct) requires review and is not for pricing |
| September 2026 | LOCKED | **122** (valuation 10 Sep) | 122 / 121 | Final/locked approved September remains unchanged |
| August 2026 | OPEN | none | 82 / 82 | Older historical draft, not for pricing |
| July 2026 | OPEN | none | 80 / 80 | Older historical draft, not for pricing |

**Gate implication:** October has **not** been finalised or locked; neither its draft 148 nor November draft 149 may be treated as approved. CS-R3 is now **PARTIALLY VERIFIED** (period status). Still to investigate read-only: 148 review/block populations and causes, valuation/refresh and readiness freshness, weekly/month-end cron outcomes, CI-048/049 implementation state, and any dependent views or approval gates. No SQL writes, approval/finalisation or readiness rebuild performed. Do not equate July/August historical exact-run fixtures with current costing.

## 3. Work-package boundaries — prevent scope creep

**Finish before declaring the Costing Suite release complete:** WP05/06/MDC-07 current implemented functionality and any verified production-blocking defects; U11 terminology only if the owner accepts it as release scope; signed-in and integrated source/release proof; govern active costing/run status based on fresh server reads.

**Not automatically release blockers:** WP08 Product/Master Data navigation, WP09 wider app launcher/IA, WP10 future-SKU safeguards beyond existing approved controls, WP11 visual redesign unrelated to critical Costing UX, WP12 *whole-programme* closure. These remain tracked with their own separate work packs. WP12-style **Costing-specific** live/regression proof is still required for CS-R5/CS-R6.

**Explicitly deferred unless separately authorised:** Tier-2 SKU Control Status ↔ Readiness merge, CCC/MCM review-authority consolidation, Action Queue controller merger, tabbed PRM evidence views, CSA relocation, C9 shared-registry periodScoped correction, changing fixed historical run 80/82 to selectable run, maker-checker D7, Utilities Hub governed label D10, dropping legacy views, retention cleanup PR #137 and e-Aushadhi WP-07 migrations #122.

**Outstanding governing decisions requiring fresh evidence or owner disposition:** A5 D2/D3/D5/D6/D7/D10 and historical `REMAINING_WORK_2026-11-01.md` items including October finalisation, stale readiness rebuild, CI-048 schedule/alert, CI-049 lock guard, June–August reconciliation, flag activation. **None of those historical statuses is assumed current without a live read.** A decision can be recorded as deferred/nonblocking, but cannot be silently considered solved.

## 4. Immediate execution order

1. Reconcile authoritative docs in draft PR #140; review/merge only with owner approval.
2. Do read-only Supabase operational snapshot (CS-R3) and choose which issues *actually* block Costing Suite completion.
3. Decide/brief U11 if appropriate; it must be its own small approved, tested client PR; no automatic code edits from this document.
4. Run signed-in feature verification and integration suites; correct only evidenced defects with scoped PRs and owner gates.
5. Create a separately approved version/release candidate on Windows and review before publication.

**Progress reporting:** show the two independent gauges (navigation packages 4/4 merged; formal master-data work packs 5/13 completed) and the nine CS-R1–R9 release gates with evidence. Never present 4/4 navigation as full Costing Suite completion.
