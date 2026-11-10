# WP05 R3 — 49-view minimum-column and reader-authority proposal

**Prepared:** 10 November 2026. **GOVERNANCE DESIGN ONLY — NOT APPROVED FOR IMPLEMENTATION.** Scope is the 49 `public` view names that reference `public.fn_costing_view_allowed` from the [original bounded 49-view inventory](WP05_W506_49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY_2026-11-09.md), checked against fresh production catalogue metadata. Owner approval of B1 did **not** authorise GRANT/REVOKE, RLS changes, function rewrites, client projection changes or new per-view authorisation contracts. WP05 remains OPEN; programme 6/13.

## Executive policy proposal

**Recommend a tiered, owner-scoped hybrid rather than either extreme.** Preserve the legitimate cross-module *aggregated* costing dashboard/status/period/pool read contract. Protect individually identifying pay, vendor source rates, named audit actors, restricted trace or unneeded JSON lineage behind their owning-module permission and any **explicitly approved** exception. The *fact that an account has CCC/CSR/MCM/CBM View in one module is not in itself evidence of business need for all 49 raw views*.

**Priorities:** P0 = already mitigated staff (retain, do not regress), P1 = high-impact business-sensitive detail requiring approval, P2 = context-dependent functional/summary or operational register, P3 = narrow option/lookup metadata. This is triage, not proof of unauthorised exposure or approved schema policy. Counts: **P0 3; P1 10; P2 32; P3 4; total 49.**

## Live read-only catalogue evidence

- Fresh live catalogue: **49/49 exact inventory names** matched; **48/49** have SQL `authenticated` SELECT on the view; **1/49** lacks that grant (`v_costing_pricing_cost_sheet_rm_line_traceability`). SQL ACL does not establish effective row access for an actual user.
- **12/49** have `security_invoker=true`; underlying source access/RLS may affect actual reachability. Other views require inspection of definition and grants before asserting per-user access.
- The helper permits privileged database identities or one View grant in CCC/CBM/CSR/MCM, so an ID-O CSR-only user may reach some shared views by **design of the current helper**. No blanket deny assertion is valid.
- Column counts and sensitive-named flags were derived from `pg_attribute`, never retrieved from view rows. Keyword classification is a **triage aid**, not field-by-field leakage proof.
- Current source verification of nine priority consumers: [R2 nine-view readback](WP05_R2_NINE_SENSITIVE_VIEW_CLIENT_CONSUMER_READBACK_2026-11-10.md). Explicit Staff Governance projections override the *historic* `.select('*')` warning in the original inventory.

## 49-view proposed policy matrix

`SELECT / INVOKER` shows `authenticated` SELECT and view `security_invoker=true` (Y/N), **not effective user access**. `Minimum-column intent` is a *functional projection principle*, **not a complete SQL field whitelist**; actual client/render/export dependencies must be verified before any implementation. Owner/reader suggestions are not granted permissions.

