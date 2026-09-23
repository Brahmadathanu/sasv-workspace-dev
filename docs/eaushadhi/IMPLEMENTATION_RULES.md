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
1. ChatGPT investigates current repo/live contracts.
2. ChatGPT issues Plan Mode prompt.
3. Cursor/Codex returns plan.
4. ChatGPT audits/corrects plan.
5. ChatGPT issues Implementation Mode prompt.
6. Cursor/Codex works in an isolated feature branch/worktree.
7. Cursor/Codex returns evidence.
8. ChatGPT independently verifies pushed GitHub code/diff/tests.
9. If satisfactory, ChatGPT authorizes merge/cleanup.
10. Final main/live/operational state is independently verified.

Never implement client work directly on main.

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
