# G2 minimal server approval safeguard — design checkpoint

## Grounded constraints

The family route header already holds `id`, `route_version`, `status`, `evidence_status`, `approval_reference`, `approved_by`, `approved_at`, `updated_at`, and `supersedes_route_id`. Product route holds route version and approval metadata. Existing validators expose `valid/errors`; generic notes or generic approval references do **not** prove that a reviewer accepted two independent repetition counts. Six unarchived approved Dhanyamlam family steps currently have 8x8 while physical executions are eight total.

## Proposed minimal implementation (NOT AUTHORISED FOR LIVE DEPLOYMENT)

1. Limit the new server check to submission/approval of NEW or edited route versions; do not retroactively make historic approved route 144 unreadable.
2. For each effective step with occurrences > 1 and cycles > 1, compute total executions with numeric overflow protection. Capture exact step identity, both counts, computed total, route ID/version and approval actor in a transaction-bound confirmation.
3. A generic free-text note or old approval reference is insufficient. Confirmation must be route-version-bound and must become invalid when either count or the approved step composition changes.
4. Prefer extending existing governed approval request/receipt if its schema and transaction logic can preserve the exact step fingerprint. Do not create a new storage table unless no existing auditable receipt is suitable.
5. Server approval must fail closed if one of the affected steps lacks a matched receipt. Apply the same rule to family route and product-route effective steps, including the ALTER_CYCLE operation. Preserve other approval validations.
6. After implementing, regression-test new 8x8 without receipt = rejected; genuine 8x8 with exact attestation = allowed; 8x1 and 1x8 = unaffected; stale attestation rejected; approved historic route 144 and protected runs 122/128 unchanged.

## Implementation boundary

No live database changes or approval calls. The approval function signatures and request-receipt persistence mechanics require precise verification before editing SQL. Do **not** merge or deploy speculative SQL. Current client safeguard is informative only. G2/CI-032 OPEN.