| # | View | Original proposed owner | Tier | Columns | SELECT / INVOKER | Suggested reader / exception | Minimum-column intent | Disposition |
|---:|---|---|---|---:|---|---|---|---|
| 1 | `v_costing_staff_classification_register` | CBM; staff HR/costing steward | P0 | 25 | Y / N | CBM View+Edit (current staff gate) | Explicit staff fields only; salary total for editor | RETAIN IMPLEMENTED |
| 2 | `v_costing_staff_cost_pool_summary` | CBM; staff HR/costing steward | P0 | 8 | Y / N | Costing aggregate viewer; no identity details | Period/pool/class/count/amount/status; omit staff_details | RETAIN IMPLEMENTED |
| 3 | `v_costing_staff_costing_class_options` | CBM; staff HR/costing steward | P3 | 5 | Y / Y | CBM View for class metadata | Code/label/pool/sort; exclude unused notes after UI review | COLUMN REVIEW |
| 4 | `v_costing_unclassified_staff_for_costing` | CBM; staff HR/costing steward | P0 | 25 | Y / N | CBM View+Edit (current staff gate) | Explicit staff fields only; salary total for editor | RETAIN IMPLEMENTED |
| 5 | `v_cost_sheet_snapshot_sku_monthly_comparison` | CSR or MCM by consumer | P1 | 56 | Y / N | CSR View for detailed cost; MCM overlap only after explicit consent | Minimum SKU/run/line/cost; exclude JSON source evidence when not rendered | POLICY+CALLSITE CHECK |
| 6 | `v_costing_pricing_cost_sheet_line_traceability` | CSR or MCM by consumer | P1 | 40 | Y / N | CSR View for detailed cost; MCM overlap only after explicit consent | Minimum SKU/run/line/cost; exclude JSON source evidence when not rendered | POLICY+CALLSITE CHECK |
| 7 | `v_costing_pricing_cost_sheet_rm_line_traceability` | CSR + restricted RM trace specialist (owner policy required) | P1 | 52 | N / N | CSR View for detailed cost; MCM overlap only after explicit consent | Minimum SKU/run/line/cost; exclude JSON source evidence when not rendered | POLICY+CALLSITE CHECK |
| 8 | `v_costing_pricing_material_rate_issue_lines` | MCM; CCC workbench overlaps | P2 | 35 | Y / N | MCM View; CCC blocker summary if used | Issue id/status/rate absence and suggested action, no vendor lineage | CALLSITE CHECK |
| 9 | `v_costing_pricing_printable_cost_sheet_lines` | CSR or MCM by consumer | P1 | 34 | Y / N | CSR View for detailed cost; MCM overlap only after explicit consent | Minimum SKU/run/line/cost; exclude JSON source evidence when not rendered | POLICY+CALLSITE CHECK |
| 10 | `v_costing_pricing_printable_cost_sheet_product_summary` | CSR or MCM by consumer | P1 | 20 | Y / N | CSR View for detailed cost; MCM overlap only after explicit consent | Minimum SKU/run/line/cost; exclude JSON source evidence when not rendered | POLICY+CALLSITE CHECK |
| 11 | `v_costing_pricing_sku_detailed_cost_sheet` | CSR or MCM by consumer | P1 | 44 | Y / Y | CSR View for detailed cost; MCM overlap only after explicit consent | Minimum SKU/run/line/cost; exclude JSON source evidence when not rendered | POLICY+CALLSITE CHECK |
| 12 | `v_costing_policy_manager_scheme_options` | PPM; CSR scheme-comparison may also consume | P2 | 6 | Y / Y | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 13 | `v_costing_policy_manager_scheme_policy_history` | PPM; CSR scheme-comparison may also consume | P2 | 21 | Y / N | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 14 | `v_costing_policy_manager_selling_policy_history` | PPM; CSR scheme-comparison may also consume | P2 | 20 | Y / N | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 15 | `v_costing_policy_manager_sku_overview` | PPM; CSR scheme-comparison may also consume | P2 | 54 | Y / N | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 16 | `v_costing_pricing_commercial_sales_basis` | PPM; CSR scheme-comparison may also consume | P2 | 37 | Y / N | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 17 | `v_costing_pricing_selected_scheme_policy` | PPM; CSR scheme-comparison may also consume | P2 | 32 | Y / N | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 18 | `v_costing_pricing_sku_scheme_comparison` | PPM; CSR scheme-comparison may also consume | P2 | 37 | Y / Y | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 19 | `v_costing_scheme_master_audit` | PPM governance | P1 | 20 | Y / N | PPM View + audit permission policy decision | Only fields rendered in audit history; actor IDs/old-new remarks restricted if unneeded | POLICY+COLUMN CHECK |
| 20 | `v_costing_scheme_master_register` | PPM; CSR scheme-comparison may also consume | P2 | 34 | Y / Y | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 21 | `v_costing_scheme_policy_rule_register` | PPM; CSR scheme-comparison may also consume | P2 | 34 | Y / Y | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 22 | `v_costing_scheme_policy_scope_options` | PPM; CSR scheme-comparison may also consume | P2 | 16 | Y / Y | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 23 | `v_costing_scheme_policy_selected_overview` | PPM; CSR scheme-comparison may also consume | P2 | 42 | Y / N | PPM View; CSR comparison via approved scoped reader if required | Policy IDs, period/effective dates, scheme, MRP/discount relevant to display | OWNERSHIP+CALLSITE CHECK |
| 24 | `v_costing_cost_pool_monthly_summary` | CBM | P2 | 9 | Y / N | CBM View; approved aggregate cost reader exception | Pool/period/totals/counts, no personnel detail | AGGREGATE REVIEW |
| 25 | `v_costing_expense_allocation_pool_options` | CBM | P3 | 5 | Y / Y | CBM View/options reader where used | Identifier/label/sort/status; omit notes if not needed | OPTIONS MINIMUM |
| 26 | `v_costing_expense_head_mapping_register` | CBM | P2 | 15 | Y / N | CBM View for admin register | Head/pool/provision, period/amount/status; remarks only if actually shown | CALLSITE MINIMUM |
| 27 | `v_costing_manual_cost_pool_monthly_summary` | CBM | P2 | 6 | Y / N | CBM View; approved aggregate cost reader exception | Pool/period/totals/counts, no personnel detail | AGGREGATE REVIEW |
| 28 | `v_costing_manual_cost_pool_provision_register` | CBM | P2 | 16 | Y / N | CBM View for admin register | Head/pool/provision, period/amount/status; remarks only if actually shown | CALLSITE MINIMUM |
| 29 | `v_costing_manual_provision_pool_options` | CBM | P3 | 3 | Y / Y | CBM View/options reader where used | Identifier/label/sort/status; omit notes if not needed | OPTIONS MINIMUM |
| 30 | `v_costing_manual_provision_type_options` | CBM | P3 | 4 | Y / Y | CBM View/options reader where used | Identifier/label/sort/status; omit notes if not needed | OPTIONS MINIMUM |
| 31 | `v_costing_manual_rate_live_rm_blockers` | MCM; CCC workbench overlaps | P2 | 17 | Y / N | MCM View; CCC blocked-status reader exception | Item/rate status/age and action classification; omit vendor lineage where possible | OVERLAP POLICY |
| 32 | `v_costing_manual_rate_manager_action_queue` | MCM; CCC workbench overlaps | P2 | 27 | Y / N | MCM View; CCC blocked-status reader exception | Item/rate status/age and action classification; omit vendor lineage where possible | OVERLAP POLICY |
| 33 | `v_costing_material_manual_rate_history` | CSR or MCM by consumer | P1 | 32 | Y / N | MCM View for vendor-rate detail; CSR-only separately authorised if necessary | Approved rates and status; vendor origin and remarks only for explicitly authorised screen | VENDOR CONFIDENTIALITY |
| 34 | `v_costing_material_manual_rate_register` | CSR or MCM by consumer | P1 | 34 | Y / N | MCM View for vendor-rate detail; CSR-only separately authorised if necessary | Approved rates and status; vendor origin and remarks only for explicitly authorised screen | VENDOR CONFIDENTIALITY |
| 35 | `v_costing_material_manual_rate_review` | MCM; CCC workbench overlaps | P2 | 16 | Y / Y | MCM View; CCC blocked-status reader exception | Item/rate status/age and action classification; omit vendor lineage where possible | OVERLAP POLICY |
| 36 | `v_costing_material_review_acceptance_register` | CCC; MCM overlap requires D3 policy | P1 | 38 | Y / N | CCC View for acceptance register; MCM cross-read separately approved | Acceptance status/date/reference; actor email and notes only for audited detail screen | ACTOR AUDIT POLICY |
| 37 | `v_costing_pricing_control_dashboard` | CCC / CSR / MCM (verify exact source) | P2 | 41 | Y / N | CCC View; CSR/MCM aggregate read where business-approved | KPI/status/count/period/run and summary only | SHARED AGGREGATE |
| 38 | `v_costing_pricing_control_integrity_audit` | CCC / CSR / MCM (verify exact source) | P2 | 5 | Y / N | CCC View; CSR/MCM aggregate read where business-approved | KPI/status/count/period/run and summary only | SHARED AGGREGATE |
| 39 | `v_costing_pricing_material_action_drilldown` | CCC / CSR / MCM (verify exact source) | P2 | 69 | Y / N | CCC View; CSR/MCM restricted drill where needed | SKU/item/action/reason; raw rate and evidence fields excluded unless needed | DRILL POLICY |
| 40 | `v_costing_pricing_material_action_queue` | CCC / CSR / MCM (verify exact source) | P2 | 26 | Y / N | CCC View; CSR/MCM restricted drill where needed | SKU/item/action/reason; raw rate and evidence fields excluded unless needed | DRILL POLICY |
| 41 | `v_costing_pricing_product_status_summary` | CCC / CSR / MCM (verify exact source) | P2 | 9 | Y / N | CCC View; CSR/MCM aggregate read where business-approved | KPI/status/count/period/run and summary only | SHARED AGGREGATE |
| 42 | `v_costing_pricing_review_action_item_drilldown` | CCC / CSR / MCM (verify exact source) | P2 | 34 | Y / N | CCC View; CSR/MCM restricted drill where needed | SKU/item/action/reason; raw rate and evidence fields excluded unless needed | DRILL POLICY |
| 43 | `v_costing_pricing_review_top_action_items` | CCC / CSR / MCM (verify exact source) | P2 | 16 | Y / N | CCC View; CSR/MCM aggregate read where business-approved | KPI/status/count/period/run and summary only | SHARED AGGREGATE |
| 44 | `v_costing_pricing_review_workbench_summary` | CCC / CSR / MCM (verify exact source) | P2 | 10 | Y / N | CCC View; CSR/MCM aggregate read where business-approved | KPI/status/count/period/run and summary only | SHARED AGGREGATE |
| 45 | `v_costing_pricing_sku_control_status` | CCC / CSR / MCM (verify exact source) | P2 | 58 | Y / N | CCC/CSR View based on actual route | SKU, run, status, MRP, aggregate cost, displayed diagnosis only | SKU STATUS CONTRACT |
| 46 | `v_costing_pricing_sku_selector` | CSR; CCC overlaps | P2 | 16 | Y / Y | CCC/CSR View based on actual route | SKU, run, status, MRP, aggregate cost, displayed diagnosis only | SKU STATUS CONTRACT |
| 47 | `v_costing_pricing_sku_status_diagnosis` | CSR; CCC overlaps | P2 | 50 | Y / N | CCC/CSR View based on actual route | SKU, run, status, MRP, aggregate cost, displayed diagnosis only | SKU STATUS CONTRACT |
| 48 | `v_costing_pricing_workflow_diagnostics` | CSR; CCC overlaps | P2 | 24 | Y / N | CCC/CSR View based on actual route | SKU, run, status, MRP, aggregate cost, displayed diagnosis only | SKU STATUS CONTRACT |
| 49 | `v_costing_unmapped_expense_heads_for_mapping` | CBM | P2 | 8 | Y / N | CBM View for admin register | Head/pool/provision, period/amount/status; remarks only if actually shown | CALLSITE MINIMUM |

