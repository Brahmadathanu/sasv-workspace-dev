# WP04 G7 Track A V2 — Independent Exact Review

2026-10-05. **PASS FOR NEW EXPLICIT PRODUCTION AUTHORIZATION — NOT EXECUTED.**

## Exact reviewed files

- forward V2 blob: `d91ed239a1069a43e57ed9472d25bf55c8761351`
- rollback V2 blob: `12cfcefe837074c8496fc0b750ba789f2d386800`
- proof V2 blob: `e856b362442626844d80faa33782324fd186897d`
- V2 contract blob: `8fef86be8c1d89ef65fafd76e4a03a6550b77f59`

Any file-content change invalidates this review.

## Live pre-V2 state reviewed

Current production state is exactly the safe pre-cutover result of V1:

- original public C portfolio RPC still active;
- V1 private substrate present;
- 44 source epochs;
- 44 source triggers;
- no build rows;
- no item rows;
- no incidence rows;
- no current build.

Pinned pre-V2 identities:

- public portfolio RPC MD5 `667267b109a25f4dec3bd7d34c1b2972`;
- V1 builder MD5 `2f50384afe6cf1bea2ecd9c3b12f164c`;
- V1 fingerprint MD5 `fb0965cc075b72b1a71919bcaac28212`;
- index reader MD5 `d691b39f9a9c088e7e38e8d41835cc0e`;
- batched run cohort MD5 `ea6f0e12b2004bd5819f54aaede5e730`;
- run assembler MD5 `a7bcc3e6df3f42c0c531148f2857ff47`;
- canonical live core MD5 `b47e4d07e13dffe5d38d37010ee5ff34`;
- C live core MD5 `fd0b3fe63b40fa3c669da8af1fa5994f`;
- CSE-P01 commercial point MD5 `68bd9325062299eb8af1291bf4d9393b`.

## V1 failure diagnosis

PASS.

V1 failed because the builder called the canonical single-SKU helper once per SKU. That helper invokes `fn_wp04_c_run_cohort(ARRAY[p_sku_id],...)` internally. Across ALL_EXISTING this repeated cohort startup and exceeded the server-operation statement envelope before public cutover.

No evidence indicates a canonical correctness defect.

## V2 builder design

PASS.

V2 batches exactly the previously repeated step:

- build all SKU ids once;
- call `fn_wp04_c_run_cohort(all_sku_ids,...)` once;
- map returned evidence envelopes by SKU;
- call unchanged `fn_wp04_c_live_core(...)` per SKU.

This matches the decomposition already used by the current C portfolio implementation.

V2 does not duplicate:
- readiness severity rules;
- route rules;
- CSE/commercial row selection;
- enrichment rules;
- driver/run evidence rules.

## Full-611 pre-cutover authority proof

PASS BY DESIGN REVIEW.

This is the strongest improvement in V2.

Before public cutover, while the existing public C portfolio RPC is still authoritative, forward V2:

1. pages OPERATIONAL using the existing public RPC at limit 100;
2. captures all 611 returned assessment envelopes into a temporary baseline;
3. compares each stored V2 assessment exactly as JSONB;
4. requires 611 baseline rows and zero mismatches.

Any mismatch raises before public replacement.

Therefore the package does not rely solely on compositional reasoning for V2 build equivalence.

## Freshness/concurrency

PASS.

V2 reuses the reviewed 44-source epoch mechanism and changes only the contract marker to `WP04_G7_TRACK_A_V2`.

The same source-version, definition-digest, schema-digest, promotion-lock and snapshot-atomic indexed-read rules remain.

## Public scope

PASS.

Forward V2 changes only:

- private fingerprint function;
- private builder function;
- private build data;
- then, after full-611 parity, the public portfolio RPC.

It does not reference or change:
- governed-period reader;
- Product-gap reader;
- RLS/Auth/roles;
- timeout settings;
- client code;
- Manage Products;
- CSE-P01;
- route authority.

Static inspection confirms zero governed-period/Product-gap references and zero timeout-setting statements in forward/rollback.

## Failure containment

PASS.

- builder/fingerprint replacement commits before build;
- build failure leaves public C reader unchanged;
- parity failure leaves public C reader unchanged;
- public cutover and guards remain atomic;
- no retry is implied;
- post-cutover proof failure has a dedicated exact V2 rollback.

## V2 rollback

PASS.

Rollback returns to the exact **pre-V2** state, not to pre-Track-A production:

- original public C portfolio RPC restored;
- V2 build rows removed;
- exact V1 fingerprint restored;
- exact V1 builder restored;
- installed V1 substrate retained;
- 44 epochs/triggers retained;
- no DROP CASCADE;
- CSE-P01 checked unchanged.

That is the correct rollback target because V1 private infrastructure already committed before this V2 package.

## Proof package

PASS FOR AUTHORIZED EXECUTION.

Post-cutover proof includes:

- current build V2/fresh/completed;
- ALL_EXISTING count;
- OPERATIONAL 611 count;
- representative direct canonical single-SKU equality;
- public statistics/population;
- BLOCKER-filter matched-count parity;
- first-page keyset identity;
- stale/absent/incomplete fail-closed behavior;
- CSE-P01 identity;
- public/private ACL checks;
- OPERATIONAL and ALL_EXISTING reads under `SET LOCAL statement_timeout='8s'`;
- final freshness.

The 8-second clamp is proof-only and lowers the test ceiling; no production timeout is increased.

## Remaining risk

The primary risk is still rebuild availability after a tracked source mutation. V2 improves initial/build efficiency but does not add automatic rebuild scheduling.

A second risk is that an ALL_EXISTING build may still take materially longer than expected even after cohort batching because per-SKU live-core logic (commercial, BOM, MRP, selling, etc.) remains. The package handles this safely: build failure occurs before public cutover and must stop without retry.

## Independent disposition

**PASS — recommend a new bounded V2 production attempt using only these exact reviewed files.**

Recommended execution sequence:

1. fresh target/source/substrate/file-identity guards;
2. execute exact forward V2 once;
3. if build or pre-cutover parity fails: stop; no public cutover should have occurred;
4. if forward reaches cutover successfully: execute exact proof V2 once;
5. if proof passes: retain V2 server recovery and stop;
6. if proof fails after cutover: execute exact rollback V2 once only under conditional rollback authorization, verify exact pre-V2 state, then stop.

Do not begin Track B, rerun G7, merge, release, publish or begin G8 under the V2 server authorization.
