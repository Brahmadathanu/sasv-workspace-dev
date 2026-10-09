# WP-07 — QC Register Preparation & Portal Execution

**Architecture state:** YELLOW  
**Progress:** 50%

## Objective
Create the complete server preparation, verification, portal contract and execution pipeline for the QC Register stage.

## Milestones
- [x] Identify all QC Register source data requirements.
- [x] Audit existing SASV/server QC/lab data relevant to e-Aushadhi.
- [ ] Define manual-entry path for missing QC data.
- [x] Define canonical/portal terminology requirements.
- [x] Define attachments/evidence dependencies if any.
- [x] Capture portal QC Register page/field/network contract read-only.
- [x] Implement server preparation/readiness lifecycle.
- [ ] Implement operator client verification UX.
- [ ] Implement safe portal executor and reconciliation.
- [ ] Record server-side progress/audit.
- [ ] Representative product verification.
- [ ] WP closure audit.

## G0A — Portal contract capture
Read-only QC Register capture completed for Product 262 / Karpooradi Thailam.

Established native QC record contract:
- route: `/admin/addQCRegister`;
- QC-record Save handler: `SaveData()`;
- Save endpoint: `../admin/SaveQCData`;
- native list/reread/document helpers identified;
- Update/Delete exist in the portal but remain outside ordinary WP-07 execution authority;
- no portal mutation occurred during capture.

## G0B — Canonical source and gap contract
Completed.

The existing `regulatory.stability_study`, `stability_study_batch`, `stability_study_document`,
`approved_laboratory` and `QC_PROTOCOL` controlled-term foundation is retained as canonical QC source authority.

Frozen safety rules include:
- ordinary lab sample dates must not be inferred as stability Study Start/End dates;
- ordinary COA existence does not automatically create a QC Register record;
- Product Details, Composition and QC remain independent portal lifecycles;
- `portal_product_state.qc_status` is not QC execution authority.

## G1 — Server lifecycle architecture
Completed and frozen.

QC owns an independent product-level stage and per-record execution lifecycle.
One run authorizes at most one QC Register Save target.
Native reread and exact semantic proof are required before row verification.
Final QC-stage verification is separate from row execution and never authorizes final product Submit.

## G2 — Server foundation implementation
Implemented live on 2026-10-04, repository-versioned on
`feat/wp07-g2-qc-server-lifecycle`, and cleanly merged to `main` at
`efa8f33b44ade2574af8f8ade4d97ff4d88009a0` after a 0-behind/no-overlap guard.

Live migrations:
- `20261004151444_wp07_qc_server_lifecycle_foundation`
- `20261004151642_wp07_qc_snapshot_document_aggregate_fix`

Implemented:
- explicit `NOT_APPLICABLE` QC protocol term for portal `N/A`;
- explicit governed Other Testing Protocol text;
- captured QC protocol portal-option projections as DRAFT mappings pending governed verification;
- QC-specific approved-laboratory portal mapping authority;
- independent `regulatory.eaushadhi_qc_stage`;
- independent `regulatory.eaushadhi_qc_run`;
- server-generated QC snapshot/content hash;
- read-only QC execution preflight;
- bounded run-arm, Save-outcome, row-verification and final-stage-verification RPCs;
- explicit QC audit-event writes;
- no direct anonymous execution of QC lifecycle RPCs.

Post-merge verification:
- repository migration files exactly match live Supabase migration history;
- Product 262 Product Details and Composition remain unchanged;
- QC remains fail-closed with `READY=false` / `NO_GOVERNED_QC_RECORDS`;
- merge created no Product 262 QC source, stage, run or QC audit row.

Post-deployment proof:
- Product 262 Product Details remains `PORTAL_VERIFIED` at workflow row_version 11;
- Product 262 Composition remains `PORTAL_VERIFIED` at stage row_version 14;
- Product 262 QC snapshot is truthfully `READY=false` with reason `NO_GOVERNED_QC_RECORDS`;
- Product 262 has zero QC source study rows, zero QC stage rows and zero QC run rows;
- run-arm fails closed while QC READY is false;
- no QC portal mutation occurred.

## Current gate
**G3 — Representative Product 262 canonical QC data preparation.**

Prepare and govern the first real QC/stability record source data for Product 262 before any client or portal execution work.
The next gate must resolve the actual testing protocol, study dates, batch representation, report date,
IN/OUT classification, eligible report artifact and (for OUT) approved laboratory + portal mapping.