## Interpretation of the highest-risk contracts

**Personnel (P0):** staff classification/review require *both* CBM View and Edit by the already-approved temporary confidentiality policy; on restricted tabs the client makes no individual-staff request. Staff pool `staff_details` is masked by the server and excluded from the client's explicit aggregate projection. This policy is already released and accepted with bounded residuals; neither recommendation nor matrix weakens it.

**Vendor rates (P1):** MCM's manual-rate register currently uses `.select('*')` and includes originating vendor and negotiated rate fields. Showing an approved rate might be necessary for costing while raw supplier negotiation details should be accessible only when explicitly authorised. No general field removal before an exact UI and export dependency map.

**Named actors/audit (P1):** material acceptance and Scheme Master audit `.select('*')` can transmit named actors, identifiers and notes even when only status/time is needed. Preserve legitimate audit traceability and admin review; restrict unneeded transmission with per-consumer explicit projections and server authority if the data is actually confidential.

**Cost/trace (P1):** the ordinary cost-sheet views contain detailed product cost but are required for Cost Sheet Review. Treat detailed costing confidentiality as distinct from RM/PM source/evidence trace, which may require a specialist role and currently includes a view without `authenticated` SELECT. Do not grant that view for convenience.

**Operational/aggregates (P2/P3):** summary/status and options should remain available to the exact legitimate viewer modules after narrower role mapping. Changing the helper globally without these positive cases could break Costing Control, Material Cost, Cost Build, and Cost Sheet Review workflows.

