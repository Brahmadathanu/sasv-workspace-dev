# WP04-G4 — Authorized A/B correctness attempt result

2026-10-04. **OPERATION FAILED — PROOF SCRIPT TYPE ERROR; NO RETRY. INDEPENDENT ORIGINAL-STATE READBACK PASS. G4 INCOMPLETE.**

## Exact authorization and fresh guards
User replied “proceed” directly to the exact single-operation authorization request: targetqhmoqtxpeasamtlxaoak, reconciled maine421fe8df9b98b4956acdcd4cadeb36a3f9b923c, scriptab-correctness-proposal.sql SHA256e29d4c395a36070d2e03f5cb01c71e969198811f408b88fe44022145e549c669. Treated as authorization of that concrete request only. Authorization consumed by exactlyone execute_sql attempt; no automatic retry, altered script, additional candidate operation, full portfolio/performance run, deployment or client work.

Fresh Git fetch matched maine421fe8df9b98b4956acdcd4cadeb36a3f9b923c, auditlocal/origin00b7df3487bd820cb42fbac2768e8ea6014ce598. Exact operation/manifest hashes matched. Fresh read-only six original definition checks alltrue; original wrappers ownerpostgres/STABLE/SECDEF/JSONB/searchpath/ACL unchanged; event fingerprint4e2c16f8333e51161dc11c5376fb3296; candidates0/idleWP04transactions0. Sample Product/SKU lifecycle membership matched literals for1/11/1795; September valuation2026-09-10/latestSUCCESS115; EXACT114 SUCCESS same context; SKU-1 absent; RESOLVED_POLICY sample1 present. Existing actor/context check included before candidate definitions in frozen operation. These metadata guards do not certify nativeAPI access.

## Exact operation result
One exact frozen script submission through ChatGPT-owned Supabase execute_sql. Returned error, SQLSTATE **42883**:

> operator does not exist: text = jsonb

Failing expression from inline_code_block:

```sql
case_id=6 AND (
 (v_result#>>'{statistics,population_sku_count}')::bigint IS DISTINCT FROM 0
 OR (v_result->>'rows') IS DISTINCT FROM '[]'::jsonb
)
```

The assertion extracts rows with `->>` (text), then compares it to JSONB. This is a proof-script defect. The same assertion occurs twice, in historical and corrected bounded aggregation blocks. Error context locates the first/historical aggregation block, before corrected-package stage. The reviewed A/B function bodies are not shown defective by this result; their corrected runtime proof remains NOT_RUN. Earlier stages precede the failed block, but no final successful result exists: do not promote execution-order inference into accepted partial parity PASS or claim planned18calls/allcases completed. Historical portfolio was not invoked; zero operational portfolio calls by frozen script/source. No retry.

This type mismatch was missed in the earlier ChatGPT static review. Delimiter/parenthesis and offline models did not check PostgreSQL operator typing. Record this verification limitation; do not report the static check as database compilation proof. No environment/tooling detour or broader architecture change follows from this defect.

The script has noCOMMIT. Execution stopped before its explicit restore/finalROLLBACK statements; therefore **explicit restore rehearsal/finalROLLBACK execution NOT_ESTABLISHED**. Independent next-call readback establishes that the original transaction-local changes did not persist after abort. Do not claim that the error exercised the full planned restoration path.

## Independent post-error reconciliation
Immediately after error, a separate execute_sql call executed only frozen ab-independent-readback.sql (read-only metadata). Result:

| Check | Observed |
|---|---|
| Six original definition hashes | All match / true |
| Canonical original ACL | postgres/authenticated/service_role EXECUTE, original exact ACL |
| Enrich original ACL | postgres/service_role EXECUTE, original exact ACL |
| Original attributes | ownerpostgres,STABLE,SECDEF,JSONB,originalsearchpaths |
| DDL event-trigger fingerprint |4e2c16f8333e51161dc11c5376fb3296, unchanged |
| Candidate functions remaining |0 |
| Idle WP04 transactions |0 |

**Independent original-state preservation/restoration readback PASS.** No guessed cleanup or further DDL required/performed. No deployment, business-data writer, nativeAuth/fixture, full portfolio/performance test or client implementation. No COMMIT issued. This attempt included production transaction-local candidate DDL before abort; it must not be described as a wholly read-only gate. Earlier accepted WP04 evidence remains intact and is not rerun/invalidated by this proof-script error.

## Bounded disposition / next gate
Current authorization **CONSUMED**; application/performance/client authorization remainfalse. Correctness proof failed; corrected candidate runtime/parity/orchestration/performance not established. G4 incomplete/application HOLD; G5blocked.

Exact next gate: **WP04-G4 — Narrow proof-script correction and independent review.** Proposed correction only: use JSONB extraction `v_result->'rows'` in the two assertions (or an equivalently reviewed consistent type comparison); candidate forward/rollback bodies and all historical artifacts remain frozen. Add a targeted operator-type check at the permitted nonmutating review scope; do not mistake it for full contract proof. This result does not edit the script or authorize its correction execution. Future corrected script must be separately named/digested and reviewed, with renewed explicit authorization before any production attempt. No automatic retry or performance operation.

Workflow: one authorized attempt failed → independent original-state readbackPASS → narrow proof-script correction/review gate; then separately authorized operation only.
WP progress:G0–G3 retained; prior limited rehearsal/operational correctness and restorationPASS retained; A/B correction proofFAILED;G4incomplete/G5blocked. Programme4/13. Current gate:WP04-G4 — Failed bounded correctness attempt disposition complete. Next:narrow proof-script correction and independent review.
Parked:UX-P01/02,NAV-P01/02,CSE-P01,SEC-P01/02 unchanged. Locked:canonical authority,lifecycle/readiness separation,governedLIVE/EXACT,specialist ownership,DEC-014;WP03closed. Branch unmerged; no rebase/main merge/tag/release; unrelated local draft preserved. WP04 stays in this chat; formal closure still requires programme records and WP05 new-chat handover.
