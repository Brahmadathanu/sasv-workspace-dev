# WP05-W506-SEC-FIX-01 — Staff Governance writer server-authorisation guard (9 November 2026)

**Status: DRAFT PR FOR INDEPENDENT REVIEW — MIGRATION NOT APPLIED.** Owner authority (issue #234, 9 Nov): code + versioned migration PR for review only. W5-06 OPEN; WP05 OPEN; programme 6/13; B1 not finally approved. No production access, no Supabase connection, no writer RPC call, no grant/role/flag change, no merge, no deploy. This is a **minimum server writer guard only**; it does not close W5-06 and is not the dedicated personnel-costing design.

## 1. Finding (as recorded in issue #234; live SELECT-only catalogue review by the owner, not re-verified here)
`public.rpc_set_staff_costing_classification(bigint,text,text,date,numeric,text)` — SECURITY DEFINER, VOLATILE, `authenticated` EXECUTE, SQL wrapper delegating to `costing.rpc_set_staff_costing_classification`; wrapper md5 `6ba709477ecc7755fb6005b6e2203a2b`. The internal SECURITY DEFINER PL/pgSQL function (md5 `553d103a5afedda3191c1aa62c33be7c`, 4,950 chars) UPDATEs/INSERTs `costing.staff_costing_classification` and has **no** `require_permission` / `auth.uid()` guard. Classification: confirmed missing server-side authorisation guard; **not a demonstrated exploit** (no restricted-user write attempted anywhere).

## 2. Change (revised after independent review of 9 Nov 2026)
`supabase/migrations/20261109040000_wp05_w506_sec_fix_01_staff_classification_writer_guard.sql` (one transaction) inserts `perform public.require_permission('module:cost-build-manager', true);` as the first executable statement after the main `BEGIN` of the **internal** function. `require_permission(…, true)` requires `can_view` **and** `can_edit` (live helper independently read: non-null `auth.uid()`, canonical `can_view=true`, `can_edit=true` when requested). Expected outcome: ID-N, ID-O, ID-V/view-only CBM, ID-X, unauthenticated and edit-on-another-module-only are denied before any lookup, validation or write; CBM view+edit continues. The future dedicated personnel-costing permission is **not referenced**.

**Verified live fingerprints (independent review, SELECT-only):** internal `md5(pg_get_functiondef)=553d103a…` (prosrc md5 `d80f2103…` informational only); wrapper `md5(pg_get_functiondef)=6ba70947…` (prosrc md5 `2878e204…` informational only); internal `proconfig={search_path=costing, public, hr}`, ACL `{postgres=X/postgres}`.

Review points addressed:
1. **Fingerprints:** full-definition md5 only; the former `prosrc OR definition` allowance is removed. Exact `regprocedure` lookups for both functions; exactly one internal overload. A wrapper definition mismatch is now an **EXCEPTION** (no warning-and-continue); the wrapper is also re-hashed after execution.
2. **Idempotency fail-closed:** a function that is not the verified original is accepted as "already guarded" only if (a) the guard text occurs exactly once, (b) removing it restores the verified original full-definition md5, and (c) re-applying the deterministic patch to that original reproduces the live body byte for byte (so the guard is the expected first statement and nothing else differs). Anything else aborts.
3. **Placement:** shared helper `pg_temp.w506_guard_patch` allows only an optional plain `DECLARE` section before the first `BEGIN`; comments, quotes, dollar quotes, labels or other text there abort (a regexp is not a PL/pgSQL parser, so unknown shapes are refused, not guessed). The patch must be a single pure insertion. **Consequence:** if the live body's declaration section contains comments or string literals the migration will abort safely and need a reviewed, byte-exact adaptation — the live body is not in the repository and I could not byte-match it.
4. **Preservation:** OID, owner, ACL, `proconfig`, volatility, SECURITY DEFINER, language, return type, defaults and arg types before/after; installed definition minus the guard must hash to the verified original; wrapper full-definition hash unchanged.
5. **Local runner safety:** unix-socket `PGHOST` only; the cluster's `data_directory` must be named `w506-disposable-*`; superuser required; a **unique scratch database** is created (fails on collision) and only that database is dropped, only if this invocation created it; no `DROP DATABASE IF EXISTS`; one `mktemp -d` removed by an exit trap.
6. **Rollback governance:** relabelled a **security regression** with a containment-first policy (prefer a forward fix / alternative protective control); requires an owner-emergency interlock setting; fails closed on any guarded-definition drift (same proof as idempotency), unexpected wrapper, or restored hash mismatch.
7. **Impact:** `module:cost-build-manager` view+edit is a temporary minimum only; not every legitimate staff-classification editor is known to hold it. Non-JWT callers (service role, cron) are denied. A bounded scan of function sources found only the public wrapper naming the writer; that is **not** an exhaustive dependency scan (triggers, jobs, dynamic SQL, external clients not covered).

The public wrapper is intentionally not modified (it delegates; a byte-exact wrapper is now a precondition).

## 3. Tests and literal results (re-run on the revised head)
Static: `node --test scripts/costing-w506-sec-fix-01/migration-static.test.mjs` → **11 pass / 0 fail**.

Isolated local PostgreSQL 16.15 (disposable cluster `w506-disposable-1`, synthetic fixture): `PGHOST=<socket dir> PGPORT=… PGUSER=postgres supabase/tests/w506_sec_fix_01/run_local.sh` → **28 runner checks passed / 0 failed, plus the identity matrix 18/18 SQL rows PASS (counted separately)**; scratch database and temp directory removed afterwards (verified). Runner refuses `PGHOST=localhost` and empty `PGHOST`.
- S0 unguarded fixture lets a no-grants identity write; S1 the unmodified migration (real fingerprints) aborts.
- S2 apply; S2b catalogue + full wrapper definition unchanged; S2c definition minus guard = original hash; S3 matrix (ID-N, ID-O, ID-V, ID-X, other-module-edit, unauthenticated denied before validation and without writes; privileged direct internal call denied; CBM view+edit allowed); S4 re-apply = verified idempotent no-op.
- S5 adversarial already-guarded drift, all abort with nothing changed: (a) extra altered statement, (b) guard moved after the first statements, (c) guard only in a line comment, (d) guard in a block comment, (e) guard in a dead branch, (f) altered wrapper with the delegate string still present.
- S6 preimage drift: (a) altered wrapper, (b) internal body drift, (c) second overload — all abort.
- S7 shapes: CRLF accepted (guard first); nested later `BEGIN…EXCEPTION` accepted (only first patched); comment in DECLARE, label, quoted default, comment before DECLARE — abort.
- S8 rollback: no interlock aborts; drifted guarded body aborts; altered wrapper aborts; with interlock restores the original full-definition hash; second rollback is a verified no-op; re-apply reproduces the identical guarded definition.

**Limits:** fixture functions and `require_permission`/`auth.uid()` are **test doubles**, not the live definitions; the live helper emits its own denial exceptions (tests only require a non-validation error and no write; no SQLSTATE is assumed). A byte-exact test against the live 4,950-char definition was **not possible** (not in the repository). The migration's fingerprint literals are replaced by the synthetic definitions' hashes in scratch copies for these tests only; the unmodified file is exercised in S1.

## 4. Unverified assumptions / blockers
1. Live internal body's declaration/`BEGIN` shape passes the strict shape check (else safe abort and a reviewed adaptation).
2. `pg_get_functiondef` text is stable between the reviewer's readback and the apply server (same server/version assumed).
3. Whether every legitimate staff-classification editor holds `module:cost-build-manager` view+edit.
4. Migration runner has privilege to `CREATE OR REPLACE` the `costing` function.
5. No exhaustive caller/dependency proof (see §2 point 7).

## 5. Roll-out prerequisites (separate owner approval; nothing applied)
1. Fresh read-only readback of both full-definition hashes, ACL, owner and `proconfig` immediately before apply.
2. Separately authorised, isolated **live-definition-equivalent** test (the exact live definition text on a non-production database) before final rollout.
3. Exhaustive caller scan (triggers, jobs, dynamic SQL, clients); explicit decision for any non-JWT caller.
4. Enumerate current CBM view+edit holders; no blanket revoke.
5. Maintenance-window apply, then post-apply catalogue verification (fingerprint minus guard, ACL, wrapper hash).
6. Prefer containment/forward fix over the rollback script, which reopens the finding.

## 6. Still open (separate governed workstreams)
Client Edit/Review controls are rendered without an edit check (`costing-suite-cost-build.js:1203-1214, 1239-1250`); generic CSV export and `select('*')` still expose all returned salary columns; `total_salary_cost` is rendered; the three Staff Governance views remain readable by the shared view helper; the dedicated personnel-costing permission is undefined; no negative-identity behavioural evidence on the live system. **W5-06 OPEN; WP05 OPEN; 6/13.**
