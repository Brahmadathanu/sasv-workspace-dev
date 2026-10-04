# WP04-G4 — Exact existing-helper diagnostic proposal / independent executable review

2026-10-04. **PREPARATION / REVIEW COMPLETE. NOT AUTHORIZED / MEASURED DIAGNOSTIC NOT RUN. G4 INCOMPLETE / APPLICATION HOLD; G5 BLOCKED.**

## Purpose in simple terms
The corrected portfolio returned in8.17seconds. This diagnostic would time existing route/shared readers and selected evidence/commercial reads, so the next correction targets measured work rather than guesses. It would not change server functions or run readiness for the611-SKU portfolio again. These few observations are diagnostic clues, not a complete decomposition of the8.17seconds or acceptance of the server contract.

## Reconciliation and source inspection
Fresh fetch confirms main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`, local/origin audit `b4e1f3eb845145fda241fb02751dd948307bbb55`, no movement/delta/overlap. Read current rules/MASTER/WP04/DEC-014 and CORRECTED_PERFORMANCE_REVIEW. Preserve G0–G3, all previous successes/failure/restoration and consumed authorizations; no proof rerun for main movement.

Fresh live read-only catalog inspection captured20 existing reader/resolver/validator/fingerprint definitions and three view definitions/options. Four measured reader identities match the existing frozen authority. Recursively inspected explicit costing/public function references and the three referenced views; no unresolved application-function reference in this bounded source closure. Sources use SELECT/read composition/validation and existing exception semantics, with no explicit data/DDL/sequence/network/dynamic writer found. One existing nested QC policy resolver is declared VOLATILE despite a read-only SELECT body. Preserve its exact metadata/body; do not misreport all nested routines STABLE or change its classification. Nineteen others retain their existing STABLE/IMMUTABLE classifications. These are reviewed existing sources, not new definitions or an exhaustive proof of every environment dependency.

Fresh separate catalog-only readback returned20function definitions/owner/ACL/search-path/security/volatility matches, three view definition/options matches, six original readiness sources match, original two attributes/ACLs/event unchanged, candidates0/idleWP040. That exact readback query was executed successfully without invoking measured readers. Fresh direct metadata reads matched server_version_num170004,Septembervaluation2026-09-10/SUCCESS115,operational611/membershipMD5eeba4bf20f54589fe5b037173a79ed82,samples1→Product1,11→Product14,1795→Product794.1/11Active/non-sample;1795Inactive/sample. All precondition evidence is in HELPER_DIAGNOSTIC_PRECONDITIONS.json. No EXPLAIN ANALYZE/helper/portfolio/canonical readiness call occurred during preparation.

## Frozen artifacts
| Artifact | SHA-256 |
|---|---|
| helper-diagnostic-proposal.sql | `143f32437b2859576bd7c3dc98aff84db351c9c51c7096f519ae7675e25fde43` |
| helper-diagnostic-readback.sql | `6fd4bacd8b04a5f3ce1496bdab69fb337fa8557a5dc059d70ad19221796b7578` |
| helper-diagnostic-source.json | `8828930a79d5bfeaf80a86a410acf8d7bb5f26849c3874975dc425fc2b4d07d6` |
| HELPER_DIAGNOSTIC_PRECONDITIONS.json | `d16bf556f002ffaa623cdf9727d853684971529ca3bc52c7506210ab648e35a3` |

helper-diagnostic-manifest.json binds all these and this review. Existing corrected/performance/correctness/source/rollback scripts and frozen manifests are unchanged. No migration/CLI/tool/Auth/fixture package added. Git records optional server evidence; no Git apply prerequisite or client handoff under DEC-014.

## Exact proposed operation — authorization required
Target `qhmoqtxpeasamtlxaoak`, main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`, exact helper-diagnostic-proposal.sql digest above. At most one execute_sql call, one REPEATABLE READ READ ONLY transaction; noCOMMIT/finalROLLBACK. Fresh main/digest/project/source/context/sample/membership guards first. Any mismatch stops before measurements. Source/dependency/attribute/view/event/name-absence guards repeat afterward. No candidate creation/restoration DDL because no objects are changed; ROLLBACK ends the diagnostic transaction/session-local settings. Separate frozen helper-diagnostic-readback.sql afterward, including onerror/timeout; no retry or guessed recovery.

Exactly eight frozen EXPLAIN ANALYZE SELECT wrappers, each executed once in fixed order:
1. Full existing route reader atvaluation2026-09-10, materialized once; same count/distinct/Product-keyed JSON map aggregate as portfolio. Full existing governed route population consumed, not narrowed to three SKUs/operational Products.
2. Existing shared-issues reader once atvaluation2026-09-10; scalar result materialized once and selected.
3–8. Existing run_evidence then commercial point reader forSKU1, then11, then1795. Evidence parametersSeptember/valuation09-10/run115; commercial parametersSKU/September/valuation09-10 and unchanged LIMIT1, no ordering/run/valuation-source filter added.1795 is a diagnostic inactive/sample case only, not counted into OPERATIONAL membership. Each scalar evidence result is MATERIALIZED and selected, not discarded behind unused COUNT; commercial result consumed via the canonical point call/LIMIT1 shape.

