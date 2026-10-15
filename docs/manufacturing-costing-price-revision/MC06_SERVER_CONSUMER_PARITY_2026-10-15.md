# MC06 server-consumer compatibility review (2026-10-15)

## Verified live contracts
- `costing.fn_preview_manufacturing_rate_readiness(bigint)` resolves `TOTAL_PRODUCTION_OVERHEAD` and returns `REVIEW_REQUIRED / OVERHEAD_COST_BEHAVIOUR_SPLIT_UNVERIFIED` for OH regardless of an available aggregate approved rate. This is intentional fail-closed scaffolding, **not** an active rate-consumption implementation.
- `costing.fn_simulate_preferred_batch_manufacturing_cost(bigint,numeric,numeric)` and `costing.fn_simulate_preferred_batch_sku_manufacturing_cost(bigint,numeric,numeric)` receive scalar **p_labour_rate** and **p_overhead_rate**. SKU simulation links to product simulation and guarded pack-base conversion, but it does not accept two separate OH rates.
- `fn_preview_manufacturing_rate_approval_inputs(119)` still returns all ten component approval inputs as REVIEW_REQUIRED; `fn_preview_manufacturing_rate_readiness(119)` shows packing labour separately (₹621,599) and OH unresolved.
- Source OH split 6 fixed heads ₹361,578.68166667 + 3 variable heads ₹654,456.60000000 = ₹1,016,035.28166667. Provisional OH route workload 991.41666667 units/month. This **does not establish** equal fixed and variable cost driver rates, nor license an aggregate-and-split sum in production.

## Implementation decision / safety
The new migration is a **read-only diagnostic only**, not a consumer rewrite. Do **not** wire two approved rates into the historical costing refresh or mark the gate READY until a separate versioned product/SKU allocation implementation proves:
1. all exact overhead source amounts are conserved once, with aggregate POH excluded from additive split ledger,
2. normal capacity for FIXED and appropriate activity denominator for VARIABLE are separately governed,
3. required source period, valuation date, policy precedence and approved actor lineage remain fail-closed,
4. product route workload, preferred minimum batch, SKU net output/conversion, and four affected active SKUs are audited,
5. packing labour is excluded from manufacture route rate and separately reconciled,
6. shadow output reconciles against unchanged run119 and explicit user-triggered future refresh.

No live deployment, run119 mutation, approval write, refresh, or merge performed. Maintain draft PR until an independent test pass and explicit cutover clearance.
