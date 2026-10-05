# WP04 G7 Track A V2 — Batched Builder Contract

Status: **PREPARED / REVIEW ONLY / NOT EXECUTED**

## Why V2 exists

V1 installed the private readiness-index substrate successfully but its initial build failed before public cutover because it called the canonical single-SKU helper separately for every SKU. That repeatedly started `fn_wp04_c_run_cohort(...)` and exceeded the server-operation statement envelope.

V2 preserves the precomputed-index architecture but replaces only that build path.

## Pre-V2 production state

- original public C portfolio RPC remains active;
- V1 private tables/functions/triggers are installed;
- 44 source epochs + 44 statement triggers are present;
- build rows = 0;
- item rows = 0;
- incidence rows = 0;
- no current readiness build.

## V2 canonical composition

V2 does not copy business/readiness rules.

For the full ALL_EXISTING SKU set it:

1. resolves the governed period/valuation/latest SUCCESS run;
2. resolves route evidence once;
3. resolves shared issues once;
4. calls `costing.fn_wp04_c_run_cohort(all_sku_ids,...)` once;
5. maps each returned `evidence_envelope` by SKU;
6. calls the unchanged `costing.fn_wp04_c_live_core(...)` once per SKU using:
   - same governed context;
   - same route evidence;
   - same shared issues;
   - same batched run envelope.

This is the same decomposition already used by the existing C portfolio implementation.

The public canonical single-SKU helper remains unchanged.

## Versioned freshness

V2 changes only the fingerprint contract marker from:

`WP04_G7_TRACK_A_V1`

to:

`WP04_G7_TRACK_A_V2`.

The 44 source relations, source-epoch triggers, canonical definition digests and source-schema digest remain unchanged.

## Build lifecycle

The existing V1 lifecycle remains:

- per-period advisory build lock;
- capture start fingerprint;
- build ALL_EXISTING once;
- validate context/count/severity;
- project dependency/shared/regional incidences;
- lock epoch registry at promotion;
- recompute end fingerprint;
- promote only if start=end;
- old current build is superseded atomically;
- failure never becomes current.

## Pre-cutover full-611 equality gate

This is new in V2.

After a V2 build is promoted but **before** replacing the public RPC:

- the still-active legacy public C portfolio reader is paged through OPERATIONAL using 100-row keyset pages;
- all 611 canonical assessments are captured in a temporary baseline;
- each baseline assessment is compared byte-for-byte as JSONB with the V2 stored assessment.

Required:
- baseline count = 611;
- mismatch count = 0.

Any mismatch stops before public cutover.

This provides direct full-population equivalence to the current public authority, not merely compositional inference.

## Public cutover

Only after the V2 build is fresh and full-611 parity passes:

- replace only `public.rpc_get_product_sku_readiness_portfolio(...)`;
- signature unchanged;
- authenticated-only execute ACL unchanged;
- Control Center permission check unchanged;
- public cutover + post-cutover guards are one transaction.

No change to:
- governed-period reader;
- Product-gap reader;
- canonical single-SKU reader;
- CSE-P01;
- route authority;
- timeout settings.

## Post-cutover proof

The separate V2 proof verifies:

- current build is COMPLETED/fresh/V2;
- ALL_EXISTING item count;
- OPERATIONAL count = 611;
- representative direct canonical single-SKU equality;
- public statistics/population;
- BLOCKER filter matched-count parity;
- first-page keyset identity;
- STALE/ABSENT/INCOMPLETE fail-closed behavior;
- CSE-P01 unchanged;
- public/private ACLs;
- OPERATIONAL and ALL_EXISTING calls under an 8-second native-equivalent ceiling;
- final freshness.

Full-611 equality is not repeated after cutover because it was a mandatory pre-cutover gate.

## V2 rollback

V2 rollback returns to the exact pre-V2 state:

- restore original public C portfolio RPC;
- delete V2 build rows (cascade only through the existing explicit FKs to item/incidence rows);
- restore exact V1 fingerprint function;
- restore exact V1 builder;
- retain the already-installed V1 tables, index reader, epoch registry and 44 triggers;
- verify pre-V2 function MD5s and empty substrate;
- CSE-P01 must remain unchanged.

No DROP CASCADE and no removal of the V1 substrate.

## Failure boundaries

### Failure before V2 builder/fingerprint commit
Pre-V2 state unchanged.

### Failure after V2 private function replacement but before successful build
Public C reader unchanged. Stop; no automatic rollback unless separately authorized.

### Build failure
Public C reader unchanged. Stop; no retry under the same authorization.

### Full-611 parity failure
Public C reader unchanged. Stop; V2 must not cut over.

### Public cutover guard failure
Cutover transaction rolls back atomically.

### Post-cutover proof failure
Run the exact reviewed V2 rollback once only if conditionally authorized.

## Operational risk

The principal architectural risk remains availability after source mutation: a source epoch change makes the current build stale until a governed rebuild completes.

V2 solves builder efficiency; it does not add automatic scheduling.

## Authorization boundary

This contract authorizes no production execution.
A new explicit V2 production authorization is required after exact independent review.
