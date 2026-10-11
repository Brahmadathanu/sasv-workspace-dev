# E-AUSHADHI AUTOMATION — DECISION REGISTER

## DEC-001 — Server-first authority
**Status:** ACTIVE  
The server is the authoritative preparation/governance layer. Portal execution consumes verified server data.

## DEC-002 — ChatGPT architect / Cursor-Codex worker boundary
**Status:** ACTIVE / WORKFLOW DETAIL SUPERSEDED BY DEC-020  
ChatGPT owns architecture and all server/database planning/implementation. Cursor/Codex perform client implementation only within ChatGPT-frozen scope. The former requirement for a separate plan-audit step on every client task is superseded by DEC-020.

## DEC-003 — Architect-Controlled Parallelism
**Status:** ACTIVE  
Parallel execution is allowed only for independent, frozen contracts. Cursor/Codex may not implement YELLOW/unresolved architecture.

## DEC-004 — Colleague rollout deferred
**Status:** ACTIVE  
Production colleagues will not perform data entry, verification, attachment upload, or portal coordination until WP-09 opens after pipeline operational acceptance.

## DEC-005 — Canonical terminology is independent of portal nomenclature
**Status:** ACTIVE  
Canonical terms remain the reusable SASV knowledge layer. e-Aushadhi labels/values are governed projections. Future Therapeutic Guide work will consume canonical data, not portal terms.

## DEC-006 — Reference governance is global
**Status:** ACTIVE  
Raw source reference → global controlled-term alias → canonical REFERENCE_WORK → global term_portal_mapping → e-Aushadhi REFERENCE option. No product/ingredient-specific Reference approval.

## DEC-007 — Portal stages are independently tracked
**Status:** ACTIVE  
Product Details, Composition, and QC Register each have their own readiness/execution/verification state. Overall completion is derived from all required stages and documents.

## DEC-008 — Proprietary document readiness
**Status:** ACTIVE / TO BE FORMALIZED IN WP-03  
A proprietary product must not be treated as overall-ready merely because Product Details is portal-verified. Required license approval and additional shelf-life supporting document(s) must be represented by the dossier/readiness contract.

## DEC-009 — Repository documentation is continuity authority
**Status:** ACTIVE  
MASTER_PROGRAMME, IMPLEMENTATION_RULES, work-pack documents, decision register, and parked backlog are authoritative continuity records across conversation limits.

## DEC-010 — Work-pack closure handover
**Status:** ACTIVE  
Every work-pack chat concludes with repository tracking updates plus a self-contained handover prompt for the next work-pack chat, then stops.

## DEC-011 — Non-blocking enhancements are parked
**Status:** ACTIVE  
Non-blocking improvements are moved to WP-11/PARKED_BACKLOG rather than expanding the active work pack.

## DEC-012 — Colleague-facing UX threshold
**Status:** ACTIVE  
The workflow must be operationally usable before WP-09. Cosmetic/value-add refinements that do not block safe/efficient operation may remain for WP-10/WP-11.

## DEC-013 — Composition READY is a server contract
**Status:** ACTIVE  
WP-05 Composition READY v1 is the sole server-to-WP-06 input boundary. A portal row or portal stage status cannot make an unready server line authoritative. READY requires VERIFIED governed line data, valid selected portal projections, global Reference readiness, blocker-free state, current version authority and a fresh server-generated execution snapshot/hash.

## DEC-014 — Verified Composition corrections are lifecycle-specific
**Status:** ACTIVE  
A VERIFIED Composition line stays locked against ordinary editing. Before portal entry starts, correction uses the governed Reopen path. After entry starts, ordinary Reopen is unavailable and only an explicitly authorized post-entry reconciliation path may correct the bounded governed projection. Reconciliation preserves VERIFIED status, records before/after audit evidence and increments version authority.

## DEC-015 — Composition portal mutations require an explicit WP-06 gate
**Status:** ACTIVE  
Portal evidence gathering and a controlled bootstrap do not create standing permission to continue portal mutation. Every further Composition Save must be explicitly opened by WP-06 under fresh server governance, durable run/progress evidence, exact page/list classification, at-most-once mutation and native reread/semantic proof.

## DEC-016 — No client-side execution hash authority
**Status:** ACTIVE  
The authoritative Composition execution hash is server-generated. Effective Reference portal value and governed Ingredient Form changes participate in `content_hash`. Client JavaScript must not calculate or substitute an execution hash.

