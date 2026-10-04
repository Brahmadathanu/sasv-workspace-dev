# WP04-G4 — Narrow correctness-script V2 correction and independent review

2026-10-04. **REVIEW COMPLETE AT NARROW SOURCE/TYPE SCOPE. V2 NOT AUTHORIZED / NOT RUN.** G4 incomplete/applicationHOLD;G5blocked;programme4/13.

## Authority and preserved evidence
Fresh fetch main **e421fe8df9b98b4956acdcd4cadeb36a3f9b923c**, auditlocal/origin **283826ad4d3e1b930dfd1f2a07c400ba94e76fc8**, unchanged. Follow IMPLEMENTATION_RULES, DEC-014, current WP04 ledger, frozen PERFORMANCE_PLAN_REVIEW and AB_CORRECTNESS_RESULT. User authorized correction/review only; failed V1's one-operation authorization remains consumed. No main merge/rebase, prior proof rerun or candidate definition. Unrelated local dependency-manifest draft preserved.

New file **ab-correctness-proposal-v2.sql**, SHA-256 **fafa65b083fe46fd93628857a3b6659e49d93c556791c25aa6dd28cd1737e23b**. Failed V1 retained byte-for-byte at SHA-256 **e29d4c395a36070d2e03f5cb01c71e969198811f408b88fe44022145e549c669**. Candidate forward/restore/readback SQL, previous accepted evidence and failed-operation result unchanged. Original script old-main preparation comment remains provenance; current authorization main above is reconciled via this record and existing moved-main disposition.

## Exact correction
Only two proof IF statements changed, historical and corrected aggregation blocks:

```sql
-- failed V1: text compared with JSONB
(v_result->>'rows') IS DISTINCT FROM '[]'::jsonb
-- V2: JSONB compared with JSONB
(v_result->'rows') IS DISTINCT FROM '[]'::jsonb
```

All other bytes identical. Reversing these two replacements exactly reproduces V1. No candidate function body, guard, sample, query, payload, operation count, ACL, source identity, transaction boundary, timer or business-rule change. Source whitespace retained intentionally for frozen function identity; do not trim embedded definitions to satisfy whitespace-only lint.

## Independent review and targeted proof
Reviewed separately from the edit: two changed lines only; all18embedded CREATE bodies byte-identical;10drops/18planned canonical calls/zeroportfolio invocations unchanged; one REPEATABLE READ transaction/noCOMMIT/finalROLLBACK preserved. All old/new candidate identity/rollback guards still exact; unchanged baseline full-JSON parity, observation timestamp handling, six bounded aggregation scenarios, missing-SKU exceptions and invalid-context checks. The identified text-vs-JSONB assertion is absent fromV2; remaining text extraction comparisons in this proof use text counterparts or explicit casts. This is a targeted review, not proof that every lazy branch is defect-free.

Read-only database validation ran **one SELECT over six inline literal JSON values only**. No business table/function, actor claim, candidate DDL or correctness-script invocation. PostgreSQL confirmed both operands jsonb and the complete zero-population assertion's expected behavior:

| Literal | Expected refusal | Observed |
|---|---|---|
| population0/rows[] |false |false |
| population0/nonempty rows |true |true |
| population1/rows[] |true |true |
| rows absent |true |true |
| rows JSONnull |true |true |
| rows text"[]" |true |true |

6/6 expected results; typesmatch=true. This directly addresses SQLSTATE42883 in the failed assertion. It does not compile/execute the fullV2 script or prove candidate correctness/performance/nativeAPI/fullG4. V2 operation remains NOT_RUN. Last independent original-state readback remains the recorded post-V1PASS; no new restoration proof is claimed here.

## Exact renewed authorization request — pending
Target **qhmoqtxpeasamtlxaoak**, reconciled main **e421fe8df9b98b4956acdcd4cadeb36a3f9b923c**, script **ab-correctness-proposal-v2.sql**, exact SHA-256 **fafa65b083fe46fd93628857a3b6659e49d93c556791c25aa6dd28cd1737e23b**. Proposed exactlyone execution only after new explicit human authorization. Fresh main/source/ACL/event/actor/sample/context/digest guards first; mismatch stops without execution. NoCOMMIT, finalROLLBACK, no automatic retry; frozen ab-independent-readback.sql separately afterwards including on error/timeout; assess limited evidence and stop. No deployment, fullportfolio/performance operation or client work.

All scopes/limits from AB_PROPOSAL_REVIEW remain:18canonical RPC invocations across original/historical/corrected stages, three existing LIVE SKUs and EXACT114/115 plus expected missingSKU exceptions; six aggregation query-fragment cases over3captured assessments,10literal predicates/twoinvalid-context checks. No actual publicportfolio invocation. Accepted-review/noSUCCESS/nativeAPI/all-SKU/CSE/ALL_EXISTING traversal/payload/performance/committedrollback still unresolved; no G4 waiver. Statement/lock/idle timeouts unchanged at15/2/30seconds; no configuration escalation. Schema work remains ChatGPT-owned underDEC-014; client blocked.

Disposition **ACCEPTABLE TO REQUEST EXACT LIMITED V2 AUTHORIZATION ONLY**. Renewed authorization is necessary because V2 is a new frozen production transaction-local DDL operation; previous authorization cannot be reused. No automatic retry occurred or is approved by this correction/review instruction.

Workflow:narrow proof correction and review complete → renewed explicit V2 authorization → fresh guards/one operation/independent readback/stop.
WP progress:G0–G3 retained; prior limitedPASS/restoration retained; V1failed/readbackPASS retained;G4incomplete/G5blocked. Programme4/13. Current gate:WP04-G4 — NarrowV2 correction/type review complete; renewed operation authorization pending. Next:single separately authorized V2 bounded correctness operation and independent readback, then assessment.
Parked:UX-P01/02,NAV-P01/02,CSE-P01,SEC-P01/02 unchanged. Locked:canonical authority,lifecycle separation,governedLIVE/EXACT,specialist ownership,DEC-014;WP03closed. No production DDL/candidate execution/deployment/client/merge/tag/release/spend this checkpoint. WP04 stays in this chat; formal closure still requires complete programme docs and WP05 new-chat handover.