Nested helper calls and full route scope are not bounded by the top-level count eight. Primary readers retain SECURITY DEFINER; the diagnostic executes as the existing connected postgres owner, without actor/session/key creation or claim impersonation. This is not nativeAPI/auth proof and grants no additional actor permissions. Existing shared helper catches policy exceptions canonically; a completed timing is not proof policies resolved.

Unchanged limits: lock2s,statement15s,idleintransaction30s. Eight measurements are within one DO statement, so its15s statement timeout covers the combined DO measurement work and metadata handling; other guard statements have their own15s limits. These are not a strict whole-operation clock budget. Any error/timeout stops operation; partial timings are not returned/promoted as PASS; independent catalog reconciliation and stop, no automatic retry/timeout escalation. No data/fixture/Auth/role assignment/schema/index/configuration writer, extra warm-up, repeat sample, concurrency load, new function/instrumentation/public payload field or full portfolio invocation.

## Capture / executable review
EXPLAIN options ANALYZE/BUFFERS/FORMATJSON,SUMMARYTRUE,TIMINGFALSE,VERBOSEFALSE. PostgreSQL17 documents that ANALYZE actually executes the query and that total statement execution time remains available with node TIMING OFF: https://www.postgresql.org/docs/17/sql-explain.html . Metadata capture uses fixed literal query strings via EXECUTE INTOjson; no user/data-driven SQL interpolation, no schema object created. One eight-iteration loop, one occurrence of each intended top-level call; all application function source/attributes/view guards are bound to the captured exact identities. SECURITY DEFINER bodies are not expanded or rewritten; their nested operator plans can remain opaque. Literal diagnostic wrappers may differ from cached internal candidate plans.

Only numeric planning/execution milliseconds, numeric root row/loop/buffer counters, node/function-scan counts and function-scan row/loop metadata are exported, plus fixed path/sample/operation labels. Raw EXPLAIN tree, filter text, function arguments, source rows, canonical/evidence JSON, Product names, commercial amounts, notes and acceptances are not returned. Route/commercial full results are internally consumed by EXPLAIN and discarded. Numeric type guards protect root counters/summary; raw node strings are never copied to output. One transaction-local `wp04.helper_diagnostic_result` custom setting carries this sanitized result to finalSELECT because the connector returns the last SELECT. It is explicitly local result transport, resets onROLLBACK, and is not persistent server configuration/business mutation. No additional plan/payload/temp-table dump or network credential step.

Independent primary-ChatGPT review separately examined call count, full consumption, constant SQL inputs, read-only source bodies including QC resolver, context/identity guards, JSONB comparisons, loop/capture structure, output allowlist and final rollback/readback boundaries. Static source closure/digest/statement/boundary checks pass. The new independent metadata readback compiled/executed successfully; **the diagnostic DO/full script was not compiled/executed**, and runtime success is not certified by static review. Local boundary-check patterns were refined to distinguish escaped literal SQL/signature strings from executable calls; no proposal SQL change or live measurement followed those check refinements. No testing harness/parser/environment installation.

Disposition: **ACCEPTABLE TO REQUEST ONE EXACT BOUNDED READ-ONLY DIAGNOSTIC AUTHORIZATION**, not implementation/deployment/fullG4 acceptance. This is real production read load, including route-wide resolution, so the reviewed WP04 plan explicitly requires new authorization despite no DDL. Earlier consumed permissions do not cover it.

## Interpretation / stop
Eight existing-helper wrapper observations cannot be added/subtracted into a measured8.17s phase breakdown or extrapolated into611/all-existing performance. Buffer figures include nested work and caching/measurement overhead, not pure wall-time causes. No cold/warm/p95/concurrency/allSKU/CSE/acceptance/payload/API/committedrollback proof waiver. Uncertain/inconclusive results stop for source/evidence disposition before any broader proof/optimization. No index, batch input helper, route rewrite, commercial-row selection, scope/target change or business-rule decision approved.

Exact next gate: **WP04-G4 — Explicit exact existing-helper diagnostic authorization**. If granted: fresh guards→one frozen execution→separate catalog readback→bounded evidence assessment→stop. If notgranted, execution remainsBLOCKED. G4 incomplete/applicationHOLD;G5blocked;programme4/13;WP03closed.

Workflow: measured-result review→exact diagnostic proposal/review COMPLETE→explicit authorization boundary.
WP progress:G0–G3retained;G4incomplete/applicationHOLD;G5blocked.
Programme progress:4of13.
Current gate:WP04-G4 — Exact read-only helper diagnostic reviewed, authorization pending.
Next:authorization decision; no operation until granted.
Parked:UX-P01/02,NAV-P01/02,CSE-P01,SEC-P01/02unchanged.
Locked:canonicalauthority/lifecycleseparation/governedLIVE-EXACT/failclosed/specialistownership/DEC-014preserved;WP03closed. No mainmerge/rebase/tag/release/spend/clientwork; unrelated draft preserved; WP04 stays thischat untilclosure/WP05new-chat handover.
