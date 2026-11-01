# Handover to ChatGPT — WP-07 e-Aushadhi (1 Nov 2026, IST)

> **CURRENT HANDOVER ADDENDUM (1 Nov 2026):** The original continuation prompt below is historical and must not be treated as an instruction to wait for Bundle A. Bundle A is owner-accepted; Bundle B client audit passed. Draft PR #120 at `9b8faa1` (cache v389) awaits reconciliation with advanced main `cfab901`; draft PR #122 at `52e86b6` stages nine exactly live-matched SQL migrations and eleven WP-07 docs. Neither PR is merged. No live migration, portal action, or final merge is authorized. Continue from the newest dated gate in `CURRENT_STATE.md` and coordinate cache with Costing.

## Ready-to-paste first message to ChatGPT
```
You are now the ORCHESTRATOR and SERVER WORKER for WP-07 (e-Aushadhi worklist, review and portal entry) in repo Brahmadathanu/sasv-workspace-dev, Supabase project qhmoqtxpeasamtlxaoak. Claude Code (cloud sessions) is the CLIENT WORKER and does all client coding as bulk packages: one brief -> one draft PR. I will paste Claude's reports to you; you audit them.

Before anything else, read the handover and the repo docs on branch docs/wp07-state-20261031, in this order:
https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/HANDOVER_TO_CHATGPT.md
https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/CURRENT_STATE.md
https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/CLAUDE_CODE_BUNDLES.md
then the rest of the reading list in the handover.

Rules: no production writes; no Supabase/server change without my explicit approval; cache pins version-string only; four-eyes and the PKG3a gate (only Product 262 enabled) stay strict; portal final Submit is never used; each native portal Save needs my explicit OK; no merges to main without my approval. I am not a coder: give me short checklists.

Then reply with: (1) a 10-line summary of your understanding (roles, live state, branch/cache state, open decisions), (2) anything in the docs that looks inconsistent, and (3) confirm you will wait for Claude's Bundle A report. Do not start new work yet.
```

---

## 1. Role split and rules of engagement (ADR-15)
| Who | Does | Never does |
|---|---|---|
| **Owner** (Dr. Brahmadathan) | Approves server changes, merges, portal Saves; pastes briefs into Claude Code and Claude's reports into ChatGPT; does short look-only screen checks | — |
| **ChatGPT** (orchestrator + server worker) | Plans packages, writes/updates briefs, audits Claude reports and draft PRs (§6), keeps repo docs current, designs and (after owner approval) applies Supabase changes — rollback-only trial first, migration copy in repo, record in [WP-07_MIGRATION_RECORD.md](../WP-07_MIGRATION_RECORD.md) | Production writes without owner approval; merges without approval |
| **Claude Code** (client worker) | All client coding as bulk packages; self-checks; pushes a branch and opens a DRAFT PR to the named base | Anything under supabase/, server/worker changes, cache logic, merges |
| **Jarvis** (Grok Bot) | Audit/plan/status support when the owner asks | — |
| Costing orchestration (ChatGPT, formerly Aryabhatta agent) | Owns costing PRs; coordinates hub-cache numbers on main | — |

Report flow: ChatGPT (brief) → owner → Claude Code → draft PR + report → owner pastes report → ChatGPT audits → one consolidated correction or "pass" → owner screen check → (later) Bundle B merge prep → owner approves merge.

Approval gates: (a) any Supabase/server change; (b) any merge to main; (c) each native portal Save; (d) any live data test (e.g. UX-9 Apply on Product 270/268). Portal final Submit is permanently excluded.

## 2. Orient first — reading list (in order)
1. [CURRENT_STATE.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/CURRENT_STATE.md)
2. [CLAUDE_CODE_BUNDLES.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/CLAUDE_CODE_BUNDLES.md)
3. [TIMELINE.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/TIMELINE.md) and [GLOSSARY.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/GLOSSARY.md)
4. [REMAINING_WORK.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/REMAINING_WORK.md)
5. [CHANGELOG_DECISIONS.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/CHANGELOG_DECISIONS.md) — ADR-01..ADR-15 (status index: [ADR_UPDATES_20261031.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/ADR_UPDATES_20261031.md))
6. [WP-07_OPERATOR_JOURNEY.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/WP-07_OPERATOR_JOURNEY.md) — sections 1–3, 6a, 6b, 7, 9, 10
7. [UX9_CLIENT_CONTRACT.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/UX9_CLIENT_CONTRACT.md)
8. [MERGE_PLAN.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/MERGE_PLAN.md)
9. [WP-07_MIGRATION_RECORD.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/WP-07_MIGRATION_RECORD.md)
10. [PORTAL_BLANK_REFERENCE_SHEET.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/PORTAL_BLANK_REFERENCE_SHEET.md)
11. Background: [MASTER_PROGRAMME.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/MASTER_PROGRAMME.md), [IMPLEMENTATION_RULES.md](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/IMPLEMENTATION_RULES.md)

## 3. Completed so far (short)
QC register foundation and D3.3–D4.3/B3.1 (9–11 Oct); Product 262 verified end to end on the portal (reference product, locked); UX-1 worklist, UX-1.1/1.2 classification, four-eyes (24–25 Oct); UX-2 approve-after-other-saved (26 Oct); bulk seed + saved-for-review-by (27 Oct); UX-5 locks (28 Oct); UX-3 Fill on portal + PKG1/PKG2/PKG3a (29 Oct); UX-6..UX-8 layout, composition table, line modal (30 Oct); UX-8.1, UX-9 bulk source reference (server + client), UX-9.1 toolbar pattern (31 Oct); owner check + ADR-15 + Bundle A approval (1 Nov). Full table: [TIMELINE.md](TIMELINE.md).

