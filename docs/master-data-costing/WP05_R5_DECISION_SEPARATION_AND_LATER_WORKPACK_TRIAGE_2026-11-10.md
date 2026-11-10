# WP05 R5 — closure-critical decisions versus separate hardening, and WP07–WP11 triage

**Prepared 10 November 2026. Status: documentation/source reconciliation, no approval or code change.** Formal programme **6/13**. Parent WP05 OPEN. Earlier records: [R4 owner decision checkpoint](WP05_R4_CONSOLIDATED_OWNER_DECISION_CHECKPOINT_2026-11-10.md), [B1 retained gate ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md), [B1 effective transfer](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md), [R3 49-view policy proposal](WP05_R3_49_VIEW_READER_AND_MINIMUM_COLUMN_POLICY_PROPOSAL_2026-11-10.md).

## WP05 decision separation

| Matter | Proposed lane | Why | Next bounded evidence/action |
|---|---|---|---|
| W5-06 Staff Governance personnel | **ACCEPTED subgate — no rework** | 10 Nov explicit owner risk acceptance, 3 authenticated CBM accounts and 11/11 UI; CSR-only NOT TESTED | #262 separate export UX hardening; preserve accepted server gate |
| 49-view broad one-of-four costing reader rule | **SECURITY POLICY DECISION, not automatic implementation** | 49 matched live; staff fixed; ten sensitive P1 possible exposures but effective-user leakage not proven | Adopt/revise design-only hybrid direction; create exact high-risk consumer/negative role contract before scoped change; do NOT treat all 49 as mandatory rewrite just to close WP05 |
| ID-N / ID-X / ID-O and SEC-A1/A2 negative access | **WP05 CORE SECURITY CLOSURE** | Current metadata/static/isolated proof cannot substitute for all authenticated negative identities; no eligible production ID-O | Choose safely bounded tests or explicit residual exceptions, no production writer invocation; existing accepted Staff Governance CSR-only exception does not waive other views |
| PRM run 80/82, moving as-of, F1 preview | **WP05 CORE FUNCTIONAL AUTHORITY** | run 82 historical recipients with current date predicates; F1 body matches migration, but privileged dependency scope/allowlist not signed | Owner business semantics decision; static/live-metadata-only F1 privilege review, no preview call |
| Four historical FAIL and W5-04 lens NT | **WP05 CORE EVIDENCE DISPOSITION** | AE1 evidence frozen 13P/4F/2NA/21NT, later partial recoveries exist, B1 T1=zero | Record exact historical error and later observed recovery by build/identity; target only critical remaining read-only checks |
| D3 CCC/MCM action authority, L1 frozen scheme KPI, C5/D5 | **WP05 CORE DECISIONS** | Could affect actual operator correctness/authority, not just cosmetic hardening | Use existing CLD3 decision matrix and live read-only metadata; no business rule changes until approved |
| CSV/export minimum field refinements (vendor, audit, trace) | **SECURITY HARDENING BACKLOG unless exposure shown** | `select('*')` is an overcollection signal, not a proven unauthorised data leak | Owner-approved tiered policy design and separate client/server packages, positive/negative regression before release |
| Final WP05 gate | **OWNER SIGN-OFF ONLY AFTER ABOVE** | B1 transferred integration breadth to WP12, not individual lens or security obligations | W5-03–W5-09 evidence and accepted risk ledger; owner final Gate Status; only then formal 7/13 |

## Later workpack current-state review, based on canonical files

| Workpack | Canonical source | Verified documentation status | Interpretation / next true gate |
|---|---|---|---|
| **WP07 (MDC-07)** | `WP-07-COSTING-NAVIGATION.md` | Navigation N1/N2/N3/N4/W6 reported merged 3 Nov; LF/CRLF 605/605 at historic head; not closed; U11 terminology and signed-in populated-data ON verification pending | **Implementation wave merged, acceptance OPEN.** Review source drift, flag state, and scoped functional interactions; coordinate wide final 11-flag sweep with WP12 B1, avoid duplication |
| **WP08** | `WP-08-MASTER-DATA-NAVIGATION.md` | **G0 NOT STARTED** | Product/SKU/BOM/route/policy hierarchy still needs independent scoped architecture audit/design; WP02's parked UX does not automatically count as completion |
| **WP09** | `WP-09-WIDER-APP-IA-AUDIT.md` | **G0 NOT STARTED** | Wider app launcher/section duplication audit not started; must inventory actual current UI before design |
| **WP10** | `WP-10-FUTURE-CREATION-SAFEGUARDS.md` | **G0 NOT STARTED** | Future SKU creation prevention/detection governance needs actual functional contract beyond earlier completed completeness readiness |
| **WP11** | `WP-11-UX-CONSISTENCY.md` | **G0 NOT STARTED** | UX hardening explicitly follows architecture; parked Manage Products UX-P02 still uncompleted |
| **WP12** | `WP-12-REGRESSION-AND-DOCUMENTATION.md` | Mock-backed 11-flag suite reported merged; B1-T2/T3 receiving contract accepted; live final build/electron regression OPEN | **Final integrated release gate**; do not present mock-backed coverage as final rollout proof |

**No inferred completion dates:** A formal 6/13 count reflects owner sign-offs, *not* the percentage of design/code/test effort remaining. WP08–WP11 still say G0/NOT STARTED; this is meaningful substantive work rather than documentation-only. A fixed 1–2 week completion promise is unsupported.

## Parallel work policy

1. Do WP05 remaining security/PRM/historical evidence and decisions first to avoid entangling data authority.
2. In parallel, permit **repository-only audits and contract drafting** for WP08–WP11, without prematurely opening implementation or changing their formal gate. A scoped kickoff for WP08 is the natural next substantive workpack after WP07 hierarchy is reconciled.
3. Keep WP12 B1 final-build integrated 11 flags, routes, widths and Windows/Electron evidence before rollout. If other workpacks alter navigation, do WP12 final run *after* those changes, not now.
4. Keep all workpack dashboards honest: **WP05 open, WP07–WP12 open, 6/13 formal**; no automatic Electron/PWA deployment, grants, schema writes or flags under documentation work.

## Remaining WP05 owner decision batch

As drafted (NOT YET OWNER APPROVED): **Q-VIEW/Q-VENDOR/Q-AUDIT/Q-TRACE** design direction; **Q-ID** negative identity test/exception limits; **Q-PRM** historical-run vs as-of intent; **Q-F1** separate static-vs-behavioural authority; **Q-HIST** later recoveries without erasing failures; **Q-SIGN** only after core gates. No action on this document alone changes a security rule or production data.
