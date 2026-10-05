# SASV Master Data Governance, Product Lifecycle & Costing Suite UX Consolidation

## Authority
This directory is the durable workflow authority for this programme. Live Supabase state governs server reality; current Git main governs repository reality; approved programme documents govern workflow state; chat is supporting context.

## Business objective
Make Product/SKU creation and lifecycle governance complete, understandable and future-proof, while simplifying Product and Costing Suite information architecture without losing specialist capability.

## Problem statement
Product/SKU creation can leave downstream costing foundations incomplete or obscure. Costing correctly fails closed, but remediation is distributed and users must know hidden dependencies. Product and Costing launch surfaces have also accumulated specialised destinations requiring evidence-based rationalisation.

## Approved scope
Product/SKU lifecycle and completeness; costing-foundation dependency inventory; central readiness/remediation; Costing Suite rationalisation; Pricing Policy Manager; Product/Master Data and wider launcher IA; recurrence safeguards; UX consistency; regression/live proof and governance documentation.

## Non-goals
No guessed master data. No rewriting historical/effective-dated evidence. No weakening fail-closed costing. No wholesale visual redesign before architecture. No deletion/merger of modules without usage/dependency evidence. No e-Aushadhi changes.

## Architectural principles
- Supabase/server is authoritative for business rules, lifecycle contracts, effective dating, validation and governance.
- Client must not duplicate authoritative server logic.
- UNKNOWN is not READY; missing evidence stays incomplete; REVIEW_REQUIRED remains review; BLOCKED cannot be bypassed.
- Entity existence, operational activation, master-data completeness, costing-foundation completeness and costing readiness remain distinct until live evidence proves exact contracts.
- Completeness must be explicit and remediation guided.
- Historical evidence is immutable.
- Progressive disclosure keeps normal tasks prominent while specialist/audit detail remains reachable.

## Work-pack inventory
- [x] WP-1 — Repository Programme Control Plane
- [x] WP00 — Authoritative Current-State Inventory
- [x] WP01 — Canonical Product/SKU Completeness Contract
- [x] WP02 — Product + SKU Lifecycle Redesign — COMPLETED, VERIFIED, AND MERGED
- [x] WP03 — Creation-Time Guided Completeness — COMPLETED, VERIFIED, AND MERGED
- [~] WP04 — Central Master Data / Costing Readiness Control Centre
- [ ] WP05 — Costing Suite Functional Rationalisation Audit
- [ ] WP06 — Pricing Policy Manager Simplification
- [ ] WP07 — Costing Suite Navigation and Information Architecture
- [ ] WP08 — Product / Master Data Navigation Rationalisation
- [ ] WP09 — Wider Application Launcher/Section Audit
- [ ] WP10 — Governance Safeguards for Future Product/SKU Creation
- [ ] WP11 — UX Consistency and Visual Hardening
- [ ] WP12 — Regression, Live Proof and Governance Documentation

## Work-pack dependencies / delivery order
WP-1 → WP0 → WP1 → WP2–WP4 → WP5–WP7 → WP8–WP9 → WP10 → WP11–WP12. Later phases do not start because an attractive future idea appears.

## Programme status
IN PROGRESS

## Active work pack
WP04 — Central Master Data / Costing Readiness Control Centre. WP03 remains completed, verified, merged, and closed; no upstream regression was demonstrated.

## Active gate
WP04-G5 — OPENING BOUNDARY FROZEN / implementation NOT STARTED. WP04-G4 is COMPLETED AND VERIFIED: all server proof obligations are closed, accepted with measured limitation, or explicitly deferred under governance; committed C contract is active and verified. Native Auth/API runtime is mandatory G7 verification, not waived. Frozen/reviewed G5 client package exists; no Cursor/Codex implementation task has yet been issued.

## Overall completion progress
4 of 13 substantive work packs (WP00–WP12) are completed, verified, and merged where applicable. The prerequisite control plane, WP00, WP01, WP02, and WP03 are complete. WP02 merged to `main` as `7948551bd48e9ab6113e21df3a2cd98946a25362`; its final feature tip was `6247a7bccb862d679071f68843523156ce6e5cb3`. A subsequent e-Aushadhi-only merge advanced `main` without WP02 overlap. WP03-G1 audited `main` at `f22b36ca7077fcf70943112fb0aee6380af93e8d`. WP03 merged to `main` as `dd7da3a6fa2f447a71d92ca091f3d18921e32968`; its verified feature tip was `3894ce43798e4d9d919dfac54c8ab11aa7168733`.

