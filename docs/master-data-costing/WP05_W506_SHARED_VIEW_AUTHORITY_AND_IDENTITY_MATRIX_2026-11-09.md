# WP05 W5-06 — shared view and restricted-function authority boundary (9 November 2026)

**LIVE CATALOGUE OBSERVATION + PROPOSED GOVERNANCE DECISION / NOT IMPLEMENTED.** Project: `qhmoqtxpeasamtlxaoak`. Evidence from SELECT-only `pg_class`, `pg_get_viewdef`, `has_table_privilege`, `has_schema_privilege`, and `has_function_privilege`. No application RPC, view-data read, authenticated user session, negative-identity test, DML, GRANT/REVOKE, auth/flag/deploy performed. Workpack WP05 OPEN; programme **6/13**; W5-06 OPEN; original shared §8 binding, narrow B1 still a **draft**.

## 1. Observed shared view scope (precise and bounded)

Among **63** `public` views/materialised views in the namespace-and-name-filter `v_costing_%` / `v_cost_sheet_%`:
- **49** live `pg_get_viewdef` bodies reference `public.fn_costing_view_allowed()`; of those, **48** grant `SELECT` to Postgres role `authenticated`, **one does not** (`v_costing_pricing_cost_sheet_rm_line_traceability`).
- **None** of those 49 grants `SELECT` to Postgres role `anon`. Twelve of 49 show `security_invoker=true` in relation options; whether base-table privileges and RLS permit a given `security_invoker` read **was not tested**.
- Fourteen further cost-named public views do not contain that shared gate text; **all fourteen** grant authenticated `SELECT` in the bounded catalogue count. They may use different security gates or rely on other conditions; **do not infer unguarded access** from the absence of this exact helper text.
- In the live function body `fn_costing_view_allowed()`, allowed means PostgreSQL `service_role/postgres` OR an application **view** grant for any one of `module:costing-control-center`, `module:cost-build-manager`, `module:cost-sheet-review`, or `module:material-cost-manager`. The function does **not** distinguish the four modules on individual views, and does **not** directly accept a PRM-only or PPM-only grant. There may be additional per-view restrictions; no comprehensive effective authorization claim is made for every view.

**Governance implication, not a proven breach:** if the helper is the controlling condition and the caller has sufficient privileges for the target view, a single CSR/CCC/CBM/MCM view grant can satisfy the shared helper even for a differently named costing module's view. In particular, classification/salary-sensitive projections require an explicit business-need and least-privilege assessment. No personal, salary or row-level data were queried here.

### 1.1 Named view inventory — preliminary review buckets only

A second SELECT-only catalogue read returned the **exact 49 helper-gated names** and their current role-SELECT flag and `security_invoker` reloptions. The following **name-based buckets are review priorities, not authoritative sensitivity/role classifications**. No view rows were queried.

- **Staff / personnel review (4):** `v_costing_staff_classification_register`, `v_costing_staff_cost_pool_summary`, `v_costing_staff_costing_class_options`, `v_costing_unclassified_staff_for_costing`. All four have authenticated SELECT at role level. Particular attention: classification/payroll-related columns must be inventoried before any claim that CSR-only view should legitimately read them.
- **Cost-sheet/detail/trace review (7):** `v_cost_sheet_snapshot_sku_monthly_comparison`, `v_costing_pricing_cost_sheet_line_traceability`, `v_costing_pricing_cost_sheet_rm_line_traceability`, `v_costing_pricing_material_rate_issue_lines`, `v_costing_pricing_printable_cost_sheet_lines`, `v_costing_pricing_printable_cost_sheet_product_summary`, `v_costing_pricing_sku_detailed_cost_sheet`. The RM-line trace view is the **only** helper-gated view without authenticated SELECT; another trace view does have role-level SELECT, which is not proof of effective access.
- **Pricing/policy review (12):** `v_costing_policy_manager_scheme_options`, `v_costing_policy_manager_scheme_policy_history`, `v_costing_policy_manager_selling_policy_history`, `v_costing_policy_manager_sku_overview`, `v_costing_pricing_commercial_sales_basis`, `v_costing_pricing_selected_scheme_policy`, `v_costing_pricing_sku_scheme_comparison`, `v_costing_scheme_master_audit`, `v_costing_scheme_master_register`, `v_costing_scheme_policy_rule_register`, `v_costing_scheme_policy_scope_options`, `v_costing_scheme_policy_selected_overview`.
- **Other costing/control/material workbench review (26):** remaining 26 named views include cost pools, manual rates, material review acceptance, costing dashboard, readiness/status and review queues; their individual columns and ownership remain to be classified before changing the gate.

**Observed group totals: 4 + 7 + 12 + 26 = 49.** In this catalogue read, all but RM-line trace have role-level authenticated SELECT. Twelve of the 49 are `security_invoker=true`; any permission matrix must consider their underlying table access. A string/name bucket is not a replacement for column-level inspection and policy-owner sign-off.

## 2. Internal-source review writer ACL

