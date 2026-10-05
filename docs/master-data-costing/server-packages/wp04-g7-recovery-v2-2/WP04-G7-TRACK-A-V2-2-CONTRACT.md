# WP04 G7 Track A V2.2 — Narrow Pre-cutover Parity-Scope Correction

Status: **FROZEN / REVIEW ONLY / NOT EXECUTED**

## Purpose

V2.2 corrects only the pre-cutover parity proof scope exposed by the V2.1 diagnosis.

Observed V2.1 result:
- ALL_EXISTING = 1793
- OPERATIONAL = 611
- parity mismatch count = 1182
- 1793 - 611 = 1182

Diagnosis proved the parity query compared:
- OPERATIONAL baseline (611)
against
- ALL_EXISTING stored rows (1793).

There was no evidence of OPERATIONAL canonical-envelope mismatch.

## Pre-V2.2 production state

- original public C portfolio RPC active;
- V2.1 builder installed;
- V2 fingerprint installed;
- index reader installed;
- 44 source epochs/triggers;
- build rows = 0;
- item rows = 0;
- incidence rows = 0;
- no current build.

## V2.2 scope

V2.2 does not replace or change:
- builder;
- fingerprint;
- index reader;
- canonical live core;
- C live core;
- run cohort/assembler;
- CSE-P01;
- route logic;
- governed-period reader;
- Product-gap reader;
- permissions/RLS/Auth;
- client code;
- timeout settings;
- business/master data.

## Forward behavior

V2.2:

1. verifies exact current pre-V2.2 identities and empty substrate;
2. invokes the already-installed V2.1 builder once;
3. requires one completed/fresh build;
4. verifies build item_count equals live ALL_EXISTING count;
5. verifies build operational_count equals live OPERATIONAL count and remains 611;
6. separately proves ALL_EXISTING SKU identity membership with a full join;
7. pages the still-active public C portfolio reader for OPERATIONAL only;
8. requires baseline count = 611;
9. filters stored build rows to exactly:
   - product_status='Active'
   - sku_is_active=true
   - sku_is_sample=false
10. compares those 611 stored OPERATIONAL rows JSONB-for-JSONB with the 611 public-C baseline;
11. requires mismatch count = 0;
12. only then runs the unchanged atomic V2/V2.1 public cutover.

## Why this is the correct proof

The builder intentionally materializes ALL_EXISTING so the indexed reader can serve both population scopes.

The current public authority can provide a trustworthy OPERATIONAL baseline. Therefore:
- canonical-envelope equality is proven on the same 611-row scope;
- ALL_EXISTING completeness is proven separately by SKU membership/count.

This avoids conflating population coverage with envelope equivalence.

## Post-cutover proof

The post-cutover proof is byte-identical to V2/V2.1:
`e856b362442626844d80faa33782324fd186897d`

It retains:
- V2 fresh/current checks;
- ALL_EXISTING count;
- OPERATIONAL=611;
- direct canonical helper samples;
- statistics/filter/keyset checks;
- stale/absent/incomplete fail-closed checks;
- CSE-P01;
- ACLs;
- two indexed reads under an 8-second proof ceiling.

## Rollback

Rollback returns to exact pre-V2.2 state:
- restore original public C portfolio RPC;
- delete V2.2 build rows;
- retain installed V2.1 builder;
- retain V2 fingerprint;
- retain index reader;
- retain 44 source epochs/triggers;
- verify empty substrate and CSE-P01.

No DROP CASCADE.

## Failure boundaries

- build failure: public C remains unchanged; stop; no retry;
- ALL_EXISTING membership failure: public C unchanged; stop;
- OPERATIONAL parity failure: public C unchanged; stop;
- cutover guard failure: cutover transaction rolls back;
- post-cutover proof failure: reviewed V2.2 rollback only under conditional authorization.

## Authorization boundary

No production execution is authorized by this package.
Fresh explicit V2.2 production authorization is required after exact independent review.