## DEC-017 — Composition execution lifecycle is stage-specific
**Status:** ACTIVE  
The existing `eaushadhi_worker_run` and product-level `entry_status` lifecycle is Product Details execution authority and must not be reused for Composition. WP-06 owns an independent Composition-stage state and Composition-run model so Product Details, Composition and QC remain independently auditable.

## DEC-018 — One Composition run authorizes one Save target
**Status:** ACTIVE  
A Composition run binds exactly one missing governed source line and one fresh content hash. Only durable `SAVE_ARMED` server state authorizes the trusted executor to issue at most one native Save. Save uncertainty is recorded as AMBIGUOUS and never auto-retried.

## DEC-019 — Composition row verification precedes final stage verification
**Status:** ACTIVE  
A successful/ambiguous Save does not itself complete the line or stage. Fresh complete list evidence, bounded row identity, native reread and exact semantic comparison must prove the target row before the run becomes ROW_VERIFIED. Composition stage becomes PORTAL_VERIFIED only through a separate final exact-set proof with no active run.

## 2026-09-25 — WP-02 Global Terminology Governance closed
- Accepted the consolidated source-centric Reference Dictionary and two-stage review modal.
- Verified global alias 1: `Sahasrayōgam - Sujanapriya → Sahasrayōgam`.
- Verified shared portal mapping 28: `Sahasrayōgam → Sahasrayoga / 28`.
- Independently proved inherited readiness for all 1,477 Sujanapriya lines across 85 products.
- Kept alias 2 `Sahasrayōgam - Vaidyapriya` DRAFT; its 32 lines across 10 products remain not ready, proving source aliases remain independently governed.
- Proved Product 262 / Karpooradi Thailam lines 929–931 are Reference-ready without per-line Reference edits.
- Composition live execution remained disarmed.

## 2026-09-27 — Product 262 Composition governance reconciliation
- Re-audited effective Reference content-hash participation and preserved server-only hash authority.
- Proved native Composition list/reread/save, hidden row identity, unit/value and Reference-value semantics through the controlled Karpooradi bootstrap.
- Added and repository-versioned the bounded Product-262 post-entry Ingredient Form reconciliation RPC.
- Added lifecycle-aware client reconciliation UI and hardened VERIFIED Composition ordinary-field locking.
- Reconciled and audited line 929 Ajamōdā from AS PER TEXT / 2 to LIQUID KWATH / 60.
- Reconciled and audited line 930 Karpūra from AS PER TEXT / 2 to SOLID / 66.
- Reconciled and audited line 931 Kēram from AS PER TEXT / 2 to OIL / 61.
- Final line row_versions are 8/8/8; product workflow row_version is 11 and remains PORTAL_VERIFIED.
- Live portal Composition remains intentionally partial with only the Ajamōdā bootstrap row.
- No further Composition portal mutation is authorized until WP-06 explicitly opens the next durable execution gate.

## 2026-09-27 — WP-06 Composition execution lifecycle frozen
- Audited the existing worker lifecycle and confirmed it is coupled to Product Details product-level `entry_status`; Product 262 already has a historical PORTAL_VERIFIED Product Details run.
- Rejected reuse of that lifecycle for Composition to preserve independent portal-stage state.
- Frozen a Composition-specific stage state plus one-target-per-run lifecycle.
- Frozen durable states SAVE_ARMED, SAVE_CONFIRMED, SAVE_AMBIGUOUS, SAVE_REJECTED and ROW_VERIFIED.
- Frozen the one-save-at-most-once rule, no automatic retry after uncertainty, and separate final exact-set PORTAL_VERIFIED proof.
- Kept Composition live arm OFF pending server foundation implementation and audit.


## 2026-09-27 — WP-06 Composition server lifecycle foundation implemented
- Deployed independent `regulatory.eaushadhi_composition_stage` and `regulatory.eaushadhi_composition_run` tables.
- Deployed read-only Composition execution preflight plus bounded arm, Save-outcome, row-verification and final-stage verification RPCs.
- V1 remains restricted to Product 262 and derives target projection from fresh server authority.
- Hardened arm evidence to require exact portal identity and bind planner counts to the exact list evidence.
- Hardened row verification to require explicit native reread success, exact row identity, current governed target semantics and planner/list count agreement.
- Hardened final exact-set verification and preserved the previous stage status in audit evidence.
- Active-run uniqueness permits at most one SAVE_ARMED/SAVE_CONFIRMED/SAVE_AMBIGUOUS run per product.
- Product Details workflow remains independent and unchanged; Product 262 stays PORTAL_VERIFIED at workflow row_version 11.
- No Product 262 Composition stage/run row was instantiated during deployment; no SAVE_ARMED authority or portal mutation occurred.
- Repository migrations exactly version the live foundation and hardening migrations.
- Composition live arm remains OFF; next gate is trusted executor/adapters and client orchestration.


