# WP04 G7 Track A V2.2 — Independent Exact Review

2026-10-05. **PASS FOR FRESH EXPLICIT PRODUCTION AUTHORIZATION — NOT EXECUTED.**

## Exact reviewed identities

- Forward V2.2 blob: `55386ab2af6488c920387f614a8906d077e453f2`
- Rollback V2.2 blob: `5ec7f2f56e89db81f0946aac0ecfd12f82d37c9e`
- Proof V2.2 blob: `e856b362442626844d80faa33782324fd186897d`

## Diagnosis basis

Read-only live evidence established:
- ALL_EXISTING = 1793;
- OPERATIONAL = 611;
- non-operational = 1182;
- V2.1 parity failure count = 1182.

V2.1 parity SQL compared the 611 OPERATIONAL baseline against all 1793 stored rows.

Exact equality of non-operational count and mismatch count proves the prior failure was a proof-scope defect, not evidence of OPERATIONAL envelope drift.

## Current-state boundary

PASS.

Current production state remains:
- public C portfolio MD5 `667267b109a25f4dec3bd7d34c1b2972`;
- installed V2.1 builder MD5 `d9831a37e97f496dfe9f61f436f65e49`;
- V2 fingerprint MD5 `606ec132a26899ae5336ff273e032552`;
- index reader MD5 `d691b39f9a9c088e7e38e8d41835cc0e`;
- 44 epoch rows / 44 triggers;
- empty build/item/incidence substrate;
- CSE-P01 unchanged.

## Narrowness review

PASS.

Forward V2.2:
- does not CREATE OR REPLACE the builder;
- does not CREATE OR REPLACE the fingerprint;
- does not change the index reader;
- does not reference governed-period or Product-gap readers;
- does not set statement_timeout;
- does not touch RLS/Auth/roles/client/business data.

The post-cutover proof is byte-identical to V2/V2.1.

## Corrected parity review

PASS.

V2.2 separates two questions:

### ALL_EXISTING coverage
It proves the stored build and `public.product_skus` have identical SKU membership.

### OPERATIONAL canonical equality
It filters the stored side to:
- Active Product;
- active SKU;
- not sample;

and requires:
- baseline = 611;
- stored operational = 611;
- JSONB mismatch count = 0.

This is the correct like-for-like authority proof.

## Architecture disposition

PASS.

No architecture redesign is required.

The V2 batched builder remains acceptable because executed V2.1 evidence already implied exact equality for the 611 OPERATIONAL envelopes; V2.2 makes that proof explicit and correctly scoped.

## Rollback review

PASS.

Rollback restores:
- original public C reader;
- empty build substrate;

while preserving the already-installed V2.1 builder/fingerprint/index infrastructure.

No executable DROP CASCADE exists.

## Remaining risk

The remaining runtime risk is unchanged:
- the build may fail due to server-operation performance or source change;
- if so, it fails before public cutover and must stop without retry.

No new correctness risk is introduced by V2.2.

## Independent disposition

**PASS — recommend one fresh bounded V2.2 production attempt using only the exact reviewed package.**

No V2.2 production SQL has been executed.

Track B remains unstarted.
G7 remains blocked.
G8 remains closed.