## Major locked decisions
- Server-authoritative completeness.
- Operational Active does not automatically mean Costing Ready.
- Review states are not converted to Ready without evidence.
- No new top-level module until later IA audit proves it is required.
- No Product/Costing redesign before WP0 closes.
- WP01 readiness is multidimensional and server-authoritative; clients consume the canonical contract rather than recomputing it.
- Product detail is the Product/SKU lifecycle anchor; SKU master, activation and readiness remain separate.
- Product Master readiness uses LIVE_AS_OF only for an explicit server-governed period.
- Manage Products readiness visibility does not require granting Costing Control Center module access.
- WP04 G4 is closed with the committed C contract active; measured 6938.008 ms / 5084.304 ms full-611 performance is accepted with limitation, provisional 3s/5s goals remain UNMET/NON-BLOCKING, and genuine native Auth/API verification remains mandatory at G7 (DEC-015).

## Major unresolved blockers
No WP02 blocker remains, and WP03-G1 found no WP03 blocker. These findings stay parked for their assigned later work and do not reopen WP02 or WP03:

- UX-P02, remaining Manage Products aesthetic and interaction hardening: PARKED → WP11.
- Broader Product / Master Data navigation: PARKED → WP08.
- Commercial-sales LIVE_AS_OF row authority is ambiguous when multiple snapshot rows exist for one SKU/period. This stays in costing/commercial-sales evidence governance and is not solved.

## Immediate next action
WP04-G5 — client implementation may begin only from the frozen/reviewed WP-04-G5-CLIENT-PACKAGE.md under DEC-011. This checkpoint stops before handing work to Cursor/Codex. G6 independently audits the pushed implementation; G7 retains mandatory genuine signed-in native Auth/API permission verification and live performance/context/navigation checks; G8 handles explicit merge/post-merge closure.

## Server development operating model
ChatGPT owns server planning/review, direct implementation and live verification through Supabase. Server delivery is not gated on GitHub commits/PRs/merges or local CLI migration tooling. Reviewed high-risk packages, target/rollback safeguards, operation evidence and live verification remain required. Repository MD records workflow; optional SQL evidence is traceability, not a client-style server delivery gate. See DEC-014 and IMPLEMENTATION_RULES.

## Client development operating model
Routine bounded client work uses the repository autonomous gate model: ChatGPT freezes one complete work package; Cursor/Codex autonomously analyze, implement, test, self-review, fix, commit and push on an isolated task branch/worktree; ChatGPT audits the pushed GitHub implementation and may request one consolidated correction pass before explicit merge approval.

High-risk work retains a separate Plan → ChatGPT review → Implementation gate. Existing WP-specific plan gates remain valid when they involve architecture, authorization/permissions, database/schema/RPC contracts, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business rules, or security-sensitive behavior.

## 2026-10-05 — C-R01/C-R02 correctness correction V2 frozen and reviewed

New versioned `c-correctness-proposal-v2.sql` prepared without changing original C SQL/history. Final SHA-256 `3ed866cbfff9be29b251c17ddf163b12f159ee96cb70738b6e58d2919e15a69f`. C-R01 compares complete six-source selections across all 611 operational SKUs using extracted original point predicates versus C set-join predicates; zero readiness/canonical/core/portfolio calls. C-R02 uses eight pure-literal typed-composite cases for absent and present-null source boundaries, seven drivers and complete JSON; no persisted fixtures/live-row claim. Source review corrected three proposal-only defects before freezing and records PASS at source level; parser/runtime NOT_RUN. No Supabase operation occurred. G4 remains incomplete/application HOLD; G5 blocked; next boundary is fresh explicit digest-bound authorization or stop.

## 2026-10-05 — C correctness V2 single authorized attempt failed / readback clean

Fresh main/target/script/context/source guards passed. Exactly one authorized V2 attempt was made and failed with PostgreSQL 42702 because PL/pgSQL variable `n` conflicted with `source_counts.n` in C-R01. No retry. Frozen independent readback immediately afterward PASS: candidate_count0, all22definitions match, attributes/columns/event/textual callers match, idle transactions0. No production/source residue. V2 digest is consumed failed evidence; original C/history remain unchanged. G4 stays incomplete/application HOLD, G5 blocked. Next only a new versioned repository correction/review may be prepared; no new operation authorized.

