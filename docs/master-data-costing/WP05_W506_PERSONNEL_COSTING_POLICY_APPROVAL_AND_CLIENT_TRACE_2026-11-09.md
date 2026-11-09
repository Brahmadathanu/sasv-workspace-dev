# WP05 W5-06 — owner personnel-costing policy and compatibility-gated implementation preparation (9 November 2026)

**Owner policy direction approved; implementation NOT approved.** The owner responded “I agree with you and go ahead” to the recommendation that individual staff remuneration should require an additional dedicated personnel-costing permission instead of general Cost Build Manager view permission, while legitimate nonidentifying aggregate labour-cost reporting remains available. This is approval to **prepare** the design, dependency trace and compatibility tests, not permission to create roles, change grants, restrict live views, call writer RPCs, deploy, or modify employee data.

**Formal status:** W5-06 OPEN; WP05 OPEN; programme 6/13; original shared §8 still binding; B1 remains draft; AE1 13 P / 4 historical F / 2 restricted NA / 21 NT unchanged.

## 1. Approved business-policy direction — boundaries

- **Individual employee identity combined with remuneration, classification or salary source** requires dedicated authorisation above generic `module:cost-build-manager` view; exact canonical permission identifier, owner administration and readers remain **TO DESIGN** and require explicit approval before live implementation.
- **Operational aggregate staffing pool totals** may be shared with the modules that genuinely need them, with no nested employee-detail payload unless separately authorised.
- **Existing legitimate staff-costing editors must not lose function through an untested blanket revoke**; map their job roles and the independent edit permission before any design is enacted.
- **Do not confuse client data minimisation with server access control**. An explicit client column list only reduces the fetched payload on that screen. Original salary views still need server-side per-view protection or an approved separate narrow projection.
- The owner did **not** approve the exact new permission string, initial assignees, granting mechanism, production rollout, B1 final adoption, or security test execution. Each is still a separate gate.

## 2. Client dependency trace — repo-confirmed

Source: `public/shared/js/costing-suite-cost-build.js` and `public/shared/js/costing-suite-shell.js` on `main` at review time. Live view column metadata and existing sensitivity classification in `WP05_W506_SENSITIVE_CLIENT_MINIMUM_COLUMNS_DESIGN_2026-11-09.md`.

| Existing client read | Verified uses | Required further checks before client projection change |
|---|---|---|
| `v_costing_staff_classification_register.select('*')` | Sort classification status and employee code; table includes employee name/code, designation, **individual total_salary_cost**, class, pool, dates, remarks, weight; row Edit button passes row to editor | Query's full fields used in generic shell table search, CSV/export and row selection; ensure editor class/pool/effective date/weight/remarks and role-safe fallback |
| `v_costing_unclassified_staff_for_costing.select('*')` | Sort classification status, **total_salary_cost** and employee code; review grid shows salary total, salary period, classification note or salary-source note, person and class; Review/Edit uses row | Preserve sort/filter and remarks fallback; ensure no additional hidden salary fields needed by table tooling |
| `v_costing_staff_cost_pool_summary.select('*')` with period filter | Grid displays period, allocation pool, costing class, staff count, pool amount and status | `staff_details` fetched but no direct reference found in cost-build controller; check generic shell CSV/search, downloads, other consumers before removing |
| `costBuildCtrl.openStaffClassificationEditModal(row)` | Reads staff ID/name/code/designation, costing class, effective_from, allocation_weight, remarks/classification_note. Save path uses staff_id and user form values | Do not remove values needed by editor or row-dependent actions |
| `costing-suite-shell.js` | Stores `loadStaffGovernanceRows` result in `ALL_ROWS`, uses shared `VIEW`, dispatches Staff Governance action rows from `VIEW[index]` | Global search/filters, table-tools sorting, CSV/exports, full raw-row lifecycle and paging must be traced before minimisation |
| MCM/CSR other sensitive reads | Vendor rate provenance, actor email and Cost Sheet trace formula/evidence **are displayed or processed** | Do not remove those fields merely because they are sensitive. Separate module-specific role policies required |

