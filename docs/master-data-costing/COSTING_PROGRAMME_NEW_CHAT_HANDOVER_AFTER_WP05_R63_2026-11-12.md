# Costing programme — new-chat handover after WP05 W5-10 closure (12 November 2026)

**Authoritative continuation checkpoint.** Owner requested handover to a new chat within the same ChatGPT project after formally accepting the WP05 W5-10 conditional closure. This file is a *handover*, not another acceptance action. Start from latest GitHub `main` and reconcile any subsequently changed files/issues before acting.

**Repo:** `Brahmadathanu/sasv-workspace-dev`  
**Production Supabase project:** `qhmoqtxpeasamtlxaoak`  
**Verified main before handover branch:** `a24690b229f3819807b546261a01c614239416dd` (merged [PR #363](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/363)).  
**Programme formally CLOSED: 7 of 13** — WP-1, WP00–WP04, WP05, WP06. WP07–WP12 remain OPEN/not formally closed; some implementation work is already merged and must not be dismissed because stale original workpack sections say draft/not started.

## 1. WP05: closed by owner, do NOT restart

- **WP05 W5-10 Gate Status:** `[x] CLOSED — OWNER ACCEPTED WITH RECORDED BOUNDED RESIDUALS — 12 November 2026`. Owner explicitly instructed “Go ahead with that” after receiving and approving the [R62 final audit and four residual decisions](WP05_R62_OWNER_BOUNDED_RESIDUAL_APPROVAL_AND_W510_RECOMMENDATION_2026-11-12.md). Formal decision recorded at [R63](WP05_R63_W510_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-12.md), PR #363 merged. This is a chat-instruction-based owner-authorised signoff, not a cryptographic signature.
- Four agreed residuals: (1) Cost Comparison functional positive/CCC-scoped negative-role HTTP denials already PASS; **p95 <=4s and October matched nonregression remain NOT PROVEN** under [#273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273). (2) Six protected D-2 sensitive views plus seventh Scheme Master Register have verified catalog/isolated role policies and scoped positive owner PWA observations; **direct seven-view real authenticated negative-role HTTP GETs NOT TESTED** under [#297](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/297); any proven disclosure MUST-FIX. (3) Frozen AE1 40-lens history remains **13 P / 4 historical F / 2 NA / 21 NT**; later recoveries do not erase history, privileged PRM previews/F1 remain BLOCKED/NOT EXECUTED. (4) Build, flags and route/authority accepted **only in bounded WP05 context**, with binding WP12 integrated B1-T2/T3 still outstanding and B1-T1=ZERO (no individual lens transferred).
- Risk/receiving accountability: [R62 §3](WP05_R62_OWNER_BOUNDED_RESIDUAL_APPROVAL_AND_W510_RECOMMENDATION_2026-11-12.md), **14 residual lines** with accountable functional roles, issue/workpack receivers and event-trigger milestones. These are accepted *deferrals/limitations*, not new technical PASS claims or already completed WP12 tasks.
- WP05 positive four-stage owner PWA role checks: CSR-only, CCC-only (R50 stale Readiness recovered by governed Nov portfolio build #7 R51/R52), MCM-only Manual Rate Register & History populated (conditional Material Review Acceptance in-context NOT OBSERVED), PPM-only Scheme Master & History populated after explicitly authorised R57 server policy correction. Source [R58](WP05_R58_PPM_STAGE4_RECOVERED_AND_BASELINE_RESTORED_2026-11-12.md). Historical failed observations retained.
- **Designated existing trial account restored** after acceptance to original **all six Costing modules View=true, all six Edit=false**, with metadata preserved; no need to reconfigure or retest. Do not include account identifiers, credentials, JWTs or personal data in public repo documents.
- R57 Scheme Master Register single-view production change was owner-approved and applied **once directly**, new definition MD5 `903cb8eae3702bf72e41213ec2c89c6e`; Audit view `e2b9eb3c1b86d073183cd376f704cf58`. Guarded SQL was in a **closed/unmerged** PR #355 and must **NOT** be merged/replayed as a migration; rollback not executed. No other SQL changes authorised by handover.
- [PR #292](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/292) fixed SW network-first Cost Comparison child imports with CI passing, retaining `hub-cache-v393`; not proof of full installed PWA activation. [R17](WP05_R17_CSR_SIGNED_IN_IDENTITY_AND_PERFORMANCE_GATE_2026-11-11.md) provides **actual** CCC-scoped RPC ID-V HTTP200 and ID-N/X/O HTTP400 P0001 denied, all with account restored. **Do not claim Cost Comparison is functionally still broken or rerun resolved permission/functional tests.**

## 2. What remains open — programme transition

**Next objective is no longer WP05 closure.** Orient through current `MASTER_PROGRAMME.md`, programme tracker, exact WP07–WP12 workpacks and current issues/PR status before choosing the next highest-leverage work. Original workpack prose can be stale; the latest dated banners, merged implementation SHAs, active issues, and actual live readbacks supersede original “NOT STARTED” placeholders.

| Workstream | Handover priority / action boundary |
|---|---|
| **WP07 / MDC-07 — Costing Suite Navigation & IA** | Verify existing **N1–N4/W6/U11** merged source and status, their current regression suites, actual outstanding acceptance/risk; prepare exact formal closure gate rather than reconstructing code. No automatic WP07 signoff. |
| **WP08 — Product/Master Data Navigation Rationalisation** | Recheck current live repo state and prior IA08 scope; propose/execute smallest authorised outstanding work with regression. Avoid colliding with existing product/SKU/master governance. |
| **WP09 — Wider Launcher/Section Audit** | Check the current IA09/O-7 decision status, navigation shared source architecture, and any blockers; do not redesign without confirmed ownership. |
| **WP10 — Governance safeguards for creation** | Derive governance requirements from current server writer guards/canonical lifecycle, map implementation and evidence gaps; no speculative table/permission alterations. |
| **WP11 — UX consistency / visual hardening** | Reconcile remaining dated cosmetic issues with existing accepted screenshots/PRs and only fix actual regressions. |
| **WP12 — final integrated regression and release** | **Already received** B1-T2-1/2 eleven-flag final-build integration and B1-T3-1/2 six-module routes/responsive/deep links/Electron/Windows A14. WP12 **NOT CLOSED**; no flag global activation, Netlify/Electron deployment or installer authorisation granted here. Direct seven-view negative-GET security checkpoint and other risk receivers remain separately governed; do not silently promote them to PASS. |
| **Residual follow-ups** | #273 performance p95 hold, #297 seven sensitive direct-negative view GET NT, #224 Scheme Master cold reliability, #262 restricted export UX, PRM F1/preview no-call, PRM run80/82 historical vs mapping as-of, capped-row/tie notices, 43 other shared views least-privilege future review. Keep issue-state distinct from closed WP05. |

**Suggested fast path: start with WP07** since code is substantially merged and its formal closure evidence may be closer than the more extensive WP08–WP12 tasks, **but verify live GitHub and owner-accepted scope first**. Avoid starting a paid Supabase development branch; use safe isolated tests/PG17 fixtures, read-only live catalogue when needed, explicit approvals for any production SQL, and owner-only live PWA observations where unavoidable.

## 3. Work rules / programme safeguards

1. **Owner is final decision/approval authority.** Assistant may autonomously handle reversible repo documentation, analysis, isolated regression tests and independently reviewed doc-only PRs; production DDL/DML, permission changes, writer RPCs, preview allowlists, global flags and app releases require specifically scoped owner approval.
2. **Server vs client:** ChatGPT orchestrates Supabase/server, verification, gate ledger and GitHub; Claude Code may handle substantial client/tests when deliberately engaged, not as an assumed background agent. Keep Electron/PWA common client source in `public/shared` rather than divergent copies.
3. **Never invent PASS.** Historical F/NT remain in source records; differentiate source/static/isolated PostgreSQL tests, catalogue evidence, genuine signed-in PWA/HTTP, and owner decisions. Do not use admin Postgres or a faked JWT as “genuine browser role proof.”
4. **No production writer-denial probes or privileged PRM preview calls** solely to tick an acceptance box. Preserve `LIVE_AS_OF` vs frozen costing run and route mapping `as_of` semantics. Respect approved October/September valuation and locked runs; never auto-reapprove/recalculate or alter pricing.
5. **Documentation current at every milestone:** reconcile exact main head, source/test hashes, open PRs, issues, completed/partial gates, account restoration and risk receivers. Merge small safe docs/test PRs after verifying diff and CI. Update `MASTER_PROGRAMME.md`, specific workpack, and gate ledger accordingly.
6. Report **progress indicator** each response and move quickly, but don't elevate WP07–WP12 statuses without evidence. No asynchronous completion claims. No browsing credentials/tokens into public docs.

## 4. New-chat first actions

1. Read this handover, [R63](WP05_R63_W510_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-12.md), [R62](WP05_R62_OWNER_BOUNDED_RESIDUAL_APPROVAL_AND_W510_RECOMMENDATION_2026-11-12.md), current `MASTER_PROGRAMME.md`, the specific next workpack and WP12 receipt. Check GitHub `main`, recent PRs, open issues and active CI.
2. **Confirm 7/13** and WP05 closed with bounded residuals; do not reopen it or retest Cost Comparison by default.
3. Determine **WP07 actual remaining tasks/gates** against code and merged tests, classify PASS/OPEN/owner decision, complete safe work promptly, keep source and docs synced. If WP07 is already completely signed, advance to WP08; never infer signature.
4. Track WP12 B1 receipt and fourteen risk follow-ups without delaying unrelated WP07–WP11 implementation unnecessarily.
5. Return exact changes, test results, PR/merge status and next owner decision, without conflating “merged” with “deployed.”

## 5. Source navigation

- [Master programme](MASTER_PROGRAMME.md)
- [WP05 canonical signed closure](WP-05-COSTING-SUITE-RATIONALISATION.md)
- [R63 conditional closure](WP05_R63_W510_OWNER_AUTHORISED_CONDITIONAL_CLOSURE_2026-11-12.md)
- [R62 residual role/milestone register](WP05_R62_OWNER_BOUNDED_RESIDUAL_APPROVAL_AND_W510_RECOMMENDATION_2026-11-12.md)
- [WP07 Navigation](WP-07-COSTING-NAVIGATION.md)
- [WP12 final regression](WP-12-REGRESSION-AND-DOCUMENTATION.md)
- [WP05/WP06/WP12 binding authenticated acceptance B1 §11](WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md)
- [WP05 retained evidence ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md)
- [Parked Backlog](PARKED_BACKLOG.md)

**Handover conclusion:** WP05 formal owner closure is complete and *risk-qualified*; start next workpack with fresh repository orientation, not another WP05 sign-off cycle. `7/13`, WP07–WP12 remain open until independently accepted.
