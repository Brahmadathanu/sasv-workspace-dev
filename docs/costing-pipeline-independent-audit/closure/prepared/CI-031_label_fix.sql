-- CI-031 PREPARED. NOT APPLIED. Owner approved the rename on 24 Oct 2026; apply only with explicit go-ahead,
-- via Supabase MCP apply_migration (never db push).
-- Scope: DESCRIPTIONS ONLY (COMMENT ON). The stored value 'NORMAL_VOLUME_RATE' is NOT changed, because it is
-- used as a logic key in costing.fn_batch_true_effective, rpc_refresh_production_overhead_workload_snapshot,
-- rpc_refresh_qc_monetary_allocation_snapshot, rpc_refresh_sku_direct_labour_component_split_snapshot,
-- in CHECK batch_true_standard_switch_rate_basis_check and the column default, and it is frozen in 42
-- batch_true_absorption_variance rows of past runs. No client screen shows the value (grep of public/ on main).
-- Effect: no data, calculation, cost, run or fingerprint change.
begin;
comment on column costing.batch_true_standard_switch.rate_basis is
  'Rate basis for batch-true absorption. Stored code NORMAL_VOLUME_RATE means ACTUAL-VOLUME RATE: frozen monthly pool / actual workload of the period, so absorption variance is zero by construction. No normal-capacity rate is used (owner decision CI-031, 24 Oct 2026). APPROVED_RATE = an approved standard rate.';
comment on column costing.batch_true_absorption_variance.rate_basis is
  'Rate basis used for this run and pool. NORMAL_VOLUME_RATE = actual-volume rate (pool / actual workload); variance is ~0 by construction (CI-031).';
comment on table costing.batch_true_absorption_variance is
  'Per-run absorption check for batch-true pools. With the actual-volume rate (stored code NORMAL_VOLUME_RATE) the variance is ~0 by design; it is not a normal-capacity variance (CI-031).';
comment on constraint batch_true_standard_switch_rate_basis_check on costing.batch_true_standard_switch is
  'NORMAL_VOLUME_RATE is the legacy code for the actual-volume rate (CI-031); the code is kept for continuity with frozen runs.';
commit;
