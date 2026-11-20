# CSR local PostgreSQL harness (#273)

Disposable, **synthetic-data** reproduction of the Cost Comparison read path. It never touches Supabase.

- `fixture.sql` – synthetic `costing.cost_sheet_line_monthly_snapshot` (~1.37M rows, 34 governed periods, 630 SKUs, Nov-2025 absent, Oct-2026 run 143 APPROVED / Nov-2026 run 149 LATEST_SUCCESS / superseded run 148), live-shaped indexes, stub governed-run view and permission functions. Statistics are taken *before* Nov 2026 rows are inserted (stale-stats scenario), as observed live on 5 Nov.
- `build_objects.sh` – extracts the **real** governed view DDL from `supabase/migrations/20261019014458_w1_approved_run_feed_and_labels.sql` and the **real** function body from `docs/master-data-costing/evidence/CSR_PARAMETERIZED_SCOPED_RPC_DESIGN_NOT_FOR_DEPLOY.sql` (no hand copy).
- `parity_and_plan.sql` – 63-column two-way `EXCEPT` parity for Sep/Oct/Nov 2026, absent Nov 2025, empty Dec 2026, Jan 2024; ordering parity; governed-run isolation; `EXPLAIN (ANALYZE, BUFFERS)`.
- `timing.sql`, `projection.sql` – relative wall-clock (fresh stats) and the client-projection check.
- `client-read-contract.test.mjs` – `node` source-contract test of the client read path (no DB).
- `run.sh` – `PSQL_ARGS="-h /path/to/socket -U postgres" ./run.sh`; refuses non-local hosts.

Limits: the governed-run view is a stub, so the original view plan here seq-scans where production uses `idx_cost_sheet_monthly_exact_tuple`. Timings are relative only, not production latency. No RLS, PostgREST, JWT role or `statement_timeout` is modelled.
