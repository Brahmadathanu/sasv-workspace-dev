# WP05-W506-CLIENT-01 — Staff Governance client dependency matrix and regression-test design (9 November 2026)

**Status: STATIC / REPOSITORY-ONLY / PROPOSAL — NOT IMPLEMENTED, NOT EXECUTED.** WP05 OPEN; W5-06 OPEN; programme **6/13**; AE1 ledger 13 P / 4 historical F / 2 NA / 21 NT unchanged; B1 draft/not adopted; shared §8 binding. No production, Supabase, SQL, RPC, auth, browser, code change, migration, grant, flag or deployment. This is **not** a security finding of effective authorisation or closure: client code cannot establish server access control. Policy basis: `WP05_W506_PERSONNEL_COSTING_POLICY_APPROVAL_AND_CLIENT_TRACE_2026-11-09.md` (owner direction approved; **no permission string, assignee, grant or rollout approved**). Does not repeat the 49-view inventory (`…49_VIEW_COLUMN_SENSITIVITY_CONSUMER_INVENTORY…`) or the earlier minimum-column design.

Labels: `CONFIRMED_IN_REPO` (file:line on `main` e78f5ec), `UNKNOWN` (not proven from source), `PROPOSAL`. Files: `S` = `public/shared/js/costing-suite-shell.js`, `B` = `…/costing-suite-cost-build.js`, `T` = `…/costing-table-tools.js`, `TY` = `…/types/supabase.ts` (generated; may lag live schema → `LIVE_UNVERIFIED`). Line numbers are approximate to the quoted statement.

## 1. Dependency graph (single path, `CONFIRMED_IN_REPO`)

`loadRowsForLens` (S:4823-4831) → `costBuildCtrl.loadStaffGovernanceRows(ACTIVE_PERIOD_START)` (B:494-525, each tab `fetchAllRows` 1000-row pages, S:4317-4335) → `ALL_ROWS = rows` → `applyFilters()` (S:6217-6250) → `VIEW` (filter by ACTIVE_FILTERS, then search) → `applySearch()` (S:6252-6285, `getSearchBlob`, S:5508-5650) → `renderTable()` (S:6866) → row HTML `B:1191-1262` → actions wired from `VIEW[index]` (S:7337-7340; `B:wireStaffGovernanceTableActions` 1425-1436) → `openStaffClassificationEditModal(row)` (B:1864-1905) → save → `costingRpc('rpc_set_staff_costing_classification', …)` (B:1990-1997). Export: `exportActiveViewCsv` (S:8265-8270) → `exportCw05CsvForView()` (flag ON) or `exportCsvForRows(VIEW)` (S:8327-8362). Only consumer in `public/` of the three views and the writer is `B` (repo grep); other hits are tests, navigation registries and generated types.

Raw-row lifecycle: **each fetched row object, with every column returned by `select('*')`, is retained in `ALL_ROWS` and `VIEW` for the life of the lens/tab**, is passed unmodified to the edit modal, and is the object serialised by Export. Tab switch (`renderStaffGovernanceTabs`, B:1358-1405 → S:7075-7090) reloads; period selector affects only the pool-summary read (`.eq('period_start', …)`, B:509-513); the other two tabs are not period-filtered (registry `periodScoped:false`, `costing-suite-registry.js:128-134`).

## 2. Per-sub-tab matrix

Legend: **D** display, **S** sort (server `order` or table-tools), **Q** text search (blob), **E** edit/modal, **X** export, **R** raw-row propagation. Columns of the typed rows are from `TY:20595-20676`.

### 2.1 Staff Review Queue (`staff-review`, view `v_costing_unclassified_staff_for_costing`; read B:518-525)

