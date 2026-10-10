# PEC — Decision & Evidence Ledger

## 2026-10-09 — Programme initialization
- **DEC-001 (LOCKED):** finance-facing reference should display canonical indent number plus canonical within-indent serial, e.g. `193 (15)`. This is display-only.
- **DEC-002 (LOCKED):** the open-indent `#` column represents the original canonical within-indent serial, never the search-result row index.
- **DEC-003 (LOCKED):** use existing governed `indent_line_sort_no`; do not add a redundant persisted line serial to `proc_indent_line`.
- **DEC-004 (LOCKED):** view permission must remain read-only. Fix PWA visibility without widening grants or bypassing access control.
- **DEC-005 (LOCKED):** no existing indent, ordering, quantity, vendor, rate, approval, dates or stock/master-data mutations are permitted under this correction.
- **DEC-006 (LOCKED):** preserve separated ChatGPT server ownership / Cursor-Codex isolated client execution / explicit user authorizations, following established e-Aushadhi and Costing governance.
- **DEC-007 (PROVISIONAL):** potential registry durability/Hub refresh improvement is a candidate solution, not a fully proven cause; validate under G0.
- **DEC-008 (LOCKED):** documentation creation does not authorize server change, feature merge or deployment.

## 2026-10-09 — PR #49 merged before audit; accepted after post-merge PASS WITH NOTES
- **DEC-009 (LOCKED):** PR #49 (G3 client: canonical indent serials in the PEC buying-list Indents popup, exports, and opened-indent `#` column) was merged to main at 19:38 IST on 2026-10-09 before independent audit, contrary to the brief. A post-merge independent read-only audit by the user's assistant returned PASS WITH NOTES. The out-of-order merge was accepted by user 2026-10-09. DEC-008 is not superseded: this entry records acceptance of that specific merge after the audit, not a general authorization to merge ahead of audit.
- **Motivating evidence:** audit found the code matches the stated scope; invalid, zero, negative, and null serials show `unavailable`; output is escaped via `esc()`; no permission, RLS, or server changes. Smoke scripts `pec-wp01-indent-serial-smoke.mjs`, `pec-plm-pm-canonical-smoke.mjs`, and `pec-pr-scope-smoke.mjs` pass.
- **Historical open notes at DEC-009 (later disposition below):** (a) `public/sw.js` still `hub-cache-v343`, so previously cached PWA clients may serve the old console script; deferred as separate release approval; the smoke test asserts v343 and must be updated with any bump. (b) the G2 server change `pec_filtered_buylist_canonical_indent_line_sort_no` is applied live but not stored as a migration in the repo. (c) export Indent Breakdown text format changes from `[193]` to `[193 (15)]`. (d) some other PEC popups still show indent number without serial (out of scope).
- **Scope at decision date:** record only; no further merge or deployment authorized by DEC-009. **Later disposition:** PR #46 closed unmerged, exact executed migration recorded in PR #51, v344 shipped via PR #52.

## 2026-10-10 — Record exact live migration history (PR #51)
- **DEC-010 (LOCKED):** Record the historically executed PEC WP01 SQL verbatim from live `supabase_migrations.schema_migrations` as `20261009100628` (MD5 `1f789d6fc0d26f62d90c7d4aa7345357`) and `20261009131026` (MD5 `4d0f5137d0ce9560f17ed3ad9192a64a`). These include PR #46's live `v_proc_vendorwise_buylist` rewrite. No db push or migration repair is needed, and there is no production change. The earlier `20261009232000` / `20261009232100` reconstructions are withdrawn. A REVOKE was intentionally not added to the historical SQL; live privileges are already correct (anon/authenticated denied). Resolved by merged PR #51.

## 2026-10-10 — Operational acceptance and final closure evidence
- **DEC-011 (LOCKED):** PEC WP01 G4 is accepted following independent user-reported PASS from both originally affected PWA accounts (one intended View-only, one intended Editor) after the v344 production rollout. Both display `193 (15)`; the View-only user accesses PEC as Read-only, and the Editor passed temporary View-only testing before intentional restoration for the verified item. Earlier admin reduced-grant/removed-grant tests remain distinct representative security evidence, not substitutes for these two real-account checks.
- **DEC-012 (LOCKED):** PR #52 merged at `dd669459010c8df1bf73a198da564a02becfb392`; Netlify production v344 and console script independently content-verified against merged main (per closure audit). PR #51's exact historical migrations are merged; PR #46 is closed unmerged as superseded. No live SQL replay, migration repair, Electron release, or permission expansion occurred in this closure sequence.
- **DEC-013 (LOCKED):** Conservative Group A cleanup was reported as 35 remote branches deleted after guards, with 23 remote branches kept (excluding main); preserving Group B/C, WIP and dirty/unresolved worktrees; automatic head-branch deletion remains off. No broader branch cleanup authorized by WP01 closure.
- **DEC-014 (PARKED):** Cross-programme migration-history drift (recorded 50 local vs 515 remote migration versions) is explicitly separate, read-only-inventory-first; other PEC popup serial formats are out of WP01 scope. No bulk history repair, database push or speculative SQL changes authorized.
- **Closure state:** Operationally accepted 2026-10-10; administrative/documentation closure becomes effective only after this final documentation PR is audited and merged. DEC-009 out-of-order merge exception remains visible.

## Evidence qualifiers
VERIFIED = observed live/current state; PRIOR AUDIT = reported in preceding chat and to be revalidated before mutation; CANDIDATE = proposed pending plan review; PARKED = excluded from this work pack.

## Future entries
Record timestamp, decision ID, motivating evidence, alternatives, user authorization, scope and superseded IDs when changed. Do not rewrite locked decisions silently.

## 2026-10-10 — G4 permission qualification
- **DEC-015 (RESOLVED — NO CORRECTION NEEDED):** Account `b8fd6239-cc4b-4123-87d0-0a89fc2c84bd` is intentionally an EDITOR. Its temporary View-only assignment was a controlled acceptance test; `193 (15)` and Read-only restrictions passed, and its Edit permission was deliberately restored. Account `33372369-…` is the original intended View-only user and passed post-v344. Current View+Edit on b8fd6239 is correct. No role correction, grant mutation or additional G4 gate remains.

## 2026-10-10 — Purchase Requisition PDF continuation header
- **DEC-016 (APPROVED):** The user (operator) approved a bounded follow-on enhancement to the Purchase Requisition PDF — repeating continuation header on pages 2+ (Dept/Unit | Location | Req No & Date), double-footer fix, sw v345. It does not reopen WP01. WP02 stays NOT OPEN; the item is tracked as WP02-A and closes on reviewed merge plus an operator multi-page export check in Electron and PWA.
