# Step121 — Run138 QC readiness HOLD: root causes verified (22 Oct 2026)

Run138 SUCCESS with 507 READY /109 REVIEW_REQUIRED /11 BLOCKED. Formal `costing.fn_w2_run_checks(138,'SUPERSEDE')` fails NO_BLOCKED_SKUS and NO_UNRESOLVED_REVIEWS; 11 other checks pass. Preserve run136 APPROVED.

## Cause A: FG base-spec validity transition

Run138 `costing.product_qc_workload_snapshot` 443 READY, 10 BLOCKED (`BLOCKED_MISSING_EFFECTIVE_FG_BASE_SPEC`). Product ids 683,694,696,697,699,722,723,724,725,726. Ten products account for eleven blocked SKUs. `lab.fn_preview_effective_fg_spec_for_product(697,'2026-10-20')` ok=true, but on 2026-10-22 ok=false, message `No active FG base spec found for product_group_id 41`. `lab.spec_profile` id454 (old FG Choornam) is_active=false, effective_to=2026-10-21; successor id755 is_active=true effective_from=2026-10-22. Old profile454 has active mappings for product groups37,41,45,100; successor755 only groups6,7,8,9,57. Old and new profiles each have 30 spec lines, 8 active/required; at least one analytical detail differs: line4 taste value `Specification to be defined` vs `Not Applicable`. DO NOT blindly map the old four groups onto 755 or alter FG analytical content solely to clear costing. Requires QA-approved effective FG spec continuation/version or corrected intended mapping.

## Cause B: dated commercial manufacturing demand-driver acceptance

Run138 QC monetary `costing.product_qc_allocation_snapshot`:386 READY,57 REVIEW_REQUIRED (`REVIEW_REQUIRED_QC_ABSORPTION_BASIS`),10 BLOCKED. The QC review propagates to 108 SKUs. `costing.fn_sales_allocation_quantity_driver_review_status` resolves acceptances only for same `period_start`, exact `source_valuation_date`, SKU/product and fingerprint. Existing 57 ACTIVE acceptances are for valuation 2026-10-20 (61 additional for Oct16); none for Oct22. Run136 453 QC READY. Across all 57 Oct22 REVIEW_REQUIRED SKU basis records, core allocation quantity, method, source, assumption id and default policy id match run136 (57/57). Requires governed dated acceptance/re-attestation for Oct22, not status override. Do not bypass provenance or auto-approve without controlled authorisation.

Both issues are independent of run138 Ksheerabala policy2 correction and cost pool reconciliation (PASS). No QA specs, driver acceptances, or approved run designation changed during this diagnostic. Next: validate QA successor group profiles and fill legitimate FG spec coverage; governed re-attestation of unchanged 57 drivers; create new run and verify W2 approval checks; only then use price revision master.
