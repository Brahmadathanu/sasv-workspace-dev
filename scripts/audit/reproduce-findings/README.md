# Reproduce audit findings (read-only)
Re-runs the queries behind the figures quoted in `docs/costing-pipeline-independent-audit` (branch `docs/costing-pipeline-independent-audit`). It prints each quoted figure next to the observed value.

- **Live:** `DATABASE_URL=postgres://<read-only user>@... node scripts/audit/reproduce-findings/run.mjs`. The session is forced read-only, and `queries/*.sql` are SELECT plus STABLE function calls only.
- **Offline:** run each `queries/NN_*.sql` in any read-only SQL console and save the single JSON value as `<dir>/NN_*.json`. Then run `node run.mjs --results <dir>`.
- `results-2026-10-15/` holds Grok's captured outputs from 2026-10-15 ~18:40 IST.

Values move as live data changes. Run-119 figures are frozen. Provision and stock figures depend on dates.