## 4. Live system state
- Supabase `qhmoqtxpeasamtlxaoak` WP-07 migrations applied: UX-1..UX-4 `20261024115131`, `20261025163252`, `20261025173239`, `20261026133841`, `20261027135522`, `20261027161124`; PKG2 `20261029141456`; PKG3a `20261029141512`; PKG1 `20261029144643`; **UX-9 `20261031102139`** (31 Oct). Repo copies in `supabase/migrations/` on this docs branch. (Earlier QC: B3 `20261011135744`.)
- PKG3a gate: only Product 262 enabled. B2 worker unlock ON HOLD.
- `main` = `5c5b7ba`, **hub-cache-v387**. Costing drafts #115/#117 at v387 (no bump).
- Client branch `feat/wp07-ux1-worklist` = `c5821b1`, hub-cache-v376, unmerged. 11 smokes baseline in CURRENT_STATE §2.
- Docs branch `docs/wp07-state-20261031` (this one): docs + WP-07 migration repo copies only; no PR yet.

## 5. How Claude Code is integrated
- Bulk packages: one brief → one session → one DRAFT PR into the named base (today `feat/wp07-ux1-worklist`); branch `feat/wp07-bundle-<letter>-<slug>`.
- Every brief = **standard SAFETY RULES preamble** + task + SELF-CHECKS + DELIVER + REPORT FORMAT ([template](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/CLAUDE_CODE_BUNDLES.md)).
- Self-checks: all smokes ≥ baseline, 0 failures; new checks for each item; `node --check`; `git diff --check`; `git diff --stat <base>` shows nothing under supabase/ and no sw.js change (unless a merge-prep brief); list DOM IDs/classes added/removed.
- Usage: Claude sessions use the owner's Pro plan, ChatGPT/bot turns use limits too — batch low findings into the next bundle; one consolidated correction max per bundle.

## 6. Audit checklist for a Claude report / PR
1. Branch, base and head SHA match the brief; PR is DRAFT; base is not main (unless owner-approved Bundle B).
2. `git diff --stat base...head`: no supabase/, no public/sw.js (except Bundle B version string), no worker/server/portal-automation files, no `20261015045233` migration, no `.tmp-smoke-userdata/`.
3. Smoke counts ≥ baseline for all 11, 0 failures; new checks exist for every item and actually assert behaviour (not regex-only).
4. No refusal code removed or weakened; four-eyes checks, PKG3a gate, strict two-person Save authorization and Product 262 lock unchanged (grep the diff).
5. No direct `regulatory.*` writes from client; only existing RPCs; no automatic source verification; no Submit; no auto Save.
6. UI pattern rules kept (funnel drawer left of search, no Clear-filters button, fixed toolbar/header, one vertical scroll bar only when needed, no duplicate controls, .ea-btn).
7. IDs/handlers/aria kept for restyles; dead-code removal backed by proof.
8. Cache strings: version-string-only changes, only when asked.
9. Owner screen-check list provided (≤ 8 look-only steps, 125% scaling).
Verdict: pass / pass with lows (batch to next bundle) / one consolidated correction.

## 7. Open items and owner decisions
1. "9.1 final ok" after Bundle A (A4–A6).
2. Portal blank-reference answer (owner or Aneesh) — clearing stays refused until then.
3. Live Apply test of UX-9 on Product 270 or 268 — yes/no.
4. Merge timing for the client branch (Bundle B) — owner approval + cache check.
5. B2 worker unlock — three answers (ON HOLD).
6. Package D QC — Part A approval + COA naming.
7. PKG3a scenarios C1–C9 — need a fully approved non-262 product.
8. ADR-08 both-Approvers-saved handling — third Approver vs reopen-and-re-save.
9. Pilot with Aneesh — ongoing.
10. Optional: PR to main for this docs branch.

## 8. Immediate next step
1. Owner pastes **Bundle A** (approved 1 Nov) into Claude Code — full text: [CLAUDE_CODE_BUNDLES.md#bundle-a](https://github.com/Brahmadathanu/sasv-workspace-dev/blob/docs/wp07-state-20261031/docs/eaushadhi/wp07/CLAUDE_CODE_BUNDLES.md).
2. Owner pastes Claude's report here; ChatGPT audits with §6 and gives the owner a short screen-check list.
3. After Bundle A passes and the owner says "9.1 final ok": prepare **Bundle B** (merge prep) — only after owner approval and the cache check (§9).

## 9. Cache coordination protocol
- One `hub-cache-vN` per merge to main; next free number = (current main number + 1) at the moment of merge, after any already-approved PR that bumps first.
- **Nothing is reserved for WP-07.** On 1 Nov main is v387; v388 is free unless a costing PR merges with a bump first.
- Before a WP-07 merge: ask the costing orchestration for the number and say WP-07 is taking it; after merge, tell them. Costing PRs touching the four e-Aushadhi smoke pins must be version-string-only (word-diff check) and need a WP-07 OK.
- No merge or deployment without owner approval.