| Column(s) | D | S | Q | E | X | Evidence |
|---|---|---|---|---|---|---|
| `classification_status` | ✔ status + lane class | server `order` | ✔ (S blob) | – | ✔ | B:1233,1118-1126; B:520-523 |
| `staff_display_name`, `employee_code`, `staff_id`, `designation` | ✔ (`staffDisplayBlock`, B:361-368; name fallbacks `staff_name/full_name/employee_name/name` do not exist in typed view → dead fallbacks) | `employee_code` server order | ✔ | ✔ modal label (B:1870-1877); `staff_id` required for save (B:1971) | ✔ | B:1234-1235; S blob lines ~5591-5598 |
| `total_salary_cost` | ✔ **individual salary rendered** (B:1237) | server `order` | ✔ **in search blob** (S:~5604) | – | ✔ | lane `=== 0` check B:1124 |
| `latest_salary_period_start` | ✔ | – | ✔ | – | ✔ | B:1236 |
| `costing_class(_label)`, `allocation_pool` | ✔ | – | ✔ | `costing_class` preselect (B:1879) | ✔ | B:1238-1239 |
| `classification_note`, `salary_source_note` | ✔ (`classification_note \|\| salary_source_note`) | – | ✔ | note → remarks default (B:1899-1903) | ✔ | B:1240 |
| `remarks`, `effective_from`, `allocation_weight` | – | – | `remarks` ✔ | ✔ modal defaults (B:1881-1897) | ✔ | |
| **Not used by any client path:** `basic_salary`, `allowance_amount`, `employer_contribution`, `other_salary_cost`, `classification_id`, `classification_created_at/updated_at`, `classification_is_active`, `effective_to`, `staff_is_active` | ✘ | ✘ | ✘ | ✘ | **✔ exported** | repo-wide grep: no reader outside `TY` |
| Table-tools sort | **none** — no `TAB_TABLE_COLUMNS` entry for this tab, legacy headers (S:6705-6710 returns `null` for non-pool tabs; `T:306-318` entry only for `staff-governance:staff-pool-summary`) | | | | | |

### 2.2 Current Classifications (`staff-register`, view `v_costing_staff_classification_register`; B:495-504)

Same column roles as §2.1 except: no `latest_salary_period_start` display (B:1194-1217), `effective_from`, `allocation_weight`, `remarks` displayed (B:1202-1204); server order `classification_status`, `employee_code`. Same unused-but-exported set. No table-tools sort (as above). Edit button on every row (B:1203-1214).

### 2.3 Staff Pool Summary (`staff-pool-summary`, view `v_costing_staff_cost_pool_summary`; B:506-516)

| Column | D | S | Q | E | X | Evidence |
|---|---|---|---|---|---|---|
| `period_start`, `allocation_pool`, `costing_class_label`/`costing_class`, `staff_count`, `pool_amount`, `pool_status` | ✔ | ✔ table-tools only when `COSTING_TABLE_TOOLS_V1` ON (`T:414-421`; header gate S:6597-6625) else server `order(allocation_pool, costing_class)` | pool/class text via blob; `pool_status` via status filter (S:~5709) | – (no Edit button, B:1220-1229) | ✔ | |
| **`staff_details` (jsonb of per-staff content, `TY:20634`; `p.staff_details` in view, `20261019134900…:2037`)** | ✘ **no reader anywhere in `public/`** (grep: only `TY`) | ✘ | ✘ | ✘ | ✔ key exported; value stringified by `csvEscape(String(value))` → for an object/array `"[object Object]…"`, so nested content is likely **not** legibly exported, but it is **fetched and held in browser memory/network response** | S:8338-8341 |
| Aggregation grain | **one row per (period, pool, class)** — rendered grid is already aggregate-only | | | | | CLD1 7/42 note |

### 2.4 Shared consumers and cross-cutting behaviour

