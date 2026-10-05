# WP04-G4 — Live no-success context read-only proof

2026-10-05. **PASS AT SOURCE + REAL GOVERNED-CONTEXT LEVEL.**

## Scope

Bounded read-only proof only. No candidate function, canonical readiness function, portfolio function, cohort helper or business resolver was executed. No DDL/DML, V3 replay, performance test, deployment or application occurred.

The purpose was to prove that frozen C preserves the existing canonical LIVE_AS_OF behavior when a governed period has a valuation date but no matching SUCCESS refresh run.

## Real governed no-success contexts

Read-only inspection of `costing.cost_periods` and `costing.costing_refresh_run` found real governed periods with valuation dates and zero matching SUCCESS runs:

- 2026-06-01 / valuation date 2026-06-30 / SUCCESS count 0
- 2026-03-01 / valuation date 2026-03-31 / SUCCESS count 0

No fixture or manufactured context was required.

## Current canonical behavior

Live `public.rpc_get_product_sku_readiness(bigint,date,text,bigint)` source confirms for LIVE_AS_OF:

- period is normalized;
- governed valuation date is required;
- latest matching SUCCESS run is selected by period + valuation;
- if none exists, `v_run` and `v_run_status` remain null;
- run-backed control snapshot is read only when `v_run is not null`;
- base dependencies are still composed from current master/route/MRP/selling/commercial evidence;
- `shared_issues` begins empty in the base payload;
- run-evidence enrichment executes only when `v_run is not null`;
- otherwise the base payload is returned directly.

Therefore current canonical no-success behavior is a valid LIVE_AS_OF context rather than an error or synthetic UNKNOWN portfolio substitute.

## Frozen C behavior

Mechanical source comparison confirms:

### Candidate public canonical wrapper

- uses the same latest SUCCESS selector by period + governed valuation;
- initializes shared issues to `[]`;
- calls the shared-issues helper only if `v_run is not null`;
- delegates to the internal LIVE wrapper with nullable `v_run`.

### Candidate internal LIVE wrapper

- calls `fn_wp04_c_run_cohort` only if `p_evidence_run_id is not null`;
- therefore no cohort/run evidence is fabricated when there is no SUCCESS run.

### Candidate common LIVE core

- derives run status only when a non-null evidence run exists;
- reads downstream control only when `v_run is not null`;
- initializes base `shared_issues` as empty;
- calls C enrichment only when `v_run is not null`;
- otherwise returns `v_base` directly.

### Candidate portfolio source

- initializes `v_shared` to empty;
- computes shared issues only when `v_run is not null`;
- passes an empty SKU array to the cohort helper when there is no run, producing no run-evidence rows;
- passes nullable `v_run` into the common LIVE core.

## Disposition

**Live no-success context compatibility: PASS at source + real governed-context level.**

Frozen C preserves the canonical no-success behavior:

- no run substitution;
- no synthetic run evidence;
- no fabricated driver rows;
- no forced UNKNOWN census;
- no shared-issue enrichment without a run;
- base LIVE_AS_OF composition remains available;
- evidence run remains null.

This closes the live no-success G4 proof obligation at source/context level. It does not claim a runtime invocation of the unapplied candidate package. Remaining G4 obligations include ALL_EXISTING/filter behavior, native Auth/API behavior, full-611 final-output parity, performance and committed deployment/rollback.
