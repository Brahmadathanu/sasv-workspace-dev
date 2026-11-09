# WP05 W5-06 — 49-view column-sensitivity and consumer review inventory (9 November 2026)

**Status: LIVE METADATA + REPOSITORY-CORROBORATED CLIENT MAPPING; DESIGN PROPOSAL ONLY.** No row data, auth identity, application RPC, mutation, GRANT/REVOKE or deployment. WP05 OPEN; 6/13; W5-06 OPEN. This inventory supersedes no governed security policy and does not authorise permission changes.

## Evidence method and interpretation

- Live PostgreSQL catalogue: selected the same 49 cost-named `public` views whose `pg_get_viewdef(...)` contains `fn_costing_view_allowed`; read *column names/types only*, authenticated SELECT ACL and reloptions, plus view-definition MD5. **This is schema metadata, not effective per-user row access.**
- Actual app read paths were checked against repository A1 inventory (`WP05_A1_LENS_AND_WORKSPACE_INVENTORY_2026-11-02.md`) plus direct GitHub code searches. Where a view has no direct per-view consumer verified in this pass, the target in the table is **PROPOSED**, not a confirmed consumer.
- Classification: **HIGH** means investigate before any broad reader access because columns suggest personnel pay, named actors, RM/PM trace or detailed purchasing/cost. **MEDIUM** means commercial/operational cost sensitivity and per-module ownership review. These are **triage labels**, not an approved enterprise classification. Even an ostensibly low-risk option view requires a role/consumer check.
- `authenticated` SQL role has SELECT on 48/49; `v_costing_pricing_cost_sheet_rm_line_traceability` is the exception. Twelve views have `security_invoker=true`; inspect underlying source privileges/RLS before judging their real exposure.
- Names/roles recorded below need a formal **least-privilege business decision**. Do **not** globally replace `fn_costing_view_allowed` or revoke existing grants while client/shared-workflow dependencies are unresolved.

## High-priority column evidence (catalogue-confirmed)

| Exact view | Relevant column names (not sample values) | Verified client consumer / status | Why review |
|---|---|---|---|
| `v_costing_staff_classification_register` | `employee_code, staff_display_name, designation, basic_salary, allowance_amount, employer_contribution, other_salary_cost, total_salary_cost` | CBM `staff-governance` direct client `.select('*')` | Individual remuneration / staff identities |
| `v_costing_unclassified_staff_for_costing` | Same named employee and salary fields | CBM staff-governance documented A1, exact current client call not separately rechecked | Even an empty queue has a sensitive projection |
| `v_costing_staff_cost_pool_summary` | `staff_details, pool_amount, staff_count, period_start` | CBM staff-governance client `.select('*').eq('period_start',...)` | Nested `staff_details` may expose individuals; contents not queried |
| `v_costing_staff_costing_class_options` | `costing_class, costing_class_label, default_allocation_pool, class_note` | CBM Staff Governance A1 | Low metadata sensitivity **relative to salary views**, but current shared rule still needs ownership review |
| `v_costing_material_review_acceptance_register` | `accepted_by, accepted_by_email, acceptance_reason, acceptance_note` | CCC Control Workbench A1 | Named staff action/audit text; D3 edit authority overlap |
| `v_costing_material_manual_rate_register` | `source_vendor_id, source_vendor_display_name, source_rate_value, rate_value, source_remarks` | MCM manual-rate-manager direct client `.select('*')` | Vendor and negotiated purchasing details |
| `v_costing_pricing_cost_sheet_line_traceability` | `trace_formula, evidence_json, drill_filter_json, source_snapshot` | CSR printable-cost-sheet direct constant in client | Fine-grained costing and lineage details |
| `v_costing_pricing_cost_sheet_rm_line_traceability` | `purchase_stock_item_name, selected_rate, rm_cost_per_sku_line` | Direct current client call not verified | Extra trace sensitivity; no `authenticated` SELECT grant |
| `v_costing_scheme_master_audit` | `actor_user_id, old_scheme_name, new_scheme_name` | PPM Scheme Master A1 | Named/internal action audit |

## Complete 49-row review register

Columns `Proposed owning domain` and `Review priority` are **not** claims that an access policy has been approved. `Consumer evidence` says **exact code** only for searched calls, otherwise **A1 inventory** when documented, or **not independently mapped**.

