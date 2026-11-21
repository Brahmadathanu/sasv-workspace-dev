# WP10 classification-table SELECT hardening: bounded preparation package (19 Nov 2026)

**STATUS: PROPOSAL ONLY. Nothing is applied to production.** No RLS change, no REVOKE, no production writer, no migration, no Electron installer. The SQL is in `WP10_CLASSIFICATION_SELECT_HARDENING_UNAPPLIED_SQL/` (docs only, deliberately not under `supabase/migrations`).

Evidence classes used below: **[repo]** static scan of this repository, **[live-audit]** ChatGPT's read-only production catalog review (PR #472 comment 7009588031, 19 Nov), **[fixture]** disposable PostgreSQL 16 stand-ins in CI (not live, no real JWT/PostgREST), **[ui]** earlier genuine browser acceptance.

## 1. Problem restated
`categories`, `sub_categories`, `product_groups`, `sub_groups` (RLS on, not forced) each have one authenticated SELECT policy: `auth.uid() IS NOT NULL`. Any valid JWT, including an identity with **no** grants anywhere, can read all four tables over REST. The in-page View gate shipped in PR #478 is a UI control only [ui]. Writes are already View AND Edit guarded (Stage A); legacy direct writers still exist until Stage B.

## 2. Read-caller and permission dependency matrix

### 2.1 Direct client readers (`.from("<table>")`, pinned by a CI guard) [repo]
| Client file | Tables | Module permission the caller needs | Population |
|---|---|---|---|
| `public/shared/js/products.js` | all four | `module:manage-products` | product master users |
| `public/shared/js/manage-bmr.js` | all four | `module:manage-bmr` (also `module:bmr`) | BMR users |
| `public/shared/js/stock-checker.js` | all four | `stock-checker` | stock users |
| `public/shared/js/lab-protocol-manager.js` | `product_groups` | `lab-protocol-manager` | lab |
| `public/shared/js/lab-spec-profile-manager.js` | `product_groups` | `lab-spec-profile-manager` | lab |
| the four classification pages | own table(s) | own `module:manage-*` | classification users |

`scripts/wp10-select-hardening/scan-readers.mjs` + `client_direct_readers.pinned.json` fail CI if a new direct reader appears, so this table cannot silently go stale.

