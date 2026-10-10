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
- **Notes carried as open follow-ups (not closed by DEC-009):** (a) `public/sw.js` still `hub-cache-v343`, so previously cached PWA clients may serve the old console script; deferred as separate release approval; the smoke test asserts v343 and must be updated with any bump. (b) the G2 server change `pec_filtered_buylist_canonical_indent_line_sort_no` is applied live but not stored as a migration in the repo. (c) export Indent Breakdown text format changes from `[193]` to `[193 (15)]`. (d) some other PEC popups still show indent number without serial (out of scope).
- **Scope:** record only. No further merge, cache bump, migration, or PR #46 disposition is authorized here. PR #46 remains OPEN and not merged; its PWA registration migration is not on main. Disposition is pending user decision.

## Evidence qualifiers
VERIFIED = observed live/current state; PRIOR AUDIT = reported in preceding chat and to be revalidated before mutation; CANDIDATE = proposed pending plan review; PARKED = excluded from this work pack.

## Future entries
Record timestamp, decision ID, motivating evidence, alternatives, user authorization, scope and superseded IDs when changed. Do not rewrite locked decisions silently.
