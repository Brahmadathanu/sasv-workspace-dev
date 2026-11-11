# WP05 R23 — six-view permission dependency and PPM audit structural risk (11 November 2026)

**Follow-up to R22 / issue #297, source-and-catalogue only.** No production view-row query, authenticated user impersonation, permission change, writer RPC, PWA flag or deployment. **Effective signed-in role behaviour remains NOT TESTED.** Owner R20 D-2 selected a closure-critical subset; this document does not approve a remediation or mark W5-06 PASS. WP05 OPEN, programme 6/13.

## Live permission function chain

Read-only `pg_proc` definitions on Supabase project `qhmoqtxpeasamtlxaoak` establish:

1. `public.fn_costing_view_allowed()` is STABLE SQL, **SECURITY INVOKER**; allows `postgres`/`service_role`, otherwise OR-combines `app_has_permission(...,'view')` for **CCC / CBM / CSR / MCM**. No PPM check. All six selected views carry `WHERE (SELECT fn_costing_view_allowed())` as the outer predicate (R22).
2. `public.app_has_permission(target,mode)` is PL/pgSQL **SECURITY INVOKER**; reads `auth.uid()`; missing UID returns false; otherwise delegates to `app_has_permission_core(uid,target,mode)`.
3. `public.app_has_permission_core(uid,target,mode)` is **SECURITY DEFINER**; selects `can_view` or `can_edit` from `public.user_permissions_canonical` for the exact `user_id, target`, returning false for missing entry or NULL. Invalid mode raises. Thus helper truth is an OR of four exact, canonical module view grants, *not* a generic 'authenticated' allowance.

This permits a precise **source-derived synthetic role oracle** for the outer predicate, not an authenticated database result:

| Synthetic identity grant set | Outer helper expected | Business-access verdict |
|---|---|---|
| no `auth.uid()` and no privileged database role | false | helper blocks; no real request executed |
| CCC View only | true | helper permits outer gate, **not** necessarily permitted detailed audit/vendor data |
| CBM View only | true | same |
| CSR View only | true | same |
| MCM View only | true | same |
| **PPM View only** | **false** | **possible legitimate Scheme Master History denial**; role intent must be settled |
| CCC Edit without View, no other View | false | exact View bit required |
| PPM View plus any one of the four costing View bits | true | cross-module reader might satisfy audit gate |
| postgres/service_role | true | privileged bypass is deliberately present; not end-user evidence |

**These are logic cases evaluated from the inspected function text, not tests performed against user data or live JWT sessions.** Existing CCC-scoped Cost Comparison RPC ID-V/N/X/O acceptance is a **different function** and cannot prove any of these six view outcomes.

## Base-relation metadata (catalogue only)

A deduplicated `pg_rewrite/pg_depend` direct-reference read of the six views showed:

- Manual-rate history depends on `costing.material_manual_rates` (RLS enabled), `public.inv_stock_item` (RLS enabled), `public.proc_vendor` (RLS enabled, **authenticated SELECT false**) and a separate snapshot view. The public manual-rate history view is **not security-invoker**, so base-table authenticated grants alone do not determine its reader behaviour. Register in turn depends on history and rate review views.
- Material acceptance view depends on `costing.v_material_review_acceptance_register`, whose `authenticated` SELECT is false; the exposed public wrapper is **not security-invoker**, so this may still expose values through its definer privilege, gated by the outer helper.
- Cost Sheet line trace draws from multiple snapshot tables with mixed RLS/SQL ACL flags and is **not security-invoker**. All exact transitive paths remain to be classified, not presumed safe.
- SKU detailed cost view is **security-invoker=true** and depends directly on `costing.v_sku_detailed_cost_sheet_current`, which itself is a view with authenticated SELECT. Underlying invoker grants and RLS must be checked before any role-access prediction.
- **Scheme Master audit:** `public.v_costing_scheme_master_audit` is **not security-invoker**, has `authenticated` SELECT, and directly reads `costing.scheme_master_audit`, an underlying table with **RLS disabled** and no authenticated SELECT. The public view's outer gate is the four-module helper (no PPM). Current client `public/shared/js/costing-suite-pricing-policy.js`, `fetchSchemeMasterAudit` at ~5192, calls `.select('*').eq('scheme_id',...).limit(200)`, and `buildSchemeMasterHistoryHtml` renders actor and old/new content. **This is a concrete source-level cross-domain permission-design mismatch requiring decision, not yet a demonstrated real-user information leak.**

### Risk categorisation

**Review priority P1 (security/functional policy):** PPM Scheme Master audit has a plausible positive-reader false-negative (PPM-only does not meet helper) and a cross-module sensitive-data false-positive (CCC/CBM/CSR/MCM View meets helper). Because the table has no RLS and view is non-invoker, do not dismiss risk by citing absence of base-table authenticated SELECT. Nonetheless no real user outcome, view-row visibility, access bypass, or business ownership is yet proved; **do not mark an actual disclosure as found**.

**Other five:** structural helper broadness and detailed columns justify bounded exact business reader/role tests. A non-invoker public view can use owner privileges over underlying objects, but independent predicates, row filters and true owner policy still matter. No blanket rewrite or view ACL alteration is approved.

## Smallest remaining gate for issue #297

1. Obtain **one exact owner/business rule**: may Scheme Master audit history (actor, prior remarks, approval reference) be viewed by **PPM View**, and should unrelated CCC/CBM/CSR/MCM-only readers be allowed? This is a permission *policy* decision, **not** automatic SQL authorisation. Distinguish the intended Scheme Master history screen from other shared aggregates.
2. Complete a **static call-graph and render/export minimum-column matrix** for six selected views (R22 direct consumers established; indirect/CSV needs checking), and check affected positive reader paths before proposing a change.
3. Build and run **isolated synthetic permission logic assertions** against a correctly pinned implementation/fixture if required. Such tests support a proposed policy but **cannot be credited as signed-in denial proof**.
4. If a precise additional genuine read-only role probe is needed, prepare a separately approved, zero-row-export, existing-identity protocol. No role changes and no production writer invocation. If policy mismatch is confirmed, design smallest reviewable view-specific fix with rollback and positive/negative regression; get explicit owner approval before production application.
5. Keep W5-06 OPEN until the selected contracts are resolved by sufficiently grounded proof or separately accepted residual. D-1 writer behavioural NT and D-4 timing HOLD remain governed, unchanged.

## Provenance and limits

Sources: live `pg_proc` definitions of the three permission functions, live `pg_class/pg_rewrite/pg_depend` and direct relation flags, current GitHub client source, R21/R22, R3/R4. No row bodies, personal permissions, signatures, tokens or data were retrieved. This is metadata/source review, **not a full transitive catalog proof or actual browser acceptance**. Historical AE1 13 P / 4 F / 2 NA / 21 NT frozen; formal WP05 OPEN, 6/13.