No QC portal Save/Update/Delete is authorized.
No final product Submit is authorized.


## G3B / S1 — Manual-entry QC preparation foundation (2026-10-08)
Authorized S1 server foundation applied live, with no Product 262 source study/draft/stage/run or portal mutation.
- Decision: operator manually enters **both** Study Start Date and Study End Date as mandatory verification fields; the server does not infer, prefill, or overwrite these dates from manufacturing months. Dates may be absent during incomplete draft editing but cannot pass source verification without explicit operator entry and evidence note.
- Report Date is similarly entered/confirmed by the operator.
- New isolated tables `regulatory.eaushadhi_qc_preparation` and `eaushadhi_qc_preparation_event`; optimistic row versions, preparation state only and append-only ordinary-operator audit history.
- Service-role-only, audited S1 RPC surface: `eaushadhi_qc_preparation_read_v1`, `save_v1`, `review_v1`, `verify_v1`; no ordinary authenticated direct table access or execute grants. S1 verification is source-only; not an execution authorization.
- Applied migrations: `20261008122004_wp07_g3b_s1_qc_preparation_manual_dates.sql` and `20261008122144_wp07_g3b_s1_manual_date_regex_correction.sql`. Both are in the dedicated S1 feature branch pending independent audit/merge.
- Read-only tests: complete sample manually entered date passes; omitted Start/End/Report dates fail; impossible calendar day fails. Direct authenticated/service role table insert denied; authenticated save/verify execute denied; service role RPC granted.
- Product 262 still has zero QC preparations, source studies, QC stage rows and QC run rows. Product Details and Composition unchanged by migrations. No S2 laboratory mapping, source promotion or QC portal execution opened.
- Feature branch: `feat/wp07-g3b-s1-qc-preparation-manual-dates` (not merged).
- Remaining acceptance: independent diff/security/permission audit, transactional write-path tests (create/save/stale/verify/reopen/reject) in disposable test context, migration parity and explicit merge authorization.

### S1 independent audit follow-up (2026-10-08)
- Existing trusted permission helper `public.rpc_eaushadhi_require_permission(p_edit)` derives `auth.uid()`, checks `public.user_permissions_canonical` for `module:e-aushadhi-automation`, and requires view/edit as appropriate.
- New public S1 `read/review/save/verify` wrappers use this helper; mutation wrappers pass the derived actor UUID to private regulatory functions. Revoked client/service-role direct EXECUTE on actor-parameter internal functions. Live hardening migration: `20261008130211_wp07_g3b_s1_actor_permission_hardening.sql`.
- Live rollback-only DO audit executed successfully: create, incomplete verify rejection, update, stale-version rejection, source verification, verification invalidation and rollback/no surviving test record. Test did not perform authenticated UI E2E exercise; client/runtime authorization still needs acceptance evidence.
- No QC portal mutations, QC study promotion, approved-laboratory mappings or Product 262 drafts authorized.
- Final merge gate: reconcile current shared main, migration-history identity/parity, role grants, audit and documentation. No automatic merge.

### G3B S1 database identity acceptance supplement
- Read-only inspected `public.user_permissions_canonical`: the established production e-Aushadhi operator has `can_view=true` and `can_edit=true` for `module:e-aushadhi-automation`.
- Ran scoped SQL claim-context simulation using `request.jwt.claim.sub`: permissioned operator read and unpermissioned identity rejection completed without exception. This is **database-level permission simulation**, not a genuine authenticated Electron/PWA client-session E2E test and does not prove the end-user application route.
- S1 remains conditional until client-authenticated route acceptance and final merge reconciliation; do not merge implicitly.

### G3B/S1 authenticated Electron read acceptance — 2026-10-09
- Feature probe branch `feat/wp07-g3b-s1-qc-preparation-read-probe`, audited corrected implementation head `257c8032fec07d5a521e370988c313d6914b014c`, launched in an isolated development worktree using `npm run dev`; operational BMR checkout preserved.
- The operator opened e-Aushadhi Review & Control, selected Karpooradi Thailam (Product 262), and clicked **QC preparation read probe**. Actual result confirmed by the operator: **“QC preparation read probe returned no preparations.”** This is **live authenticated Electron read PASS**, not QC source verification, QC Ready, or portal verification. Government portal-browser session can remain disconnected.
- Independent code audit of the read-only feature/probe and bounded view-permission correction completed. The client probe requires view permission, restricts to Product 262, and returns success solely on an empty array.
- Main/feature file movement reconciled with no overlap (as of main `200148818d52a4c552ec0a338d86bf794803dddd`): main-only changes are BMR batch-number normalization files; feature S1 changes remain QC migrations, QC docs and probe-related client/tests.
- Await explicit merge authorization after final integrated check. S2 promotion, approved-laboratory mapping, full QC preparation UI, portal Save/Submit remain unopened.