## 2026-09-29 — WP-06 trusted Composition executor merged
- Implemented dedicated Composition executor, live adapters, bounded native normalizer, IPC/preload/client orchestration and read-only UI projection.
- Preserved one canonical `COMPOSITION_LIVE_ARM_DEFAULT=false` authority; environment `"true"` alone cannot arm execution.
- Corrected the native portal contract during independent audit: the page mutation function is `SaveData()`, while `/admin/SaveCompositionData` is the HTTP endpoint it calls.
- Trusted request/response observers are installed before the one allowed `SaveData()` invocation; CONFIRMED requires exactly one matching POST, settled HTTP success, parsed bounded JSON and business `status == "1"`.
- Local native validation rejection with no matching request is REJECTED; invoked uncertainty remains AMBIGUOUS and is never auto-retried.
- Exact ADD mode is required before invocation; update/delete remain prohibited.
- Interrupted SAVE_ARMED recovery is read-only and deterministic: exact-present → AMBIGUOUS then verification; conclusively absent → REJECTED; uncertain/conflicting → AMBIGUOUS and stop.
- Feature commits: `462e2174aff55829b8318c104edebb7c3df5c84d`, correction `e5d96452c80bd384710317afedb0c412a6f99599`; merged at `3611cb29e8166bfcf924c7c01aa59229b2128720`.
- Post-merge live audit confirmed Product 262 workflow still PORTAL_VERIFIED at row_version 11 with zero Composition stage rows and zero Composition run rows.
- Next gate is controlled runtime/read-only acceptance with live mutation still disarmed; no Karpūra/Kēram portal entry is yet authorized.


## 2026-10-02 — WP-06 first-live line-930 attempt safely rejected
- The first controlled Product 262 / line 930 attempt created durable `SAVE_ARMED` authority, then failed immediately because `buildCompositionTrustedDeps()` omitted the executor-required `recheckMutationIdentity` adapter bridge.
- The failure occurred before field fill and before `SaveData`; no Composition portal mutation occurred.
- Trusted recovery captured a fresh complete portal list, proved line 930 absent, and changed the original run to `SAVE_REJECTED` with outcome `REJECTED`. No replacement run was created.
- Product Details remains `PORTAL_VERIFIED` at workflow row_version 11. Composition remains `PARTIAL` at stage row_version 3.
- Portal evidence remains matched `[929]`, missing `[930,931]`; neither Karpūra nor Kēram has been entered.
- The trusted dependency wiring correction requires independent audit before another controlled line 930 attempt.

## DEC-020 — Autonomous gate-based client implementation
**Status:** ACTIVE  
Routine bounded client work no longer requires a separate ChatGPT approval between analysis/plan and implementation. After ChatGPT freezes one complete bounded work package, Cursor/Codex may autonomously analyze internally, implement, run targeted checks/tests, self-review, fix issues found, rerun checks, commit, push the dedicated task branch, and report completion. ChatGPT then audits the actual pushed GitHub implementation, may issue one consolidated correction pass if necessary, performs final verification, and explicitly authorizes merge/cleanup.

High-risk work retains a separate Plan → ChatGPT review → Implementation gate. High-risk includes architecture changes, database/schema/RPC contract changes, authentication or permissions, production-data mutation risk, destructive operations, major cross-module refactoring, unclear business-rule decisions, and security-sensitive behavior.

Cursor/Codex stops for human guidance only for genuine ambiguity, materially different business/UX choices, undocumented backend-contract invention, production/security risk, material scope broadening, business-rule contradictions, genuinely judgmental visual/UX choices, merge to main, or version/tag/release/publishing.

