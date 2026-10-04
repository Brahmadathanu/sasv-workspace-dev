# WP04-G4 — Corrected operational portfolio performance result

2026-10-04. **Bounded correctness PASS; measured performance goals NOT MET; independent restoration PASS. G4 INCOMPLETE / APPLICATION HOLD; G5 BLOCKED.**

## Authority and single execution
User explicitly authorized exactly one frozen corrected operation against target `qhmoqtxpeasamtlxaoak`, main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`, script `corrected-portfolio-proof-proposal.sql`, SHA-256 `c55b2a79d575fbdedf52cce810c826d99412ef5efbad16c1d37f018628cab72e`. Fresh fetch confirmed unchanged main and audit head `a111e2566a4ccd7f2727bb976c73e9fdc6c0d93f`. All frozen manifest file digests matched. Fresh separate catalog readback matched six original definitions, owner/access/settings and DDL event fingerprint; candidate count and observed idle WP04 transactions were zero. Fresh population/context inspection matched 611 operational SKUs, 460 Products, first SKU1, ordered membership MD5 `eeba4bf20f54589fe5b037173a79ed82`, September period/valuation2026-09-10/SUCCESS115. Embedded actor/source/package guards also passed.

Exactly one execute_sql attempt completed, with one original canonical SKU1 baseline and one corrected operational portfolio invocation over all611, page limit1 and null filters. Existing statement15s/lock2s/idle30s limits were preserved. No COMMIT, automatic retry, timeout increase, deployment or client implementation. Exact restore guards passed in transaction and final ROLLBACK completed. Authorization is consumed; no subsequent operation is authorized. Frozen scripts/proposal manifests remain historical byte-identical records; current disposition is this result and the programme ledger.

## Bounded results
| Evidence | Result |
|---|---|
| Operational population | 611 |
| Returned page rows | 1 |
| Governed context, count/page envelope and severity census | PASS at frozen assertions |
| First row full canonical JSON parity against original baseline | PASS |
| Corrected combined portfolio latency | 8,174.908 ms |
| Historical uncorrected combined latency | 10,822.426 ms |
| Observed reduction | 2,647.518 ms / 24.46% |
| Combined response within3s / within5s goals | false / false |
| PostgreSQL JSONB text response size | 14,491 bytes |
| In-transaction exact restoration checks | PASS |
| Separate independent restoration readback | PASS |

Independent readback matched all six original definitions, original two functions' ACL/owner/security-definer/STABLE/return type/search paths, event fingerprint `4e2c16f8333e51161dc11c5376fb3296`; candidate function count0 and observed idle WP04 transactions0. Sanitized tool evidence is in CORRECTED_PERFORMANCE_RESULT.json. No business payload or credentials exported.

## Independent assessment and next bounded gate
The correction can execute the actual operational portfolio, with the frozen count/context/envelope/first-row parity checks passing. Accepted earlier V2 sample/query-fragment correctness remains retained. This does not establish full all611 JSON/statistics parity. The observed response is faster than the single historical reference, but remains above both goals. This is an uncontrolled single observation; it does not establish repeatable speedup, concurrency capacity, cold/warm performance, SLA or dominant inner cost path. Outer latency is the combined call, not separate page/statistics measurements. Response size is database JSONB text, not HTTP wire size.

**Disposition: retain limited correctness/restoration evidence; do not accept performance readiness or deploy.** Full G4 remains incomplete, including broader allSKU/CSE/edge/ALL_EXISTING/nativeAPI/payload/accepted-review/noSUCCESS/wider-performance/committed-rollback/client-regression proof or explicitly reviewed disposition. No waiver or new business/architecture decision follows from this result.

Exact next gate: **WP04-G4 — Measured corrected-performance disposition and remaining-proof review.** Review the 8.17s residual against existing source/read-only evidence and determine the smallest justified remaining proof/correction plan. No additional portfolio test, instrumentation, optimization, RPC/index change or deployment is authorized. Any new high-risk package requires reviewed frozen scope and a new explicit production authorization. Stop after this evidence assessment.

Workflow: frozen proposal → explicit authorization → fresh guards → one operation → separate readback → bounded assessment COMPLETE.
WP progress: G0–G3 retained; G4 incomplete/application HOLD; G5 blocked; WP04 incomplete.
Programme progress: 4 of13.
Current gate: WP04-G4 corrected measured result assessed; performance goals not met.
Next: measured corrected-performance disposition/remaining-proof review, not execution.
Parked: UX-P01/02, NAV-P01/02, CSE-P01, SEC-P01/02 unchanged.
Locked: canonical readiness authority, lifecycle separation, governed LIVE_AS_OF/EXACT_RUN, fail-closed evidence, specialist ownership and DEC-014; WP03 closed. Unrelated local draft preserved; no merge/tag/release/spend. WP04 closure/new-chat WP05 handover remains future work.
