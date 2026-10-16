# AU-5 live install evidence (2026-10-16, IST ~20:38–20:45)
Approval: user, "Approve AU-5 with re-based rates: install switched off now, prepare October period and run". Jarvis notified first.
## Migrations (Supabase MCP apply_migration)
- 20261016150830 au5_batch_true_install_switch_off: switch/variance tables, fn_apply_batch_true_standard (switch + effective_from gate), one hook line in rpc_refresh_manufacturing_cop_chain.
- 20261016150908 au5_rebased_rates_switch_on_effective_oct2026: rate policy rows id 10 (labour v3) and the POH v2 row, APPROVED, effective 2026-10-01, ref USER-APPROVAL-AU5-REBASED-20261016; switch ON, effective_from 2026-10-01.
## Zero-movement proof, run 122 (md5 over full rows; 634 rows each), before install / after install / after switch ON
- POH alloc ef42f1b81f4ea0da3eb6f178fdcbec76 (identical x3 checks)
- DL alloc a9c983801d84eb15f963fc707d1cb2c1 (identical)
- Prime 3b6909f4e056f4715ab465ae8fbe0798 (identical)
- COP 26712633fdfa59554037967627afdaf9 (identical)
- Pricing bridge abeed46cb4459f00ceda8676e9f6f4f1 (identical)
- fn_apply_batch_true_standard(122): 'OFF' with switch off; 'NOT_EFFECTIVE' with switch on (valuation 2026-09-10 < 2026-10-01). Variance table: 0 rows.
## Re-based rates (run 122 inputs; reproducible SQL)
rate = pool / SUM over products with batch_size_ref>0 of workload_per_batch x monthly_base_qty / batch_size_ref (460/460 products).
- POH: 670,935.04 / 1,583.472371 = 423.7112
- Labour: 706,203.00 / 1,399.062060 = 504.7689 (replaces 128.02 from 1 Oct; Sep keeps 128.02)
In NORMAL_VOLUME_RATE mode the engine re-derives the rate from each run's own pool and volume, so the October values will differ, with variance 0.
## October period
rpc_ensure_cost_period('2026-10-01'), run twice (idempotent): OPEN, valuation 2026-10-16 SYSTEM_DEFAULT/DRAFT, 1 audit row. September: LOCKED, 2026-09-10, untouched.
## Pre-run check
634 active SKUs = run-122 set (0 added, 0 dropped). 0 without packing BOM, 0 without RM BOM, 460/460 products with batch_size_ref. 0 QUEUED/RUNNING runs. Jobs 60 and 61 paused. Shared readiness issues: none.
