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
- Applied migrations: `20261008180000_wp07_g3b_s1_qc_preparation_manual_dates.sql` and `20261008180500_wp07_g3b_s1_manual_date_regex_correction.sql`. Both are in the dedicated S1 feature branch pending independent audit/merge.
- Read-only tests: complete sample manually entered date passes; omitted Start/End/Report dates fail; impossible calendar day fails. Direct authenticated/service role table insert denied; authenticated save/verify execute denied; service role RPC granted.
- Product 262 still has zero QC preparations, source studies, QC stage rows and QC run rows. Product Details and Composition unchanged by migrations. No S2 laboratory mapping, source promotion or QC portal execution opened.
- Feature branch: `feat/wp07-g3b-s1-qc-preparation-manual-dates` (not merged).
- Remaining acceptance: independent diff/security/permission audit, transactional write-path tests (create/save/stale/verify/reopen/reject) in disposable test context, migration parity and explicit merge authorization.