**Important:** `total_salary_cost` is deliberately visible in current Staff Classification and Staff Review grids. Reducing other salary component columns alone cannot make those grids safe for generic CBM readers. The server-side view/API path must prevent unauthorized row access to identifiable salary totals, and the UI must provide an intentional restricted experience for nonauthorised CBM readers. No existing personnel-costing role is assumed to have been created or assigned.

## 3. Governed implementation design alternatives (none adopted)

**Recommended separation (subject to impact analysis):**

1. **Protected personnel-costing detail**: preserve individually identified salary/classification register and unclassified review behind a **separate canonical permission**, enforced by server-side access policy. This can be an appropriately gated view or guarded read RPC; select strategy only after checking existing PostgREST consumers, security-definer/invoker consequences, performance and permission primitives. Do not infer access from hiding the navigation.
2. **Safe aggregated pool view**: provide staff/pool counts and total amounts without `staff_details`, employee codes or identity-containing nested JSON for legitimate cross-module costing consumers. A simple explicit client projection does not eliminate the risk of direct queries to the broad underlying view; server restrict or offer an explicit safe aggregate API.
3. **Client role-aware operation**: a generic CBM viewer sees allowed aggregates plus a truthful “Personnel-costing detail requires additional permission” explanation. An authorised staff-costing reviewer retains the existing three-tab workflow and governed edit path, with role-appropriate tests.
4. **No abrupt global helper change**: `fn_costing_view_allowed` is shared by 49 views and is not the right place for a blanket restrictive rewrite.
5. **Dedicated role management**: identify who may grant the new permission, the smallest existing eligible role cohort, revocation, logging and audit requirements. No user-specific grant or account inventory is requested in this package.

## 4. Required client-worker evidence BEFORE code PR

Claude can perform the following work on source **without Supabase, authentication, browser or deployment**:

- Exhaustively trace `ALL_ROWS`, `VIEW`, `applyFilters`, table-tools, table search and CSV/export for **Staff Governance only**, including both flag OFF/ON paths at 1280/390 where relevant.
- Produce an exact field-dependency inventory with evidence `file:function`, separating **grid display, sort, search, edit, modal, export, and raw-row propagation**. Confirm whether `staff_details` is used by *any* loaded client consumer.
- Evaluate the three proposed explicit projection lists against *all* discovered consumers; identify missing columns and never silently drop a field used for actions/audit.
- Derive a role-aware UI design that **does not leak salaries to generic CBM-view users**, with precise failure/restricted states. No policy bit/key invention or premature implementation.
- Provide deterministic static/regression test **plan** for authorized personnel-costing reader/editor, generic CBM-only viewer, CSR-only ID-O, ID-N, ID-X; assert no sensitive request is sent under disallowed identity. Include historic permissions, both flag states, search, export, edit, period switch, empty staff queue, and error/no-write cases.
- Output one docs-only draft PR, evidence/decision matrix, and clearly identify requirements for later isolated server migration and positive/negative role tests. **No code modification, no PR merge, no live SQL/RPC** under this package.

## 5. Non-negotiable future implementation gates

A. Owner approves **exact permission identifier and authorized duty cohort** (not individual names in Git), sensitive-view-to-module map, intended aggregate availability, and what an unauthorized CBM user sees.

B. Server design reviewed: default deny, exact view definitions and precondition hashes, PostgREST schema/API exposure, SEC-A1/A2 side effects, RLS/security invoker/definer/ACLs, tests on isolated synthetic instance, and rollback/dependency plan.

C. Client code reviewed separately, with failing-before/passing-after tests against data minimisation, search/export/editor and restricted fallback.

D. Only after **explicit owner implementation approval**: governed branch, migration/test PR, review and **separate controlled production release approval**. No silent live privilege change during documentation or inspection.

This does not discharge W5-06 behavioural negative-identity/server-denial criteria or amend the shared §8 contract. WP05 remains OPEN, 6/13.