Dedicated task branches/worktrees, no direct implementation on main, server authority, existing design language, no unrelated refactoring, no invented backend objects/routes/contracts, targeted verification, and explicit merge/release approval remain mandatory.
## 2026-10-02 — WP-06 read-only acceptance and closed first-live gate
- Controlled read-only runtime acceptance passed on merged baseline `80c2f9e20c1226faf10036405e24048434c28b23` with matched `[929]` and missing `[930,931]`.
- Implemented bounded Product 262 / source line 930 Karpūra first-live safety architecture, including dependent-option readiness, final trusted reread and durable no-mutation rejection closure.
- Production mutation remains impossible: `COMPOSITION_LIVE_ARM_DEFAULT=false` and `COMPOSITION_FIRST_LIVE_930_RELEASE=false`; environment `"true"` alone cannot arm execution.
- No Composition mutation occurred. Kēram line 931, Composition-stage verification, QC Register and final Submit remain excluded.

## 2026-10-02 — WP-06 first-live line-930 release gate opened
- Closed-gate pre-live acceptance passed on baseline `2ad4b80b8b8ed711edc97daa3855d9e7f0727a89` without portal mutation.
- The reviewed Product 262 / source line 930 release constant is intentionally open while `COMPOSITION_LIVE_ARM_DEFAULT=false` remains unchanged.
- Production mutation still requires the separate exact runtime environment arm and explicit operator confirmation. No Karpūra portal Save has occurred.
- The next gate is one explicitly authorized controlled Karpūra run. Kēram line 931, Composition-stage verification, QC Register and final Submit remain excluded.

## 2026-10-03 — WP-06 native Composition fill-order correction
- The post-arm `recheckMutationIdentity` production wiring correction passed exact-main preflight.
- A subsequent controlled Product 262 / line 930 execution reached native fill, but final pre-Save verification proved Ingredient Type 1 had cleared Ingredient Name and Botanical Name. `SaveData` was not invoked, and the run closed durably as `SAVE_REJECTED` with no-mutation proof.
- Native investigation proved Type 1 explicitly clears both text fields and then rebuilds Reference; diagnosis: `FILL_ORDER_RESET`.
- The adapter now selects Type, waits for Reference option readiness, selects Reference, and only then writes the two governed text values. Final exact pre-Save verification remains unchanged.
- Product Details remains `PORTAL_VERIFIED` at workflow row_version 11. Composition remains `PARTIAL` at stage row_version 7 with portal match count 1; three historical line 930 runs are `SAVE_REJECTED`, and no active run exists.
- Portal state remains matched `[929]`, missing `[930,931]`; Karpūra and Kēram remain absent.
- The next gate is independent audit and merge, followed by a short exact-main no-mutation preflight before any further controlled line 930 execution.
- RLS hardening for the three previously identified regulatory tables remains a separate parked security audit.

## 2026-10-03 — WP-06 Karpūra ROW_VERIFIED and Phase-2 line-931 client gate
- Controlled Product 262 / source line 930 Karpūra completed durably as `ROW_VERIFIED` with save outcome `CONFIRMED` after the corrected native fill order.
- Current live Composition state: `PARTIAL` at stage row_version 10, portal match count 2, matched `[929,930]`, missing `[931]`; historical line-930 runs are three `SAVE_REJECTED` plus one `ROW_VERIFIED`; no active run exists. Kēram remains unentered.
- Server Phase-2 predecessor guard migration `20261003153637_eaushadhi_composition_line931_phase2_predecessor_guard.sql` is merged/live and exposes bounded preflight `phase2_line_931` authority.
- Client first-live line-930 release is closed (`COMPOSITION_FIRST_LIVE_930_RELEASE=false`). Controlled Phase-2 release opens only Product 262 / line 931 (`COMPOSITION_CONTROLLED_PHASE2_931_RELEASE=true`) when server `server_gate_ready` and the exact planner partition are both proven, with exact env `"true"` and explicit confirmation. Stage verification remains disabled.
- No Kēram portal mutation occurred in the client transition. Next gate: independent audit/merge, then short exact-main line-931 preflight. RLS hardening remains a separate parked security audit.


## 2026-10-04 — WP-06 exact-main final-stage preflight PASS
- Final-stage client activation was independently audited and merged at `01ce609df1ca7dc2082a6ecc81e877b1cb15c1d0`.
- Exact-main final-stage Preview passed with planner `ALREADY_COMPLETE`, governed/portal/match `3/3/3`, exact matched source IDs `[929,930,931]`, missing `[]`, and zero conflicts/duplicates/extras/blockers.
- `finalStageVerifyEligible=true` and `stageVerifyEnabled=true`; row-entry eligibility is closed and no line-entry action is available because the missing set is empty.
- Product 262 Composition remains `PARTIAL` at stage row_version 13 with no active run; Product Details remains `PORTAL_VERIFIED` at workflow row_version 11.
- The preflight performed no `composition-verify-stage`, no `markStageVerified`, no SaveData, no run arm, no record/verify-row call, and no portal or Supabase lifecycle mutation.
- Next gate: one explicitly confirmed server-side `PARTIAL → PORTAL_VERIFIED` transition after a fresh exact-set recollection. QC Register and final Submit remain excluded.

