# Implementation Rules

## Server responsibility
- Supabase/server work uses the authoritative server workflow.
- Inspect live server architecture before mutation.
- Do not rewrite effective-dated/history data.
- Do not guess business/master data.
- Do not duplicate server business logic in the client.

## Client responsibility
1. ChatGPT architecture/contract.
2. Cursor PLAN mode.
3. Independent ChatGPT plan audit.
4. Isolated feature branch/worktree.
5. Cursor implementation.
6. Tests.
7. Commit/push.
8. Independent ChatGPT diff/code audit.
9. Correct on the same branch if required.
10. Explicit merge approval.
11. Merge to current main.
12. Post-merge verification.
13. Branch/worktree cleanup.

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