| Topic | Finding | Evidence |
|---|---|---|
| Row-click | Clicking a non-button part of a staff row falls through every lens branch to the **generic SKU drawer** (`openDetails(row, preferred)` with `preferred` undefined → title `row.sku_display_name \|\| row.sku_id \|\| "SKU Details"`, SKU tabs). Which staff fields, if any, the SKU-tab renderers read from `SELECTED_ROW` was **not traced** → `UNKNOWN` | S:7243-7330 (no staff branch), S:8064-8078 |
| Export | Exports **union of all keys of every row in `VIEW`** (not the on-screen columns): today includes all pay components and `staff_details` key. `neutraliseCsvRows` keeps every key (T:496-509). Export button has **no role gate for Staff Governance** (gates exist only for RM/PM trace, S:8211-8260). Filename includes lens, period, row count | S:8327-8362 |
| Search | `getSearchBlob` concatenates `employee_code`, `staff_id`, designation, **`total_salary_cost`**, `salary_source_note`, `remarks`, `classification_note`, pool/class — typing a salary figure filters person rows | S:~5577-5605 |
| Role gates | Route-level only: `module:cost-build-manager` `can_view` (`PERM_CAN_VIEW`, S:3497-3505). `PERM_CAN_EDIT` is set (S:3501) but **`B` contains no `PERM_CAN_EDIT`/`canEdit` check; the three Edit/Review buttons are rendered unconditionally** and the save button is enabled by form validity only (B:1848-1862). **Independent live catalogue verification on 9 Nov found NO application permission guard in either the public wrapper or internal implementation.** Public wrapper grants authenticated EXECUTE; internal SECURITY DEFINER function performs UPDATE/INSERT. This is a confirmed server guard omission, but restricted-identity write success was **NOT TESTED**. Do not invoke this writer in production. | B:1203-1214,1239-1250; S:9620 `canEditCbm` exists in context but unused by staff code |
| Period switch | affects pool-summary only (B:509-513); other two reads re-run only on tab/lens reload | S:7075-7090 |
| Flags | `COSTING_NAV_GROUPS_V1` changes only the scope note chrome (B:1373); `COSTING_TABLE_TOOLS_V1` changes headers/sort for the pool tab and export neutralisation. Neither alters the fetched columns | B:1373; S:6407-6625; S:8267 |
| Class options | `v_costing_staff_costing_class_options` read `select('*')` on load (B:401-410) — class labels/pool codes; no person data in typed columns, sensitivity of its columns not re-examined here | B:401 |
| Existing tests | `scripts/costing-table-tools/table-tools-pkg3/4.test.mjs` mock the staff **header/alignment** arrays only; `n2.test.mjs` asserts the scope note text; `lens-evidence-matrix.test.mjs` / `flag-sweep-browser.test.mjs` list the lens id. **No existing test asserts staff columns, payload, export content, search or edit gating** | grep of `scripts/` |

## 3. Proposed minimum projections (PROPOSAL; none applied)

Select lists are *client payload minimisation only*. **They do not protect `total_salary_cost`, which the Review and Register grids intentionally render, and do not stop a direct query to the broad view** (policy doc §1).

| Tab | Proposed `select` | Dropped (unused by client) | What breaks / must be decided |
|---|---|---|---|
| Review Queue | `staff_id, staff_display_name, employee_code, designation, classification_status, latest_salary_period_start, total_salary_cost, costing_class, costing_class_label, allocation_pool, classification_note, salary_source_note, effective_from, allocation_weight, remarks` | `basic_salary, allowance_amount, employer_contribution, other_salary_cost, classification_id, classification_created_at/updated_at, classification_is_active, effective_to, staff_is_active` | **CSV loses those columns** (behaviour change; owner decides whether export is part of the protected duty). Search blob still works (it ignores absent keys). `order('total_salary_cost')` needs no select. `effective_to`/`staff_is_active` unused today — keep if later features need them |
| Register | same minus `latest_salary_period_start`, `salary_source_note` unless used (register grid does not show them; modal uses `classification_note`) | as above | same export note |
| Pool Summary | `period_start, allocation_pool, costing_class, costing_class_label, staff_count, pool_amount, pool_status` | **`staff_details`** | none in UI; export drops the key. Table-tools columns (`T:414-421`) all covered |

**Existing editors:** the modal needs `staff_id, staff_display_name, employee_code, designation, costing_class, effective_from, allocation_weight, remarks, classification_note` (B:1870-1903); the projections above retain all. Dropping any of them silently breaks the edit workflow or the `row.staff_id` guard (B:1971).

## 4. Restricted UI sketches (PROPOSAL; no permission string invented)

Let **PCV** = "holder of the (to-be-designed, owner-approved) personnel-costing read authority" and **PCE** = its edit counterpart; names/identifiers `TO DESIGN`.