## 2026-10-05 — C correctness V3 proposal frozen / source review PASS

Repository-only continuation after the consumed V2 failure. V3 SHA-256 `ccb961faac0192b2cd3bcc4fd52ac2da1489ccad10f000e0dd6820360cb80eca`. It removes the observed C-R01 PL/pgSQL/CTE `n` ambiguity by using `total_rows`, `source_row_count` and qualified `sc.source_row_count`; review also caught and corrected seven latent C-R02 bare `case_name` references to `r.case_name`. V2 remains immutable. Original C source/evidence unchanged. No Supabase execution occurred. G4 remains incomplete/application HOLD; G5 blocked. Current gate is explicit authorization for at most one V3 runtime attempt with separate independent readback.

## 2026-10-05 — C correctness V3 runtime PASS / exact readback platform-blocked

Fresh main/target/source/context/digest guards all passed. Exactly one V3 attempt ran and returned C-R01 PASS across 3666 comparisons (611 SKUs × 6 sources; zero mismatches/type/multiplicity failures) and C-R02 PASS across all 8 pure literal typed-record cases. No retry. The separately frozen independent readback was invoked immediately afterward but was blocked by the platform before reaching Supabase. A compact read-only critical reconciliation then PASS: candidate_count0, temporary assembler absent, canonical/enrich/run/shared/route/commercial identities match, idle WP04 transactions0. This is strong restoration evidence but not a full frozen independent-readback PASS. G4 remains incomplete/application HOLD; G5 blocked; no portfolio/performance/application/deployment/client work occurred.

## 2026-10-05 — Independent readback-only completion PASS

Prepared/froze/source-reviewed `c-independent-readback-completion.sql` at SHA-256 `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`. It is genuinely read-only (BEGIN READ ONLY; no DDL/DML/business/portfolio calls; final ROLLBACK) and does not reuse/reopen V3. Fresh main/target/key-source guards passed. Execution returned overall_pass=true: database/owner context, all22 frozen definitions, no definition mismatch, three-function owner/ACL/search_path attributes, all nine candidate absence, event-trigger fingerprint, six snapshot-table column fingerprint, run-evidence textual callers, and no idle WP04 transactions all PASS. Returned mutation_performed=false, v3_replayed=false, portfolio_invoked=false. The independent-readback evidence gap is therefore CLOSED. V3 remains consumed and must not be rerun. G4 remains incomplete/application HOLD only for other outstanding proofs; G5 blocked; programme 4/13.

## 2026-10-05 — CSE compatibility read-only proof PASS

Bounded source/catalog reassessment only. Live commercial resolver MD5 `68bd9325062299eb8af1291bf4d9393b` and underlying view MD5 `1327ae5236481295aff6aa27d311f440` match frozen C guards. Mechanical source comparison proves current canonical and frozen C private live core use the same exact `fn_resolve_sku_commercial_sales_basis_point(p_sku_id,v_period,v_val) limit 1` call; C adds no direct view query, alternate ORDER BY, batching or replacement commercial row-selection rule. Therefore CSE compatibility is PASS: C does not change commercial-sales authority. CSE-P01 remains parked and unresolved rather than waived. No business-function invocation, mutation, portfolio/performance work, application, deployment, G5 or client work occurred.

## 2026-10-05 — Payload / nonmonetary / monetary-note read-only audit PASS

Frozen C public readers/common core/enrich reviewed mechanically; no explicit monetary amount/cost-per/pool/allocation/sales-value/price/revenue/margin field is constructed into the candidate readiness response. Regional Marketing source view has monetary columns, but C projects only status/source/acceptance/evidence identifiers. Shared/global issues contain no monetary values, remarks, approval references or note field. Bounded Run115 note-content scan covered 5088 driver/control notes and 1272 selected-scheme resolution notes: zero currency-symbol hits and zero INR/Rs/rupee hits; generic cost/rate/pool/value words are explanatory status text, not amounts. Candidate portfolio source retains costing-control-center view check, but native Auth/API proof remains unresolved. This closes only the payload/nonmonetary/monetary-note obligation; no business RPC, portfolio, DDL/DML, performance, application, deployment, G5 or client work occurred.