## G3B/S2A — Approved operator-entry and QC document contract (2026-10-09)

**Approval scope:** field-level design, document naming/registration pattern, human source verification and later gated portal lifecycle. This section is a contract freeze only. No QC draft, report upload, authoritative study promotion or portal operation is authorized solely by its approval.

### Operator flow
1. In e-Aushadhi Review & Control select the governed product and QC Register section; preserve the existing module and product lifecycle.
2. Operator manually enters QC protocol (OTHER requires actual description), Start Date, End Date, shelf-life months, batch numbers, Report Date, QC IN/OUT, true report issuer, optional issuer approval/Form-48 evidence, and portal laboratory candidate (OUT). Dates must have evidence notes and are never calculated from manufacturing month or COA date.
3. Operator uploads the actual QC test-report PDF to the existing protected `eaushadhi-evidence` bucket under a purpose-specific validated convention. For Product 262, proposed filename `EAUSHADHI_P0262_KARPOORADI_THAILAM_QC_TEST_REPORT_V01.pdf`; version must advance for a new artifact. Preserve original filename, issuer and byte checksum in canonical metadata; no PDF content relabelling or false issuer attribution.
4. Register the QC report as a **new QC-specific document purpose/asset**, not APPROVED_PRODUCT_COPY. Server must validate product, purpose, path, PDF MIME/extension, size, content hash, verified object presence/identity, current version and authorized actor. Registry and actual storage bytes must agree. Upload success alone is not registration or verification. Reuse the proven Approved Product Copy contract/upload/storage pattern, not its document type/RPC blindly.
5. Field review displays missing/pending/verified with evidence and actionable failure reasons. Draft Save allows incomplete data. Source Verify requires all mandatory fields, a current verified QC report asset and human confirmation, binds source and document hashes to the version, and invalidates prior verification on any relevant edit/replacement.
6. Separately governed promotion maps exactly one verified preparation to its authoritative `stability_study`, batch rows and current report attachment atomically; idempotent uniqueness, stale-version rejection and append-only audit are mandatory. A source-verified preparation is **not** equivalent to portal READY or portal verified.
7. QC snapshot/preflight only becomes READY when authoritative source, report asset, canonical-to-portal protocol mapping and, for OUT, qualified laboratory and portal mapping meet existing G2 rules. Portal navigation, bounded Save, native reread, exact semantic reconciliation and QC stage verification follow *separately* under the existing G2 execution lifecycle. Never final product Submit by implication.

### Schema and contract findings
- Existing S1 `eaushadhi_qc_preparation.draft_payload` admits: `testing_protocol_term_id`, `other_testing_protocol_text`, `study_start_date`, `study_end_date`, `date_basis`, `date_evidence_note`, `shelf_life_months`, `batches`, `report_date`, `report_date_evidence_note`, `quality_control_mode`, `source_report_issuer`, `source_report_approval_no`, `portal_laboratory_candidate`, `report_filename`, `report_sha256`, `report_evidence_note`.
- S1 review currently checks report filename and SHA text, **not** a registered QC asset; additional attachment-backed readiness must be built before source promotion/portal READY. Never treat S1 verification alone as proof of upload.
- Existing approved copy client uses `rpc_eaushadhi_document_upload_contract` → non-upsert Supabase private storage upload → `rpc_eaushadhi_register_approved_product_copy`. QC must use separate purpose/scoped registration and attachment linkage; ordinary users cannot directly write regulatory tables.
- Existing `stability_study_document` links study to `document_asset` with purpose `TEST_REPORT` or `PORTAL_UPLOAD_ARTIFACT`; G2 QC snapshot already requires current active eligible attachment.
- The only verified Product-262 named `document_asset` encountered in S2A was ID 1, `APPROVED_PRODUCT_COPY`, **not** the QC report. Actual source QC PDF registration is unproven.
- Portal QC protocol `OTHER` candidate mapping was seeded as DRAFT; verify its native Others option before execution. Source report issuer NUPAL and preferred editable portal candidate Haridev Formulations must remain separate; Haridev is never automatically represented as report issuer or approved mapping.
- IN versus OUT requirements must be explicit; no laboratory mapping may be fabricated or auto-verified.

