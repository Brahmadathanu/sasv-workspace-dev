# Costing — Draft-Run Component Evidence and Governed Review Gate
**Design/contract brief: 3 November 2026; NO implementation approval implied**

## Current facts and preserved invariants
- Source Git `main` following U11 #144 squash merge: `cf26ae5ed6c69b9e5f52e195f033cfb94e2e781b`.
- October approved run **143** governs pricing. October draft run **148** is successful but **NOT approved**: 514 READY / 113 REVIEW_REQUIRED / 1 BLOCKED; frozen run-specific source.
- Reviews: 109 direct-labour component foundation, with 52 basis OK, 32 no SKU sales in lookback and 25 no product sales; one separate internal conversion review; 2 material reviews; one regional Marketing review (Dhanyamlam SKU 41, OK); one blocked SKU 105 due to missing required PM rate **as-of run 148**. Do not silently classify review as a pricing approval. Do not bypass `REVIEW_REQUIRED` and `BLOCKED`.
- The existing `public.v_costing_pricing_sku_control_status_by_run` is run-scoped and permission-guarded for CCC view. The existing Cost Sheet reads `public.v_costing_pricing_sku_detailed_cost_sheet`, which traces governed current-run presentation, **not** arbitrary draft run 148. Do not change this governed source or pass an uncontrolled run id into pricing/master data.
- Source tables: `costing.sku_direct_labour_allocation_snapshot` (RLS enabled, authenticated SELECT grant; not assumed Data API exposed), `costing.sku_prime_cost_snapshot` (RLS enabled, no authenticated SELECT), `costing.sku_regional_marketing_expense_allocation_snapshot` (no RLS and no authenticated SELECT). **Never grant broad client access to these base tables.**
- Existing `public.rpc_get_regional_marketing_evidence_review_queue(p_refresh_run_id,p_region_code,p_sku_ids)` is permission-checked CCC view and requires 1–200 SKU ids; `public.rpc_accept_regional_marketing_review(p_refresh_run_id,p_sku_id,p_region_code,p_acceptance_reason,p_acceptance_note)` delegates to CCC-edit + nonempty reason + eligible exact fingerprint acceptance. For SKU 41 / OK / run 148, queue currently shows REVIEW_REQUIRED, `is_acceptance_eligible=true`, `is_accepted=false`. **Read-only verification only. No acceptance executed.**
- `COSTING_REVIEW_WORKLIST_V1`, `COSTING_UX_CONSISTENCY_V1`, `COSTING_NAV_GROUPS_V1` are default OFF. U11 label package merged but remains OFF.

## Design decision to seek from owner, before any new server object

**Preferred:** one narrowly scoped, run-specific *read-only* RPC or secure `security_invoker` view returning a stable minimal record for the single selected `period_start,refresh_run_id,sku_id`. It must validate that the requested run belongs to the period and is one of the permitted display/review runs; require CCC view permission; enforce strict pagination/batch limits; expose only the fields needed for remediation; and guarantee no mutating or leaking sensitive administration fields.

Possible minimal response fields, all names to verify with live schema: `refresh_run_id, valuation_date, sku_id, product_name, first_control_status, control_severity, direct_labour_allocation_status, allocation_reason_code, allocation_basis_status, allocation_resolution_status, allocation_resolution_note, direct_labour_component_model_code, internal_material_conversion_status, regional_basis_source/status/note by IK/OK, marketing_expense_allocation_status by region`, plus `evidence_source_run_id` and freshness. Avoid exposing cost figures or marketing monetary evidence unless needed, already accessible to this permission, and explicitly approved.

**Alternative:** create a run-aware Cost Sheet evidence mode with **read-only draft banner**, but only if it never alters the existing governed-run pricing/master views or semantics. This has a wider blast radius and is not recommended without a separate design audit.

**Until the chosen read contract is approved and implemented:** Claude may prototype a *mock-only* evidence drawer using a stubbed interface, but must not add a production RPC call to a nonexistent contract or query `costing.*` directly in a browser. Do not invent a generic prime-cost acceptance RPC.

## Existing client workflow and acceptance boundary

1. **Worklist** (CCC, read-only): select October period and run 148; display 114 non-ready SKUs, ensuring pagination, severity, explanatory source type and missing provenance.
2. **Component evidence drawer** (proposed): demonstrate draft-148 source cause, grouped by material, direct labour, conversion and regional Marketing; explicit `Draft run 148 · not for pricing` label. An approved 143 comparison may be added only with distinct read-only data, clearly identified by run. Missing/error data stays UNKNOWN, never READY.
3. **Upstream remedy navigation** (already exists): Production Route Manager for direct-labour foundation/workload; Driver Governance; Commercial Sales Assumptions for sales-basis defaults/assumptions; Material Cost Manager for the two material issues and SKU 105 rate. Never write to frozen 148 from these screens.
4. **Regional Marketing evidence acceptance** (existing server contract): show queue eligibility/fingerprint/run/region, require explicit nonempty reason and CCC edit permission. Warning for reviewer: acceptance is a governed evidence decision, *not* run approval and not necessarily a correction of upstream regional data; confirm before write. This requires a separate owner-approved client write action after verifying server role semantics and acceptance expiry/fingerprint. **No automatic acceptance or testing against live production.**
5. **New refresh** is separately authorised after upstream policy/data changes; immutable 148 does not become READY retroactively. Run approval/finalisation remains the existing guarded preview → acknowledge → approve/lock process.

## Implementation packages and tests

**CDE-1 — Mock/read-only client review panel:** Only after read contract design is approved; implement in current CCC worklist drawer rather than a new tab/module, behind existing `COSTING_REVIEW_WORKLIST_V1`, OFF identity unchanged. Tests: period/run/SKU identity, 110-prime grouping, conversion exception, OK/IK split for SKU41, foreign-run reject, pending/error, pagination, output sanitisation, view permission, no RPC writes and no approved-run leakage.

**CDE-2 — Server read contract:** Assistant/server owner separately implements only after explicit approval, role/ACL/RLS review, negative permission tests and read-back verification. Explicitly isolate from browser code. No requirement to create a new table or mutate data.

**CDE-3 — Governed regional acceptance client action:** Only after reviewer workflow contract/owner acceptance. Add confirmation and reason, role edit checks and no-bulk path. Test expiry/eligibility change, stale fingerprint, duplicate acceptance, wrong run/region, view-only, cancel and server errors with mock RPC. Do not conflate `rpc_accept_material_review_action` with regional evidence acceptance.

**A7 — Existing material acceptance regression:** Can proceed NOW as a **test-only**, independent, file-disjoint PR. Assert `saveMaterialReviewAcceptance` uses `rpc_accept_material_review_action` exact payload, eligibility REVIEW_REQUIRED + MATERIAL_RATE_REVIEW, reason threshold, and edit guard; test close/reload and failure handling; no production requests. Do not touch business logic absent a proven defect.

## Review conditions and stop rules
- One writer per `costing-review-worklist.js` and Cost Sheet; avoid overlapping U11/other worktrees.
- Every code PR is a draft with exact HEAD, full history and LF/CRLF/Chromium evidence; independent review and owner approval before merge.
- Do not change public Cost Sheet into a draft source, relax permissions, create server RPCs, approve run 148, finalise October, switch flags, publish or deploy without explicit authorisation.
- Current release goal is **complete WP00–WP12**, not an early Electron release. This gate is a necessary WP05/WP06/MDC-07/WP12 cross-cutting dependency, not a new work pack.
