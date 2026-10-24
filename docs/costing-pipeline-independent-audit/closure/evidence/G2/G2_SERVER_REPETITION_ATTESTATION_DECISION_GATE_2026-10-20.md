# G2 server-side repetition approval — decision gate (20 October 2026)

Live read-only inspection of `costing.fn_validate_route_family_route(bigint)` and `costing.fn_validate_product_process_route(bigint)` confirms both return JSON with `valid` and `errors`. The former directly checks route step records; the latter checks effective product steps. Product route has `evidence_status` and `route_note`; neither is a count-specific attestation. Current family and product approval RPCs fail when these validators return invalid.

Decision: do not add a naive `count>1 AND cycles>1 => invalid` rule because legitimate nested repetition must remain possible. Do not accept a nonblank note or approval reference as proof. Existing client change displays multiplication but cannot ensure that approved counts are physically correct.

Server implementation prerequisites: identify a governed version-bound evidence/confirmation record, exact reviewer identity, total for each affected step, and validation of unchanged inputs between confirmation and approval. Check whether existing approval history can retain this evidence without schema changes. Existing `step_note`, `override_reason` and approval reference are insufficient individually. Avoid new tables unless no satisfactory existing audit record exists. Do not invalidate or mutate approved route144 or protected costing refresh runs122/128.

Required negative regression: 8x8 with generic note but no explicit attestation blocks NEW approval; 8x1 passes existing route checks; 8x8 with governed, version-matched reviewer evidence may pass; editing counts after attestation invalidates it; existing approved route144 remains readable and unchanged. Test both family and product approval paths. No server changes authorised; G2/CI-032 OPEN.
