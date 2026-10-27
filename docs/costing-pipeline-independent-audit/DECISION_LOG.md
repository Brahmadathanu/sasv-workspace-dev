# Costing decision log (ADR style)

Short records of non-trivial choices. Status: Accepted / Superseded / Parked / Open. Sources: owner decisions 26–27 Oct 2026, approval requests in [redesign-v2/](redesign-v2/README.md), live checks 27 Oct 2026.

| # | Date | Decision | Rationale | Status |
|---|---|---|---|---|
| D1 | 26 Oct | The official date of a month is the approved run's own date. The original D1 wording ("the month's date becomes a working date") was **superseded by v2**: there is no moving working date; the stored month date is a legacy compatibility field that is not moved. | One source of truth; approved history cannot shift | Accepted (as revised in v2) |
| D2 | 26 Oct | Approval is preview-gated; the old three-argument approve/supersede/finalise routes refuse (`W2_USE_NEW_APPROVAL_ROUTE`). v2: a 15-minute preview acknowledgement replaces the earlier token idea. | The approver must see the impact first | Accepted, live (CI-040) |
| D3 | 26 Oct | Approving a stale draft needs an explicit "approve anyway" acknowledgement, audited. | Visible, recorded override | Accepted, live (CI-040) |
| D4 | 26 Oct | Approving a newer draft supersedes the current approved run in one step (stored REVOKED, shown Superseded). | No window with two or zero approved runs | Accepted, live (CI-040) |
| D5 | 26 Oct | Weekly and month-end drafts continue in approved months, labelled "not for pricing". Month-end draft on the 1st at the last day of the month just ended; one catch-up on Monday; bounded retries of temporary failures. | Fresh drafts without touching pricing | Accepted, live (CI-041) |
| D6 | 26 Oct | Read-only health check with adjustable thresholds. Draft retention (older than 12 months) not built. | One place to see problems | Health check live (CI-043); retention not built |
| D7 | 26 Oct | Lock only in the quarterly pre-close batch; month-end finalise approves and does not lock; lock changes the lock state only. | Separate approval from closing | Accepted, live (CI-042) |
| A1 | 27 Oct | CI-042 v2.2 rollback default is Mode B (non-destructive) while CI-040 is live. | Keeps the new approval route working | Accepted |
| A2 | 27 Oct | CI-043 revision B: operational findings are reported (INFO/WARN), not treated as migration failure; rollback keeps settings changed after install. | Install must not fail on real data findings | Accepted, live |
| A3 | 27 Oct | Health-check scheduling and alert delivery are separately governed work. | Each live change needs its own approval | Open |
| A4 | 27 Oct | June–August 2026 (no approved run) are a separate governance reconciliation; not bypassed by October work. | Avoid back-filled approvals | Open |
| A5 | 27 Oct | CI-044 parked. | Not needed for October | Parked |
| A6 | 27 Oct | Documentation changes go on docs-only draft PRs for independent (ChatGPT) review; no merge without the owner. | Review before main changes | Accepted |
| A7 | 27 Oct | Five applied migrations kept byte-identical in `supabase/migrations/` as record copies; history gaps documented, not "fixed" by renames. | Truthful history; no replay risk added | Accepted (see [MIGRATION_HISTORY_RECONCILIATION.md](MIGRATION_HISTORY_RECONCILIATION.md)) |
| A8 | 27 Oct | Old first-governed-run runbook converted to a historical record without runnable SQL; new current runbook added. | Obsolete steps must not be executable | Accepted |