| Variant | Behaviour | Needs |
|---|---|---|
| **A. CBM-only restricted view (generic CBM reader)** | Staff Governance shows **Pool Summary only** (no person rows requested); Review Queue and Register tabs replaced by an explanatory state "Personnel-costing detail requires additional permission" **without issuing the person-level request**; no Edit button; Export limited to aggregate columns | a client permission probe for PCV (does not exist; permission list RPC consumed at S:3490-3520 would need the new target) **and** server denial so a direct request returns nothing — the client state is cosmetic otherwise |
| **B. PCV/PCE viewer-editor** | Existing three tabs and modal unchanged in function; projections from §3; Edit buttons only for PCE; row-click drawer disabled or replaced for staff rows (item 2.4 UNKNOWN) | PCE definition separate from `module:cost-build-manager` `can_edit`, and confirmation that `rpc_set_staff_costing_classification` enforces it server-side |
| **C. Aggregate-only path without `staff_details`** | Pool summary from an aggregate source with exactly the 7 columns above; the already-existing `v_costing_cost_pool_monthly_summary` (B:621-624, columns `staff_pool_amount`, `total_pool_amount`, per pool/period) shows aggregate staffing totals are already served without person data | owner decision whether `staff_count` per class is acceptable; server projection (view or guarded RPC) is a separate migration gate |

Not decided here: which variant; whether PCV also gates Pool Summary; export entitlement; handling of the generic drawer; behaviour of `rpc_set_staff_costing_classification` for view-only callers.

## 5. Deterministic regression-test design (SPECIFIED, NOT EXECUTED; source-level / mocked supabase only)

Harness pattern: extend the existing mock style (`table-tools-pkg3.test.mjs`) with a stub `supabase.from(view).select(cols).order()…range()` that **records every request** `{view, select, filters, order}` and an in-memory dataset with canary values (e.g., `basic_salary: 111111`, `staff_details: [{canary:true}]`). No live data. No browser needed for T1–T9; T10 is the browser smoke the owner may run later.

Identity matrix (mock permission-list payloads shaped like S:3490 input; **target names for the new authority are placeholders `PCV`/`PCE`**): **ID-PCE** (CBM view+edit + PCV+PCE), **ID-PCV** (CBM view + PCV, no edit), **ID-CBM** (CBM view only), **ID-O** (CSR only), **ID-N** (no grants), **ID-X** (other-module-only). Flags: `COSTING_NAV_GROUPS_V1` and `COSTING_TABLE_TOOLS_V1` each OFF/ON (4 combinations). Viewports 1280 / 390 for DOM-level checks.

| # | Case | Expected (design target; **today’s code fails the marked items**) |
|---|---|---|
| T1 | Request recorder, each tab | ID-PCE/PCV: Review and Register requests use the §3 explicit `select` (no `*`) — **fails today (`*`)** ; Pool request has no `staff_details` — **fails today** |
| T2 | **No-sensitive-request proof** for ID-CBM, ID-O, ID-N, ID-X | recorder shows **zero** requests to the Review/Register views and no request selecting `total_salary_cost`/pay components; Pool request only if Variant A/C chosen — **fails today** (client has no probe) |
| T3 | Column-dependency | every key read by `B:1191-1262`, `staffDisplayBlock`, modal fill, lane class ⊆ projection (static scan of the source + projection constants) |
| T4 | Search | ID-PCV: typing an employee code filters; typing a salary figure behaviour = design decision (target: salary excluded from blob); ID-CBM: search over pool rows only |
| T5 | Export (flag OFF and ON) | CSV header set equals the on-screen/projection set; canary `basic_salary`/`staff_details` absent; ID-CBM export contains no person columns — **fails today** (`exportCsvForRows` unions all keys) |
| T6 | Edit gating | Edit/Review buttons absent for ID-PCV, ID-CBM; present for ID-PCE; save handler not invocable (`rpc_set_staff_costing_classification` never called by mocks for non-PCE) — **fails today** (no gate) |
| T7 | Edit round-trip (ID-PCE) | modal prefilled from projection; payload to the writer equals `{p_staff_id,p_costing_class,p_allocation_pool,p_effective_from,p_allocation_weight,p_remarks}` unchanged (B:1990-1997); post-save reload re-requests with projection; validation toasts unchanged (B:1936-1980) |
| T8 | Period switch | pool request carries `period_start` filter; other tabs issue no period filter; period change with ID-CBM issues no person-level request |
| T9 | Empty / error | empty Review queue shows empty state; mocked `error` response → existing error toast path, `ALL_ROWS` not partially populated; restricted state text is truthful and static |
| T10 | 1280/390 DOM smoke (owner-run later, mock backend) | restricted state and tables render, no horizontal page scroll, Edit controls reachable by keyboard (B:1864-1905 focus handling) |
| T11 | Row-click | for ID-PCV/ID-CBM clicking a staff row opens no SKU drawer (target) — determine current behaviour first (UNKNOWN §2.4) |
| T12 | Negative **no-write** | across all identities the recorder shows no mutating RPC unless an explicit PCE click in T7 |