At readback:
- `authenticated` has `USAGE` on schema `costing`, `EXECUTE` on `costing.rpc_accept_internal_source_material_review_action(date,bigint,text,text,text,text,text)`.
- `anon` has neither `costing` USAGE nor direct EXECUTE.
- Its live function body begins with authenticated-user validation and `public.require_permission('module:costing-control-center',true)`, which requires both `can_view` and `can_edit` on CCC in the canonical permission source. Thus reachability and successful writer authorization are **distinct**.
- Session `current_setting('pgrst.db_schemas',true)` returned NULL in this SQL session. **This does not establish whether `costing` is exposed through the production Data API**. Do not claim PostgREST reachability from SQL ACL alone.
- Related SEC-A1 public wrappers expose authenticated `EXECUTE` but delegate to guarded internal functions; approval-preview SEC-A2 `rpc_costing_preview_approval_impact` is explicitly mutating and remains outside any read-only runner.

**Disposition:** review this direct internal EXECUTE grant for defense in depth. No permission revoke is authorised; changing it without dependency mapping may interrupt legitimate internal callers.

## 3. Exact identity versus contract expectations (NOT TESTED)

| Identity | Contractual grants, subject to owner-side confirmation | CCC-specific writer protected by `require_permission(CCC,true)` | Shared `fn_costing_view_allowed()` result under intended grants | What *cannot* yet be claimed |
|---|---|---|---|---|
| ID-V | Six costing modules VIEW, zero EDIT | **DENY expected** | **ALLOW expected** via one-of-four | No direct negative writer test |
| ID-N | No costing grants | **DENY expected** | **DENY expected** | No authenticated server evidence |
| ID-X | CCC EDIT=true, VIEW=false | **DENY expected**, because `can_view` also required | **DENY expected**, absent any other grants | This unusual state is a proposed identity contract, not verified live provisioning |
| ID-O | CSR VIEW only | **DENY expected** for CCC edit | **ALLOW expected** under current shared helper for its covered views | Universal denial of all CCC views is **not an appropriate test oracle** while this helper stands |

These are **logical implications of the *inspected* definitions**, not observed identity outcomes. In particular a denied/allowed shared view must be chosen individually after inspecting its own definition, ACL, `security_invoker` and underlying data access. Do not mistake absence of a client link for proof of server denial.

## 4. Owner policy question — a precise choice, not silently decided

**Policy P-W506-VIEW:** Is the shared one-of-four view rule an intentional *Costing-wide reader role*, or should each sensitive view require the **specific owning module's view permission**, possibly plus a separate cross-module role for aggregated reporting?

- **Option A (retain intentionally):** keep one-of-four at the helper; explicitly classify all 49 views by sensitivity (public business summary, pricing detail, employee payroll, trace/restricted), document which are acceptable under a single reader-module grant, and prove data handling and any RLS restrictions. Just saying 'retain' without classifying the sensitive views is inadequate.
- **Option B (propose a scoped hardening design — preferred for independent review):** keep cost-wide shared read for genuinely non-sensitive aggregations where required, but map individual sensitive views to owning module/trace roles and define explicit cross-module exceptions. Prepare a view-by-view ACL/security-invoker/dependency matrix, compatibility tests and rollout/rollback plan. **No direct broad replace of `fn_costing_view_allowed()`:** it is reused by many views and a global change can lock out valid users or break refresh jobs.

**Policy P-W506-INTERNAL:** should the internal-source review function retain direct `authenticated` EXECUTE, or restrict it to explicitly required callers while preserving guarded public interfaces? A review of actual call sites, schema exposure and job roles is required before changing any grant.

**Owner decision status:** both **PENDING**. This document proposes assessment, not deployment and not a security vulnerability verdict.

## 5. Smallest next verification — separate permission required before behavioural tests

A. **Repository/catalogue only:** complete the view-by-view matrix using the **49-name catalogue inventory above**, recording corresponding target module, actual columns and data sensitivity, SELECT grants, `security_invoker`, secondary guards, underlying relation/RLS expectations, known UI consumers and necessary operational roles. Reconcile trace-role exceptions. Examine actual SQL function dependencies on internal source accept RPC and list alternative call paths before considering any revocation.

B. **Identity read-only behaviour, later and only with explicit owner approval:** use existing ID-N, ID-X, ID-O (no new user or grant changes) on a source-verified build, with an *exact, individually audited* set of safe view reads, and record expected versus actual server codes without accessing sensitive records. For ID-O, separate CCC-specific `require_permission` contracts from shared view-helper contracts. **No preview, accept, close, approve, refresh or other writer RPCs**, even to elicit an expected denial; no token capture or replay.

C. **SEC writer-denial behaviour, if ever required:** isolated synthetic nonproduction testing under a new owner-reviewed plan; production catalogue proof remains `CATALOGUE_OBSERVED`, never `BEHAVIOURAL_PASS`.

**Stop conditions:** any unexpected reader data, unanticipated code path, source/build drift, denied session mismatch or mutating request stops the affected test before continuing.

**Gate position:** W5-06 OPEN; 40-lens AE1 remains 13 P / 4 historic F / 2 NA / 21 NT. No B1 final approval or WP05 sign-off.
