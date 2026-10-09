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
| WP01 | PEC traceability & PWA access correction | G2 SERVER VERIFIED; G3 CLIENT PENDING | G0 current-state proof → G1 server contract/plan → G2 filtered JSON change → G3 UI/registry refresh → G4 acceptance → G5 reviewed integration |
| WP02 | Post-fix operational stabilization | NOT OPEN | Opens only for accepted regressions or separately approved follow-on stabilization |
| BACKLOG | Future improvements | PARKED | New features require an explicit separate decision |

Do not invent percentage. G2 server mutation and technical parity verified live; G3 client and G4 signed-in acceptance pending. G5 merge unopened. Governance drafting is not production correction completion.

## WP01 gate ledger
- [~] G0 — Reconcile current main, exact repository files, function owner/security, migrations, auth and signed-in PWA behaviour; freeze test plan.
- [ ] G1 — High-risk server/auth plan independently reviewed and explicitly authorized.
- [x] G2 — Applied migration `pec_filtered_buylist_canonical_indent_line_sort_no` and verified 1147 canonical joins, 769 result rows, quantity/amount parity, example serial 15, function privileges intact. Authenticated acceptance remains G4.
- [ ] G3 — Isolated client implementation, canonical serial rendering, PWA refresh/durable registry, targeted tests and self-review.
- [ ] G4 — Independent code audit and operational acceptance with actual affected users/roles and read-only checks.
- [ ] G5 — Explicit merge authorization, current-main overlap check, integration and post-merge/live verification.
Gate state can become [x] only with recorded reproducible evidence. A skipped or partial test is not a pass.

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
