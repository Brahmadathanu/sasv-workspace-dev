# PEC — IMPLEMENTATION RULES

## Working culture
Evidence → classify → freeze bounded scope → explicit approval for sensitive mutation → controlled execution → independent verification → record decisions → handover. Never convert assumptions into master data or approvals. Never hide unresolved gaps behind a success status.

## Authority separation
1. Live Supabase = server reality; current main = repository reality; approved WP/decisions = workflow authority.
2. ChatGPT owns server/RPC/permissions contract analysis and direct connected-tool server implementation, *only following explicit approval of the exact mutation*; server work does not require Cursor or a GitHub client PR as a precondition.
3. Cursor/Codex owns bounded client implementation only, on isolated branch/worktree. It may analyze/test/self-review/fix/commit/push autonomously after the contract is frozen. It may not silently change SQL, grants, RLS, server contracts or live production data.
4. User is decision and deployment authority. A request to document or investigate **never** authorizes a data or production mutation.

## High-risk gates
Security/permissions, service-worker caching, RPC definitions, schema, RLS, navigation entitlement or live data changes require: baseline evidence; exact change plan; impact/security/rollback discussion; explicit user authorization; post-change verification. Do not treat read-only `can_view` as edit privilege. Never grant broader module access merely to make a card visible.

## Client delivery
Routine bounded changes: freeze package → isolated Cursor/Codex analysis/implementation/tests/self-review/correction/commit/push → independent ChatGPT GitHub audit → consolidated correction pass if needed → reviewed merge decision.
High-risk changes: PLAN-only proposal → independent ChatGPT review → approved implementation → same autonomous implementation and audit cycle.
Stop only for ambiguous business decisions, undocumented contract, security/data risk, material scope expansion, failing semantics, cross-module overlap or merge/release permission. Never merge, tag, publish, bump versions or deploy without explicit user approval.

## Worktree / cross-project protection
Persistent operational checkout: `D:\ELECTRON PROJECTS\daily-worklog-app`.
Protected WIP: `wip/prm-local-uncommitted`, `wip/lab-analysis-entry-local-uncommitted`.
Do not hard reset, destructive clean, force-delete protected branches, overwrite other agents' branches, or touch e-Aushadhi/Costing worktrees. Verify current main and changed-file overlap before starting or merging. Use an independent PEC feature branch.

## Data and traceability invariants
- Serial is `indent_line_sort_no` from the canonical ordered indent source. Never derive it from filtered index, UI page or offset.
- `Indent (Serial)` is a **display format**, not a persisted composite identifier.
- If a serial is absent or invalid, display a truthful explicit unavailable state and record an evidence defect; never synthesize a number.
- Do not alter `indent_line_id`, actual ordering, indent number, quantities, UOM, vendor selection, prices, approval events or historical records to fix display.
- Filtered and unfiltered buy lists should agree for equivalent selection and should not drop required breakdown fields.
- Registry durability must be versioned where appropriate, idempotent and preserve existing grants. Refresh/resume should not bypass permission checks. Server authorization remains authoritative.

## Verification evidence
For server: target project, pre/post function signatures and security posture, minimal SQL change, row and financial totals parity, representative indent, migration/version evidence and rollback path.
For client: branch and SHA; changed files; exact test commands/results; diff review; search/filter/infinite-scroll, no-serial fallback and responsive modal checks.
For PWA: authorized read-only and edit roles separately, unauthorised account, reopened PWA and resume/refresh, cache/service-worker behaviour, route authorization. Don't claim signed-in acceptance without actual signed-in proof.
For integration: fresh main and merge base, changed-file overlap, isolated regression, post-merge checks, explicit approval.

## Scope control
Discoveries classified REQUIRED NOW / DEPENDENT LATER / PARKED / OUT OF SCOPE. Preserve non-blocking ideas in backlog/decision log, not active code. If evidence contradicts the locked contract, stop and seek an amended approval.

## Milestone and documentation discipline
[ ] NOT STARTED; [~] ACTIVE; [x] VERIFIED; [!] BLOCKED; [P] PARKED. Only independent evidence makes [x]. Update relevant WP gate ledger on material changes, MASTER_PROGRAMME when a gate/pack advances, CHANGELOG_DECISIONS for locked choices and handover when changing chats. Avoid bookkeeping-only commits.

## Handover
Carry current main, candidate branch/head/worktree, server migration/RPC state, user-validated acceptance, tests, current gate, locks, unresolved gaps, prohibited mutations and **one exact next instruction**. Use WORKPACK_HANDOVER_TEMPLATE.md.

## Quality principle
Move quickly because scope is bounded and evidence is clear — not by removing authorization, security or verification gates.
