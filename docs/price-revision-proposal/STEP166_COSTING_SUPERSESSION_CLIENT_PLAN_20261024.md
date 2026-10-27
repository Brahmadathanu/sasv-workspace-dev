> **SUPERSEDED by redesign v2.2 (27 Oct 2026).** This document describes an earlier design. For how costing approval, month-end and locking work now, see [COSTING_REDESIGN_V2_CURRENT_STATE.md](../costing-pipeline-independent-audit/COSTING_REDESIGN_V2_CURRENT_STATE.md). The text below is kept unchanged as history.

> **STATUS UPDATE 24 Oct 2026 15:50 IST — RE-BRIEF REQUIRED:** the supersession this plan assumes has **already happened**. Owner authorisation **#10** (24 Oct 12:45 IST, issued through the backend) was used by run 143, which was approved at 13:46 IST and replaced run 140 as October's approved run (Mathalam (F) at ₹118/kg). The "verified production facts" below are now out of date. The screen's scope (a general owner supersession action for future periods) must be re-briefed before Cursor plans it. The plan text below is kept unchanged.

# Step 166 — Costing supersession client gap (24 Oct 2026)

## Current gate: [~] HIGH-RISK CLIENT PLAN AUDIT
Next: Cursor/Codex PLAN (no implementation yet), followed by ChatGPT independent audit and explicit implementation gate.

## Verified production facts
- October 2026 remains OPEN / valuation DRAFT with APPROVED run 140; latest run 140 SUCCESS; do not revoke or modify it.
- Mathalam (F) stock item 584, governed manual rate 18, ₹240/kg was changed to INACTIVE effective 2026-10-24. Current rate selector returns LATEST_PURCHASE_RATE ₹118/kg dated 2026-08-04.
- No replacement run exists. Backend rejected plain refresh with AU2_PERIOD_HOLDS_APPROVED_RUN.
- public.rpc_costing_authorise_supersession(date,text,text) exists and rejected backend-admin invocation with W2_OWNER_ONLY. Never circumvent owner control.
- Earlier failures run 123 (immutable overhead), run 120 (no effective PM BOM revision); later runs through 140 succeeded. Preserve failures and history.

## Repository findings
- public/shared/js/costing-suite-shell.js implements rpc_request_costing_refresh, staged progress, and refresh toolbar.
- No usage found for rpc_costing_authorise_supersession in the default-branch client.
- Existing server workflow takes source-of-truth precedence; do not invent database RPCs or duplicate business rules in client.
- Current client implementation must be verified against branch/main and its actual shared pages before code edit.

## Bounded PLAN requirements for Cursor/Codex
1. Read docs/master-data-costing/IMPLEMENTATION_RULES.md and relevant programme rules, identify actual active route and owner authorization patterns.
2. Propose a compact Costing Run Governance action on an existing suitable client route, not a separate module. Display period, approved/latest/active run, and owner eligibility; avoid falsely offering action to nonowners.
3. Use only existing public.rpc_costing_authorise_supersession(p_period_start,p_reason,p_approval_reference), with explicit user confirmation and mandatory reason/reference, and verify returned authorization record.
4. Preserve existing refresh path, stage monitoring, run designation and approval. Supersession authorization does NOT approve or supersede run 140 by itself.
5. Surface W2_OWNER_ONLY, already-authorized, active-run and expiry errors accurately. Do not grant role, add privileged RPC, make frontend owner predicate authoritative, or use service-role credentials.
6. Include targeted tests: no client bypass, nonowner denied, 140 preserved, authorization success UX, refreshed run queued only when authorized, errors no false success, routing and responsive display.
7. Isolated feature branch/worktree, PLAN only. Report affected files, design, existing test commands, uncertainties, permission dependency. ChatGPT audits PLAN before implementation.

## Out of scope
- No schema/migration changes, rate mutation, run deletion, silent run approval, force refresh or unrelated costing suite redesign.
- Do not use GitHub repository state as proof that production client deployment has occurred.

## Workflow
Current: plan requested. Programme remains at run 140 approved, fresh run blocked pending owner-authorized supersession. Next: audited client plan then controlled implementation/verification and owner action.
