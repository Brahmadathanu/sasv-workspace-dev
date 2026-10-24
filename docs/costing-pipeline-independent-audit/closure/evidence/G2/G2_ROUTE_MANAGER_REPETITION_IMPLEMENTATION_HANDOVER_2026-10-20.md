# G2 Route Manager repetition safeguard — implementation handover (review-only)

## Verified source entry points
- `public/shared/js/costing-suite-production-route-step-form.js`: family-step form has `Expected occurrences`, `Standard cycles` and a `Step note` field. Current hint says cycles are a `Governed cycle multiplier for the step`.
- `public/shared/js/costing-suite-production-route-delta-form.js`: product-delta editor has the same two numeric fields, without explanation of multiplication.
- Live Direct Labour and Production Overhead preview expressions multiply the two values. Six route144 steps have 8 × 8 despite a physical requirement of 8 total; 0 of 1,155 product overrides currently have dual-positive entries.

## Small client change, to implement together
1. Retain both count inputs and data fields; rename explanatory hint to **cycles within each occurrence**, not an independent count of total cycles.
2. Show **Total step executions per standard manufacturing batch = expected occurrences × cycles per occurrence**, immediately below both controls. Update on input changes and when editing existing records; never save a derived quantity as a third field.
3. When both values exceed one, visibly call for independent physical evidence of nested cycles, show worked example `8 × 8 = 64 executions`, and require a deliberate reviewer decision at approval. A nonempty `step_note` or `override_reason` is not sufficient on its own.
4. Preserve existing form validation and compact layouts. Display must not infer machine-charge capacity, batch count or production throughput from this multiplier. `production_batch_size_ref` remains authoritative for standard batch size.

## Server approval rule — blocked pending contract
Family and product approval RPCs already call their central validators and require approval references. Those references do not capture an explicit nested-cycle attestation. Do NOT simply require nonblank text, do NOT parse arbitrary text for a magic phrase, and do NOT globally prohibit two factors >1: legitimate nested repetitions can exist.

**Minimum safe first increment:** implement informative client total and dual-positive warning in a branch, with regression tests; do not claim approval enforcement. **Second increment:** design version-bound reviewed evidence/confirmation using existing governance controls after examining the complete approval transaction and persistence options. Only then update existing central validators and approval UI together. No new table unless unavoidable. Do not alter approved route144 or any frozen costing snapshot/run 122 or 128.

## Acceptance tests
- (8,1) -> 8, (1,8) -> 8, (8,8) -> 64 with strong warning; edit existing 8/8 renders 64 without mutating the record.
- Empty, negative, decimal, non-finite and zero input invalid; no misleading computed value.
- Family and product-delta paths consistent; no impact on inherited values or other route-step fields.
- No server enforcement declared PASS until tested in isolated PostgreSQL and through authenticated route approval end to end.

G2/CI-032 OPEN; review-only programme; no production changes.
