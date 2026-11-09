# WP05-W506-SEC-FIX-01 — Staff Governance writer server-authorisation guard (9 November 2026)

**Status: DRAFT PR FOR INDEPENDENT REVIEW — MIGRATION NOT APPLIED.** Owner authority (issue #234, 9 Nov): code + versioned migration PR for review only. W5-06 OPEN; WP05 OPEN; programme 6/13; B1 not finally approved. No production access, no Supabase connection, no writer RPC call, no grant/role/flag change, no merge, no deploy. This is a **minimum server writer guard only**; it does not close W5-06 and is not the dedicated personnel-costing design.

## 1. Finding (as recorded in issue #234; live SELECT-only catalogue review by the owner, not re-verified here)
`public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)` — SECURITY DEFINER, VOLATILE, `authenticated` EXECUTE, SQL wrapper delegating to `costing.rpc_set_staff_costing_classification`; wrapper md5 `6ba709477ecc7755fb6005b6e2203a2b`. The internal SECURITY DEFINER PL/pgSQL function (md5 `553d103a5afedda3191c1aa62c33be7c`, 4,950 chars) UPDATEs/INSERTs `costing.staff_costing_classification` and has **no** `require_permission` / `auth.uid()` guard. Classification: confirmed missing server-side authorisation guard; **not a demonstrated exploit** (no restricted-user write attempted anywhere).

## 2. Change
`supabase/migrations/20261109040000_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql` (one transaction): inserts `perform public.require_permission('module:cost-build-manager', true);` as the first statement after the first `BEGIN` of the **internal** function. `require_permission(…, true)` requires `can_view` **and** `can_edit` (semantics per CLD2 live read; body not in repo). Expected outcome: ID-N, ID-O, ID-V/view-only CBM, ID-X (edit without view), unauthenticated and edit-on-another-module-only are denied before any lookup, validation or write; CBM view+edit continues. The future dedicated personnel-costing permission is **not invented or referenced**.

Design decisions:
- **No body copy.** The migration reads the live definition (`pg_get_functiondef`) and patches it, so repository history cannot reintroduce a stale body.
- **Fail closed:** one internal function and the wrapper signature must exist; wrapper must still delegate; live internal `md5(prosrc)` **or** `md5(pg_get_functiondef)` must equal `553d103a…` (the issue does not say which form was hashed — accepting either is a stated assumption), or the function must already be guarded (idempotent no-op); no existing `require_permission` in the matched body; comment/unbalanced-quote check before the first `BEGIN`; guard present exactly once and before any `insert into/update/delete from` token; removing the inserted text reproduces the original; live body occurs exactly once in the definition text.
- **Nothing else changes:** signature, return type, volatility, SECURITY DEFINER, `proconfig` (incl. `search_path`), ACL, owner, language, OID are compared before/after and the transaction aborts on any difference. `CREATE OR REPLACE` keeps grants. No GRANT/REVOKE/DROP.
- **Public wrapper intentionally not modified.** It delegates, so every path (wrapper or any privileged internal caller) is guarded by the single internal check; rewriting a live SQL wrapper adds drift risk and no additional denial. A wrapper check can be added later as defence in depth.
- **Service/cron/other callers:** `require_permission` needs a non-null `auth.uid()`, so a caller without a user JWT (service role, cron, definer-to-definer from a job) will be **denied** and must be handled deliberately, not bypassed. No in-repo caller exists (grep of `supabase/`, `scripts/`, `public/` finds only the client call at `costing-suite-cost-build.js:1990`). Live callers are `UNKNOWN` → prerequisite below.

Rollback (prepared, not executed): `docs/master-data-costing/prepared/WP05_W506_SEC_FIX_01_ROLLBACK.sql` removes exactly the inserted text and re-asserts the pre-fix fingerprint. Rolling back re-opens the finding.

## 3. Tests and literal results
Static: `node --test scripts/costing-w506-sec-fix-01/migration-static.test.mjs` → **8 pass / 0 fail**.

Local isolated PostgreSQL 16.15 (throwaway cluster, synthetic fixture): `PGHOST=<local socket> PGPORT=… PGUSER=postgres supabase/tests/w506_sec_fix_01/run_local.sh` → **ALL LOCAL CHECKS PASSED** (T0–T7, identity matrix 18/18 rows PASS):
- T0 unguarded fixture: a no-grants identity can write through the wrapper (reproduces the finding on the fixture).
- T1 the **unmodified** migration (real fingerprint) aborts closed against a non-matching body; body unchanged.
- T2 migration applies to a fingerprint-matched fixture (fingerprint literal substituted **in a scratch copy only**).
- T3 matrix: wrapper denied (SQLSTATE 42501, table unchanged) for ID-N, ID-O, ID-V, ID-X, edit-on-other-module-only, unauthenticated; permission error precedes validation error; direct internal call with a privileged role denied for ID-N, ID-V, unauthenticated; internal not executable by `authenticated` (ACL unchanged); CBM view+edit allowed via wrapper and via internal (insert and update paths) and still reaches validation; metadata/ACL/wrapper preserved; guard is first statement after `BEGIN`.
- T4 re-apply is a no-op notice; T5 rollback restores the original fingerprint; T6 re-apply reproduces the identical guarded body; T7 body without `BEGIN` aborts closed.

**Limits of this evidence:** the fixture function and `require_permission`/`auth.uid()` are **test doubles**, not the live definitions (the live internal body is not in the repository). These tests prove migration mechanics, fail-closed behaviour, guard ordering and the identity logic *given* the recorded `require_permission` semantics. They do **not** prove behaviour of the live function, the live body's `BEGIN` shape, or live ACLs. One bug in the migration was found and fixed during testing (an invalid `regexp_replace` argument form); the harness failed it before the fix.

## 4. Unverified assumptions / blockers
1. Live fingerprint form (prosrc vs full definition) — both accepted; if neither matches, the migration aborts (safe) and needs re-derivation from a fresh owner readback.
2. Live internal body has a first `BEGIN` preceded only by a declaration section without comments/odd quotes; otherwise the migration aborts (safe).
3. `require_permission(text,boolean)` live semantics exactly as in CLD2; denial SQLSTATE/message unknown (fixture uses 42501).
4. Whether `module:cost-build-manager` edit holders are exactly the legitimate editors (job-role mapping not done; no personnel-role design here).
5. Live `proconfig` for the internal function (fixed `search_path`?) — unchanged by the migration; if none is set that is a separate hardening item.
6. Migration requires ownership/privilege to `CREATE OR REPLACE` the costing function (the migration runner role); not checked.

## 5. Roll-out prerequisites (for the owner's separate approval)
1. Read-only readback: `md5(prosrc)` and `md5(pg_get_functiondef)` of the internal function and wrapper; `proconfig`, `proacl`, owner; confirm they equal this PR's expectations.
2. Read-only caller scan: `pg_proc.prosrc ILIKE '%rpc_set_staff_costing_classification%'`, `pg_depend`, cron/job definitions; decide any non-JWT caller explicitly.
3. Enumerate current `module:cost-build-manager` view+edit holders; confirm the legitimate staff-costing editors are among them (no blanket revoke).
4. Apply in a maintenance window; verify post-apply fingerprint, ACL unchanged, guard text present; behavioural check only with a separately authorised synthetic/non-production path (no production writer call by Claude).
5. Keep rollback script and pre-fix definition text archived.

## 6. Still open (separate governed workstreams)
Client Edit/Review controls are rendered without an edit check (`costing-suite-cost-build.js:1203-1214, 1239-1250`); generic CSV export and `select('*')` still expose all returned salary columns; `total_salary_cost` is rendered; the three Staff Governance views remain readable by the shared view helper; the dedicated personnel-costing permission is undefined; no negative-identity behavioural evidence on the live system. **W5-06 OPEN; WP05 OPEN; 6/13.**
