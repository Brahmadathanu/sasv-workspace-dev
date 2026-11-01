# WP-07 e-Aushadhi — current state (as of 1 Nov 2026, IST)

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

- Owner screen checks: UX-8.1 passed; UX-9.1 round 3 passed 5/6, the tooltip defect fixed in `c5821b1`; 1 Nov check: see §4a; **final "9.1 final ok" still pending** (Bundle A).
- Open low findings (all in Bundle A as A1–A3): (1) floating tooltip does not follow page scroll while open; (2) the "flag clears in finally" check is regex-only, not a run of the error case; (3) tab-strip focus ring may be clipped.

## 3. Main, cache and merge status (checked 1 Nov 2026)
- `origin/main` is **`5c5b7ba`** (docs PR #113) with cache **`hub-cache-v387`** (CW-05 pkg 4, PR #112). Costing PRs #106–#112 moved main v383 → v387; each changed the four e-Aushadhi smoke pins by version string only.
- Open costing drafts: **#115** (`feat/costing-c1-run-context-diagnostics`, `fb7e863`) and **#117** (`feat/costing-c1b-run-148-worklist`, stacked on #115, `7a8f929`) — both still at v387, no bump; #114/#116 are docs drafts (as reported by the costing orchestration; PR numbers not re-checked in this pass).
- **No cache number is reserved for WP-07.** The client branch `feat/wp07-ux1-worklist` (`c5821b1`) is on `hub-cache-v376`. At merge it takes the next free number at that moment (v388 if nobody has used it; otherwise the next).
- To merge: owner approval, then confirm the number with the costing orchestration (ChatGPT), rebase onto `main`, bump, update the four e-Aushadhi pins (version strings only: `eaushadhi-qc-preparation-workspace-smoke`, `eaushadhi-qc-b5-d7-smoke`, `eaushadhi-qc-b5-d7-2-2-smoke`, `eaushadhi-qc-b5-d7-3-smoke`), hand-merge `CHANGELOG_DECISIONS.md`, run every smoke. See [MERGE_PLAN.md](MERGE_PLAN.md).

## 4. Delivery model (ADR-15, owner-accepted 1 Nov 2026)
- **ChatGPT** = orchestrator + server worker (plans, audits, Supabase server work only after owner approval). The costing suite is also orchestrated in ChatGPT (no longer by the Aryabhatta agent).
- **Claude Code** (cloud sessions, Pro plan) = client worker: all client coding as bulk packages (one brief → one draft PR). See [CLAUDE_CODE_BUNDLES.md](CLAUDE_CODE_BUNDLES.md).
- **Jarvis (Grok Bot)** = audit, planning and status support unless the owner says otherwise.
- Codex (usage limit) and Cursor (interim) are retired from the default flow.
- Handover: [HANDOVER_TO_CHATGPT.md](HANDOVER_TO_CHATGPT.md).

## 4a. Owner screen check at `c5821b1` (1 Nov 2026)
Floating tooltip and keyboard/Escape: pass. Short window: pass. Findings sent to Bundle A: **A4** tooltip should also show from the Composition tab button, and the "i" needs a more visible colour; **A5** no horizontal scroll bar at half width when the table is wider; **A6** "Approve reviewed lines" text turns dark on hover (unreadable). "9.1 final ok" waits for these fixes.

## 5. Open questions
- Portal blank reference: does the portal accept an ingredient with no reference? ([PORTAL_BLANK_REFERENCE_SHEET.md](PORTAL_BLANK_REFERENCE_SHEET.md)) — owner or Aneesh.
- B2 worker unlock (three answers, [B2 decision sheet](../wp07-overnight-20261029/B2_DECISION_SHEET.md)).
- Live Apply test of UX-9 on Product 270 or 268 (changes real data): owner decision.
- ADR-08 two-Approver dead end: third Approver vs reopen-and-re-save (to confirm).

## 6. Bundle A independent audit (1 Nov 2026)
- Claude Code delivered draft PR [#118](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/118), branch `feat/wp07-bundle-a-ux-polish`, head `6c4434a`, targeting `feat/wp07-ux1-worklist` at `c5821b1` (not main).
- ChatGPT independently read the PR metadata, base/head comparison, patches and new smoke source. **Verdict: PASS WITH LOW FINDINGS — code review, not final visual acceptance.** The PR changes seven client/CSS/test files; no committed Supabase/server/worker/cache or service-worker file changes. Claude reports all 11 original smokes at baseline with zero failures and the new UX-10 smoke 124/124; these checks were inspected but not independently rerun.
- A1–A6 and scoped tab styling are present. The legacy composition-card render path is still used by the line modal and was correctly retained. No merge or rebase authorized.
- Parked low findings for a later suitable bundle: disabled primary/danger button contrast is not fully ratio-tested in the disabled state; two older markup-comparison smokes now narrowly strip Bundle A class tokens, so future test changes must preserve their meaningful regression coverage.
- **Next gate:** owner look-only screen verification of PR #118 at 125% (tooltip, narrow/full-width scroll, focus rings and button contrast). **Do not click an active Approve, Save, Apply, gate On/Off or portal action during this check.** Final `9.1 final ok` and Bundle B remain pending owner acceptance/approval.

## 7. Bundle A owner acceptance (1 Nov 2026)
- Owner launched the isolated Windows checkout of Bundle A at `6c4434a` and reported **all screen tests passed**. This closes the Bundle A owner visual-check gate and provides the outstanding UX-9.1 final acceptance.
- Draft PR #118 remains unmerged; the separate documentation branch is also unmerged. The two low audit observations remain parked, not blockers.
- **Next gate: Bundle B merge preparation, requiring a new explicit owner approval and a fresh main/cache coordination check.** No rebase, cache change, merge, production write, portal Save or Submit is authorized by this acceptance.

## 8. Bundle B revised integration boundary (1 Nov 2026)
- Claude's first Bundle B session correctly stopped without changes when Costing PR #117 advanced main to `9c189d60967c2efd3b99f4703416eb22123d96e2` and `hub-cache-v388`.
- Independent read-only GitHub verification confirmed main `9c189d6`, cache v388, and Bundle A PR #118 still draft at `6c4434a`.
- Orchestrator assigned **candidate `hub-cache-v389` for WP-07 draft integration preparation**, subject to a fresh check immediately before the version change; no technical reservation can stop concurrent mergers.
- Revised Bundle B may prepare a separate `merge-prep/wp07` branch and one draft PR to main; no merge, production writes or portal action approved. Preserve Costing and WP-07 changes; test all relevant cache pins.