## 2026-10-05 — Live no-success context read-only proof PASS

Read-only table/source proof only. Governed periods 2026-06-01/2026-06-30 and 2026-03-01/2026-03-31 have zero matching SUCCESS runs, providing real no-success contexts without fixtures. Live canonical source and frozen C source were compared mechanically. Both leave evidence run null when no matching SUCCESS exists; C public wrapper keeps shared issues empty unless a run exists, internal wrapper skips cohort load when run is null, common core skips control/enrichment and returns the base LIVE_AS_OF payload, and portfolio source uses an empty cohort input without synthesizing evidence. No readiness/candidate/portfolio/business RPC was executed. This closes only the live no-success compatibility obligation at source + real-context level; remaining G4 obligations include ALL_EXISTING/filter behavior, native Auth/API, full611 final-output parity, performance and committed deployment/rollback.

## 2026-10-05 — ALL_EXISTING / filter behavior read-only proof PASS

Current tables confirm 1793 ALL_EXISTING SKUs and 611 OPERATIONAL SKUs; operational membership fingerprint remains `eeba4bf20f54589fe5b037173a79ed82`. Frozen C source review confirms ALL_EXISTING includes every existing SKU, OPERATIONAL is Active Product + Active non-sample SKU, population is materialized before filters, and full statistics derive from the selected population before search/issue/page filtering. Filter validation/same-incidence witness/OR-within+AND-across/UNKNOWN retention/NOT_REQUIRED exclusion/literal Product-name substring + exact ID search/keyset pagination/matched vs returned counts all pass mechanically. No portfolio/canonical/helper/business function was invoked. This closes only ALL_EXISTING/filter behavior at source + live-membership level; remaining G4 obligations include native Auth/API, full611 final-output parity, performance and committed deployment/rollback.

## 2026-10-05 — Full-611 final-output parity authorization boundary

After closing ALL_EXISTING/filter behavior, reassessment found no remaining proof closable by read-only inspection alone. `c-full611-final-output-parity-proposal.sql` frozen at SHA-256 `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753`, source review PASS. It avoids 611 public canonical calls and portfolio invocation; instead it compares complete JSON for all 611 operational SKUs between the current original enrich/point-evidence path and C cohort-envelope/C enrich over the same reviewed common LIVE composition. It still creates five transaction-scoped proof functions and performs substantial reads in production; therefore fresh explicit authorization is required. No execution occurred.

## 2026-10-05 — Full-611 final-output parity attempt consumed / timeout / restoration PASS

Fresh main/target/script/source/context/membership guards all PASS. The single authorized execution of `c-full611-final-output-parity-proposal.sql` (SHA-256 `81e30181fb7f1958f2b75b218135f26de97b83ac86519e8d6c091ff6acdac753`) timed out with SQLSTATE57014 under the unchanged15s timeout while the original arm was in `fn_resolve_sales_allocation_default_policy_as_of` → `fn_resolve_sku_commercial_sales_basis_point` → `fn_wp04_old_live_core`. No retry and no timeout increase. Immediate read-only restoration verification returned overall_pass=true: all22 original definitions, attributes, columns, event fingerprint, textual callers and candidate absence clean; no idle WP04 transaction. Authorization is consumed. Full611 final-output parity remains NOT PROVED; no output mismatch is asserted. G4 incomplete/application HOLD; G5 blocked.

## 2026-10-05 — Full-611 compositional final-output semantic parity PASS

Repository-only reassessment/review after the consumed timeout established a safer proof method. C-R01 already proves all611×six changed input selections equal; C-R02 proves the typed projection boundary. Original run-evidence and C assembler scheme/regional CTEs and JSON composition tails normalize identically. Original and C enrichment transformations normalize identically after substituting equal evidence/shared values. Canonical LIVE base composition and C common LIVE base normalize identically after only the reviewed same-authority route-row delivery substitution; base JSON tail is exact. The unchanged commercial resolver call is textually identical and must not be duplicated as a parity oracle because CSE-P01's pre-existing unordered selection can create observational disagreement unrelated to C. Repository-only review therefore records full611 C-induced final-output semantic parity PASS compositionally. The prior runtime attempt remains consumed/timed-out/not black-box-proved/restoration-PASS/no-retry. Remaining G4 obligations: native Auth/API, performance and committed deployment/rollback.