## 2026-10-04 — WP-06 Kēram ROW_VERIFIED and final-stage client activation
- Controlled Product 262 / source line 931 Kēram completed durably as `ROW_VERIFIED` with save outcome `CONFIRMED`.
- Current live Composition state: still `PARTIAL` at stage row_version 13; `governed_line_count` 3; `portal_match_count` 3; matched `[929,930,931]`; missing `[]`; five historical Composition runs; no active run. Product Details remains `PORTAL_VERIFIED` at workflow row_version 11.
- Server final-stage PARTIAL-only guard migration `20261004105934_eaushadhi_composition_final_stage_partial_guard.sql` is merged/live; `rpc_eaushadhi_composition_stage_mark_portal_verified` requires current `stage_status = PARTIAL` before any `PORTAL_VERIFIED` transition.
- Client final-stage activation exposes distinct Preview `finalStageVerifyEligible` / `stageVerifyEnabled`, a dedicated confirmation modal, and the existing bounded `verifyCompositionStage` path. It does **not** require `EAUSHADHI_COMPOSITION_LIVE_ARM` and performs no portal Save/Update/Delete.
- Composition-stage `PORTAL_VERIFIED` has **not** been executed. Next gate: independent audit/merge of the final-stage client activation, then short exact-main final-stage preflight. QC Register and final Submit remain excluded.


## 2026-10-04 — WP-06 Composition stage PORTAL_VERIFIED
- Product 262 / Karpooradi Thailam final Composition-stage verification completed successfully after a fresh exact-set recollection.
- Fresh planner authority was `ALREADY_COMPLETE` with governed/portal/match `3/3/3`, exact matched IDs `[929,930,931]`, missing `[]`, and zero conflicts/duplicates/extras/blockers.
- Composition stage transitioned durably from `PARTIAL` row_version 13 to `PORTAL_VERIFIED` row_version 14; workflow row_version remained 11; `portal_verified_at` is present.
- Latest stage evidence is `STAGE_PORTAL_VERIFIED`, and the audit trail contains `COMPOSITION_STAGE_PORTAL_VERIFIED` for Product 262.
- No Government portal row mutation occurred during final-stage verification: no SaveData, SaveCompositionData POST, run_arm, record_save, verify_row, Update or Delete. Historical Composition run count remains five and all prior run statuses are unchanged.
- Next gate: representative regression, then WP-06 closure audit. QC Register and final Submit remain excluded.


## 2026-10-04 — WP-06 CLOSED
- Representative regression passed on authoritative main `c719dacff9d8031ece3a892333db83d25bf164fd`: Composition executor/live-adapter/contract/offline-plan/review-control/worker-client syntax checks passed; Composition execution, offline planner, worker contract, IPC and review-RPC smoke suites passed.
- Regression preserved missing-row, one-save, rejection/ambiguous/recovery, row-verification and exact-set final-stage contracts. Completed Product 262 is fail-closed against further WP-06 row entry and repeat final-stage verification.
- Live closure evidence remains: Product 262 Composition `PORTAL_VERIFIED` row_version 14, workflow row_version 11, governed/portal-match `3/3`, no active runs, five historical runs unchanged, `STAGE_PORTAL_VERIFIED` latest evidence, and exactly one `COMPOSITION_STAGE_PORTAL_VERIFIED` audit event.
- WP-06 closure audit passed. Work pack status is `DONE` / 100% and downstream-safe. QC Register and final Submit remain unopened separate gates.
- Overall programme completion baseline remains 46% because the repository defines it as a milestone-based programme indicator but contains no documented recalculation formula; no new overall percentage is invented during this work-pack closure.

## 2026-10-08 — WP-07 G3B manual QC date governance and S1 deployment
- Operator **manually enters** Study Start and Study End dates as mandatory values to approve; no automatic manufacturing-month derivation or prefilling. Reviewer documents evidence/provenance. Report date also manually confirmed.
- S1 draft and event foundation deployed in two repository-versioned migrations on feature branch, with service-role-only operations, no QC study or portal Save authorized. Read-only validation/security checks passed; isolated write-path tests and final audit pending.
- Haridev default portal selection remains editable as a future candidate, separate from NUPAL report issuer; portal mapping remains unverified and no S2 promotion is authorized.