### Ordered implementation boundaries
**S2B — Server contract and backend:** independently audit current SQL, approved-copy registration and storage policies; implement purpose-specific naming/upload/registration, evidence-backed verify and transactional promotion with permission checks and rollback-only acceptance. Migrations live only after separate bounded plan approval. No actual Product-262 draft/report/study writes during technical tests.

**S2C — Client UX:** high-risk Plan → ChatGPT review → Cursor implementation on isolated feature branch; compact QC Register panel, human field entry, editable OUT lab selection, controlled PDF upload, field review, Save/Verify, clear status. Do not implement against hypothetical RPC signatures.

**S2D — QC portal executor:** separate authorization following verified source and current native capture; reuse existing G2 run-arm/Save-outcome/reread/stage-verify lifecycle. No portal Save/Update/Delete/Submit opened in S2A/B/C.

### Outstanding evidence
Confirm exact QC report bytes/hash and legitimate accessible artifact; start/end/report dates through human entry; Form-48/laboratory validity and the source issuer versus portal lab applicability; native portal Others and laboratory-option mapping. Any unresolved question remains a blocker rather than inferred data.

**S1 closure:** PR #47 merged to main `980cfeed1aaaaf13d6cd168506dc91d87d3546a8`; Product-262 authenticated Electron read yielded empty preparations. Prior S1 document paragraphs describing pre-merge state are historical, not the current state.

### S2B implementation plan — 2026-10-09 (plan, not execution permission)

**Dependency confirmed live:** `regulatory.approved_laboratory` currently has zero rows. The only existing public evidence APIs are `rpc_eaushadhi_document_upload_contract`, `rpc_eaushadhi_approved_product_copy_get`, `rpc_eaushadhi_register_approved_product_copy`. No QC-specific upload registration API exists. Existing `stability_study`, `stability_study_batch` and `stability_study_document` support the canonical projection.

**B1 — QC document contract and metadata:** Build an explicit QC_TEST_REPORT purpose with product/preparation binding, exact convention and version (proposed P0262 QC_TEST_REPORT_V01), private `eaushadhi-evidence` object, content SHA-256, byte size, PDF constraints, original issuer/filename and verified storage object identity. Upload reservation and actual registration must be distinct. No client-provided storage key, digest or "uploaded" claim alone establishes object verification. Recheck permissions, storage RLS and physical object identity. No reuse of APPROVED_PRODUCT_COPY as a QC report.

**B2 — S1 amendment for evidence-backed Verify:** Provide a read-only attachment readiness review and bind exact registered active QC asset ID, SHA and document version to the preparation at verification. Existing `report_filename` and `report_sha256` text-only fields are insufficient. Editing/replacing source fields/document invalidates verified state. Preserve manually entered date and evidence-note checks, source hash, authenticated actor, optimistic version guard and append-only events. Enforce explicit failure reasons and idempotent duplicate rejection. Operators may save incomplete drafts.

**B3 — lab and portal mapping:** Separate true issuing lab (NUPAL in current Product-262 report) from editable preferred portal lab (Haridev). Neither name confers `approved_laboratory_id`; register only with verified Form-48 identity, validity and governed mapping. Require explicit operator review before OUT promotion/readiness; block if issuer and selected portal lab would falsely attribute report. Verify protocol OTHER→portal Others mapping rather than trusting DRAFT.

**B4 — transactional source promotion:** Implement permissioned, version/hash-bound source promotion to one `stability_study`, ordered `stability_study_batch` rows and current `stability_study_document` TEST_REPORT reference, all in one transaction. Track preparation→study identity and append-only promotion event, enforce no duplicate on retries, fail stale versions and changed/unavailable assets. Promotion is not QC portal run authorization.

**B5 — verification and closure:** Migration parity, RLS/execution grants, wrong-role fail-closed, invalid PDF/unregistered/mismatched checksum failure, incomplete dates, stale edits, OUT lab mismatch, duplicate promotion, transactional rollback, Product-262 zero-row invariant until separately authorized, unchanged Product Details/Composition. Run on disposable/rolled-back test identities. Audit repository implementation independently before merge.

**Implementation sequence:** separate B1 then B2/B3 then B4/B5 controlled server gates. No client implementation until server RPC response contract audited and frozen. No QC portal operation, release, or Product-262 real record created as part of development tests.
