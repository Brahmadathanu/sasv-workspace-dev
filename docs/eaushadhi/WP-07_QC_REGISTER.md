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

### B1 rollback-only behavioral/security audit — 2026-10-09
- Feature migration head prior to this documentation update: `7045e2c4da9e90c8a506397b02281e95493d3024`. Evaluated SQL source by executing `BEGIN; [migration]; [assertion DO block]; ROLLBACK;` in live database, **without deploying it**.
- PASS: function creation and PostgreSQL execution; anonymous public RPC denial; authenticated internal-regulatory RPC denial; authenticated public read grant; missing preparation and registration identity fail-closed; rollback-only creation of an incomplete Product-262 S1 draft followed by QC report reservation versions V01 and V02; incorrect preparation version rejected; missing storage object rejected; two append-only reservation events in the disposable transaction.
- Immediately after rollback: **0** surviving Product-262 QC preparations, **0** preparation events, **0** source studies, **0** B1 reservation tables; no QC PDF uploaded and no portal mutation.
- **Not yet tested:** successful registration of a real storage object, conflicting second registration/idempotent positive response, wrong MIME/oversize on an actual storage object, concurrent reservation racing under separate sessions, live authenticated editor/view-only use of the new wrappers and end-to-end byte integrity. Do not claim full B1 verification.
- **Integrity limitation:** newly registered assets will remain `UNVERIFIED_BYTES`; claimed SHA-256 and storage metadata do not prove actual bytes. B2 verification/promotion must remain blocked until a trusted object-hash process is implemented and independently audited.
- The S1 preparation row version currently does not advance on B1 reservation/registration. B2 must explicitly bind and invalidate attachment-sensitive source verification; do not imply source Verify is protected merely by registering an attachment.
- **Gate remains:** B1 implementation candidate; independent final security review and explicit live migration authorization remain required.

### B1 additional acceptance boundary — 2026-10-09
- Rechecked production: zero Product-262 QC preparations, zero Product-262 `stability_study` rows and no B1 reservation table deployed.
- Executed entire current candidate migration inside `BEGIN ... ROLLBACK` with a permission-negative public-read probe using an unauthorised simulated authenticated identity. An error was caught as expected; this is **simulation**, not live client-session proof.
- Production storage bucket currently exposes only the existing Product-262 Approved Product Copy as a matched known object; do **not** reuse, edit, or remove it for B1 positive tests.
- Unresolved acceptance: true positive PDF upload/storage-object registration, real object metadata rejection/idempotent retry, inter-session concurrency and view/edit user-session validation. SQL-only simulated storage rows are insufficient as proof of genuine Supabase Storage behavior.
- Safe next step: isolated test project/branch or explicitly approved purpose-scoped temporary PDF upload and cleanup, with resource/cost and operational permission review. Until then B1 is unmerged, undeployed and not acceptance-complete.

### B1 continuation audit — 2026-10-10
- Supabase project `qhmoqtxpeasamtlxaoak` currently has **no available development branches**, confirmed through branch listing. Do not assume an isolated existing DB instance.
- Rollback-only B1 migration + tests PASS: invalid caller SHA-256 rejected (`22023`), stale preparation version rejected (`40001`), no QC document asset registered; rollback executed.
- Main observed at `dd669459010c8df1bf73a198da564a02becfb392`; reconcile main-only movement before eventual merge.
- Real Supabase Storage upload/positive registration, concurrency under separate sessions, byte-level trusted integrity and user-authenticated RPC checks remain outstanding. No artificial storage.object row should be labelled real-storage acceptance.
- Next: determine affordable isolated environment and whether real-storage acceptance should occur after a separate B1 deployment approval, with exact controlled test object and cleanup. Do not create a chargeable environment implicitly.

### S2B/B1 live deployment acceptance — 2026-10-10
- Explicit operator authorization received for **B1-only** migration. Live Supabase migration application succeeded, recorded version `20261010054501` / name `wp07_s2b_b1_qc_report_reservation_registration`.
- Repository migration file renamed from draft timestamp `20261009190000` to exact live-history version `20261010054501`; SQL contents unchanged.
- Post-deploy read-only checks: 0 report reservations, 0 report events, 0 Product-262 QC preparation drafts and 0 stability studies; QC snapshot `ready=false`, reason `NO_GOVERNED_QC_RECORDS`.
- ACL post-deploy: anonymous QC register/read EXECUTE denied; authenticated public registration EXECUTE granted; authenticated direct internal regulatory registration EXECUTE denied. The public wrapper still checks canonical module edit permission through `rpc_eaushadhi_require_permission(true)`.
- No real QC report upload, document-byte verification, source promotion, QC stage/run or portal mutation. Real authenticated positive registration, object integrity and race acceptance remain pending; deployment success is **not** end-to-end B1 acceptance.
- GitHub branch awaits independent final diff and merge review; no Git merge/release authorization is implied.
