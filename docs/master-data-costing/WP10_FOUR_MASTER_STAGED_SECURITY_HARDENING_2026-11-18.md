# WP10 — four classification master tables: staged server and client security hardening
**Prepared 18 Nov 2026; REVIEW DRAFT / NOT APPLIED.** Scope: `public.categories`, `public.sub_categories`, `public.product_groups`, `public.sub_groups`. This is a two-stage server security change with an existing merged client-RPC implementation, not an immediate permission cutover. Project `qhmoqtxpeasamtlxaoak`.

## Why this is urgent
Live read-only catalog rechecked on 18 Nov 2026, PostgreSQL 17.4: four tables have RLS enabled, `authenticated` SELECT/INSERT/UPDATE/DELETE grants, and exactly one `FOR ALL` RLS policy per table with both conditions `auth.uid() IS NOT NULL`. The only `relacl` roles are postgres, service_role and authenticated. Thus any signed-in identity potentially accesses ungoverned direct writes. The check proves an authorisation design gap, not that such a write was exercised. No writes were attempted.

Current merged `main` root clients `js/categories.js`, `js/subcategories.js`, `js/product-groups.js`, `js/subgroups.js` already use the 12 governed `rpc_wp10_*` create/rename/delete RPCs and canonical `module:manage-*` Edit permissions. Old pre-PR #445 Electron binaries have direct writes, and fleet installed versions are unknown. Live functions are SECURITY DEFINER owned by the database owner and start with `public.require_permission('module:manage-...',true)`; server permission helper `public.app_has_permission(text,text)` calls `app_has_permission_core(auth.uid(),...)` backed by `public.user_permissions_canonical`.

## Choose two deliberately distinct security stages
### Stage A — interim **per-module Edit RLS** (proposed; exact SQL below)
Replace each identity-only ALL policy with explicit identity-only SELECT plus INSERT, UPDATE and DELETE restricted by existing canonical module Edit permission. Do **not** revoke authenticated DML grants yet: this permits genuinely authorised older clients to continue their legacy direct writes. Rejects signed-in users without Edit. **Limits**: Editor legacy direct writes still bypass RPC-level validation/guardrails and can bypass business invariants; therefore not a complete resolution or a substitute for Stage B. This is a live schema change requiring owner approval, a preflight and staged non-production test. **Not yet applied**.

Candidate SQL, **single transaction**, Postgres 17. Exact existing four policy names and target keys grounded in live catalog / RPC definitions:

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';

DROP POLICY categories_authenticated_crud ON public.categories;
CREATE POLICY categories_authenticated_read ON public.categories
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY categories_authenticated_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_has_permission('module:manage-categories','edit')));
CREATE POLICY categories_authenticated_update ON public.categories
  FOR UPDATE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-categories','edit')))
  WITH CHECK ((SELECT public.app_has_permission('module:manage-categories','edit')));
CREATE POLICY categories_authenticated_delete ON public.categories
  FOR DELETE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-categories','edit')));

DROP POLICY sub_categories_authenticated_crud ON public.sub_categories;
CREATE POLICY sub_categories_authenticated_read ON public.sub_categories
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY sub_categories_authenticated_insert ON public.sub_categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_has_permission('module:manage-subcategories','edit')));
CREATE POLICY sub_categories_authenticated_update ON public.sub_categories
  FOR UPDATE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-subcategories','edit')))
  WITH CHECK ((SELECT public.app_has_permission('module:manage-subcategories','edit')));
CREATE POLICY sub_categories_authenticated_delete ON public.sub_categories
  FOR DELETE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-subcategories','edit')));

DROP POLICY product_groups_authenticated_crud ON public.product_groups;
CREATE POLICY product_groups_authenticated_read ON public.product_groups
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY product_groups_authenticated_insert ON public.product_groups
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_has_permission('module:manage-product-groups','edit')));
CREATE POLICY product_groups_authenticated_update ON public.product_groups
  FOR UPDATE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-product-groups','edit')))
  WITH CHECK ((SELECT public.app_has_permission('module:manage-product-groups','edit')));
CREATE POLICY product_groups_authenticated_delete ON public.product_groups
  FOR DELETE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-product-groups','edit')));

DROP POLICY sub_groups_authenticated_crud ON public.sub_groups;
CREATE POLICY sub_groups_authenticated_read ON public.sub_groups
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY sub_groups_authenticated_insert ON public.sub_groups
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.app_has_permission('module:manage-subgroups','edit')));
CREATE POLICY sub_groups_authenticated_update ON public.sub_groups
  FOR UPDATE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-subgroups','edit')))
  WITH CHECK ((SELECT public.app_has_permission('module:manage-subgroups','edit')));
CREATE POLICY sub_groups_authenticated_delete ON public.sub_groups
  FOR DELETE TO authenticated
  USING ((SELECT public.app_has_permission('module:manage-subgroups','edit')));