## 2026-10-05 — Native Auth/API read-only preflight PASS

Current Supabase docs/access model, live catalog and frozen C source were reconciled without API execution or mutation. Canonical RPC is SECURITY DEFINER with authenticated execute and anon/PUBLIC denied. Candidate period/gap/portfolio readers each contain auth.uid refusal + costing-control-center view check, revoke PUBLIC/anon/service_role and grant authenticated only; no Manage Products fallback. Candidate readers remain absent and current main has no invocation of them. Existing permission/session aggregation found real session-bearing Control Center+Manage Products, Manage-Products-only and neither-permission users, so no fixtures are needed. However a genuine native API request runs through PostgREST on another connection and cannot see uncommitted transaction-local functions; native runtime proof therefore requires a temporarily committed candidate surface + genuine signed-in user sessions + explicit rollback, and remains NOT RUN. No credentials/tokens were read or exposed.

## 2026-10-05 — Native Auth/API conditional authorization prerequisite not met

Conditional authorization was not consumed. The required genuine signed-in client/PostgREST execution path is unavailable through the current connected tool surface without retrieving a user bearer token/session credential, which is explicitly prohibited. No temporary server surface was committed and no native request occurred. Native Auth/API structural preflight remains PASS; runtime behavior remains NOT RUN. Current main remains e421fe8df9b98b4956acdcd4cadeb36a3f9b923c. Remaining G4 obligations: native Auth/API runtime, repeatable performance, committed deployment/rollback.

## 2026-10-05 — Native runtime deferred to G7; G4 performance proof gate opened

Repository governance review confirms WP04-G7 is the explicit authenticated/live verification gate covering permissions and performance. Native Auth/API runtime proof is therefore deferred to G7, not waived: structural preflight stays PASS, runtime NOT RUN, conditional authorization NOT CONSUMED, no manual bearer/JWT use permitted; G7 failure blocks G8 closure. Performance remains a G4 feasibility requirement because the last corrected measured portfolio was ~8.17s against 3s/5s goals and C is unmeasured. Frozen `c-repeatable-performance-proposal.sql` SHA-256 `bfcc9176b7745fb4e2e6ef0cbe357bba16c917c3d47ec7633d96a812c7c5a75f`: exact C package, two OPERATIONAL limit1/full611 observations, unchanged15s timeout, no COMMIT, final ROLLBACK, aggregate metrics only. Source review PASS; execution requires fresh explicit authorization. Committed deployment/rollback remains unresolved after performance.

## 2026-10-05 — C repeatable performance feasibility NOT MET / restoration PASS

Authorized script `c-repeatable-performance-proposal.sql` SHA-256 `bfcc9176b7745fb4e2e6ef0cbe357bba16c917c3d47ec7633d96a812c7c5a75f` executed exactly once after fresh main/source/context/membership/digest guards passed. Exactly two OPERATIONAL limit1 calls (full611 statistics) completed: 6938.008ms and 5084.304ms; response size 14491 bytes each; matched611/returned1/severity-total611. Both >5s and >3s, so feasibility goal NOT MET. No timeout increase, no retry, no target relaxation. Immediate independent readback returned overall_pass=true; all22 originals/attributes/columns/event/callers clean, candidates absent, idle tx0. Authorization consumed. Native runtime remains deferred to G7. Committed deployment/rollback remains blocked behind performance disposition; no G5/client work.

## 2026-10-05 — Bounded performance-feasibility disposition recommendation

Source-only analysis confirms remaining avoidable orchestration (full assessment JSON serialize/reparse, repeated aggregate scans) but no evidence it can reliably remove the ~1.94s needed from the slower6.938s run. Route readiness remains a demonstrated ~1.82s once-per-response cost but further reduction requires a subset-aware/specialist route contract redesign. The dominant invariant is synchronous full canonical readiness+statistics for all611 before readiness filters/page. Repository G1 explicitly defines <=3s page/<=5s statistics as provisional engineering goals, not approved SLAs, and permits measured target/scope review. Recommendation: Option2 — accept measured C performance as feasible for WP04, record targets UNMET/NON-BLOCKING, retain final signed-in/live performance at G7, and move deeper route/page-statistics/cache/materialization work to a separate architectural decision/work item. Recommendation only; threshold/gate not changed until explicitly accepted.

## 2026-10-05 — WP04-G4 performance disposition accepted

