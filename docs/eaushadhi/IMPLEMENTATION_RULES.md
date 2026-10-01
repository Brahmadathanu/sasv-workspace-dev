# E-AUSHADHI AUTOMATION — IMPLEMENTATION RULES

## 1. Ownership
- ChatGPT is the architect and programme controller.
- Server/database planning and implementation are performed by ChatGPT using connected tools.
- Cursor/Codex are client implementation workers only.
- The user remains the business/operational decision authority.

## 2. Server workflow
Investigate → plan → confirm contract → implement through connected tools → independently verify live state → record repository migration/source → update work-pack tracking.

Do not pass server/database implementation to Cursor/Codex unless the programme documentation is explicitly amended by the user and ChatGPT.

## 3. Client workflow

### Routine bounded client work
1. ChatGPT investigates current repo/live contracts and freezes one complete bounded work package.
2. Cursor/Codex works autonomously within that approved scope: analyze internally → implement → run targeted checks/tests → self-review its diff → fix issues it finds → rerun checks → commit → push the dedicated task branch → report completion.
3. Cursor/Codex must not stop merely to ask whether it may continue after analysis, editing, linting, testing, or self-review.
4. ChatGPT independently verifies the pushed GitHub code/diff/tests.
5. If needed, ChatGPT issues one consolidated correction pass on the same branch.
6. ChatGPT performs final verification and explicitly authorizes merge/cleanup.
7. Final main/live/operational state is independently verified.

### High-risk client work
Retain a separate Plan → ChatGPT review → Implementation gate when work involves architecture changes, database/schema/RPC contracts, authentication/permissions, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business-rule decisions, or security-sensitive behavior.

After ChatGPT approves the high-risk plan, Cursor/Codex should still execute the implementation autonomously within that approved scope through self-review, tests, commit, push, and completion report.

### Agent stop conditions
Cursor/Codex should stop and request human guidance only when:
- requirements are genuinely ambiguous;
- materially different business/UX behaviours are possible;
- an undocumented backend contract would have to be invented;
- production data or security behaviour may be affected;
- scope must broaden materially;
- tests reveal a business-rule contradiction;
- a visual/UX decision genuinely requires human judgment;
- merge to main is required;
- version/tag/release/publishing is required.

### Completion report
Every completed client work package must report:
- branch;
- commit SHA;
- changed files;
- checks/tests performed and results;
- self-review outcome;
- unresolved items;
- any human verification still required.

Never implement client work directly on main. Never merge, version, tag, release, or publish without explicit approval.

## 4. Operational checkout safety
Persistent operational checkout:
`D:\ELECTRON PROJECTS\daily-worklog-app`

Protected WIP branches:
- `wip/prm-local-uncommitted`
- `wip/lab-analysis-entry-local-uncommitted`

Prohibited unless explicitly authorized:
- hard reset
- destructive clean
- force-delete protected branches
- overwriting unrelated local WIP

## 5. Portal safety
Portal mutations are permitted only within a work pack whose contract explicitly opens that exact mutation.
No implicit permission carries from one portal stage to another.
Product Details, Composition, QC Register, and final Submit are separate gates.

## 6. Data authority
Canonical/server data is authoritative.
Portal wording/value is a projection used only where required by e-Aushadhi.
Never replace canonical terminology with portal terminology in the source model.
This preserves downstream reuse such as Therapeutic Guide development.

## 7. Verification discipline
Human verification is required where governance marks a value as DRAFT/candidate.
Diagnostic similarity/candidate scoring must never become automatic authority.
A product is portal-ready only when all required server-side readiness gates are satisfied.

## 8. Work-pack scope discipline
When new work is discovered:
1. If required for current WP acceptance → current WP.
2. If required by another existing WP → add to that WP.
3. If useful but non-blocking for programme closure → WP-11/PARKED_BACKLOG.

Do not expand active scope merely because an improvement is attractive.

## 9. Documentation updates
When a milestone changes state, update its WP document with evidence.
Cursor/Codex may report implementation evidence, but only ChatGPT audit/live verification may mark a milestone complete.
Update MASTER_PROGRAMME only when a work-pack state/current gate/dependency materially changes.

## 10. Work-pack handover
At closure, generate a self-contained next-chat handover prompt and stop.
The prompt must include:
- programme/work-pack name;
- documents to read;
- authoritative main SHA and relevant branch/head;
- live migration/server state;
- completed milestones;
- exact first task;
- required end state;
- dependencies;
- safety invariants;
- allowed/prohibited mutations;
- downstream outputs;
- requested short cumulative recap format.

## 11. End-of-response recap rule
Every substantive response ends with a compact block:

**Workflow:** WP-XX — <name>  
**WP progress:** NN%  
**Programme progress:** NN%  
**Current gate:** ...  
**Next:** ...  
**Parked:** none / short item(s)

Percentages are milestone tracking indicators, not schedule/effort estimates.

## 12. Quality principle
“Fast because the contract is understood, not fast because safety gates are removed.”
