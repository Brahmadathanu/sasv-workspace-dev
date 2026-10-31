# WP-07 remaining work / backlog (31 Oct 2026)

| # | Item | State | Blocked on | Where |
|---|---|---|---|---|
| 1 | UX-9.1 final owner screen "ok" on `c5821b1` | Waiting | Owner | CURRENT_STATE §2 |
| 2 | Three low audit findings (tooltip follows scroll; real error-path test for flag-clears-in-finally; tab focus-ring clipping) | Ready | — | Bundle A |
| 3 | Extend `.ea-btn` + "fixed toolbar / one table scroll bar / filter drawer" pattern to other e-Aushadhi tabs (no behaviour change) | Ready | — | Bundle A |
| 4 | Remove legacy old-card render path for composition lines (UX-7 finding 1), if confirmed unused | Ready (verify first) | — | Bundle A |
| 5 | Merge prep: rebase on main, cache v384+, four smoke pins, CHANGELOG hand-merge, full smokes, draft PR to main | Ready to brief | **Owner approval + Aryabhatta ping** | [MERGE_PLAN.md](MERGE_PLAN.md), Bundle B |
| 6 | Portal blank-reference check (A/B/C/E answers) | Waiting | Owner or Aneesh | [PORTAL_BLANK_REFERENCE_SHEET.md](PORTAL_BLANK_REFERENCE_SHEET.md) |
| 7 | Blank-reference clearing / "Reference needed before portal entry" note | Blocked | Item 6; server change needs owner approval | Bundle C |
| 8 | B2 worker unlock (worker beyond Product 262) | **ON HOLD** | Owner's three answers | [B2 sheet](../wp07-overnight-20261029/B2_DECISION_SHEET.md), Bundle C |
| 9 | Package D: QC across many products | Blocked | QC server Part A approval; COA file-naming convention | [old package D](../wp07-overnight-20261029/CODEX_PACKAGES.md) |
| 10 | PKG3a scenarios C1–C9 (live gate tests) | Not run | Needs a fully approved non-262 product | ADR-08 |
| 11 | ADR-08 two-Approver dead end: third Approver vs reopen-and-re-save | To confirm | Owner | ADR-08 |
| 12 | Pilot with Aneesh (owner + Aneesh on real products) | In progress | — | Pilot sheet (agent workspace) |
| 13 | 14 older repo migration files whose versions differ from live | Open | Joint plan with costing agent | WP-07_MIGRATION_RECORD.md |
| 14 | `FORMULATION_APPROVED` refusal not exercised live | Accepted risk | A product with an approved formulation | ADR-13 |

Standing exclusions: portal final Submit never; each portal Save explicitly authorized; no direct writes to regulatory tables.