| # | Exact view | Proposed owning domain | Priority / reason | Consumer evidence |
|---:|---|---|---|---|
| 1 | `v_costing_staff_classification_register` | CBM; staff HR/costing steward | HIGH (personnel) | CBM staff-governance; `costing-suite-cost-build.js` exact `.select('*')` |
| 2 | `v_costing_staff_cost_pool_summary` | CBM; staff HR/costing steward | HIGH (personnel) | CBM staff-governance; `costing-suite-cost-build.js`, selected-month filter |
| 3 | `v_costing_staff_costing_class_options` | CBM; staff HR/costing steward | HIGH (personnel) | A1 module/lens inventory; exact call not independently rechecked |
| 4 | `v_costing_unclassified_staff_for_costing` | CBM; staff HR/costing steward | HIGH (personnel) | A1 module/lens inventory; exact call not independently rechecked |
| 5 | `v_cost_sheet_snapshot_sku_monthly_comparison` | CSR or MCM by consumer | HIGH / granular costing or vendor | A1 module/lens inventory; exact call not independently rechecked |
| 6 | `v_costing_pricing_cost_sheet_line_traceability` | CSR or MCM by consumer | HIGH / granular costing or vendor | CSR printable-cost-sheet; `costing-suite-cost-sheet.js` TRACEABILITY_VIEW |
| 7 | `v_costing_pricing_cost_sheet_rm_line_traceability` | CSR + restricted RM trace specialist (owner policy required) | HIGH (RM trace; already ACL-restricted) | A1 module/lens inventory; exact call not independently rechecked |
| 8 | `v_costing_pricing_material_rate_issue_lines` | MCM; CCC workbench overlaps | MEDIUM / vendor & rates | A1 module/lens inventory; exact call not independently rechecked |
| 9 | `v_costing_pricing_printable_cost_sheet_lines` | CSR or MCM by consumer | HIGH / granular costing or vendor | CSR printable-cost-sheet; `costing-suite-cost-sheet.js` PRINTABLE_LINES_VIEW |
| 10 | `v_costing_pricing_printable_cost_sheet_product_summary` | CSR or MCM by consumer | HIGH / granular costing or vendor | A1 module/lens inventory; exact call not independently rechecked |
| 11 | `v_costing_pricing_sku_detailed_cost_sheet` | CSR or MCM by consumer | HIGH / granular costing or vendor | A1 module/lens inventory; exact call not independently rechecked |
| 12 | `v_costing_policy_manager_scheme_options` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 13 | `v_costing_policy_manager_scheme_policy_history` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 14 | `v_costing_policy_manager_selling_policy_history` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 15 | `v_costing_policy_manager_sku_overview` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 16 | `v_costing_pricing_commercial_sales_basis` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 17 | `v_costing_pricing_selected_scheme_policy` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 18 | `v_costing_pricing_sku_scheme_comparison` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 19 | `v_costing_scheme_master_audit` | PPM governance | HIGH / actor IDs | A1 module/lens inventory; exact call not independently rechecked |
| 20 | `v_costing_scheme_master_register` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 21 | `v_costing_scheme_policy_rule_register` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 22 | `v_costing_scheme_policy_scope_options` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 23 | `v_costing_scheme_policy_selected_overview` | PPM; CSR scheme-comparison may also consume | MEDIUM / commercial | A1 module/lens inventory; exact call not independently rechecked |
| 24 | `v_costing_cost_pool_monthly_summary` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 25 | `v_costing_expense_allocation_pool_options` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 26 | `v_costing_expense_head_mapping_register` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 27 | `v_costing_manual_cost_pool_monthly_summary` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 28 | `v_costing_manual_cost_pool_provision_register` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 29 | `v_costing_manual_provision_pool_options` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 30 | `v_costing_manual_provision_type_options` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |
| 31 | `v_costing_manual_rate_live_rm_blockers` | MCM; CCC workbench overlaps | MEDIUM / vendor & rates | A1 candidate or unverified; exact call-site mapping pending |
| 32 | `v_costing_manual_rate_manager_action_queue` | MCM; CCC workbench overlaps | MEDIUM / vendor & rates | A1 candidate or unverified; exact call-site mapping pending |
| 33 | `v_costing_material_manual_rate_history` | CSR or MCM by consumer | HIGH / granular costing or vendor | A1 candidate or unverified; exact call-site mapping pending |
| 34 | `v_costing_material_manual_rate_register` | CSR or MCM by consumer | HIGH / granular costing or vendor | MCM manual-rate-manager; `costing-suite-material-cost.js` exact `.select('*') |
| 35 | `v_costing_material_manual_rate_review` | MCM; CCC workbench overlaps | MEDIUM / vendor & rates | A1 candidate or unverified; exact call-site mapping pending |
| 36 | `v_costing_material_review_acceptance_register` | CCC; MCM overlap requires D3 policy | HIGH / action actor+email | A1 candidate or unverified; exact call-site mapping pending |
| 37 | `v_costing_pricing_control_dashboard` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 38 | `v_costing_pricing_control_integrity_audit` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 39 | `v_costing_pricing_material_action_drilldown` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 40 | `v_costing_pricing_material_action_queue` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 41 | `v_costing_pricing_product_status_summary` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 42 | `v_costing_pricing_review_action_item_drilldown` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 43 | `v_costing_pricing_review_top_action_items` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 44 | `v_costing_pricing_review_workbench_summary` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 45 | `v_costing_pricing_sku_control_status` | CCC / CSR / MCM (verify exact source) | MEDIUM / operational | A1 candidate or unverified; exact call-site mapping pending |
| 46 | `v_costing_pricing_sku_selector` | CSR; CCC overlaps | MEDIUM / SKU-level | A1 candidate or unverified; exact call-site mapping pending |
| 47 | `v_costing_pricing_sku_status_diagnosis` | CSR; CCC overlaps | MEDIUM / SKU-level | A1 candidate or unverified; exact call-site mapping pending |
| 48 | `v_costing_pricing_workflow_diagnostics` | CSR; CCC overlaps | MEDIUM / SKU-level | A1 candidate or unverified; exact call-site mapping pending |
| 49 | `v_costing_unmapped_expense_heads_for_mapping` | CBM | MEDIUM / operational finance | A1 candidate or unverified; exact call-site mapping pending |

**Integrity check:** 49 rows = 4 staff + 7 cost sheets/detail + 12 pricing + 26 other. The inventory is exhaustive **for the bounded 49 helper-gated names**, not all views or all possible function/data paths.

## Compatibility/least-privilege design recommendation — NOT AUTHORISED

1. **First preserve:** existing shared view access remains untouched. A broad helper rewrite could break Cost Sheet Review, CCC drills, Material Cost Manager and the cost-build administrative screens; SQL `security_invoker` means underlying privileges vary.
2. **Prioritise staff compensation:** explicitly decide whether CCC-only, CSR-only and MCM-only viewers should receive *any* person-level pay and nested `staff_details`. **Suggested target**: retain salary-bearing detail in a CBM-specific protected path (or dedicated HR/costing role), while exposing only appropriately aggregated pool totals to legitimately cross-module consumers. Distinguish staff-identifying from de-identified counts. This is a policy proposal, not automatically correct.
3. **Separately protect RM/PM trace and vendor rates:** preserve existing trace-role restrictions; compare public trace views and supplier origin fields with the role-specific RPCs and signed-in UI consumers. Protect provider/contract data independently of generic module view.
4. **Avoid breaking legitimate shared summaries:** CCC/CSR/MCM/PPM may need some common status or pricing aggregates. For each view, record direct consumers and delegated RPCs, business minimum columns, intended permission target, underlying RLS, integration tests and a rollback strategy.
5. **No auto GRANT/REVOKE:** only after the owner agrees a row-specific matrix, prepare an isolated migration candidate with precondition hashes, exact ACL/column change diff, positive authorized-role tests, negative-role tests and rollback, without applying it to production.
6. **W5-06 remains open:** ID-N, ID-X, ID-O actual read-only behaviour and SEC writer-denial remain untested. Do not use a row-level SELECT from sensitive views merely for security discovery.

## Next precise task (no repeated broad audit)

For the nine high-priority examples above, finish per-client read-site verification and identify which columns are rendered/downloadable versus merely returned by `.select('*')`. This is critical: a client that fetches full salary columns may transmit them even if the UI hides them. Then write a `VIEW → route → minimum columns → required role → cross-module exception` proposal; review with the owner before any security change.

**Formal contract:** WP05 OPEN, programme 6/13; B1 still draft; shared §8 binding; AE1 13 P / 4 historical F / 2 NA / 21 NT unchanged.
