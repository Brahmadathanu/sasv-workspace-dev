# WP05 R39 — Owner-approved MCM reader policy, guarded two-view candidate (12 November 2026)

**OWNER BUSINESS POLICY APPROVED — NOT AUTHORISED FOR PRODUCTION EXECUTION.** In response to R38, the owner explicitly approved **Q-R38-MCM: MCM View only** for full Material Manual Rate Register and History. CCC, CBM, CSR or any other module permission alone must not grant full material rate/provenance access. MCM View plus other module permissions remains permitted; MCM Edit without View does not confer reader access. The owner authorised preparation, isolated verification and rollback, and **explicitly reserved separate production SQL approval**.

## Exact scope

- `public.v_costing_material_manual_rate_history`: 32 columns, original MD5 `e827e401cc2bb8ccadf782ee5b98add4`.
- `public.v_costing_material_manual_rate_register`: 34 columns, original MD5 `8a4c73fd3f4562679af3ed0638fa87e4`.
- Shared prior `fn_costing_view_allowed()` on both is replaced **only in those views** with a narrow `public.app_has_permission('module:material-cost-manager','view')` for ordinary authenticated roles. The existing privileged technical branch is retained, but service_role SQL SELECT is **not granted**, so the pre-existing ACL denial persists.
- The Register itself reads History. Candidate applies History first and Register second **in one transaction**; rollback does the same. Existing source joins, vendor provenance, output columns and client `select('*')` remain.
- Each original view is postgres-owned, `security_invoker=false`, SQL `relacl={postgres=arwdDxtm/postgres,authenticated=r/postgres}`, anon/service_role SELECT denied. Candidate checks these attributes and exact source MD5 for both before touching either view.
- Outside scope: `fn_costing_view_allowed`, `app_has_permission`, all other D-2 views, base `costing.material_manual_rates`, vendor tables, record values, purchasing grants, client JS, PWA/Electron, writer RPCs and users' assigned permissions.

## Review artifacts

- `docs/master-data-costing/candidates/WP05_R39_MCM_TWO_VIEWS_APPLY_REVIEW_ONLY.sql`: all-or-nothing guarded two-view replacement, exact output projection, single access condition, no GRANT or function creation.
- `docs/master-data-costing/candidates/WP05_R39_MCM_TWO_VIEWS_ROLLBACK_REVIEW_ONLY.sql`: guarded restoration, **not executable until exact applied candidate MD5 values have been established from isolated PG17 and pinned**. No speculative rollback execution.
- `scripts/wp05-r39-mcm-access/fixtures/*`: synthetic empty, type-matched source dependencies and original two view definitions taken from production metadata; one fabricated manual-rate record, no real supplier data.
- `scripts/wp05-r39-mcm-access/mcm-views-pg17.test.mjs` + `.github/workflows/wp05-r39-mcm-view-policy.yml`: isolated PostgreSQL 17 parser, full nested two-view SQL, positive MCM and MCM+other, negative CCC/CBM/CSR/no-view, unchanged 32/34 columns, original ACL, service_role denial, rollback and drift rejection.

## Current evidence and safety boundaries

This review does not itself establish a real signed-in MCM PWA positive or unrelated-module negative, and this is *not* a request to test using privileged production PostgreSQL role/JWT impersonation. There is **no approval to apply either SQL file to live Supabase**, even transiently inside a rollback-only transaction. Before any later execution approval, complete isolated PG17 verification, pin rollback candidate fingerprints, independently review full SQL and preservation of actual source dependencies, and refresh live metadata with a stop-on-drift preflight. Obtain **separate owner approval for that exact two-view production operation**.

**W5-06 stays OPEN**: the remaining CCC acceptance and CSR detail/lineage reader policies are unapproved, and authenticated role evidence for these views is not complete. R37 positive owner-reported Scheme History remains accepted at its stated evidence level; R34 production Scheme audit correction unchanged. Formal WP05 programme **6/13**.
