# PEC — MASTER PROGRAMME

## Purpose
Restore reliable, auditable procurement traceability and user access while preserving existing business data and finance-facing indent references. Operate as a bounded corrective programme, not a redesign of indent architecture.

## Existing verified findings (2026-10-09)
- Canonical vendor-wise view `v_proc_vendorwise_buylist` includes `indent_line_sort_no` in `indent_breakdown`.
- Example verified in live data: Indent **193**, material **28 MM ROPP Cap**, serial **15**; expected reference **193 (15)**.
- Live filtered function `proc_vendorwise_buylist_filtered_pec_internal` rebuilds breakdown JSON without `indent_line_sort_no`.
- Previous investigation found open-indent client numbering computed from visible row offsets rather than `indent_line_sort_no`; reverify against current main before editing.
- Previous investigation found PWA registration and read-only grants live but app visibility missing for two users. Persistence, refresh/resume, and signed-in user acceptance require renewed evidence; don't declare root cause closed from server registration alone.

## Scope
1. Read-only PWA permission/registry/navigation persistence and refresh correction.
2. Vendor-wise buying-list Indents modal `Indent (canonical serial)` display.
3. Open-indent `#` column shows canonical, stable serial across search/filter/append.
4. Regression, security and signed-in operational proof.

## Exclusions
No indent renumbering, no new `proc_indent_line` serial column, no reordering or rewriting historical indent lines, no purchases/PO generation changes, no approval/date changes, no inventory/master-data corrections, no permissions broadening, no unrelated module/release/production deployment.

## Roles
- User: operational, finance-facing UX and final mutation/merge acceptance authority.
- ChatGPT: architect, evidence auditor, server planning/application via connected Supabase tools after explicit scope authorization, independent verification and programme control.
- Cursor/Codex: client executor on a dedicated branch/worktree, never owner of server contracts or production data changes.
- Repository programme documents govern progress; executors report evidence, they do not self-certify final closure.

## Work packs & sequence
| Pack | Name | State | Entry / closure boundary |
|---|---|---|---|
| WP00 | Governance & baseline | IN REVIEW | Documentation drafted; independent audit and integration approval pending |
| WP01 | PEC traceability & PWA access correction | CLOSED — 2026-10-10 (PR #53, merge e20a8f06) | G0 current-state proof → G1 server contract/plan → G2 filtered JSON change → G3 UI/registry refresh → G4 acceptance → G5 reviewed integration |
| WP02 | Post-fix operational stabilization | NOT OPEN | Opens only for accepted regressions or separately approved follow-on stabilization |
| BACKLOG | Future improvements | PARKED | New features require an explicit separate decision |

G2 live SQL and exact migration history are reconciled by PR #51; G3 client code merged in PR #49; G4 PWA visibility and serial display are PASS for both originally affected users after production service-worker v344 (PR #52); one original affected account is intentionally Editor (temporarily tested as View-only, then restored); the other is View-only and passed. No grant correction is needed. Representative admin role-reduction and permission-removal tests also passed earlier. G5 preserves the historical exception that PR #49 merged before independent audit and was accepted after PASS WITH NOTES. Final documentation integration remains pending; global migration-history drift is a distinct new work package.
## WP01 gate ledger
- [~] G0 — Reconcile current main, exact repository files, function owner/security, migrations, auth and signed-in PWA behaviour; freeze test plan.
- [ ] G1 — High-risk server/auth plan independently reviewed and explicitly authorized.
- [x] G2 — Live change `pec_filtered_buylist_canonical_indent_line_sort_no` verified: 1147 canonical joins, 769 result rows, quantity/amount parity, example serial 15, function privileges intact. Applied live. Repository durability resolved by merged PR #51. Authenticated acceptance is recorded under G4 (PASS WITH NOTES).
- [x] G3 — PR #49 merged to main at 19:38 IST on 2026-10-09. Canonical indent serials in the PEC buying-list Indents popup, exports, and opened-indent `#` column. Post-merge independent read-only audit: PASS WITH NOTES (2026-10-09).
- [x] G4 — PASS / COMPLETE (2026-10-10): account `33372369-…` (intended View-only) sees and opens PEC, displays `193 (15)` with Read-only access. Account `b8fd6239-…` (intended Editor) displays `193 (15)`; its temporary View-only test passed with disabled edit actions, then Editor role was deliberately restored. Representative admin grant-removal test also passed. No permission correction pending.
- [x] G5 — Post-merge verification of main was done by the independent audit (PASS WITH NOTES). NOTE: PR #49 was merged at 19:38 IST on 2026-10-09 before that audit, contrary to the brief. The out-of-order merge was accepted by user 2026-10-09. This mark does not mean the prescribed audit-then-merge order was followed.
Gate state can become [x] only with recorded reproducible evidence. A skipped or partial test is not a pass.

## Closure and separately governed follow-ups (2026-10-10)
- PR #51: merged; original live migration versions `20261009100628` and `20261009131026` are on `main` with exact SQL parity; no repair or replay.
- PR #52: merged as `dd669459010c8df1bf73a198da564a02becfb392`; production Netlify PWA independently content-verified as v344. No Electron release or DB change.
- PR #46: closed unmerged as superseded; branch preserved for reference.
- Conservative Group A remote-branch cleanup: 35 branches deleted after SHA, ancestry, PR and local worktree checks; 23 remote branches kept excluding main (executor-reported ledger); Group B/C, WIP, dirty/missing worktrees retained. Auto-delete remains off.
- Global migration-history drift (50 local migration files, 515 remote versions in the recorded snapshot) is excluded from PEC WP01 and requires separate read-only inventory/governance. Do not bulk repair/push.
- Other PEC popups without indent serial remain outside the WP01 scope; finance-facing buying list/export formatting changed from `[193]` to `[193 (15)]`.
- WP01 is **CLOSED — 2026-10-10** (final documentation PR #53 merged at e20a8f06).

## Dependency and stop rules
G1 requires G0; G2 and G3 require the approved contract; G4 needs reviewed server/client candidates; G5 needs acceptance. Permissions changes, unknown server contract, surprising moved-main overlap, missing serial, mismatched quantities or cross-programme overlap STOP the relevant gate.

## Acceptance summary
- `193 (15)` appears for the verified item, derived from authoritative server value.
- Searching for only serial 15 shows `15`, never `1`; append/search reorder does not alter it.
- Both individually authorized PWA accounts see the intended card and open module at their granted mode after normal refresh/resume; ungranted users do not gain access.
- No unintended changes to buying quantities, assignments, rates, approval lifecycle or procurement records.

## Repository anchor
Documentation branch created from observed main `980cfeed1aaaaf13d6cd168506dc91d87d3546a8` (2026-10-09). Recheck `origin/main` before implementation, review and merge; do not treat this SHA as perpetually current.

## Mandatory reply recap
**Workflow:** PEC WPxx — name
**WP progress:** verified gates / total gates
**Programme progress:** verified work packs / total opened work packs (not time estimates)
**Current gate:** precise status
**Next:** single next authorized step
**Parked:** short note
**Locked:** key decisions