## 2026-10-08 — WP-07 S1 operator identity security correction
- S1 source-draft read/review/save/verify public wrappers now use existing `rpc_eaushadhi_require_permission` and derive the authenticated actor; user-supplied audit identity is never a public wrapper argument.
- Internal regulatory preparation functions are revoked from application/service roles and retained solely for owner-definer delegation. No autonomous service-role impersonation path is approved.
- A rollback-only S1 lifecycle test completed without error for create, incomplete verification denial, edit, stale denial, verify and verification invalidation. No test records persisted.
- S1 remains unmerged pending final permission, parity and branch movement audit; S2, client and portal execution remain unopened.

## 2026-10-09 — WP-07 S1 live Electron acceptance
- Product 262 authenticated read-only QC preparation probe returned **“QC preparation read probe returned no preparations.”** Operator-observed PASS using isolated feature-branch Electron development app, not a government portal login.
- Independent review of bounded view-only diagnostic and permissions correction accepted. No QC preparation or QC study record created; S2 and portal execution remain unopened.
- S1 awaiting final integrated audit and separate authorization before merging.

## 2026-10-11 — WP-07 driver handover and C1b decisions
- **Programme driver:**
  - On 2026-10-10 the user authorised Jarvis (Grok Bot) to drive WP-07 autonomously in ChatGPT's planning, server and audit role.
  - ChatGPT is updated after milestones. Merges and live migrations still require explicit user approval.
- **C1b defaults (operator-approved):** applied only on an empty Product 262 form with no saved `manual-qc:262:primary` preparation. They are never auto-saved, and the operator reviews every value.
  - protocol Others (`OTHER` by code), text "Cross Sectional Approach (API Vol VIII Page No:226)";
  - date basis `OPERATOR_REVIEWED_CROSS_SECTIONAL_MANUFACTURING_SPAN`;
  - shelf life 36;
  - mode OUT;
  - portal laboratory "HARIDEV FORMULATIONS" if present in the live list.
  - Study start/end and report dates are never prefilled, consistent with the 2026-10-08 manual-date decision.
- **Portal QC field rules adopted client-side,** from portal `addQCRegister.js` / `CommonValidation.js`:
  - other text: `OnlyAlphaNumericWithunderscoreandbracket('otherText')` (`/^[a-zA-Z0-9()-_ .]*$/`) and `MaximumLengthCheck('otherText', 125)`;
  - batch: `AlphaNumericWithoutRegExp('batchno')`, `MaximumLengthCheck('batchno', 256)`, `MinumumLengthCheck('batchno', 2)`. SASV additionally requires a strict `a,b,c` form: no spaces, empty items or duplicates; items `[A-Za-z0-9./_-]+`;
  - report: "Please Upload Test Report"; `file.size > 2 * 1024 * 1024` → "Test Report limit is 2 MB .";
  - SASV date rules: study end strictly after start; report date on or after study end.
- **Source approval number:** relabelled "Issuing lab Form-48 approval no. (evidence only; not sent to portal)". The portal `qcdetails` Save payload has no such field.
- **Canonical QC report filename:** `EAUSHADHI_P{4-digit product id}_{NAME}_QC_TEST_REPORT_V{NN}.pdf`, server-assigned at B1 reservation. For Product 262 the first name is `EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf`. The operator does not type it.
- **Portal laboratory vocabulary (M-LAB, live `20261010180112`):**
  - 59 labs from authenticated live capture `2d2840d0-e708-4000-9096-18d8ccf7e4d3`, stored byte-exact with portal ids; HARIDEV FORMULATIONS = 3980.
  - The value saved and sent is the label, which is the portal `labName`.
  - Reference only: confers no Form-48 approval or laboratory mapping authority.
- **Open regulatory question for B3:** the current report issuer NUPAL is not in the portal laboratory list, so an OUT report from NUPAL cannot be named as the portal laboratory. Resolve before evidence governance and portal entry.
- **Readiness wording:** the UI never shows READY for QC before C2 upload and B1–B4. With no server review reasons it shows "Fields complete (draft only)" plus the C2 / B1/B2 / B3 / B4 / portal-entry checklist.

