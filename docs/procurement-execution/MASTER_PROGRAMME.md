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
| WP01 | PEC traceability & PWA access correction | G3 MERGED (PR #49); G4 PASS WITH NOTES; G5 MERGED EARLY | G0 current-state proof → G1 server contract/plan → G2 filtered JSON change → G3 UI/registry refresh → G4 acceptance → G5 reviewed integration |
| WP02 | Post-fix operational stabilization | NOT OPEN | Opens only for accepted regressions or separately approved follow-on stabilization |
| BACKLOG | Future improvements | PARKED | New features require an explicit separate decision |

Do not invent percentage. G2 server mutation and technical parity verified live. G3 is done: PR #49 merged to main at 19:38 IST on 2026-10-09. G4 signed-in acceptance evidence is recorded PASS WITH NOTES (admin account with a temporarily reduced grant, not the two originally affected accounts). G5 did not follow the brief's order: the merge happened before the independent audit; post-merge verification of main was done by that audit (PASS WITH NOTES), and the out-of-order merge was accepted by user 2026-10-09. Open: service-worker cache bump (`public/sw.js` still `hub-cache-v343`), PR #46 disposition and getting its PWA registration migration onto main, and storing the live G2 change `pec_filtered_buylist_canonical_indent_line_sort_no` as a repository migration. Governance drafting is not production correction completion.

## WP01 gate ledger
- [~] G0 — Reconcile current main, exact repository files, function owner/security, migrations, auth and signed-in PWA behaviour; freeze test plan.
- [ ] G1 — High-risk server/auth plan independently reviewed and explicitly authorized.
- [x] G2 — Live change `pec_filtered_buylist_canonical_indent_line_sort_no` verified: 1147 canonical joins, 769 result rows, quantity/amount parity, example serial 15, function privileges intact. Applied live and not stored as a migration in the repository (open follow-up). Authenticated acceptance is recorded under G4 (PASS WITH NOTES).
- [x] G3 — PR #49 merged to main at 19:38 IST on 2026-10-09. Canonical indent serials in the PEC buying-list Indents popup, exports, and opened-indent `#` column. Post-merge independent read-only audit: PASS WITH NOTES (2026-10-09).
- [x] G4 — Signed-in acceptance evidence recorded 2026-10-09, PASS WITH NOTES. Phone PWA checks used the admin account with a temporarily reduced view-only grant on module `procurement-execution-console`, not the two originally affected accounts. Screenshots held by the user. See WP01 evidence.
- [x] G5 — Post-merge verification of main was done by the independent audit (PASS WITH NOTES). NOTE: PR #49 was merged at 19:38 IST on 2026-10-09 before that audit, contrary to the brief. The out-of-order merge was accepted by user 2026-10-09. This mark does not mean the prescribed audit-then-merge order was followed.
Gate state can become [x] only with recorded reproducible evidence. A skipped or partial test is not a pass.

## Open follow-ups (2026-10-09, IST)
Pending. Not decided in this document.
- Service-worker cache bump: `public/sw.js` remains `hub-cache-v343`. Previously cached PWA clients may serve the old console script. Deferred as a separate release approval. The smoke test asserts v343 and must be updated with any bump.
- PR #46 disposition: still OPEN, not merged. Migration `supabase/migrations/20261009153000_pec_pwa_indent_serials.sql` registered the live PWA module client row and is not on main. Getting that migration onto main so the repository matches the live database is pending user decision.
- Store the live G2 server change `pec_filtered_buylist_canonical_indent_line_sort_no` as a migration in the repository.

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
