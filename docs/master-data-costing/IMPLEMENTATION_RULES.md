# Implementation Rules

## Server responsibility
- ChatGPT owns server analysis, package planning/review, implementation and live verification through the connected Supabase/server tools. Client executors do not own server application merely because a client package depends on it.
- Server work follows live inspection → concrete plan/review for high-risk changes → authorized direct server application → live verification → durable workflow/evidence handover.
- Server implementation is not bound to GitHub: no Cursor/Codex handoff, repository commit/push, PR, merge or local CLI-generated migration is required as a server-apply prerequisite. Use the appropriate supported Supabase operation and retain its operation/migration record where applicable.
- Repository MD remains the durable programme/gate authority. SQL/migration/rollback evidence may be retained in Git for traceability where useful; this does not turn server delivery into the client Git pipeline.
- Direct server ownership does not waive high-risk review, target validation, rollback, permission/RLS/evidence safeguards or required live verification; role assignment alone does not approve an unspecified mutation.
- Inspect live server architecture before mutation.
- Do not rewrite effective-dated/history data.
- Do not guess business/master data.
- Do not duplicate server business logic in the client.

## Client responsibility

### Routine bounded client work
1. ChatGPT freezes one complete bounded work package.
2. Cursor/Codex autonomously analyze internally, implement, run targeted checks/tests, self-review the diff, fix issues found, rerun checks, commit, and push from an isolated feature branch/worktree.
3. Cursor/Codex reports branch, commit SHA, changed files, checks/results, self-review outcome, unresolved items, and required human verification.
4. ChatGPT independently audits the pushed GitHub diff/code/tests.
5. If required, ChatGPT issues one consolidated correction pass on the same branch.
6. ChatGPT performs final verification and explicitly authorizes merge.
7. Merge to current main, post-merge verification, and branch/worktree cleanup follow only after approval.

### High-risk client work
Server dependencies remain ChatGPT-owned under the server workflow above. A client plan may identify a required server contract, but Cursor/Codex must not invent or apply that contract as client work.

Use a separate Cursor/Codex PLAN → independent ChatGPT plan audit → autonomous implementation gate for architecture changes, database/schema/RPC contracts, authentication/permissions, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business-rule decisions, or security-sensitive behavior.

### Agent stop conditions
Cursor/Codex stops for human guidance only when requirements are genuinely ambiguous, materially different business/UX behaviours are possible, an undocumented backend contract would have to be invented, production/security behaviour may be affected, scope must broaden materially, tests reveal a business-rule contradiction, a genuinely judgmental visual/UX decision is required, merge to main is required, or version/tag/release/publishing is required.

Never merge, version, tag, release, or publish without explicit approval.

## Branch discipline
- Never implement directly on main.
- No destructive reset/clean of canonical checkout.
- Unexpected moved-main overlap stops the gate.
- e-Aushadhi and unrelated worktrees/branches remain untouched.

## Data discipline
- UNKNOWN ≠ READY.
- Missing evidence remains incomplete.
- REVIEW_REQUIRED remains review when evidence is insufficient.
- BLOCKED cannot be bypassed merely to make a dashboard green.

## Scope discipline
Classify discoveries as REQUIRED NOW, FUTURE DEPENDENCY, PARKED ENHANCEMENT or OUT OF SCOPE. Only REQUIRED NOW may interrupt the active gate. Everything else is recorded in PARKED_BACKLOG.md or its designated future WP.

## Status markers
- [ ] NOT STARTED
- [~] IN PROGRESS
- [x] COMPLETED AND VERIFIED
- [!] BLOCKED
- [P] PARKED
A milestone becomes [x] only after its verification gate passes.

## Mandatory gate ledger
Every WP document states Current Gate, Gate Status, Required to close, and Next gate. Status transitions are explicit: [ ]→[~] on genuine start; [~]→[x] only after verification; [~]→[!] for a genuine blocker; [~]→[P] only for deliberate deferral.

## Repository authority
1. Live server state is authoritative for server reality.
2. Git repository/current main is authoritative for repository state.
3. Approved programme/WP documents are authoritative for workflow state.
4. Chat narrative is supporting context.
Discrepancies are reconciled before proceeding.

## Cumulative recap
Every substantive programme reply ends with Workflow, WP progress, Programme progress, Current gate, Next, Parked, and Locked.

## Handover
Before changing chats/pausing: update WP document and MASTER_PROGRAMME.md; record decisions/backlog; produce the handover template; record main/branch/worktree SHAs and exact next gate.

## Decision locks
Locked decisions are recorded in CHANGELOG_DECISIONS.md and the relevant WP. Revisit only with new evidence and an explicit superseding decision.
