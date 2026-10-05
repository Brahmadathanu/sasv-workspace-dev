# WP04 G7 Track A V2.1 — Independent Exact Review

2026-10-05. **PASS FOR FRESH EXPLICIT PRODUCTION AUTHORIZATION — NOT EXECUTED.**

## Exact reviewed identities

- Contract V2.1 blob: `04be8331e4aae876362f0f2951a524a822a55713`
- Forward V2.1 blob: `38cf3b3f8df2461e31822ab09b5207da8b5c38c8`
- Rollback V2.1 blob: `c7fd717c212a829aa70af2f128b2d6de16bc818c`
- Proof V2.1 blob: `e856b362442626844d80faa33782324fd186897d`

## Live compatibility evidence

PostgreSQL server: 17.4.

Live catalog confirms:
- `jsonb_object_length(jsonb)`: absent;
- `jsonb_object_keys(jsonb)`: present.

The identified V2 failure is therefore reproducible as a package compatibility defect.

## Narrow delta review

The V2 and V2.1 builder definitions were compared line-for-line.

Executable delta count: **1**.

V2:
`IF jsonb_object_length(v_run_map)<>cardinality(v_sku_ids) THEN`

V2.1:
`IF (SELECT count(*) FROM jsonb_object_keys(v_run_map))<>cardinality(v_sku_ids) THEN`

The only other textual difference is trailing whitespace/newline.

No canonical, commercial, route, filtering, freshness, promotion or incidence logic changed.

## Current-state guard review

PASS.

V2.1 pins the exact current state:

- public C portfolio MD5 `667267b109a25f4dec3bd7d34c1b2972`;
- installed V2 builder MD5 `bfd9f8789fd8771d1ac9b6d468b1bf1c`;
- installed V2 fingerprint MD5 `606ec132a26899ae5336ff273e032552`;
- index reader MD5 `d691b39f9a9c088e7e38e8d41835cc0e`;
- run cohort MD5 `ea6f0e12b2004bd5819f54aaede5e730`;
- run assembler MD5 `a7bcc3e6df3f42c0c531148f2857ff47`;
- canonical live core MD5 `b47e4d07e13dffe5d38d37010ee5ff34`;
- C live core MD5 `fd0b3fe63b40fa3c669da8af1fa5994f`;
- CSE-P01 MD5 `68bd9325062299eb8af1291bf4d9393b`;
- 44 epoch rows / 44 triggers;
- empty build/item/incidence substrate.

## Scope review

PASS.

Forward/rollback/proof contain:
- zero governed-period reader references;
- zero Product-gap reader references;
- no production timeout-setting change;
- no RLS/Auth/permission mutation;
- no client code;
- no business/master-data mutation.

The proof alone retains `SET LOCAL statement_timeout='8s'` as the previously reviewed native-equivalent proof clamp.

## Architecture preservation

PASS.

V2.1 does not revise the V2 architecture.

It preserves:
- one batched run cohort;
- unchanged C live-core per SKU;
- full-611 pre-cutover authority parity;
- unchanged freshness contract;
- unchanged indexed reader;
- unchanged public cutover;
- unchanged post-cutover proof.

## Proof reuse

PASS.

The V2.1 proof file is byte-identical to the independently reviewed V2 proof:
`e856b362442626844d80faa33782324fd186897d`.

No new proof semantics are required for this compatibility-only correction.

## Rollback review

PASS.

Rollback returns to the exact pre-V2.1 production state, including the currently installed V2 private builder definition.

This knowingly restores the private compatibility-defective builder, but the original public C reader is restored and no build data remains, so the defective private builder is inert. This is preferable to silently broadening rollback into an earlier architecture state.

No DROP CASCADE.

## Risk

The correction itself has negligible architectural risk.

The remaining production risk is unchanged from V2:
- the batched ALL_EXISTING build may still exceed the server-operation envelope for reasons unrelated to the compatibility defect.

If that happens:
- public C reader remains unchanged;
- stop without retry;
- it becomes performance evidence for the next architecture decision.

## Independent disposition

**PASS — recommend a fresh, bounded V2.1 production attempt using only the exact reviewed V2.1 files.**

No V2.1 production SQL has been executed.

Track B remains unstarted.
G7 remains blocked.
G8 remains closed.