### 2.2 Public views that depend on the tables
[live-audit] nine dependent views, six with `security_invoker=true` (caller's own RLS applies). The audit comment does not say which six; `05_dependency_catalog_readonly.sql` lists them live. Client consumers found in this repo [repo]:

| View | Client consumers | Notes |
|---|---|---|
| `v_product_details` | `manage-pm-bom.js`, `production-execution-queue.js`, `js/supply-overrides.js` | PM templates, production queue, Electron supply |
| `v_stock_checker` | `stock-checker.js` | |
| `bottled_stock_on_hand` | `bottled-stock.js`, Electron `js/log-add.js`, `js/update-log-status.js`, `js/production-planning-workbench.js` | **Electron daily work log population** |
| `fg_bulk_stock` | `fg-bulk-stock.js`, Electron `js/log-add.js`, `js/log-edit.js`, `js/update-log-status.js`, `js/production-planning-workbench.js` | **Electron daily work log population** |
| `bmr_card_not_initiated` | `bmr-card-not-initiated.js`, `bmr-admin-correction.js`, `js/supply-batch-plan.js` | |
| `v_costing_scheme_policy_rule_register`, `_scope_options` | `costing-suite-pricing-policy.js` (invoker in migration source) | Pricing Policy |
| `v_costing_scheme_policy_selected_overview` | none in client | definer in migration source |
| `v_sdv_dim_product_hierarchy` | no direct client consumer | sales data viewer family |

### 2.3 Functions and RPCs
[repo] a static scan of `supabase/migrations` finds 24 functions reading the tables: **23 SECURITY DEFINER, 1 INVOKER** (`costing.fn_product_group_id_for_product`). They serve Production Route Manager (`module:production-route-manager`), Supply Batch Plan, Manage Products (`rpc_wp10_preview_product_subgroup_impact`), and lab spec/protocol helpers. SECURITY DEFINER objects run as the owner; with RLS not forced they are **unaffected by any change to the authenticated read policy** [fixture]. Caveat: local migrations are incomplete (633 files vs 705 live history rows), so this is a lower bound; `05_dependency_catalog_readonly.sql` is the authoritative live check.

### 2.4 Cross-module conclusion
The four tables are **shared reference taxonomy** used as context by product, BMR, stock, lab, costing, production-route and sales/MIS workflows and by the legacy Electron daily-log screens. A reader set keyed to specific modules would need roughly 25 module keys, would break the next module that joins the taxonomy, and would require every Electron work-log user to hold one of them. The classification-specific control that is genuinely needed is the **write** guard (done) and the screen gate (done).

## 3. Options and recommendation
| Option | What changes | Risk | Verdict |
|---|---|---|---|
| **A. Accept and document** | nothing | any signed-in identity (including offboarded or never-provisioned) reads taxonomy over REST | acceptable only if sign-up is closed and offboarding always removes the auth user |
| **B. Provisioned-user gate (recommended)** | read policies become `app_is_provisioned_user()`: identity holds >= 1 canonical View/Edit grant anywhere | an identity that is signed in but has zero grants loses reads (returns empty, not an error) | **smallest safe cutover** |
| **C. Module-restricted reads** | per-module or reader-set predicate | breaks the readers in 2.1-2.3 unless every invoker view becomes definer-with-predicate and clients move to RPCs; large rewrite | **not recommended now** |

### 3.1 Exactly what B does and does not do
- Does: closes direct reads for authenticated identities with **no** canonical grant (offboarded, unprovisioned, explicit deny-everywhere). Reads by every provisioned reader (6 representative module readers + Editors + View-only) keep working, directly and through invoker views [fixture].
- Does **not**: give per-module confidentiality. A user with any other grant (for example the 4-module No-access test account, which holds six Costing grants) can still read the four taxonomy tables over REST. That is the intended shared-taxonomy semantics, not a defect to be hidden.
- Does not change writes, table grants, definer objects, Stage B or Electron. A definer view **without its own predicate** still exposes rows to everyone with SELECT on the view; the fixture shows this on purpose. Reviewing those objects is a separate item (the seven sensitive views are WP12).
- SELECT denial under RLS returns **200 with an empty array**, not 403. Unprovisioned users will see empty lists, not errors.

## 4. Legacy Electron direct-write dependency (not presumed upgraded)
- Installed pre-#445 Electron versions still direct-write the four tables; Stage A already requires View AND Edit for those writes. Option B does **not** touch writes, so it is safe whether or not the fleet is upgraded.
- Legacy Editors are provisioned (they hold `can_edit`), so their direct `UPDATE ... RETURNING` and reads continue [fixture: write matrix identical before and after].
- Legacy daily-log users read `bottled_stock_on_hand` / `fg_bulk_stock`; the Electron pages check `module:add-log-entry` / `module:edit-log-entry`, so they should be provisioned, but that is an inference from the client code, not verified on production. `04_coverage_readonly.sql` counts any sign-in identity that would lose reads, so this assumption is checked on production before apply.
- **Stage B (REVOKE direct DML) stays blocked** on managed-fleet inventory and a separate owner decision. This package neither includes nor depends on it.

## 5. Test evidence
[fixture] CI job `select-hardening` (PostgreSQL 16, disposable cluster) on commit be1a8e4: **16/16 pass, 0 skipped**. Actors: Editor, View-only, No-access (no rows), deny-all (false/false rows), edit-without-view, six single-module readers (stock, daily log, BMR, costing, route, products), anon.
| Scenario | Result |
|---|---|
| Baseline Stage A: no-grant and deny-all identities read all four tables | demonstrated (the hole) |
| Preflight PASS on Stage A shape; postflight FAIL before and PASS after apply | pass |
| After apply: no-grant and deny-all identities read 0 rows from all four tables | pass |
| After apply: Editor, View-only, edit-without-view and all six readers still read all four tables | pass |
| After apply: invoker views (`v_product_details`, `v_stock_checker`, `bottled_stock_on_hand`, `v_costing_scheme_policy_scope_options`) work for every reader, return 0 rows for no-grant identities | pass |
| Definer function with own permission check unchanged; definer view with predicate unchanged; definer view without predicate still exposes rows (documented) | pass |
| Write matrix (Editor, View-only, No-access, deny-all, edit-without-view, other-module readers x 4 tables x insert/update/delete) identical before and after | pass |
| Governed RPCs: Editor allowed, View-only and No-access denied, after apply | pass |
| anon cannot read tables or execute the helper | pass |
| Idempotent re-apply; rollback restores identical policies, grants and data hash; second rollback refuses | pass |
| Mixed, partial and half-applied states refuse and change nothing | pass |
| Coverage and dependency-catalog queries run; counts only; read-only transactions | pass |
Limits: stand-in `app_has_permission` and invoker/definer shapes; PostgreSQL 16 not 17.4; no real JWT, PostgREST or Supabase auth; the live canonical table's columns are asserted by preflight P7 rather than assumed.

## 6. Owner decisions still required
1. **D1** choose A, B or C (recommendation: B).
2. **D2** if B: review `04_coverage_readonly.sql` output; every non-zero `would_lose_reads_signed_in_last_90d` needs a name-level review by the owner (the query itself returns counts only).
3. **D3** confirm that an identity holding only `can_edit=true` (no view) counts as provisioned (current proposal: yes, any true grant).
4. **D4** whether definer views without their own predicate (found by `05`) get a separate review.
5. **D5** timing relative to Stage B (independent; B does not need the fleet cutover).
6. **D6** who applies it (owner-controlled lane, guarded transaction, same approach as the registry steps).

## 7. Implementation and rollback sequence (not executed)
1. Run `05_dependency_catalog_readonly.sql` live (read-only); reconcile with section 2; any invoker object not in the fixture gets an added test.
2. Run `04_coverage_readonly.sql` live (read-only); owner reviews D2.
3. Run `01_preflight_readonly.sql`; require RESULT PASS.
4. Owner approval (D1-D6).
5. Apply `02_apply_provisioned_read_gate.sql` once (single guarded transaction; state-aware; no-op if already applied).
6. Run `03_postflight_readonly.sql`; require RESULT PASS. Re-run `01` is expected to FAIL on P3 (read policy changed).
7. Genuine browser check: View-only, Editor and No-access accounts still reach their modules and lists; Products, BMR, Stock Checker and a daily-log screen still load. Direct REST read as the no-grant identity returns `[]` (only if an authorised identity exists).
8. **Rollback** (any time): `99_rollback.sql`, then `03` (expect the read policies back to identity-only via `01` PASS). Restores the exact Stage A policy set; no data or grant changes.

## 8. Out of scope
Stage B REVOKE, per-module read restriction (option C), the seven sensitive views, any change to definer objects, write policies, grants, flags, the registry or the Electron release HOLD. WP10 and WP12 remain OPEN.
