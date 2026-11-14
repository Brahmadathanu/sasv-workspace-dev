# WP-07 e-Aushadhi — current state (as of 1 Nov 2026, IST)

> **CURRENT INTEGRATION STATUS — 1 November 2026 (supersedes earlier branch/cache/merge instructions below):** The authoritative integration branch is `main` at `a6d35b93945b92626789f4f35a9eb25365026427`; the service-worker cache is `hub-cache-v390`. WP-07 client integration PR #120, Costing v390 PR #123, and WP-07 test-harness reconciliation PR #124 are merged. PR #122 is the remaining **draft, unmerged** repository-only reconciliation of nine historical WP-07 migration SQL files and eleven governance documents; it targets `main`. On 1 November, a read-only audit independently compared all nine SQL files with `supabase_migrations.schema_migrations.statements`: **9/9 exact text matches and matching MD5 values**. These migrations are **already applied**: never run `db push`, reapply, rewrite, or rename these files. Some original migration preambles say “NOT APPLIED”; those are preserved historical comments, **not current operational status**. Earlier instructions below naming v387/v388/v389, describing PR #120 as unmerged, or prescribing rebase/cache bumps are historical and MUST NOT be executed. Preserve Product 262 restrictions, four-eyes controls, native portal Save requiring individual owner approval, and the permanent prohibition on portal Submit. No production writes or migration execution; merge PR #122 only on separate owner approval. The agreed Costing/WP-07 shared-`main` integration freeze remains active through this gate.


> **LATEST INTEGRATION STATUS (1 Nov 2026, supersedes older section 2–4 branch/cache snapshots):** Bundle A passed owner screen acceptance. Bundle B accepted client audit at `9b8faa1` (draft PR #120; cache v389). Ten UX/PKG SQL migrations have exact live-history MD5 parity; nine and eleven authoritative docs are staged in draft PR #122 (`52e86b6`), targeting Bundle B. New main `cfab901` (Costing UX-F1, cache v388) is ahead of PR #120's merge base `9c189d6`; main overlap must be reconciled before any merge. Neither PR may merge without separate owner approval. **Do not follow obsolete v376/v387 or Bundle A-pending instructions below as current actions.**

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

## 9. Bundle B draft PR #120 independent audit (1 Nov 2026)
- Claude integrated Bundle A with main `9c189d6` (v388) to branch `merge-prep/wp07` head `6b88313`, cache `v389`; [PR #120](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/120) is draft, unmerged. GitHub independently verified base/head/main and 31 commits ahead, zero behind.
- All 12 WP-07 and four QC suites reported passing, but **three Costing regression tests are red**. Independent inspection confirms their historical change-scope guards compare global `supabase/` and/or all `*.html` and `*.css` against Costing package anchors; legitimate WP-07 additions trigger them.
- **Audit verdict: correction required before merge**: narrowly scope Costing historical diff guards to their intended owned files while retaining positive checks for Costing changes; regression-test the adjustment against main and integration. Do not relax functional/security checks.
- Separate release blocker: migration repo/live parity not yet independently established. PR #120 includes inherited WP-07 migration `20261024115131`; other live UX1–UX9 migration copies (including `20261031102139`) remain on docs branch. Complete read-only version/statement parity audit and plan any repo-only corrections under server-worker governance. No db push.
- Bundle A owner screen acceptance remains valid. No main merge, deployment, server mutation, native Save or final Submit approved.

## 10. Bundle B scope-guard correction audit (1 Nov 2026)
- Claude submitted correction `b1539df` to draft PR #120; GitHub independently confirms main `9c189d6`, PR open/draft and six `scripts/`-only files in the corrective commit. Claude reports 46 suites green including four corrected Costing guards and 16 negative controls; execution not independently rerun.
- **Narrow follow-up required:** `scripts/lib/costing-scope-guard.mjs` uses `COSTING_SQL_PATTERN = /\bcosting\b/i`, which detects `costing.t` but can miss Costing identifiers such as `costing_refresh_run` because underscore is a word character. Strengthen new-migration protection and negative controls for actual Costing identifiers; preserve permission for genuinely unrelated WP-07 migration files. Do not alter functional client/server code.
- Release remains blocked separately on repo/live migration parity and authoritative documentation landing. No approval to merge or deploy.

## 11. Bundle B final client correction accepted (1 Nov 2026)
- Draft PR #120 head `9b8faa10000cd505b9a87afa733284728bcaf929` independently confirmed, main remains `9c189d6`, PR unmerged.
- Final correction touches only `scripts/lib/costing-scope-guard.mjs` and `scripts/costing-scope-guard/scope-guard.test.mjs`. New `sqlTouchesCosting` token matcher includes underscore-delimited and schema-qualified identifiers. Real WP-07 migration control remains allowed and Costing examples detected. Claude reports 28/28 scope controls and 47 suite runs passing; independently inspected GitHub source but did not personally execute the suites.
- **Verdict: client integration correction accepted; no more Claude work for Bundle B at present.** PR merge and release remain blocked pending read-only live/repo migration parity and authoritative documentation integration, with separate owner approval required for final merge.

## 12. Read-only live/repository migration inventory (1 Nov 2026)
- Supabase project `qhmoqtxpeasamtlxaoak`, `supabase_migrations.schema_migrations`, queried read-only. All 10 WP-07 UX/PKG versions from 24–31 Oct are recorded live: `20261024115131`, `20261025163252`, `20261025173239`, `20261026133841`, `20261027135522`, `20261027161124`, `20261029141456`, `20261029141512`, `20261029144643`, `20261031102139`.
- PR #120 `9b8faa1` contains only `20261024115131`; the docs branch contains the other nine at their matching version numbers, but lacks `20261024115131` (in PR). Main lacks all ten. Do not reapply them.
- Live stored UX-1 statement length `14855`, md5 `228072363ffa20a127a4fa98a4f7e22e`; live UX-9 statement length `21769`, md5 `2f3c01f7167d8ac6c59940235f91c569`. UX-9 docs-branch file length also `21769` characters. Full byte/statement parity for all 10 **not yet certified**; matching names/versions/length alone does not prove SQL equality.
- Repository migration filenames vs live records elsewhere in e-Aushadhi history sometimes differ in timestamp/name; no global migration parity conclusion yet. Existing repo documents include stale `CANDIDATE - NOT APPLIED` preamble in the UX-9 file although recorded live as applied; correction must be documentation-only and must not silently alter applied SQL bytes.
- **Gate:** No db push, migration repair, or main merge pending an exact parity procedure and documentation integration decision.

## 13. Exact migration parity audit — 1 Nov 2026
Read-only hash comparison of the ten WP-07 UX/PKG migrations dated 24–31 October: **10/10 exact MD5 matches** between the files in GitHub and the corresponding `supabase_migrations.schema_migrations.statements[1]` in live project `qhmoqtxpeasamtlxaoak`. UX-1 is contained in draft PR #120; the nine later migration files are present on this docs branch. Preserve original SQL files byte-for-byte, including historical comment headers. Correct outdated applied-status descriptions in separate documentation only. No database history repair or production action is needed for these ten. This is not yet a global repo/live migration parity certification. Next gate: repository-only integration plan and owner merge approval.
