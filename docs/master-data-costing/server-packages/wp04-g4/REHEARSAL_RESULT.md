# WP04-G4 — Authorized limited rollback-only rehearsal result

Date: 2026-10-04. Disposition: PASS_LIMITED_SCOPE; G4 remains incomplete; deployment HOLD.

## Frozen authority and authorization
User explicitly authorized one rollback-only operation against main `80246db8e10d5bb9ff1b0228ae41b0cfc2624d36`, project `qhmoqtxpeasamtlxaoak`, script SHA-256 `7d85ee676a6e6df358069a9406b0e26685b1b1efe4342a1aa68e337a6e46e11f`, fresh guards, no COMMIT, no automatic retry, independent readback, then stop. Authorization is consumed by this single execution; no future execution, deployment or client work is authorized. Script bytes/header and original proposal remain frozen historical records; their NOT_AUTHORIZED labels describe preparation before this explicit authorization.

Repository preflight: main80246db and audit ea50fa3001fe766a68f26191537a4a5c5492011b match. Intervening 01ce609→80246db commits change only three e-Aushadhi programme documents; no WP04 overlap. No rebase/merge of main. Connected project sasv-workspace is ACTIVE_HEALTHY / Postgres17.

## Fresh live guards
READ ONLY transaction passed the exact frozen source-definition, owner/attributes, ACL, candidate-name absence and enabled-event-trigger guards. Owner postgres; September period valuation2026-09-10; latest matching SUCCESS run115. Separate READ ONLY actor-claim check returned actor_claim_matches=true, existing Control Center view permission=true and idle_wp04_transactions=0. This is SQL claim context, not native Auth/API proof.

## Single execution
One execute_sql call received the exact 94,858-byte LF script. It completed successfully with its final ROLLBACK. No retry, COMMIT, snippets or additional rehearsal was executed. Returned metadata:

```json
{"operation":"WP04_G4_ROLLBACK_ONLY_REHEARSAL","deployment":"NOT_AUTHORIZED","canonical_cases":3,"native_api_proof":"NOT_RUN","full_verification":"NOT_ESTABLISHED","portfolio_invocation":"NOT_RUN","source_restore_checks":"PASSED_IN_TRANSACTION","period_and_gap_invocation":"PASSED_IN_TRANSACTION"}
```

The script's assertions passed for seven function definitions/catalog identities; three exact canonical JSON comparisons (SKU11 LIVE_AS_OF, SKU1795 LIVE_AS_OF, SKU11 EXACT_RUN115); two limit1 period/gap reader invocations; guarded old-definition restoration and candidate removal. Six package paths were invoked; lazy branches are not universally proved. Business payloads were neither emitted nor added to this evidence record.

## Independent readback
A fresh, separate READ ONLY transaction repeated the frozen six-source/ACL/attribute/event-trigger guards successfully. Metadata: independent_source_acl_attribute_event_trigger_readback=PASS; candidate_function_count=0; idle_wp04_transactions=0; valuation_date=2026-09-10; latest_success_run=115. Original definitions/access are restored; no candidate functions remain committed. No permission assignment, data/fixture/actor writer, client edit, paid resource, merge/tag/release occurred. This was a production transactional DDL operation: do not describe it as no production operation. Locks/load/logs/statistics/OID consumption are not claimed absent or rolled back.

## Evidence assessment and stop
This is limited function creation/invocation, three-case parity and transaction-local restore evidence. It is not full portfolio runtime/performance, all-SKU/CSE parity, no-success/lazy-branch coverage, native/API authorization, arbitrary-note monetary certification, client regression or committed deployment rollback proof. G4-R03 remains unresolved; application_authorized=false. The generic forward_rollback_rehearsal prerequisite is not promoted to full PASS.

Stop after assessment. Next gate: ChatGPT-owned bounded disposition of remaining G4-R03 proof, using this evidence. No additional SQL execution or client implementation is authorized. G0–G3 retained; G4 incomplete; programme4/13; WP03closed; parked/locked/DEC-014 unchanged. Formal closure/new-chat handover obligations remain.