## 2026-10-11 — WP-07 D3.2 byte check is operator-triggered
- The QC test report byte check runs only when the operator clicks **Check bytes on server** and confirms the terminal-outcome warning. Register does not start it.
- The live B2 SQL is in the repository as `supabase/migrations/20261011094445_wp07_b2_qc_report_byte_verification.sql`, byte-exact to the applied migration (md5 `11a328b66551d8a1bbce82e1133560ec`). It was not reapplied. `rpc_eaushadhi_qc_report_record_byte_check_v1` and `rpc_eaushadhi_qc_report_byte_check_target_v1` are EXECUTE for `service_role` only; `anon` and `authenticated` have none.
- A PDF larger than 2 MB is rejected when the file is selected and again in the worker before reserve or register, with no network call.
- A reused reservation that returns `40001` from register asks the operator to reserve a new version. Only that click calls reserve with `forceNew`. There is no automatic retry.

## 2026-10-11 — WP-07 D3.3 V01 byte check verified
- **V01 byte check ran (operator-triggered):**
  - Reservation `7e9bdf61-43c8-407d-b4dc-d9b45680c972` → `VERIFIED_BYTES`.
  - Verified SHA-256 `0795de1d0e186cec278040cd16f1431e7422ceeaf7b48f7b6a50ca9bdba60ee9` equals the claimed SHA-256.
  - Size 1,723,549 bytes; object version `306b7fc8-e5b4-4e88-9b36-45c7f5d38c24`.
  - `bytes_checked_at` 2026-10-11 12:25:07 UTC (17:55:07 IST); event #3 `BYTES_VERIFIED`, method `edge:eaushadhi-qc-report-verify`.
- **Negative permission test passed** before the check:
  - No auth header → 401 at the gateway.
  - Anon key → 403 FORBIDDEN.
  - Viewer-only user → `42501 e-Aushadhi Automation permission is required`.
  - No state change.
- **Confirm is now an in-page modal, and worker `fileSize` is required.**

## 2026-10-11 — WP-07 B3 evidence binding is live
- B3 is applied live as `20261011135744_wp07_b3_qc_evidence_binding` (md5 `18671148f501ee69b031a5df913ffadb`, byte-exact in the repository). It was not reapplied from this client change.
- `rpc_eaushadhi_qc_preparation_verify_v1` is retired. `rpc_eaushadhi_qc_preparation_verify_v2` binds the evidence tuple and requires attestation plus per-fact evidence. `rpc_eaushadhi_qc_evidence_recheck_v1` is read-only.
- Storage rejects client update and delete of a registered QC report. Register stays at 2 MB. The lock order is preparation, then reservation.
- **Operator decision, pending B4 legal basis:** a NUPAL-issued report may be filed under HARIDEV FORMULATIONS as the portal laboratory. Recorded for B4. B3 does not act on it.

## 2026-10-11 — WP-07 D4.1 saved report filename loads into Verify
- Verify source facts blocked a matching draft after reload. The saved `report_filename` was not loaded back into the form, and the report list has no verified SHA until a byte check in the same session, so the client compared the draft with a blank file name and a blank SHA.
- The form now loads `report_filename`. The client compares the SHA only when a verified SHA is known, and the file name only when both names are non-empty. `rpc_eaushadhi_qc_preparation_verify_v2` still rejects a real SHA or file-name mismatch.

## 2026-10-11 — WP-07 D4.2 saved facts and reopen
- **B3.1 decision (candidate, not yet applied):** an attested reopen supersedes a binding in an append-only way. Binding #1 stays in the audit trail. The draft returns to Review required.
- The operator confirmed that batches, report date, study end date, and shelf life are printed on NUPAL report page 1.
- Study start date and testing protocol are operator facts: not shown in the report, each with a note.
- **D4.2 display root cause:** after Verify source facts the card cleared its rows and showed the defaults, so study start and protocol appeared as No while the server had saved Yes. The confirm dialog did not list the submitted facts, and a focused Yes/No control could change with the mouse wheel or arrow keys. There is no path that turns a selected No into a saved Yes.
- A verified preparation shows the six saved facts read-only when the recheck returns them. If that evidence is absent, the card says the saved fact evidence is not available in this view.
- Reopen for re-verification is operator-triggered only. It will call `rpc_eaushadhi_qc_preparation_reopen_v1` once B3.1 is applied. Until then a missing RPC says reopen is not available on the server yet.
