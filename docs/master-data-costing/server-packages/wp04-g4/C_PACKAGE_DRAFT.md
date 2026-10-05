# WP04-G4 — Exact unapplied C snapshot-cohort package

2026-10-05. DRAFT PREPARED / INDEPENDENT EXACT REVIEW PENDING. No execution or application authorization.

Target `qhmoqtxpeasamtlxaoak`; main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`; input audit `d108ea764891a1eea9ff770262a5ac0f0893ad6b`. Fresh fetch matched both refs. DEC-014 unchanged; server work remains ChatGPT-owned. G0–G3 retained, G4 incomplete/application HOLD, G5 blocked, programme 4/13.

## What the draft changes

The six allocation inputs are left-joined to one distinct SKU cohort. One typed-row assembler retains the original scheme/regional queries and complete evidence JSON composition. Both the original point run-evidence helper and the cohort path use it. Missing/null keys remain anchor rows; null/empty arrays return no cohort rows. Period, valuation and run equality predicates remain on every join. No JSON map uses a null SKU as a key.

The portfolio assesses the same full population, once per SKU, with a materialized evidence relation. Canonical single-SKU LIVE_AS_OF uses a singleton cohort through a private wrapper. The copied canonical composition in the private prefetched core differs only at the final enrichment call. Exact public canonical/EXACT_RUN branch text, existing enrich entry point, period and gap reader bodies remain identical to accepted A/B source. The changed historical helper dependency still requires runtime parity.

This is **12 reviewed candidate definitions**, comprising **three existing replacements** and **nine absent candidate functions**. These are not twelve newly invented business authorities. The public readers are the existing unapplied WP04 package; this correction adds four private helpers. Exact identities are in c-package-identities.json.

| Existing replacement | Restoration |
| --- | --- |
| public.rpc_get_product_sku_readiness(bigint,date,text,bigint) | Exact captured live definition and unchanged ACL |
| costing.fn_product_sku_readiness_enrich(jsonb,bigint,date,date,bigint) | Exact captured live definition and unchanged ACL |
| costing.fn_product_sku_readiness_run_evidence(bigint,date,date,bigint) | Newly expanded replacement scope; exact captured live definition and unchanged ACL |

Four added private functions: fn_wp04_c_run_assemble, fn_wp04_c_run_cohort, fn_wp04_c_enrich and fn_wp04_c_live_core. The five previous candidate functions remain. All new private functions are owner-only; the same three candidate public readers retain authenticated execution plus their existing in-body permission checks. No new permission/module/route mapping, table, view, index, cache, job, specialist writer or client logic.

## Fresh evidence and guard boundary

c-source-before.json records a read-only catalog capture: 22 function definitions, three view identities, six valid/ready unique run/SKU indexes, snapshot composite column types/order/nullability, event-trigger fingerprint and textual caller inventory. All 20 previously captured helper identities match. Existing canonical/enrich/run-evidence definitions match frozen originals. Candidate count zero. Only captured textual caller of the original run-evidence helper is existing enrich; textual inventory is not exhaustive proof against dynamic/external callers.

Separate bounded table-only context inspection matched September valuation 2026-09-10, SUCCESS115, EXACT114, 611 operational SKUs/460 Products, firstSKU1 and membership fingerprint eeba4bf20f54589fe5b037173a79ed82. No canonical/readiness/helper/portfolio execution occurred in preparation. These inspections are not application or runtime proof.

Forward preconditions bind original definitions/owners/ACLs, candidate names, views, index definitions, complete captured column shape, textual callers and event state. Candidate postconditions and rollback preconditions bind all 12 bodies/signatures/argument names/defaults/types/output modes/settings/ACLs/attributes. Rollback restores originals before dropping dependent candidates in reverse order; no CASCADE. Final ROLLBACK remains in every draft. Source/ACL identity is not a claim of committed rollback proof.

## Exact correctness proposal — NOT AUTHORIZED / NOT RUN

c-correctness-proposal.sql contains one repeatable-read transaction, lock timeout2s, statement timeout15s, idle timeout30s, no COMMIT, final ROLLBACK. It captures originals, temporarily defines the C package, checks bounded parity/refusals, restores exact originals and emits only bounded result metadata. Baseline GUCs are transaction-local proof comparison storage, not production evidence authority. SQL actor claim is not native Auth/API proof.

| Explicit top-level business calls | Proposed count |
| --- | --- |
| Successful canonical reads: original5 + C5 | 10 |
| Expected missing-SKU canonical refusals: original1 + C1 | 2 |
| Point run-evidence helper: original12 + C12 | 24 |
| Direct cohort calls: three-SKU, duplicate/null/missing, empty, null array | 4 |
| Prefetched canonical core with captured cohort evidence | 3 |
| Invalid envelope/context/coverage calls, expected refusal | 6 |
| Direct full route map / shared global helper | 1 / 1 |
| Portfolio / hidden611 old point evaluations | 0 / 0 |

Counts describe top-level calls, not nested reads. Each cohort row invokes the assembler and unchanged scheme/regional queries; canonical paths invoke their ordinary dependencies. The fixed proof is not a performance benchmark. Null/SKU/period/valuation/run, missing SKU/run and context mismatch cases compare complete helper JSON. Five canonical cases retain LIVE1/11/1795 and EXACT11@114/115; three prefetched core cases compare full JSON independently of the singleton path. Seven ordered driver dependencies and context are validated before accepting internal prefetch; no silent fallback query or success-as-UNKNOWN for malformed input.

The separate c-independent-readback.sql checks all 22 originals, three replacement attributes, candidate absence by name (including overloads), column/caller/event state and idle WP04 transactions. It must run independently after any authorized attempt, including failure/timeout; unexpected errors abort, with no automatic retry.

## Preparation checks and limits

Structural checks PASS: 12 definitions/three exact restores; original scheme/regional/driver composition tail byte-identical; private core body changed only at enrichment call; public canonical/enrich/period/gap bodies equal accepted A/B source; all forward/restore bodies exact embeds; one outer transaction/no COMMIT/final ROLLBACK; zero portfolio calls; manifest hashes match. These are source identity checks, not a database compiler or implementation acceptance. SQL parser and runtime compilation NOT_RUN.

The correctness proposal does **not** prove all611 final outputs, a live no-success context, present-null-status fixture parity, native API access, complete payload/monetary notes, filter/all-existing behavior, repeatable latency, or committed deployment rollback. These remain explicit proof/disposition gaps. No fixture creation or new infrastructure is proposed. Additional private wrappers may slow point reads; set-wise retrieval may retain indexed probes and per-SKU composition cost. No speed guarantee or point-path performance acceptance.

No new performance operation script is frozen: first exact correctness-package review/disposition, then a separate reviewed performance proposal if justified. No timeout increase, target relaxation, retry, route refactor, commercial row selection, index or automatic wider optimization.

## Exact next gate

WP04-G4 — Independent exact C source/rollback/security/correctness-proof review. Review must assess the expanded run-helper scope, typed interfaces, total proof load, source dependency/caller coverage, null semantics and remaining proof gaps. It may require bounded corrections or reject the package; source preparation is not acceptance. Only after an accepted exact proposal may a specific fresh production authorization be requested. G4 incomplete; G5 blocked; WP03 closed; parked/locked rules and mandatory formal-closure WP05 new-chat handover unchanged.
