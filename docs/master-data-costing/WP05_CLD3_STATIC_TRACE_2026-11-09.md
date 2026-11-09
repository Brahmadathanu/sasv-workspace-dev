# WP05-CLD3 — Static trace: scheme-policy semantics, preview call trees, PRM run-82 zero rows (9 November 2026)

**Status: STATIC / REPOSITORY-ONLY / PROPOSAL — NOT EXECUTED.** WP05 OPEN; programme **6/13**. AE1 ledger unchanged (13 P / 4 historical F / 2 NA / 21 NT). No production, Supabase, SQL (even SELECT), RPC, browser, auth, flag, code, cache, deployment or permission action. Builds on merged CLD1 (#242) and CLD2 (#243); it does not repeat them. Issue #234.

Evidence labels: `CONFIRMED_IN_REPO` (text of a migration/client file), `NOT_IN_REPO` (definition absent from repository), `LIVE_UNVERIFIED` (repo text may differ from live), `INFERENCE` (reasoned from repo, not proven), `OBSERVED_PREVIOUS_RUN` (earlier merged evidence), `OWNER_DECISION_PENDING`.

Method for §2: a regex pass over `supabase/migrations/*.sql` took, for each function name, the **last-by-filename** definition, split out the `$…$` body, and listed (a) schema-qualified and unqualified `fn_*/rpc_*/require_*` callees, recursively, and (b) side-effect tokens (`insert into`, `update … set`, `delete from`, `truncate`, `set_config`, `pg_notify`, `dblink`, `nextval`, dynamic `execute`, `create temp/table`). Limits: regex, not a parser; table/view reads inside bodies were not enumerated; a view or trigger reached through a table is not traced; migration order ≠ guaranteed live order. Script text is not committed (scratch only); the method is reproducible from this paragraph.

---

## 1. Scheme-policy semantics (`ik_selected_scheme_id` / `ok_selected_scheme_id`)

### 1.1 What the repository proves

| Fact | Source | Label |
|---|---|---|
| KPI counts `scheme_policy_complete_count` as `ik_selected_scheme_id IS NOT NULL AND ok_selected_scheme_id IS NOT NULL` over `v_costing_policy_manager_sku_overview` (`CROSS JOIN policy`) | `20261013183522_wp05_s1_kpi_view_rebuild.sql:72-73` | CONFIRMED_IN_REPO |
| Public `v_costing_policy_manager_sku_overview` is a pure column pass-through of `costing.v_costing_policy_manager_sku_overview` behind `fn_costing_view_allowed()`; the two id columns plus `ik/ok_policy_source`, `_scope`, `_rule_id`, `_priority_sort`, `_apply_mode`, `_replace_from_scheme_id`, `*_scheme_effective_from/to`, `*_scheme_policy_active` | `20261019134900_tb2_costing_view_permission_gate.sql:671-730` | CONFIRMED_IN_REPO |
| **Body of `costing.v_costing_policy_manager_sku_overview` is not in the repository.** Only (i) a hash-guarded text patch that replaces its *selling-price-bridge* `period_start = max(period_start)` predicate with a current-successful-run `EXISTS` (base hash `bd014e0f…`) and (ii) later hash records (`cceca7a5…` in `docs/costing-pipeline-independent-audit/closure/evidence/G0/g0_live_defs.json`, hashes only) exist | `20260809071519_gate_11y_10g_4b_ppm_exact_current_run_projection.sql`; evidence JSON | NOT_IN_REPO |
| Same for `costing.v_sku_selected_scheme_policy` (current resolver view; public wrapper `v_costing_pricing_selected_scheme_policy` exposes `region_code, scheme_id, scheme_name, paid_qty, free_qty, effective_from/to, is_active, policy_rule_id, policy_source, policy_scope, priority_sort, apply_mode, replace_from_scheme_id`) | `20261019134900…:1487-1521`; hash `548df0ab…` only in evidence JSON | NOT_IN_REPO (body) |
| **Selection priority, region matching and effective-date rules are therefore not provable from the repository for the live overview.** The exposed column set shows they exist (rule id, source, scope, priority, apply mode, replace-from, effective window, region) but not how they combine | — | NOT_IN_REPO |

### 1.2 New finding — a run-scoped selected-scheme snapshot exists and is not the scheme-viability snapshot

CLD1/CLD2 examined `costing.sku_scheme_viability_snapshot` and correctly concluded that a per-scheme row's `scheme_id` is not bilateral selection. **They did not examine a second snapshot, `costing.sku_selected_scheme_policy_context_snapshot`**, which the repository shows is the *frozen selected-scheme record*:

- Run-pipeline refresh function `costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot(period, valuation, run)` is called inside the chain (`20261024171314_ci037_profit_chain_v3.sql:237`, anchor text; function body `NOT_IN_REPO`, hash `ea9949960ed3…` in G0 evidence).
- Consumers: printable Cost Sheet joins it once per region — `ikp … region_code='IK'`, `okp … region_code='OK'` on `(period_start, valuation_date, refresh_run_id, sku_id)` and exposes `ikp.scheme_id/scheme_name AS ik/ok_selected_scheme_id/name` (`20261019134900…:1210-1215, 1272-1273`), labelled "Frozen IK/OK selected-scheme policy context for the refresh run" (line text of the “Selected Scheme: IK/OK” rows). `CONFIRMED_IN_REPO`.
- The profit-chain function **raises an exception unless every pricing-bridge SKU has exactly one IK and one OK row** (`20261024171314…:121-133`: `v_ss_bad > 0 or v_ss <> 2 * v_pb`). So for runs built by the CI-037 chain version, per-SKU bilateral completeness is a pipeline invariant. `CONFIRMED_IN_REPO` for the invariant text; whether it was present when run 143 (valuation 2026-10-22, before the 2026-10-24 migration) was built is **`LIVE_UNVERIFIED`** — do not assume it for Oct.
- Documented columns (only a *local-test reconstruction* of the DDL is in the repo, `docs/costing-pipeline-independent-audit/closure/prepared/CI-037_localtest/schema.sql:168-193`, **not** live DDL): `period_start, valuation_date, refresh_run_id, sku_id, product_id, region_code, scheme_master_context_snapshot_id, scheme_id, scheme_name, paid_qty, free_qty, total_qty, policy_rule_id, policy_source, policy_scope, priority_sort, apply_mode, replace_from_scheme_id, effective_from, effective_to, policy_updated_at, resolution_status, resolution_note, qualifying_candidate_count`. The column set mirrors the live resolver view's exposed policy columns (§1.1) — `INFERENCE` that it is the frozen counterpart of the same resolution rule.
- `resolution_status` vocabulary per the repo's own comment: `RESOLVED_POLICY`, `DEFAULT_NO_SCHEME`, `BLOCKED` ("Live CHECK … allows only…", `20261024171314…:170`); readiness code additionally tolerates `RESOLVED` (`20260929091329_wp01_readiness_scheme_regional_status_semantics.sql:13`). `CONFIRMED_IN_REPO` (comment/code); live CHECK `LIVE_UNVERIFIED`.
- In the local-test DDL `scheme_id` is `NOT NULL` and a `DEFAULT_NO_SCHEME` status exists. If live matches, **`scheme_id IS NOT NULL` on the snapshot is true even for “default / no scheme” rows**, so the live KPI's `IS NOT NULL` semantic cannot be ported to the snapshot unchanged. `INFERENCE / LIVE_UNVERIFIED`.

### 1.3 Count definitions (candidates; none supported as final)

The live KPI (CLD2: 601 complete / 28 missing at read time) means the **current** overview yields NULL ids for some SKUs, i.e. “no resolved selection today”. Candidate run-scoped definitions over the snapshot, per `(period_start, valuation_date, refresh_run_id)`:

| Def | Rule | Meaning | Support status |
|---|---|---|---|
| **S-A** | SKU has IK row **and** OK row with `resolution_status = 'RESOLVED_POLICY'` | explicit policy selected in both regions at run valuation | closest analogue of “non-NULL selected id today” **if** live NULL ⇔ no resolved policy; unproven |
| **S-B** | both rows with status ∈ {`RESOLVED_POLICY`,`DEFAULT_NO_SCHEME`} | every SKU/region resolved (incl. explicit default) | would count 629/629-style full coverage; measures pipeline completeness, not policy coverage |
| **S-C** | both rows exist (any status) | structural completeness only | trivially equals SKU count where CI-037 invariant held |

**Recommendation (for owner decision, not approved):** do not define a historical numerator until the readbacks R6–R9 below show (a) the status distribution, (b) whether live-view NULL ids correspond to `DEFAULT_NO_SCHEME`/`BLOCKED` in the snapshot of the *current* run (run 151), and (c) whether run 143 satisfies the one-IK-one-OK invariant. If R7 shows S-A reproduces the live 601/28 for run 151 at its valuation date, S-A is the supported definition; denominator = distinct SKUs of the same run's pricing bridge. `OWNER_DECISION_PENDING`. Historical grain: the key `(period_start, valuation_date, refresh_run_id, sku_id, region_code)` is **repo-supported** by the join at `20261019134900…:1272-1273`; the distinct-SKU vs row-count distinction CLD1 R4 insisted on applies (two rows per SKU).

### 1.4 Missing sources (exact) and proposed SELECT-only catalogue inspection — NOT EXECUTED

Missing: bodies of `costing.v_costing_policy_manager_sku_overview`, `costing.v_sku_selected_scheme_policy`, `costing.rpc_refresh_sku_selected_scheme_policy_context_snapshot`; live DDL/CHECK of the snapshot. Owner-run, read-only (privileged role, no function execution; `pg_get_viewdef` and `pg_get_functiondef` are catalogue text accessors):

```sql
-- R6 definitions (text only; compare md5 with cceca7a5…, 548df0ab…, ea9949960ed3…)
SELECT 'view' k, c.oid::regclass::text n, md5(pg_get_viewdef(c.oid,true)) h, pg_get_viewdef(c.oid,true) d
FROM pg_class c WHERE c.oid IN ('costing.v_costing_policy_manager_sku_overview'::regclass,'costing.v_sku_selected_scheme_policy'::regclass)
UNION ALL
SELECT 'func', p.oid::regprocedure::text, md5(pg_get_functiondef(p.oid)), pg_get_functiondef(p.oid)
FROM pg_proc p WHERE p.proname='rpc_refresh_sku_selected_scheme_policy_context_snapshot' AND p.pronamespace='costing'::regnamespace;

-- R7 columns/constraints of the frozen snapshot
SELECT a.attname, format_type(a.atttypid,a.atttypmod), a.attnotnull
FROM pg_attribute a WHERE a.attrelid='costing.sku_selected_scheme_policy_context_snapshot'::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='costing.sku_selected_scheme_policy_context_snapshot'::regclass;

-- R8 per-run status distribution and completeness (runs 143, 149, 151)
SELECT s.refresh_run_id, s.region_code, s.resolution_status, count(*) rows, count(DISTINCT s.sku_id) skus, count(*) FILTER (WHERE s.scheme_id IS NULL) null_scheme
FROM costing.sku_selected_scheme_policy_context_snapshot s WHERE s.refresh_run_id IN (143,149,151) GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT s.refresh_run_id, count(*) skus_total,
  count(*) FILTER (WHERE ik=1 AND ok=1) skus_one_ik_one_ok,
  count(*) FILTER (WHERE ik_res=1 AND ok_res=1) skus_S_A
FROM (SELECT refresh_run_id, sku_id,
        count(*) FILTER (WHERE region_code='IK') ik, count(*) FILTER (WHERE region_code='OK') ok,
        count(*) FILTER (WHERE region_code='IK' AND resolution_status='RESOLVED_POLICY') ik_res,
        count(*) FILTER (WHERE region_code='OK' AND resolution_status='RESOLVED_POLICY') ok_res
      FROM costing.sku_selected_scheme_policy_context_snapshot WHERE refresh_run_id IN (143,149,151) GROUP BY 1,2) s GROUP BY 1 ORDER BY 1;

-- R9 reconcile run 151 S-A against the live KPI (601/28 at CLD2 read time; counts move with current policy)
SELECT count(*) FILTER (WHERE ik_selected_scheme_id IS NOT NULL AND ok_selected_scheme_id IS NOT NULL) live_complete,
       count(*) FILTER (WHERE ik_selected_scheme_id IS NULL OR ok_selected_scheme_id IS NULL) live_missing
FROM public.v_costing_policy_manager_sku_overview;
```

(`public` view requires the viewer grant; run as the owner's privileged SQL role. All five statements are SELECT-only. Not executed here.) Interpretation caveat: live-vs-snapshot differences can legitimately arise from policy edits after the run valuation date; that is a semantic difference, not a defect.

---

## 2. F1 and preview/`rpc_get_*` call trees

### 2.1 F1 — `public.rpc_preview_route_family_route_steps(bigint,date,date)` (kept separate)

| Layer | Source | Properties | Side-effect scan |
|---|---|---|---|
| Wrapper | `20260803111630_create_kashayam_route_step_candidate_preview.sql:246-258` | `plpgsql security definer`, no volatility ⇒ VOLATILE default, `search_path public, costing`; body = `perform public.require_permission('module:production-route-manager', false)` then `return costing.fn_preview_route_family_route_steps(...)`; `revoke all … from public, anon; grant execute … to authenticated` (lines following) | none besides the permission call |
| Internal | `20260812172712_restore_route_family_route_step_preview_semantics_archive_guard.sql:2-` (latest by filename; header says backfilled from live `schema_migrations`) | `plpgsql stable security definer`, `search_path costing, public, pg_temp` | **no callee functions**; no DML/`set_config`/`pg_notify`/`dblink`/dynamic SQL; returns `jsonb_build_object(… 'preview_only',true, 'records_created',0 …)` |
| Data read | same body | `SELECT` only from `costing.production_route_family_route`, `production_route_family`, `production_route_family_product_group_map`, `public.products`, `sub_groups`, `daily_work_log` | grain: whole PRM family/route and all `daily_work_log` rows for the group's active products in the date window (SECURITY DEFINER bypasses RLS; view-permission only) |
| `require_permission(text,boolean)` | `NOT_IN_REPO` (CLD2 live catalogue read: non-null `auth.uid()`, exact grant row, `can_view`, `can_edit` if flag true) | — | `OBSERVED_PREVIOUS_RUN` |

**Conclusion (STATIC_PASS, repo-text only):** the repository version of F1 has no write path at any depth. Residual: `LIVE_UNVERIFIED` that live bodies equal repo text (CLD2 confirmed only wrapper shape, not an MD5 match); `require_permission` body not in repo; table-level triggers cannot fire on SELECT; views are not involved. **Hence F1 meets the CLD1 “tier 1 static” bar but is NOT allowlisted by this document.** Proposed gate to a one-name allowance: owner-run catalogue readback of `md5(pg_get_functiondef)` for the wrapper and internal function compared with a hash computed from the repo text (R10 below), then explicit owner approval. `OWNER_DECISION_PENDING` (Q-F1).

### 2.2 The three historical-candidate previews and the shadow preview

Per-function results (latest definitions; all internals `STABLE SECURITY DEFINER` unless stated; side-effect scan: **none** in any body below except `raise exception` for validation):

| Public wrapper (VOLATILE default, SECURITY DEFINER, `require_permission('module:production-route-manager', false)`, grant to `authenticated, service_role`) | Internal chain (all `NOT_IN_REPO` gaps listed) | Result |
|---|---|---|
| `rpc_preview_route_family_candidate(bigint,int[],date,int)` `20260802171634_route_family_candidate_engine.sql:303` | `fn_preview_route_family_candidate` (`20260812172628_route_archive_aware_current_read_surfaces.sql:84`) → `fn_resolve_production_route_candidate_policy` (`20260802141847_production_route_historical_candidate_engine.sql:43`) | no write path in repo text; STATIC_PASS (repo) |
| `rpc_preview_product_process_route_candidate(bigint,date,int)` `…engine.sql:322` | `fn_preview_product_process_route_candidate` (`20260804153937_align_product_delta_preview_to_approved_route.sql:2`) → `fn_preview_product_process_route_evidence` (`20260805052413_correct_route_candidate_policy_and_activity_kind_coverage.sql:10`), `fn_preview_route_family_candidate`, `fn_resolve_effective_route_family_route` (`20261020170128_g2_correct_route161_effectivity_and_historical_family_resolver.sql:36`) → `fn_resolve_route_family_for_product` (`20260812145258_route_archive_and_subgroup_mapping_foundation.sql:90`) | no write path in repo text; STATIC_PASS (repo) |
| `rpc_preview_product_route_delta_candidate(bigint,date,int)` `…engine.sql:337` | `fn_preview_product_route_delta_candidate` (`20260804153937…:133`) → the previous chain | no write path; STATIC_PASS (repo) |
| `rpc_preview_direct_labour_shadow_workload(bigint,date,date,bigint,bigint)` `20260805163156_direct_labour_policy_and_shadow_workload_preview.sql:252` | `fn_preview_direct_labour_shadow_workload` (`20260807113339_gate_11y_10c_1_route_foundation_execution_hardening.sql:536`) → `fn_preview_shared_standard_batch_route_foundation` (`20261014114526_fix_historical_preferred_batch_size_asof_resolution.sql:1`) → `fn_effective_product_process_steps`, `fn_effective_product_process_route_steps`, `fn_resolve_effective_product_process_route` (`20260812172034_route_archive_aware_core_resolution_validation.sql:5,34,142`), `fn_internal_source_product_demand_as_of` (`20260915050710…:2`) → `fn_sales_allocation_quantity_driver_review_status` → `fn_sales_allocation_quantity_driver_fingerprint` (IMMUTABLE), `fn_validate_effective_product_process_route` → `fn_validate_product_process_route`, `fn_validate_route_family_route` (`20260829191547…`, `20260829190955…`); also `fn_validate_direct_labour_workload_policy` (`20260805163156…:63`) | no write path in repo text; **wrapper file's `insert into` hits are migration-time seed rows (`:275-296`), not RPC body**; STATIC_PASS (repo) |

Notes: (1) `fn_route_parent_immutable` appeared as a text-adjacent hit in the scan; it is a **trigger function** (`returns trigger`, `20260818063051…:2-3`) and is not a callee — excluded. (2) The wrappers' VOLATILE default is a declaration gap, not evidence of writes. (3) Each wrapper reads whole-PRM-grain data under a **view** permission; no row scoping. (4) Contrast `rpc_costing_preview_approval_impact` (a *writing* “preview”, CLD1 §2): naming never classifies safety, so this table is a per-signature static result only.

### 2.3 Workload `rpc_get_*` family (`shared-workload-preview`)

| RPC | Source | Properties / scan |
|---|---|---|
| `rpc_get_production_route_manager_workload_preview(...)` | `20260806114659_add_prm_workload_preview_list_and_detail.sql:2` | VOLATILE-default, SECURITY DEFINER; `require_permission(…, false)`; callees `fn_effective_product_process_steps`, `fn_resolve_effective_product_process_route`, `fn_resolve_effective_route_family_route`, `fn_resolve_route_family_for_product`, `fn_validate_effective_product_process_route`; only `raise exception` as side effect |
| `rpc_get_production_route_manager_workload_detail(date,date,bigint,bigint)` | same file `:236` (**CLD1/CLD2 called it `_workload_preview_detail`; the repo name is `_workload_detail`**) | same callee set and scan |
| `rpc_get_route_workload_management_explain(date,date,bigint,bigint)` | wrapper `20260811023750_gate_11y_10i_2c_3d_2c_direct_labour_component_explain.sql:5` (`stable security definer`) calling renamed `…_explain_core` | wrapper reads `sku_direct_labour_allocation_snapshot`; `…_core` is the pre-rename body of the same name from `20260810113919_gate_11y_10i_2c_2b_1_route_workload_management_explain.sql:2` (stable, only `require_permission` as call, ~18 kB, no DML token). The rename itself is in `20260811023750…:2-3`; no later redefinition found |

Result: STATIC_PASS (repo) for all three; remains outside the read-only allowlist until owner approval. The exact-run constants (run 82) pin them to a fixed historical context; they read frozen snapshots plus effective-route resolvers evaluated **as of dates passed in**.

### 2.4 What is still `UNKNOWN`
Live function text/ACL/ownership for every row above; `require_permission` body; any function modified outside `supabase/migrations/` (SEC-A1/A2 migrations are known to be absent from the directory); dynamic behaviour of `daily_work_log`-reading RLS-free definers. Proposed SELECT-only catalogue check (**not executed**):

```sql
-- R10 properties and hashes for all functions in §2 (provolatile: s=stable, v=volatile)
SELECT p.oid::regprocedure::text sig, p.provolatile, p.prosecdef, p.proconfig, pg_get_userbyid(p.proowner) owner,
       md5(pg_get_functiondef(p.oid)) body_md5,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname,p.proname) IN (
 ('public','rpc_preview_route_family_route_steps'),('costing','fn_preview_route_family_route_steps'),
 ('public','rpc_preview_route_family_candidate'),('public','rpc_preview_product_process_route_candidate'),
 ('public','rpc_preview_product_route_delta_candidate'),('public','rpc_preview_direct_labour_shadow_workload'),
 ('costing','fn_preview_route_family_candidate'),('costing','fn_preview_product_process_route_candidate'),
 ('costing','fn_preview_product_process_route_evidence'),('costing','fn_preview_product_route_delta_candidate'),
 ('costing','fn_preview_direct_labour_shadow_workload'),('costing','fn_preview_shared_standard_batch_route_foundation'),
 ('public','rpc_get_production_route_manager_workload_preview'),('public','rpc_get_production_route_manager_workload_detail'),
 ('public','rpc_get_route_workload_management_explain'),('public','rpc_get_route_workload_management_explain_core'));
-- R11 transitive dependency/volatility cross-check: any non-stable function referenced by the bodies above
SELECT DISTINCT p.oid::regprocedure::text, p.provolatile FROM pg_proc p WHERE p.provolatile='v' AND p.pronamespace='costing'::regnamespace
  AND p.proname ~ '^(fn_(preview|resolve|effective|validate|internal_source|sales_allocation)_)';
```
The hash comparison against repo text is manual (the repo file text is the reference); a mismatch re-opens that function as UNKNOWN. SELECT-only; `pg_get_functiondef` returns text and executes nothing.

---

## 3. PRM run-82 Mapping Review / Foundation Review zero rows

### 3.1 Static chain (CONFIRMED_IN_REPO)

Client contexts: Mapping, Foundation and Workload Preview use period `2026-08-01`, valuation `2026-08-07`, run **82** (`public/shared/js/costing-suite-production-route-helpers.js:177-202`); Route Readiness uses run **80** (`:166`). **`p_as_of_date` is not tied to run 82: the UI sends `getAsOfDate()` (`costing-suite-production-route.js:771`, e.g. `:887`) which defaults to the browser's local *today*** (`ensurePrmAsOfDateInitialized`, helpers `:7840-7850`). Server default is `current_date`.

Mapping RPC (`20260812173816_gate_11y_10i_2c_3f_1b_3b_final_archive_isolation.sql:4-`, STABLE SECURITY DEFINER) rows = `recipients(run 82 workload snapshot products)` ⋈ `fn_product_process_route_readiness(as_of)` **where `readiness_status = 'BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING'`**, then classified (`SAME_GROUP_SINGLE_FAMILY_EVIDENCE`, `NO_READY_SAME_GROUP_EVIDENCE`, `AMBIGUOUS…`). Foundation RPC (`20260809104352_gate_11y_10i_2b_2…:2-`) uses the same recipients ⋈ readiness, with the **additional** condition that **no product in the same group is READY** (`coalesce(ge.ready_products_same_group,0)=0`), then calls the evidence/candidate preview functions per product/group.

`costing.fn_product_process_route_readiness(as_of)` (`20260812172034_route_archive_aware_core_resolution_validation.sql:427-`, SQL STABLE SECURITY DEFINER): population = **all currently ACTIVE** `public.products` (not run-82-frozen), `route_family_id = fn_resolve_route_family_for_product(product, as_of)` using APPROVED, non-archived, effective-dated product / subgroup / group mappings; status order: `route_family_id IS NULL → BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING`; else no approved effective family route → `BLOCKED_NO_APPROVED_ROUTE_FAMILY_ROUTE`; else invalid product route → `BLOCKED_INCOMPLETE_PRODUCT_PROCESS_ROUTE`; else `READY`.

### 3.2 Predicates that can legitimately reduce 495 to zero

Starting set (CLD2): 495 distinct run-82 direct-labour recipient products (`OBSERVED_PREVIOUS_RUN`, SELECT-only).

| # | Predicate | Zero-row mechanism |
|---|---|---|
| P1 | recipient product is currently `ACTIVE` (`upper(status)='ACTIVE'`) | recipients inactivated since August drop out |
| P2 | `fn_resolve_route_family_for_product(product, as_of=today)` is NULL | **if mappings were approved after 2026-08-07, as-of-today readiness differs from run-82 time**; all recipients may now resolve a family ⇒ none `BLOCKED_NO_APPROVED_ROUTE_FAMILY_MAPPING` ⇒ Mapping Review empty *by design* |
| P3 | mapping/subgroup/group effective window contains as-of date and `status='APPROVED'` and `archived_at IS NULL` | same direction as P2 |
| P4 (Foundation only) | group has **no** READY product among recipients | any READY sibling in the group removes that group's blocked products |
| P5 (Foundation) | `p_group_evidence_class`, `p_product_group_id`, `p_search` filters | UI defaults not established here; filters narrow, never widen |
| P6 | RPC context guard: run's `period_start`, `valuation_date`, `valuation_context_source='CAPTURED_AT_REQUEST'` must match, else **exception**, not empty set | an empty list is not a context-mismatch symptom |

Hence: **zero rows is a plausible, designed outcome when every run-82 recipient now has an approved route-family mapping as of today** (P2/P3) — and is *not* evidence of a defect. It is equally consistent with an unnoticed filter. It cannot be classified from the repository alone. Status stays `NOT TESTED / source data comparison required`; no selector, fallback or fix is proposed. `INFERENCE` for P2 direction; the readiness function text is `CONFIRMED_IN_REPO` but live body/data `LIVE_UNVERIFIED`.

### 3.3 Minimal owner-approved SELECT aggregate (no function call) — NOT EXECUTED

Reproduces P1–P3/P4 with base tables only, avoiding `fn_product_process_route_readiness` and the RPCs. It approximates the group/subgroup/product mapping resolution at a single `:as_of` date; **if it disagrees with the UI, the resolver function (`fn_resolve_route_family_for_product`, `…foundation.sql:90`) is authoritative and must be read first (R12).**

```sql
-- R12 resolver body (text only)
SELECT pg_get_functiondef('costing.fn_resolve_route_family_for_product(integer,date)'::regprocedure);  -- adjust signature to catalogue
-- R13 funnel of the 495 recipients as of :as_of (UI default today) — SELECT only
WITH p AS (SELECT :as_of::date d),
rec AS (SELECT DISTINCT product_id FROM costing.product_direct_labour_workload_snapshot
        WHERE refresh_run_id=82 AND period_start='2026-08-01' AND valuation_date='2026-08-07'),
act AS (SELECT r.product_id, p.sub_group_id FROM rec r JOIN public.products p ON p.id=r.product_id WHERE upper(coalesce(p.status,''))='ACTIVE'),
m AS (SELECT a.product_id,
  EXISTS(SELECT 1 FROM costing.production_route_family_product_map x, p WHERE x.product_id=a.product_id AND x.archived_at IS NULL AND x.status='APPROVED' AND x.effective_from<=p.d AND (x.effective_to IS NULL OR x.effective_to>=p.d)) has_product_map,
  EXISTS(SELECT 1 FROM costing.production_route_family_product_subgroup_map x, p WHERE x.product_subgroup_id=a.sub_group_id AND x.archived_at IS NULL AND x.status='APPROVED' AND x.effective_from<=p.d AND (x.effective_to IS NULL OR x.effective_to>=p.d)) has_subgroup_map,
  EXISTS(SELECT 1 FROM public.sub_groups sg, costing.production_route_family_product_group_map x, p WHERE sg.id=a.sub_group_id AND x.product_group_id=sg.product_group_id AND x.archived_at IS NULL AND x.status='APPROVED' AND x.effective_from<=p.d AND (x.effective_to IS NULL OR x.effective_to>=p.d)) has_group_map
 FROM act a)
SELECT (SELECT count(*) FROM rec) recipients, (SELECT count(*) FROM act) still_active,
       count(*) FILTER (WHERE has_product_map OR has_subgroup_map OR has_group_map) with_any_approved_mapping,
       count(*) FILTER (WHERE NOT (has_product_map OR has_subgroup_map OR has_group_map)) candidate_blocked_no_mapping
FROM m;
-- run twice: :as_of = '2026-08-07' (run-82 time) and :as_of = current_date (UI default)
```
Reading: `candidate_blocked_no_mapping` = 0 at `current_date` and >0 at `2026-08-07` ⇒ zero rows is explained by later mapping approvals (the C5/D5 label risk is *as-of drift*, which the UI makes visible via the as-of date control). Non-zero at today ⇒ the zero-row UI result is **not** explained by this predicate set and must be investigated (the function text and context guard first). Product/subgroup type casts (integer vs bigint) may need adjusting by the owner's SQL role; this text is a proposal.

---

## 4. Not done / unverified
No run-151 selling/scheme row audit, no execution of any proposal, no live definition or hash comparison; regex trace limits as stated in the header; run 82 count 495 and run 143/149/151 populations are CLD2 observations; `require_permission`, SEC-A1/A2 bodies and the three missing view/function bodies remain `NOT_IN_REPO`. **No B1 decision, no gate promotion, no allowlist change.** WP05 OPEN; 6/13.
