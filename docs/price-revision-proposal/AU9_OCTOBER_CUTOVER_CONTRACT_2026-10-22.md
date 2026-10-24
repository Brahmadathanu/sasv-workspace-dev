# AU-9 prospective October cutover — gated implementation contract

Status: **DESIGN / HOLD — not deployed**. Workstream: standalone Price Revision Proposal G0; supporting correction, not replacement for the required Ksheerabala 101/41 shared-process conversion cost fix. Freeze: approved run 136, valuation 2026-10-20, must remain immutable.

## Confirmed database constraints

- `costing.fn_frozen_valuation_through()` returned 2026-10-20.
- `plant_capacity_profile`, `capacity_fallback_policy`, `route_step_capacity_rule`, `plant_aware_load_switch` are configured FORWARD_ONLY. Future-dated November versions are immutable except permitted effective_to closure. INSERT/UPDATE are journaled. No overlapping effective intervals; intervals are [from,to).
- 298 profiles all start 2026-11-01; 17 fallbacks and 9 rules also November-dated; plant_aware_load_switch empty.
- `pals_from_nov2026` and `rscr_from_nov2026` CHECK constraints prevent early inserts. `fn_au9_g4_load_mode` and `fn_au9_g4_resolve_step_load` contain explicit November gates.
- Four equipment class capacity rules have unique capacity among *operational machines with November-effective profiles*; five T1 rules use approved GRINDER legacy default. Apparent 2/3.2 and 8/20 kg conflicting capacities came from closed zero-duration historical profile rows and MUST NOT be used as current capacity conflicts.
- October candidate bridge demand: 22 explicit route-linked machines and 44 operational class-rule machines, with two overlapping = 64 distinct. Validate precise eligible profile set again before DDL.
- Manual cotton-cloth filtration of oil after vessel processing must be distinguished from separately machine-assisted Kalkkam lipid recollection. The current MANUAL_LOT 50kg SOLID fallback yields 3 loads for 101 Avarthi; physical relevance is not proven.

## Migration design — staged, atomic where practicable

1. **Preflight**: Recheck current IST date, frozen-through, no concurrent run, approved migration identity, current signatures/bodies and privileges, profile machine-status/capacity, effective-date uniqueness; prepare exact record manifest and old/new snapshots. Hold if date is not forward permissible.
2. **Prepare source-controlled SQL** using repository Supabase migration conventions and migration parity. Never use ad-hoc production DDL without source provenance. Capture function definitions and rollback strategy before changes.
3. **Safe early bridge**: Insert *new* period-valid October machine profile versions [approved forward date, 2026-11-01) for exactly the eligible set, preserving November rows untouched. Journal each insert and verify no conflicts. New policy versions [same date, 2026-11-01) for 17 fallbacks and 9 activity rules; retain originals.
4. **Governed gate fix**: Remove only November-specific CHECK barriers for switch and route rules; retain date-ordering and exclusion constraints. Replace literal-November tests in BOTH load-mode and resolver functions with effective-dated switch/resolver checks; preserve machine precedence, journal/forward guards and fail-closed behaviour. Verify security definer/function grants unchanged or strengthened.
5. **Manual-workload correction**: Establish activity-aware distinction for manual cloth-oil filtration versus machine lipid recollection. Do not globally disable MANUAL scaling or hardcode 101/41 product IDs. No rule activation until this is verified and approved.
6. **Dry-run exact-date checks**: For every eligible costing step, resolver must return exactly one valid basis; report missing profile, mismatched resource class, class-rule ambiguity, unsuitable machine, denied fallback, and orphan lineage. Verify nine rules (four class + five T1), 17 fallbacks, and 64-bridge coverage with explicit failures (not suppressed).
7. **Activate through single dated switch** only once validations pass. Historical 2026-10-20 remains on legacy path. Validate new step provenance, deterministic outputs and no unintended switches outside target date.
8. **Joint-process correction**: Implement reusable process relationship (common cycles 1–41 once; continuation cycles 42–101 only product183), independently charged BOM/RM, 5kg+105kg outputs, and governed common conversion split (candidate physical 5/110, 105/110 not yet approved as universal financial policy). Preserve independent finishing, QC and packing. Company labour/overhead pools conserved.
9. **Only then** execute a fresh authorized governed costing run; validate product/SKU outcomes and whole-company allocation invariants before G0 close and price-revision workbook.

## Mandatory stop conditions

Abort/rollback where possible (without mutating historical snapshots) if immutable/forward-only policy rejects change, any overlapping profile/rule/switch interval, missing revision journal, invalid class or machine status, inconsistent load basis, unexpected SKU regressions, expense-pool imbalance, or joint-process double counting. Existing run136 must not change. Historical old-path output must remain independently reproducible.

## No-action record

This file specifies implementation gates only. No Supabase migration, new switch, cost refresh, or Google Sheets modification was performed when it was written.
