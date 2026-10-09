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

## Evidence qualifiers
VERIFIED = observed live/current state; PRIOR AUDIT = reported in preceding chat and to be revalidated before mutation; CANDIDATE = proposed pending plan review; PARKED = excluded from this work pack.

## Future entries
Record timestamp, decision ID, motivating evidence, alternatives, user authorization, scope and superseded IDs when changed. Do not rewrite locked decisions silently.