## Design questions for explicit owner decision (not pre-approved)

1. **Reader model P-W506-VIEW:** approve *hybrid per-view classification with explicit shared summaries and scoped exceptions*, rather than blanket one-of-four access to sensitive detail, **as the planning direction only**. This does **not** authorise changes to all 49 views.
2. **Vendor-source handling:** confirm whether originating vendor identity/rate/remarks may be displayed by MCM View or need a distinct procurement/audit privilege, while retaining rate-governance functions.
3. **Audit-actor handling:** approve role/column criteria for acceptance register and Scheme Master audit history; audit retention must not be lost.
4. **Cost trace granularity:** delineate normal costing details (CSR View), detailed RM/PM origin trace (specialist role), and shared aggregated costing KPI.

## Implementation gate — not yet cleared

**Phase A (next, read-only):** derive *exact* client route, SELECT projection, table render fields, export fields, RPC reads, nested detail and requested status for priority P1 views. Enumerate every real current consumer, not only the original tentative owner. Cross-check `security_invoker` and grants on underlying sources, RLS and SECURITY DEFINER functions via metadata only.

**Phase B (owner approval after A):** approve row-specific `VIEW → verified consumers → minimum columns → exact can_view target / specialist role → permitted cross-module exception → negative role expectations`. Include unknown identity and partial-identity states. The existing W5-06 staff policy is immutable absent new explicit approval.