COMMIT;
```

**Preconditions before Stage A**: independently verify `app_has_permission` EXECUTE by authenticated and definer/core read access; check canonical target names/Editor grants and role behaviour; verify `public.require_permission` privilege checks in existing `rpc_wp10_*`; sandbox identical policies with **disposable fixtures** using genuine Editor, View-only and No-access sessions. Check all four legacy direct writer paths and SELECT reads. Run the SQL only when separately authorised in production; ensure rollback SQL below and stable server snapshot are available. `app_has_permission` is stable per statement only for same authenticated caller and no mid-statement permission changes. Any unexpected denied authorised Editor is a stop/rollback, not grounds to relax permissions broadly.

**Stage A rollback (only if no subsequent policy amendments; owner-approved emergency use):** single transaction, for every table `DROP POLICY ..._read/..._insert/..._update/..._delete` then recreate old `FOR ALL TO authenticated USING ((SELECT auth.uid()) IS NOT NULL) WITH CHECK ((SELECT auth.uid()) IS NOT NULL)` under original name `<table>_authenticated_crud`. This reopens the known exposure; rollback is a security event and requires risk recording. Do not execute blindly after Stage B.

### Stage B — final **no direct DML** after compatible staff fleet installed
After all managed/offline/staff installations are demonstrably updated to a governed-RPC build, stage/approve the exact transaction:

```sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';

REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.categories, public.sub_categories,
  public.product_groups, public.sub_groups
FROM authenticated;

COMMIT;
```

Keep SELECT grants, RLS read policy and the 12 narrowly permitted `rpc_wp10_*` EXECUTE grants. RPC SECURITY DEFINER functions need separate audited canonical Edit checks; do not weaken or drop them. Confirm no relevant `PUBLIC` / `anon` grant, inherited-role table rights, side-door RPC or bypass. Retire Stage A write policies in a later isolated cleanup only after testing grants and documenting the expected policy state; leaving them inert is not a reason to declare defense in depth complete.

**Final rollback is *not* automatic re-GRANT:** older direct-writer clients cannot be safely reintroduced; treat rollback as a maintenance/security incident. Prefer forward-fixing the new RPC-only installer. Any exceptional re-GRANT requires a separate explicit owner security decision, duration, controls and recovery plan.

## Test and receiving gates
| Test | Stage A | Stage B | Evidence required |
|---|---|---|---|
| Signed-in, canonical module-Edit FALSE / real JWT | Direct table DML denied for each table | DML denied | Non-production disposable fixtures or authorised safe REST method, never live master writes; deny metadata, not rows |
| Signed-in, module Edit TRUE | Legacy direct DML continues (compat only) | Direct DML denied | Real actor/category and fixture proof before and after |
| Governed 12 RPC calls | Available and canonical Edit enforced | Available and canonical Edit enforced | Editor positives with non-prod fixtures; denied View-only negatives |
| Normal category hierarchy reads | Remain available per existing SELECT policy | Remain available | No regressions in four screens and dependent reads |
| Staff clients | Older permitted Editor binaries still run temporarily | All installed binary sources use governed RPC only | Privately collected per-install version/build proof, no PII in GitHub |
| Role safety | No direct base-table bypass for View-only | No authenticated direct table DML for all roles | Live post-cutover catalog + authenticated negative cases |
| Operational | No errors, changed row values or unexpected ACLs | No legacy update failures and no updaters downgrading to direct-DML code | Hash pinned, rollback evidence, scoped metrics |

**Do not use** role impersonation, `SET ROLE` in production as a substitute for real JWT acceptance, dummy new production rows, or revoked access before fleet migration.

## Client checklist and recommendation
1. Keep current merged governed-RPC client implementation; do not rewrite the four clients without a demonstrated defect.
2. In source/offline tests, prohibit `.from('categories'|'sub_categories'|'product_groups'|'sub_groups').insert/update/delete/upsert` and unexpected direct REST writes; allow SELECT and named RPC calls. Reuse existing WP10 G1/G2 safeguards, extend only if coverage gaps are found.
3. Before the formal Electron release, pin exact new build and verify four JS files in ASAR. First test on the owner PC; distribute only after separate release approval. Count actual installed staff versions; updater downloaded is not updated.
4. Once all installations are RPC-only, Stage B becomes a safe separate owner-approved server cutover. Complete real role negative acceptance and declare the four-table security risk resolved **only after** verified.

## No-action / status
**Nothing applied or merged by this document.** The precise SQL is a reviewed candidate, not a deployment instruction. WP10/WP12 OPEN, programme 11/13 CLOSED, Electron HOLD. PR #463 stays separate/unapplied. There was no master record DML, ACL/RLS mutation, account change, installed-client change or production feature flag activation. Security findings anchored by read-only 18 Nov pg_catalog observation and [Supabase securing API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api).

## 18 Nov additional independent source + helper preflight (read-only)
- Pinned `main` SHA `8c7648fab72f2cf2e40bacc74e8fe59bedca2777`: independently inspected `js/categories.js`, `js/subcategories.js`, `js/product-groups.js`, `js/subgroups.js`. Each has three named `rpc_wp10_*` operations for create/delete/rename. Their `.from(...)` lines are used for list/read paths; no direct `.insert/.update/.delete/.upsert` calls found in these four reviewed files. **Scope is these four files, not a whole-repository proof**.
- Live PostgreSQL catalog, `BEGIN READ ONLY`: `public.app_has_permission`, `public.app_has_permission_core`, `public.require_permission` all have `authenticated EXECUTE=true`, `anon EXECUTE=false`. The first is invoker, the other two definer; function owner postgres. This supports Stage A feasibility but **is not** a real JWT denied-role/Editor behaviour test.
- Live 18 Nov policy/ACL recheck: four tables `postgres/service_role/authenticated` explicit ACLs; `authenticated` retains `arwd`, table owner postgres, and one broad ALL RLS policy each. No catalog or business modification.
- **Preflight remaining:** test Stage A under actual isolated authorised permissions/fixtures and verify no unintended modules write these tables; catalog and source alone do not authorise production policy replacement.
