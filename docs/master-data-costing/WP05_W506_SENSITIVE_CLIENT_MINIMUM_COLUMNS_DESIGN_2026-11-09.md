# WP05 W5-06 — targeted client-data minimisation and sensitive-view hardening design (9 November 2026)

**DESIGN / NOT IMPLEMENTED.** This follows the merged 49-view catalogue inventory (#250). It documents *actual* client reads and visible column uses in current repository files. No production row query, identity test, RPC execution, schema/ACL/client code change, flag or deployment. WP05 OPEN, programme 6/13, W5-06 OPEN, B1 remains a draft.

## 1. Why the client view boundaries matter

A shared `fn_costing_view_allowed()` view grant plus a module's own navigation guard are **not equivalent to per-view least privilege**. The network response of a `select('*')` includes columns not necessarily displayed. Therefore merely hiding a column in HTML **does not protect it**. Conversely, removing fields from a request might disrupt edit drawers, search, sorting or exports even when the main table looks correct. A permission policy must be enforced at the server/view/API boundary; client projection is defense-in-depth and data minimisation, **not authorization**.

## 2. Actual repository client reads — exact findings

| Screen / read | Actual request | Fields proven in visible table or sort | Extra sensitive fields in live view, not proven necessary for that table | Decision |
|---|---|---|---|---|
| **CBM Staff Governance — Classification Register** `public/shared/js/costing-suite-cost-build.js` `loadStaffGovernanceRows` | `v_costing_staff_classification_register.select('*')`, order by `classification_status,employee_code` | `classification_status,employee_code,staff_id,staff_display_name,designation,total_salary_cost,costing_class_label,costing_class,allocation_pool,effective_from,allocation_weight,remarks`. Action button passes row to edit path | `basic_salary,allowance_amount,employer_contribution,other_salary_cost,salary_source_note` etc. **No direct use of `basic_salary` located in this controller; editor dependencies not exhaustively traced** | Candidate explicit projection, but **do not deploy until edit workflow and export verified** |
| **CBM Staff Governance — Staff Review Queue** same controller | `v_costing_unclassified_staff_for_costing.select('*')`, sort `classification_status,total_salary_cost,employee_code` | `staff_id,staff_display_name,employee_code,designation,latest_salary_period_start,total_salary_cost,costing_class_label,costing_class,allocation_pool,classification_note,salary_source_note,classification_status`. Action Review/Edit receives row | Same individual salary components as classification register (basic, allowance, employer, other) not used in visible table; may be used in elsewhere in edit or export | Candidate explicit projection after all consumers checked |
| **CBM Staff Governance — Staff Pool Summary** same controller | `v_costing_staff_cost_pool_summary.select('*').eq('period_start',activePeriodStart)` | Visible table uses `period_start,allocation_pool,costing_class_label/costing_class,staff_count,pool_amount,pool_status` | `staff_details` (nested data) is fetched but no reference to `staff_details` located within `costing-suite-cost-build.js` | **Strongest immediate client-projection candidate:** drop `staff_details` from read only after confirming shared search/export/raw row consumers |
| **MCM Manual Rate Manager** `public/shared/js/costing-suite-material-cost.js` | `v_costing_material_manual_rate_register.select('*')`; history and review queries also `select('*')` | Register uses `stock_item_name,register_status,manual_rate_id` sort; provenance renderer uses `source_vendor_display_name,source_vendor_id,source_vendor_rate_id` and further source fields. Source vendor information is visibly used, not merely unused baggage | Some audit/provenance columns may be necessary to detail, export or history; not isolated here | **Do not remove vendor fields by guesswork**; trace detail and historical record requirements |
| **MCM / CCC material acceptance** `public/shared/js/costing-suite-material-cost.js` | acceptance records loaded for workbench; `accepted_by_email` and `acceptance_reason/note` are rendered | Accepted actor email and timestamp displayed in accepted detail card | Email and notes are therefore **intentionally exposed to this consumer**; question is which roles may see them | Server policy / actor-display decision required; no projection-only fix |
| **CSR Printable Cost Sheet Explain** `public/shared/js/costing-suite-cost-sheet.js` | `TRACEABILITY_VIEW=v_costing_pricing_cost_sheet_line_traceability`, `PRINTABLE_LINES_VIEW` | `trace_formula,trace_summary,trace_source_snapshot,source_note,evidence_json` used in explain pipeline. `evidence_json` rendered through a whitelisted metadata-key list, but JSON still fetched | Raw JSON may contain more keys than the UI prints; raw payload exposure requires separate column/service policy | Avoid dropping explain data without preserving verified explain behavior |

**Proof limits:** The view definitions/columns came from 9 Nov live metadata; the client usages are source reads from connected GitHub `main` at this review. “Not located” means the inspected controller did not reference the field—not a full-program proof. Cross-module exports, generic table tooling, cached raw rows, edit form payloads and foreign callers remain to be enumerated. No row values were inspected.

## 3. Minimum-column request candidates (not deployable code)

For each Staff Governance tab, the following *candidate UI projection* covers the visible grid and the known sorting path. It is deliberately **not certified to preserve edit, export, search, dialogs or downstream callers**:

```js
// Proposed only — NOT applied.
// Classification Register
.select("staff_id,employee_code,staff_display_name,designation,classification_status,total_salary_cost,costing_class,costing_class_label,allocation_pool,effective_from,allocation_weight,remarks")
// Review Queue
.select("staff_id,employee_code,staff_display_name,designation,classification_status,latest_salary_period_start,total_salary_cost,costing_class,costing_class_label,allocation_pool,classification_note,salary_source_note")
// Staff Pool Summary
.select("period_start,allocation_pool,costing_class,costing_class_label,staff_count,pool_amount,pool_status")
```

After mapping hidden dependencies, **add only essential fields**, verify sorting/filter/export and edit payload parity, and test whether separate protected detail RPC/view is needed. The projected list cannot be used as a blanket access-control solution: the original `public` view remains directly queryable by anyone granted effective access. Staff Governance already visibly shows `total_salary_cost` and individual identities, so the owner must decide whether CBM view access is sufficient for such display before authorising changes.

## 4. Proposed server authorization model — no SQL migration authorised

| Data class | Proposed policy | Compatibility risk / evidence required |
|---|---|---|
| **Staff identity + salary details** | CBM view **plus** an explicit staff-costing/HR-confidential role if approved by owner; provide only operational aggregate totals to other Costing modules | Existing CBM view-only colleagues may currently rely on classification register; enumerate actual authorised staff and intended duty before change. Do not silently block legitimate payroll/costing work |
| **Staff pool aggregated amounts** | Cross-module summary permitted only if owner determines totals genuinely needed; remove nested identifiable `staff_details` from broad projection | Confirm current pool summary grid/export doesn't consume nested details; confirm no indirect access through other views |
| **Vendor/source purchase offers** | MCM readers with legitimate procurement-costing duty; any CCC/CSR shared exposure must be explicitly justified and minimum-column | History/provenance is actually displayed by MCM; do not strip trace necessary to audit rate selection |
| **RM/PM trace and fine-grained costs** | Preserve explicit `role:material-cost-rm-trace` / `role:material-cost-pm-trace` policy; review each public trace view separately | Verify server path; absence of authenticated SELECT on RM-line trace is not sufficient to classify other trace views |
| **Accepted-by actor email / notes** | Audit detail available only to legitimate CCC/MCM reviewers or an explicitly governed audit role | UI currently displays email and notes; owner decides retention, purpose and cross-module visibility |
| **General costing/status/pricing summaries** | Preserve documented shared reporting requirements; where needed publish dedicated safe aggregate views rather than globally loosening sensitive views | Flag/cross-module regression and permissions parity before any change |

Implementation sequencing if eventually approved: (1) owner-owned policy matrix per sensitive view; (2) map actual positive consumer/role and need-to-know; (3) build nonproduction tests and explicit precondition hash/rollback; (4) versioned migration plus optional client projection changes in isolated PR; (5) independent review and **separate owner rollout approval**. Do not globally rewrite `fn_costing_view_allowed` or broad `REVOKE` on live database.

## 5. Exact next acceptance dependency

One owner policy decision is required **before writing an implementation migration**: should per-person salary/cost-classification information remain accessible to every CBM-view user, or must it require a dedicated personnel-costing role? A recommended safe principle is **dedicated role for individual pay data**, with nonidentifying cost pool totals where broader reporting is necessary. This is a recommended policy direction, **not approval**.

A small client worker package can now inspect the full raw-row dependency graph (table tools, CSV/export, edit drawer and any generic search) and write static regression tests around the three Staff Governance selectors. Until that review, no SELECT projection should be changed.

**W5-06 OPEN; WP05 OPEN; 6/13; AE1 13 P / 4 historical F / 2 NA / 21 NT; shared §8 binding and B1 not yet final-approved.**
