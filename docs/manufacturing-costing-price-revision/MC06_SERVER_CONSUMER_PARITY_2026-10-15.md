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

## Independent read-only parity results — 2026-10-15
No Supabase development branches present; no migrations deployed to production. Reproduced MC06 labour+fixed OH+variable OH arithmetic using live run119 standard-batch functions in read-only SQL: 460/460 products calculable, zero product arithmetic mismatches. Independently joined all 635 active SKUs to governed base-pack conversion: 635/635 calculable, zero SKU component-sum differences greater than 0.000001; targeted four active exception SKUs 207,208,209,1798 all present. This is arithmetic and data-contract evidence ONLY, not full-period pool conservation, runtime function execution, abnormal-capacity handling, approval, SKU 509-scope verification or cutover readiness. Sum across one standard batch per product is not a monthly absorption measure. Work remains fail-closed.

## STOP — period denominator parity failure (2026-10-15)
Run119 frozen workload labour 5519.35 and OH 5373.50 vs provisional monthly normal frequency proxy labour 911.61666667 and OH 991.41666667. Applying candidate monthly rates yields labour absorption ₹4,275,680.42 vs source ₹706,203.00 and overhead ₹5,506,933.43 vs source ₹1,016,035.2817, combined ₹9,782,613.85 vs ₹1,722,238.28 (~5.68x). These figures are diagnostic, not authorised absorbed costs. STOP numerical rate approval/cutover until common-period workload, frequency model and monthly-versus-run aggregation scopes reconcile. The 460 product/635 SKU arithmetic checks do NOT cure this failure. No new refresh, no run119 mutation.

## Denominator root cause isolated — 2026-10-15
Live run119 snapshots are 460 product modelling rows, not a validated September actual-production ledger: labour 5519.35 route workload units (458 READY monthly drivers 5509.85 units, two REVIEW_REQUIRED 9.50); OH 5373.50 (458 READY monthly drivers 5363.00, two REVIEW_REQUIRED 10.50). Sample records show minimum-one-standard-batch rounded counts even for tiny monthly quantity (product760 quantity 0.3300, batch count 1, labour intensity/workload 358.1). Thus they are modelled required batch workload, whereas MC05 historical 12-month first FG transfer proxy is frequency-based workload, monthly labour 911.616667 and OH 991.416667. Their sums are not like-for-like actual completed production, so ₹9.78m hypothetical absorption is a denominator-population/period mismatch diagnostic, not an actual cost. Do not force pool absorption or back-compute an approved denominator from reconciled expenditure. Develop scope-consistent normal capacity and minimum-batch production plan first, then price test. Historical run119 untouched.