**Phase C (isolated proof):** build non-production synthetic fixtures for positive/negative roles, unknown grants, revoked grants, export and cross-module dashboards; confirm parity. Draft one small reviewable migration/client PR per sensitivity family, with rollback and client compatibility.

**Phase D (only after separate release approval):** staged production migration/deploy with explicit approval, monitoring, rollback and no interruption of legitimate costing reads.

**Stop rules:** no broad helper rewrite; no guessed cross-module grants; no production role change or RLS/GRANT/revoke; no preview/Save/Close/refresh RPCs; no execution of unknown functions for evidence; no salary or supplier record exports; no silent promotion of NT/F acceptance states.

## Documentation and status

Sources: [original 49-view inventory](WP05_W506_49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY_2026-11-09.md), [R2 live readback](WP05_R2_LIVE_PRM_F1_DEFINITION_AND_SHARED_VIEW_READBACK_2026-11-10.md), [R2 priority consumers](WP05_R2_NINE_SENSITIVE_VIEW_CLIENT_CONSUMER_READBACK_2026-11-10.md), [approved Staff Governance residual record](WP05_W506_CONF_01_OWNER_RESIDUAL_DISPOSITION_2026-11-10.md), [B1 retained-gate ledger](WP05_B1_RETAINED_GATE_EXECUTION_LEDGER_2026-11-10.md).

**This design does not change WP05's 40-lens evidence (13 P / 4 historic F / 2 restricted NA / 21 NT), W5-06 scoped personnel acceptance, or programme 6/13.**