Test code is not written or run here. The tests prove **client behaviour against a mocked server only**; they never substitute for server-side denial testing.

## 6. UNKNOWN / not proven

1. **Independent server catalogue result (9 Nov): confirmed server permission-guard omission** for `rpc_set_staff_costing_classification` public wrapper and internal implementation; authenticated users have EXECUTE on public wrapper, while internal function writes classification data with no `require_permission`/`auth.uid`/canonical grant check. The *behavioural exploitability* under restricted identities remains NOT TESTED; no writer was invoked. See addendum below.
2. Live column list of the three views (types file may lag); whether `staff_details` contains salary-bearing content (typed `Json`, producer `costing.v_staff_cost_pool_monthly` body not traced).
3. Generic drawer's use of staff row fields (§2.4).
4. Whether any non-`public/` consumer (Electron, scripts, other apps) reads the views — repo grep outside `docs/` found none besides tests/types.
5. Sensitivity of the class-options view columns.
6. Existence/shape of any PCV/PCE permission target — none exists in code; none invented.
7. Whether PostgREST direct access to the broad views remains possible regardless of any client change (server design gate, policy doc §5B).

## 7. Residual gates (unchanged)
Owner approval of exact permission identifier and duty cohort; reviewed server design (default deny, view hashes, RLS/ACL, isolated synthetic tests, rollback); separately reviewed client PR with failing-before/passing-after tests above; controlled production release approval. **WP05 OPEN; W5-06 OPEN; 6/13.**


## 8. Independent live server catalogue addendum — 9 November 2026 (ChatGPT verification)

This section was **not part of Claude's repository-only execution**. A separate SELECT-only `pg_proc`/`pg_get_functiondef` inspection of the live project `qhmoqtxpeasamtlxaoak` confirmed that:

- `public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)`: `SECURITY DEFINER`, `VOLATILE`, authenticated role has `EXECUTE`, anon does not. SQL wrapper delegates directly to `costing.rpc_set_staff_costing_classification`. Definition MD5 `6ba709477ecc7755fb6005b6e2203a2b`.
- `costing.rpc_set_staff_costing_classification` (same signature): `SECURITY DEFINER`, `VOLATILE`; authenticated role does **not** have direct `EXECUTE`, but the public wrapper can delegate. Definition MD5 `553d103a5afedda3191c1aa62c33be7c`.
- Inspection of the **entire** 4,950-character internal function body confirms no `require_permission`, `auth.uid` or canonical-permissions checks. It directly `UPDATE`s or `INSERT`s `costing.staff_costing_classification` after validating staff existence, class, pool and numeric input ranges.
- Consequently the **server-side application-authorisation guard is missing from this write path**. This does **not** establish a successful unauthorised call under an actual restricted user's credentials, because **no RPC was invoked** and other deployment/API controls have not been behaviourally tested. Treat as **HIGH-PRIORITY SECURITY DESIGN DEFECT** and do not count W5-06 as PASS.
- This finding is distinct from SEC-A1 material-review functions, whose inspected delegated bodies *do* check CCC edit. It also means client-side hiding of Edit buttons or minimum-column projection is **insufficient** on its own.

**Suggested correction (not authorised/applied):** guard the public writer before delegation **and** the internal writer at the start of its body using the owner-approved canonical module edit permission, while separately deciding how the new personnel-costing edit right relates to CBM edit. Preserve legitimate staff-costing editors, avoid default-PUBLIC grants, add synthetic negative and positive server tests, define rollback, and require owner's express implementation and rollout approval. The exact permission key and final role policy remain undecided. **No production change or tests executed.**
