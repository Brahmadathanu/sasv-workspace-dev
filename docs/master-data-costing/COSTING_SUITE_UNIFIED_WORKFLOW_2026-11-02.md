# Costing Suite — Unified Workflow Control and Handover (2 November 2026)

> **Authoritative navigation and workstream coordination page (proposed, PR #129; NOT merged).** This document consolidates the route to existing evidence, **not** the underlying historical or server-governance records. On conflict: live Supabase governs server facts; current Git `main` governs code; approved dated decisions govern scope. A date-stamped old report never outranks verified newer evidence.

## The two documentation namespaces — decision

1. **`docs/master-data-costing/` = ONE active Costing Suite / master-data UX programme control plane.** Its `MASTER_PROGRAMME.md` defines work packs; `WP-05-COSTING-SUITE-RATIONALISATION.md`, `WP-06-...`, `WP-07-COSTING-NAVIGATION.md` (called **MDC-07**, NOT e-Aushadhi WP-07) retain scoped execution authority. `CURRENT_STATE_2026-11-01.md` and `REMAINING_WORK_2026-11-01.md` are dated snapshots, not the up-to-the-minute state. This file is the shared entry point for the next chat.
2. **`docs/costing-pipeline-independent-audit/` = evidence/policy/server audit and closure record**, **not a competing second client roadmap**. Keep `closure/PROGRAMME.md`, issue register, policy ledger, migrations/evidence, and dated results intact. `CURRENT_STATE.md` and `INDEX.md` are historical (October) and must not be treated as current run facts. Server-specific G0–G6 are **not** the client programme's gates.
3. **`docs/costing-client-hardening/` = delivered CW package evidence** (#126 CW-06, #127 CW-13, #128 CW-07), not a separate active programme. Work package evidence and pre-merge status text are retained; merged status is in the dated 2 Nov banners. The integration document on the separate integration branch should be preserved or linked as dated testing evidence, but its unmerged state should not be misreported as a live integration branch requirement.

**Do not delete or squash history, old SQL evidence, active migrations, old PR branches, or the paused e-Aushadhi namespace as part of documentation unification.** Unification means a single current navigation and status register with references, not merging unrelated policies into one giant document or deleting proof.

## Verified repository baseline (2 Nov)

- Repository: `Brahmadathanu/sasv-workspace-dev`; current `main` HEAD verified by GitHub `3d0b6185f4351469cf23969beefac0e8875e0c2e`.
- Squash merged in sequence: #126 (CW-06) `4f1cb406`; #127 (CW-13) `86b4ad5e`; #128 (CW-07) `3d0b6185`.
- Claire/Claude reported **393/393 Costing+library tests** on reconciled PR head, LF+CRLF, browser tests not skipped. **A fresh run on the final merged `main` is still pending independent proof.** Smokes 42/57 on prior sandbox, other 15 e-Aushadhi dependency failures matched `main`; not a clean global smoke pass.
- Service worker code designation `hub-cache-v390`; *live PWA deployment/version still requires separate evidence*. Default-OFF costing flags are unchanged. No database edits or feature activations in this merge series.
- Earlier 3/10 chat progress meter has **no located formal ten-gate source**. Do not present it as authoritative. Master-data programme ledger records **WP00–WP04 complete (5 of 13 substantive WP00–WP12)**, with WP-1 prerequisite control-plane complete. This is a work-pack count, not a time-weighted percentage.

## Next focused workflow — rapid execution

**Phase 0 (parallel, no merge):** Verify final main's 393 suite on LF+CRLF and PWA code/version via authorized read-only checks; verify draft docs PR #129 file scope; reconcile status and prepare to mark dated docs as historical after an owner-approved docs merge. No feature activations, DB writes or migration operations.

**Phase 1 / WP05 (start immediately in a new chat):** Treat the existing 25 Oct Costing client UX audit as an input, *not automatic WP05 acceptance*. Map all six Costing suites, each lens and action, its authority/data source, user role, overlap, discoverability and entry path, including Production Route historical candidate controls hidden and its family create missing `p_family_code`. Separate actual duplicate responsibilities from similar labels; produce a rationalisation matrix, preserve specialist/audit functions and server permissions. Propose one preferred home for each daily task and progressive disclosure. Cross-reference WP05, WP06 (Pricing Policy Manager), MDC-07 (Costing navigation), WP11 (UX), and CCC-P01/02. Avoid opening competing CW-client programmes.

**Phase 2 (parallelizable bounded Claude packages after WP05 map):** group high-return UX by independent files/modules, with a single shared shell/information architecture specification before parallel edits; validate using exact LF/CRLF tests + populated-data / signed-in browser acceptance. Never run simultaneous merges to `main`; reconcile staging and merge sequentially on written owner approval. Server-side changes require separate written governance authorisation.

**Phase 3:** Work-pack closure evidence, flags/activation decisions, production validation, docs and handover. Reassess scope/time weekly based on actual completed accepted packages; do **not** promise a fixed 3–6 week duration. Target fast parallel analysis and incremental releases; work constrained by owner decisions and high-risk live changes.

## Open work / controls (not automatically part of the next client package)

- Production Route Manager: fragmented lens navigation, invisible Historical Candidate Review controls and candidate-based family creation missing server-required `p_family_code`; do not reveal controls, invent codes or execute writes without owner decision. Supported family creation uses Route Families modal.
- Utilities Hub **Cost Sheet Review & Approval** label is server-sourced from `public.app_modules`, while suite client now says **Cost Sheet Review**. A narrow governed metadata change is required, with owner approval; no unauthorized SQL.
- October: approved run 143 and draft 148 need current read-only re-verification before any valuation/finalize. November draft 149 observed in owner UI, not an approval. October finalization, readiness rebuild, CI-049 lock guard, CI-048 monitoring, June–August reconciliation, 74 blocked machine capacities and flag activation have separate gates and owner decisions.
- WP05, WP06, MDC-07 remain **open/not formally accepted**. The 25 Oct audit is evidence, not closure.
- e-Aushadhi **WP-07 is deliberately paused**, with migrations/branches/doc hashes preserved; do not touch it until the owner resumes it. This is distinct from Costing **MDC-07**.
- Keep `COSTING_DIALOGS_V1` and other newer flags default OFF, preserve permission / RPC contracts and `hub-cache-v390` until a separately approved release change.
- Local Windows original worktree may contain protected uncommitted content; use isolated worktrees. No force resets/stashes of user working tree or migration `20261015045233_ppm_inactive_sku_mrp_policy_governance.sql`.

## Next-chat starting instruction

Read **this file**, `docs/master-data-costing/MASTER_PROGRAMME.md`, `WP-05-COSTING-SUITE-RATIONALISATION.md`, `WP-07-COSTING-NAVIGATION.md`, `REMAINING_WORK_2026-11-01.md`, `docs/costing-pipeline-independent-audit/audit-2026-10-25/C_client_ux_audit_and_backlog.md`, and **current GitHub main**. Check PR #129 (documentation draft), which contains this proposed authoritative entry point. **Begin WP05 current-lens inventory and consolidation design immediately**; do not wait for a fresh chat to plan it from scratch. Keep cadence and evidence-based progress, not a made-up 3/10 metric.
