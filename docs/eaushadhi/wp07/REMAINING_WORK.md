# WP-07 remaining work / backlog (refreshed 1 Nov 2026, IST)

Owner = Dr. Brahmadathan. Orchestrator/server worker = ChatGPT; client worker = Claude Code (ADR-15).

| # | Item | State | Blocked on | Where |
|---|---|---|---|---|
| 1 | UX-9.1 final owner screen "ok" | Waiting for Bundle A (A4–A6 found 1 Nov) | Bundle A, then owner | [CURRENT_STATE §4a](CURRENT_STATE.md) |
| 2 | Three low audit findings A1–A3 (tooltip follows scroll; real error-path test for the verify lock; tab focus-ring clipping) | **Approved — Bundle A** | — | [Bundle A](CLAUDE_CODE_BUNDLES.md) |
| 3 | A4 tooltip also from the Composition tab button + more visible "i"; A5 automatic horizontal scroll at half width; A6 "Approve reviewed lines" hover contrast (+ all `.ea-btn` variants) | **Approved — Bundle A** | — | [Bundle A](CLAUDE_CODE_BUNDLES.md) |
| 4 | Extend `.ea-btn` + toolbar/one-scroll-bar/filter-drawer pattern to other tabs (no behaviour change) | **Approved — Bundle A** | — | Bundle A (b) |
| 5 | Remove legacy old-card render path (UX-7 finding 1), only if proven unused | **Approved — Bundle A** | — | Bundle A (c) |
| 6 | Merge prep: rebase on main (v387 on 1 Nov), next free cache (v388 if free), four smoke pins, CHANGELOG hand-merge, smokes, draft PR to main | Ready to brief | **Owner approval + cache check with costing orchestration** | [MERGE_PLAN.md](MERGE_PLAN.md), Bundle B |
| 7 | Portal blank-reference check (A/B/C/E answers) — clearing a reference stays refused (`BLANK_REFERENCE_NOT_ALLOWED`) until answered | Waiting | Owner or Aneesh | [PORTAL_BLANK_REFERENCE_SHEET.md](PORTAL_BLANK_REFERENCE_SHEET.md) |
| 8 | Live Apply test of UX-9 on Product 270 or 268 (changes real data) | Owner decision | Owner | ADR-13 |
| 9 | Blank-reference clearing / "Reference needed before portal entry" | Blocked | Item 7; server change needs owner approval | Bundle C |
| 10 | B2 worker unlock (worker beyond Product 262) | **ON HOLD** | Owner's three answers | [B2 sheet](../wp07-overnight-20261029/B2_DECISION_SHEET.md) |
| 11 | Package D: QC across many products | Blocked | QC server Part A approval; COA file-naming convention | [old package D](../wp07-overnight-20261029/CODEX_PACKAGES.md) (stale wording: "Codex" = client worker) |
| 12 | PKG3a scenarios C1–C9 (live gate tests) | Not run | A fully approved non-262 product | ADR-08 |
| 13 | ADR-08 both-Approvers-saved dead end: third Approver vs reopen-and-re-save | To confirm | Owner | ADR-08 |
| 14 | Pilot with Aneesh (owner + Aneesh on real products) | In progress | — | Pilot sheet (agent workspace, not in repo) |
| 15 | 14 older repo migration files whose versions differ from live | Open | Joint plan with costing orchestration | [WP-07_MIGRATION_RECORD.md](../WP-07_MIGRATION_RECORD.md) |
| 16 | `FORMULATION_APPROVED` refusal not exercised live | Accepted risk | A product with an approved formulation | ADR-13 |

Standing exclusions: portal final Submit never; each native portal Save explicitly authorized by the owner; no automatic source verification; no direct client writes to regulatory tables; no production/server writes without owner approval; no merges to main without owner approval.
