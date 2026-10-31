# WP-07 e-Aushadhi — current state (as of 31 Oct 2026, IST)

This is the single "where are we" page for WP-07. If another WP-07 note disagrees with it, this page wins until it is next refreshed.

## 1. Live database (project `qhmoqtxpeasamtlxaoak`)
| Version | Change | Status |
|---|---|---|
| 20261024115131 … 20261027161124 | UX-1 to UX-4: roles, worklist, four-eyes triggers, stage review state, bulk seed, saved-for-review-by | Live (ADR-01..06) |
| 20261029141456 | PKG2 correction-note separator | Live |
| 20261029141512 | PKG3a two-person portal-entry gate (strict four-eyes); **only Product 262 enabled** | Live (ADR-08) |
| 20261029144643 | PKG1 captured portal options (569 options, six Product Types) | Live (ADR-09) |
| **20261031102139** | **UX-9 bulk source reference**: `rpc_eaushadhi_set_source_reference_bulk_v1`, `rpc_eaushadhi_source_reference_preview_v1`, table `regulatory.source_reference_bulk_request` | **Applied 31 Oct 2026** (ADR-13) |

UX-9 apply evidence: rollback-only trial on live 25/25 (first run 21/25 from a test-harness shortcut, fixed; both rolled back); post-apply read-only checks clean (both functions SECURITY DEFINER, anon cannot execute, log table RLS on with 0 client grants, Correct source function unchanged, 2,135 lines with a reference unchanged). Not exercised live: the `FORMULATION_APPROVED` refusal. Repo copy: `supabase/migrations/20261031102139_eaushadhi_ux9_bulk_source_reference.sql` (md5 `2f3c01f7167d8ac6c59940235f91c569`). Undo: drop both functions and the log table (save the log first).

Source corrections (Correct source, and UX-9) update `regulatory.source_composition_line` **in place**, with an audit trigger. There is no separate working-source overlay table.

Standing rules still in force: strict four-eyes on every stage; portal final **Submit** permanently excluded; each native portal **Save** needs its own explicit authorization; **B2 worker unlock is ON HOLD** (the worker stays locked to Product 262).

## 2. Client branch `feat/wp07-ux1-worklist`
- Tip **`c5821b1`** (31 Oct). Not merged; it is behind `main` and 26+ commits ahead of the merge base.
- Cache on the branch: `hub-cache-v376`.
- Audited chain since UX-8: `3d09c0f` UX-8.1 part 1 · `eec3531` UX-9 2B build · `747fc86` UX-9 fixes · `db9bbda` UX-9.1 toolbar/dialog · `12246a4` UX-9.1 fixes · `986a656` round 3 · `366606d` L4 lock / aria · `c5821b1` H3 floating helper tooltip. All passed audit; latest audit: 0 high, 0 medium, 3 low.
- Smoke baselines at `c5821b1` (counts may only grow):

| ux3 | ux5 | ux1 | ux2 | ux6-layout | ux61-portal-text | ux61-card-colours | ux62-controls | ux7 | ux9 | ux91 |
|---|---|---|---|---|---|---|---|---|---|---|
| 34 | 36 | 91 | 61 | 79 | 51 | 57 | 46 | 82 | 86 | 86 |

- Owner screen checks: UX-8.1 passed; UX-9.1 round 3 passed 5/6, the tooltip defect fixed in `c5821b1`; **final "9.1 final ok" still pending**.
- Open low findings: (1) floating tooltip does not follow page scroll while open; (2) the "flag clears in finally" check is regex-only, not a run of the error case; (3) tab-strip focus ring may be clipped.

## 3. Main, cache and merge status
- `main` cache is `hub-cache-v383` (PR #106, `9ea163d`; costing workstream PRs #100–#106 by Aryabhatta). `main` has since moved to `8143426` (docs-only, PR #107).
- To merge the client branch: rebase onto `main`, bump cache to **v384 or later**, update four e-Aushadhi smoke pins (version strings only: `eaushadhi-qc-preparation-workspace-smoke`, `eaushadhi-qc-b5-d7-smoke`, `eaushadhi-qc-b5-d7-2-2-smoke`, `eaushadhi-qc-b5-d7-3-smoke`), hand-merge `CHANGELOG_DECISIONS.md`, run every smoke. See [MERGE_PLAN.md](MERGE_PLAN.md).
- **Merge needs owner approval and a ping to Aryabhatta first.**

## 4. Delivery model
Codex hit its usage limit; Cursor is the interim client builder. The owner is considering Claude Code (Pro plan) cloud sessions: one brief → one draft PR covering several related UX items. See [CLAUDE_CODE_BUNDLES.md](CLAUDE_CODE_BUNDLES.md). Jarvis (Grok Bot) keeps server design/apply, audits and docs.

## 5. Open questions
- Portal blank reference: does the portal accept an ingredient with no reference? ([PORTAL_BLANK_REFERENCE_SHEET.md](PORTAL_BLANK_REFERENCE_SHEET.md)) — owner or Aneesh.
- B2 worker unlock (three answers, [B2 decision sheet](../wp07-overnight-20261029/B2_DECISION_SHEET.md)).
- ADR-08 two-Approver dead end: third Approver vs reopen-and-re-save (to confirm).