Programme authority accepted server performance feasibility as **ACCEPTED WITH MEASURED LIMITATION**. Exact retained observations: 6938.008ms and 5084.304ms, both OPERATIONAL/full611/full-statistics and both above provisional3s/5s engineering goals. Goals remain UNMET and must never be represented as passed. Restoration PASS; consumed performance authorization remains consumed. The targets are non-blocking engineering targets for WP04, not approved SLAs or locked business acceptance requirements. No further speculative G4 optimization is permitted. Caching/materialization/page-statistics separation/precomputation/route-contract redesign deferred to a future architectural decision/work item. G7 retains mandatory signed-in/live performance verification. Next G4 server gate is committed deployment/rollback only.

## 2026-10-05 — Final G4 server gate: committed deployment/rollback authorization pending

Performance disposition accepted with measured limitation. Exact permanent C deployment, rollback and independent verification artifacts are frozen/source-reviewed. Deployment SHA-256 `cfc07ee0a731e11ba57e12d2edd3dea58c22bc05fc42c50446c9032a6132da12`; rollback `38024dab44f4bb513588142437e2f360fc90f35e4beb17437e3266faaa008d88`; post-deploy verification `35aba23abc2409a8c1bc9b434fbb36c337302e4883e1e4c1f811dff72b29658e`; old-state readback `42ff34e909251f22938dbb971a65d232cdc9938cd3d2dcb643092e63c620fc02`. Both committed scripts are exact reviewed source derivations with only final ROLLBACK→COMMIT. Recommendation: one committed deployment attempt, independent verification, and only on verification failure one exact conditional rollback attempt + old-state readback. No production execution yet; G5/native G7 work not included.

## 2026-10-05 — Committed C deployment PASS / rollback not triggered

Fresh authorized main/digest/source/ACL/attribute/candidate/context/membership/event/column/caller guards all PASS; pre-deployment old-state independent readback overall_pass=true. `c-committed-deployment.sql` executed exactly once and COMMIT succeeded. Immediate read-only `c-post-deployment-verification.sql` PASS: exact candidate identity, governed-period reader, Product-gap reader, canonical single-read and one OPERATIONAL/full611 functional smoke all PASS; native API remains deferred to G7; performance goal remains UNMET_NON_BLOCKING; business_mutation=false. Conditional committed rollback was not triggered and is NOT CONSUMED. No G5/client/merge/release/native-JWT/performance-redesign activity occurred. Deployed C server contract is now active production state.

## 2026-10-05 — G4 formally closed; G5 opening package frozen

G4 acceptance reconciliation PASS. Closed/accepted evidence includes C-R01/C-R02, independent readback, CSE compatibility, payload/nonmonetary/notes, live no-success, ALL_EXISTING/filter, compositional full611 semantic parity, accepted measured performance limitation, and committed C deployment/post-deployment verification. Native Auth/API runtime remains explicitly deferred to mandatory G7 signed-in verification; this is governance deferral, not PASS/waiver. No unresolved blocker prevents G5. G4 is marked COMPLETED AND VERIFIED. G5 client package and independent review are frozen; implementation is not started. Programme completion remains 4/13 because WP04 itself remains in progress through G5–G8.

## 2026-10-05 — WP04-G5 implementation handoff issued

Exact frozen G5 package was issued as GitHub issue #43 against main `e421fe8df9b98b4956acdcd4cadeb36a3f9b923c`, preserving DEC-011/014/015 and all G4 locks. Package/review blob identities are pinned. No Cursor/Codex launch action is available through the current connector, so no implementation branch/edit/push is claimed yet. G5 remains pending external Cursor/Codex execution. After a branch is pushed, ChatGPT must audit the actual GitHub implementation before any merge decision. G6/G7/merge/release remain not started.

## 2026-10-05 — WP04-G5 branch audit: correction pass required

Independent audit of pushed `feat/wp04-g5-portfolio-readiness` head `43a21b4ba7fa0acc8f314466c06960770478434a` confirms clean scope/base but identifies one consolidated in-scope client hardening pass before acceptance: fail-closed strict response-envelope validation, server-authoritative severity filter options, and exactly one visible readiness search source, with strengthened smoke coverage. Stale cache-pin failures are pre-existing and not G5 regressions. Correction request is pinned to issue #43. No merge/G6/G7/release started; await corrected branch then re-audit.
