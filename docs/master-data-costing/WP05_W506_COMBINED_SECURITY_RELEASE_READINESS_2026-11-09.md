# WP05-W506 — Combined Staff Governance security release readiness (9 November 2026)

**Status: DOCUMENTATION ONLY. Nothing applied, merged or deployed. W5-06 OPEN; WP05 OPEN; programme 6/13.** The owner accepted Path B and stated the operational caller policy in a subsequent decision on 9 November 2026; neither decision authorises production execution, rollback, grant changes or release.


## Owner disposition and operational preflight addendum — 9 November 2026

**Owner-approved policy (not deployment authorisation):**
- **R1 / Path B accepted.** The owner accepts the residual risk of not running the unchanged Save+Close suites on isolated PostgreSQL 17.4, on the strength of the recorded 16.15 exact-source and combined-sequence results, subject to the controlled rollout gates. PostgreSQL 17.4 migration execution remains **NOT TESTED**; never report it as PASS.
- **R6 / intended operational use confirmed.** Staff Governance classification changes are ordinarily made **through the SASV application**. Deliberately necessary **governed backend changes** remain an exceptional administrative route. This is a qualified operating-model attestation, **not** an absolute statement that all possible external/dynamic callers have been inventoried or that backend work is prohibited. Such exceptional backend procedures must be separately reviewed/authorised; a JWT-less `service_role` RPC invocation will be denied after the proposed guard. No automatic bypass, service credential exemption or grant widening is authorised.
- This owner confirmation satisfies the requested operating-model declaration to the extent of the owner's knowledge and existing scan evidence. **Unknown future, third-party or undocumented dynamic callers remain a residual risk**, rather than being asserted absent.

**Fresh owner-side read-only preflight evidence:**
- Production server PostgreSQL 17.4; all four Save/Close function full-definition MD5s, owners, ACLs and `proconfig` matched original baselines in the preceding independent readback. The current exact hashes are listed in §§1 and 7; **repeat the readback immediately before any eventual production execution**.
- Live `supabase_migrations.schema_migrations` / connected `list_migrations` results end at version `20261108165005` (`pec_vwl_r2_direct_indent_origin_lookup`) at this preflight. The proposed `20261109040000` and `20261109050000` migrations were not recorded. **Recheck for newer changes at execution time.**
- Bounded SELECT-only scan for both Save and Close: zero other `pg_proc.prosrc` references outside their respective wrappers, zero matching `cron.job.command` text, zero direct user triggers. This does not inspect all external or dynamic callers.
- Supabase's connected migration interface accepts a migration name and SQL body. This does **not prove** it will preserve a source filename version, nor that it tolerates the migration files' embedded `BEGIN/COMMIT` when wrapped in an executor transaction. No migration was submitted. **Executor/tool compatibility remains an unresolved STOP gate**, requiring a separately approved nonproduction-equivalent check or an exact, reviewed execution strategy before production approval. Record tool, applied name/version, source file hash, execution outcome and migration-history row; do not use `supabase db push`.

**Approved direction for the release plan, not permission to execute:** Prepare a sequential **Save then Close** controlled rollout with inter-step read-only checks, stop/fix-forward on partial failure and no routine rollback. Release authorisation, executor, maintenance window, migration-tool compatibility, optional containment actions and controlled post-deploy deny-path testing all remain **separate explicit decisions**. The client confidentiality workstream and formal W5-06/WP05 acceptance remain OPEN.

## Execution-tool compatibility finding — 9 November 2026 (blocking preflight)

**Newly discovered upstream Supabase warning:** Embedding top-level `BEGIN`/`COMMIT` in SQL submitted to a migration runner that already wraps the operation can cause an inner COMMIT to persist changes while a subsequent error prevents the runner from recording its migration-history row. Supabase specifically recommends leaving transaction management to that runner. Source: https://supabase.com/kb/troubleshooting/partial-migrations-and-schema-inconsistencies-from-embedded-transactions . The previously recorded in-file transaction precedent does **not** establish safety for these two files.

Both draft migration files currently include `begin;`/`commit;`. **No approval to submit those unchanged files via `apply_migration` or an equivalent auto-transaction migration runner.** Owner Path B approval is limited to the untested PostgreSQL 17.4 execution compatibility; it does not waive transaction/history integrity.

**Additional version-history issue:** Current connected Supabase MCP `apply_migration` accepts `name` and `query`, not a caller-specified migration version. Supabase MCP issue https://github.com/supabase/mcp/issues/241 reports server-generated migration timestamps that differ from repository filenames. This repository's AU2 guidance disallows unreviewed `supabase db push`. A concrete version-alignment/recording procedure is still required, not simply noting generated versions.

**Required remediation before execution:** Have the code worker propose minimal changes to both draft migration files, removing top-level transaction control only when the selected runner is proved to wrap **all** file statements on **one connection within one transaction** (needed for `pg_temp` helper visibility). Update the static tests expecting the old framing. In an isolated PostgreSQL 16.15 runner-equivalent harness, test ordinary Save→Close, idempotency, error injection after the function CREATE and before history recording (prove both DDL and history roll back), function fingerprint preservation and history-name/version mapping. No uncontrolled changes to the guard, target, wrappers, ACLs, rollback policy or existing production schema. If runner/connection/transaction semantics cannot be verified, **STOP**; choose a separately reviewed execution alternative. PRs #254 and #255 remain draft, production BLOCKED.

## 1. PR heads and states

| PR | Purpose | Head | State |
|---|---|---|---|
| #254 | Save writer guard `costing.rpc_set_staff_costing_classification` (migration `20261109040000`) | `ba8d3b1` | open, DRAFT, unmerged, unapplied |
| #255 | Close writer guard `costing.rpc_close_staff_costing_classification` (migration `20261109050000`) | `522e602` | open, DRAFT, unmerged, unapplied |

Both target `main` (`a779161`). Both are untouched by this document. (#254's description still cites an earlier head `4768d36` in one heading; the code/test content is current.) Policy in both: `require_permission('module:cost-build-manager', true)` (View **and** Edit) as the first statement of the internal function; wrappers unchanged; no identity hard-coded; no service-role bypass. Owner policy: one intended Staff Governance editor for now; delegation later, preferably via a dedicated personnel-costing permission.

## 2. Combined migration verification

**Static review (source inspection).**
- Ordering: `20261109040000` (Save) < `20261109050000` (Close), both later than the last `main` migration (`20261108165005`); unique versions; no overlap in files. Branches are independent, so merge order does not change filename order. Both PRs append to different places in docs (#255 appends an addendum to the targeted catalogue; this PR inserts its link near the top to avoid a textual conflict).
- Independence: different functions/signatures, different fingerprints (Save `553d103a…`/`6ba70947…`; Close `1c9884c0…`/`a8254681…`), different temp helpers (`pg_temp.w506_guard_patch` vs `pg_temp.w506_close_guard_patch`), different rollback interlock settings (`w506.rollback_owner_emergency_approval` vs `w506.close_rollback_owner_emergency_approval`). No shared objects, no cross-reference (`rpc_set_` absent from the Close files).
- Privilege: neither migration contains GRANT/REVOKE/DROP/ALTER or wrapper edits; guard requires `auth.uid()` plus canonical View+Edit, so `service_role`/JWT-less callers are denied by design (no bypass).
- **Transactions are separate.** Each file has its own `begin;…commit;`. Applying two files is **not atomic**. (A precedent for in-file `begin/commit` exists: `20261104131055_…`.)
- **Deployment tooling (documented repo history, not tested here):** earlier live applies used Supabase MCP `apply_migration` or the SQL editor (CI-033 record; AU2 runbook), which may assign a server-side version rather than the filename version, and AU2 states **do not use `supabase db push`** because repo and live history are not reconciled. The executor must therefore apply the reviewed file bytes exactly, record the assigned version, and not rely on `db push`. Whether the chosen tool tolerates an inner `begin/commit` is **NOT TESTED**; precedent only. Neither file sets `lock_timeout`; the executor should set a short session `lock_timeout` before running (outside the files; files stay unmodified).

**Executed combined evidence (new; PostgreSQL 16.15 disposable cluster, exact live snapshots of all four functions over synthetic dependencies, unchanged migration/rollback files; scratch script not committed): 24 checks passed / 0 failed.**

| Scenario | Result |
|---|---|
| Baseline | all four original fingerprints reproduced; no-grant user can call both writers (finding reproduced) |
| Save then Close | each applies; interim state after Save only = Save denied, **Close still open**; final: no-grant denied on both, CBM View+Edit allowed on both; wrappers unchanged; owner/ACL/config/signature/OID of all four unchanged; re-applying both is a no-op |
| Reverse order | byte-identical guarded definitions (no cross-dependency) |
| Partial failure (Close wrapper drift after Save commits) | Close aborts fail-closed ("wrapper full-definition md5"); Save stays guarded and committed; Close internal untouched; Close writer remains open to a no-grant user (residual exposure confirmed) |
| Forward correction | after the verified wrapper is restored, re-running **only** Close succeeds; end state identical to the clean sequence; Save not re-touched |
| Independent rollbacks | Save interlock does not authorise Close rollback and vice versa; Save-only rollback reopens only Save and leaves Close guarded; re-applying Save restores the combined state |
| Optional single-transaction variant (scratch concatenation, not a proposed file) | Close failure leaves **both** unguarded (all-or-nothing); on a clean state yields identical guarded definitions |

Already-guarded handling: each migration treats an exact original+insertion as a verified no-op, aborts on any other drift (per the #254/#255 suites and S1h above).

**Atomic-installation option (documented, not recommended by default).** A single combined file would give all-or-nothing, but: it would be a third, new artefact needing its own review/history entry; it would not preserve the approved per-PR migration files; and an all-or-nothing failure leaves *both* writers open, which is the worse security state than a Save-only success. Choose it only if the owner values symmetry over earlier closure of the Save hole. The approved files and migration history are not altered by this document.

## 3. Partial-failure analysis (Save commits, Close fails)
State: Save guarded; Close unguarded (still callable by any authenticated user via wrapper). Safest response, in order:
1. **STOP**, record the exact error text and `md5(pg_get_functiondef)` of all four functions; do not retry blindly.
2. **Do not roll Save back** — that reopens a second hole for symmetry. 
3. Diagnose with read-only catalogue queries (drift in Close internal vs wrapper; lock timeout; privilege). Fix forward: if the cause is transient (lock/timeout) re-run Close; if drift, re-read the live definition and issue a reviewed corrected companion migration (new fingerprints), never edit the approved file in place.
4. If forward correction cannot be done promptly, the owner may **separately approve** a temporary containment of the Close wrapper (e.g. restricting its EXECUTE) after an impact evaluation (it has no known repo caller; the Staff Governance UI uses Save only). Not authorised here.
5. Record the interval of exposure and the outcome.

## 4. Risk register

| # | Risk | Evidence | Class |
|---|---|---|---|
| R1 | PostgreSQL 17.4 not execution-tested | 16.15 only; no approved 17.4 environment | **Owner accepted Path B** as documented exception; PG17.4 remains NOT TESTED |
| R2 | 16.15 exact-source verification limits | Exact live definitions, 4 fingerprints, synthetic dependencies, test-double helper, different server version | Conditionally acceptable (strong evidence of logic; not a production test) |
| R3 | Real `require_permission` and PostgREST behaviour | Live helper read by definition (md5 `d4921dbc…`), not executed; PostgREST/RLS not exercised | **NOT TESTED**; conditionally acceptable only with post-deploy authorised denial tests |
| R4 | Authenticated view-only / unauthorised access | Denied in 16.15 matrices (44 distinct denial/permit rows across both writers) | Resolved for logic in isolation; production behaviour NOT TESTED (see R3) |
| R5 | Existing CBM View+Edit users | 1 View+Edit, 2 View-only (owner aggregate); sole editor attested as intended | Resolved for present operation; breadth of CBM rights noted |
| R6 | Unknown external / non-JWT callers | Owner confirms app-only ordinary updates, plus exceptional governed backend procedure; bounded repo/live scans identify no routine non-JWT callers; unknown external/dynamic calls cannot be excluded | **Operating model attested; residual discovery risk retained**; no bypass |
| R7 | Partial deployment (non-atomic) | Executed in §2 | Conditionally acceptable with STOP rules and forward-correction plan |
| R8 | Function-definition drift between readback and apply | Fail-closed aborts executed for both | Resolved by design; requires fresh readback at apply |
| R9 | Independent emergency rollbacks reopen holes | Executed independence in §2 | Conditionally acceptable: containment-first, owner-interlocked |
| R10 | Client Edit controls shown without edit check; salary exposure (CSV, `select('*')`, `total_salary_cost`) | Source inspection; separate workstream | Not addressed by these PRs; does **not block** these guards but blocks any privacy claim and W5-06 closure |
| R11 | Migration-tool transactions and version history | Supabase advisory warns embedded BEGIN/COMMIT may commit DDL before migration history; MCP-generated version may differ from filename | **BLOCKING** until runner-compatible migration revision, isolated failure/rollback proof and version-history method |
| R12 | Lock contention at CREATE OR REPLACE | Not measured | Conditionally acceptable with `lock_timeout` and a maintenance window |

## 5. PostgreSQL 17.4 disposition
**Evidence for parity:** all four production 17.4 `pg_get_functiondef` fingerprints equal those produced by 16.15 from the committed definitions, so the text the migrations compare against is rendered identically; the migrations use long-stable features only (`to_regprocedure`, `pg_get_functiondef`, `regexp_instr`/`regexp_replace`, `md5`, `replace`, `EXECUTE` of `CREATE OR REPLACE FUNCTION` in a DO block). I identified no specific 17 incompatibility.
**Residual risks specific to testing on 16 instead of 17.4 (unexercised):** PL/pgSQL compilation/validation of the guarded bodies on 17; planner/executor behaviour of the unchanged wrapper SQL bodies; privilege/search_path semantics for SECURITY DEFINER under 17 defaults; any version-specific catalogue rendering not covered by the four fingerprints; behaviour of the real extensions/roles present in production. These are **unobserved**, not known failures.
- **Path A — Verified release:** an approved disposable PostgreSQL 17.4 (same minor) runs the *unchanged* suites: `run_live_equivalent.sh` for #254 (26 checks + 21-row matrix) and #255 (26 checks + 23-row matrix), plus the combined sequence scenarios in §2, on a cluster whose data directory is named `w506-disposable-*`. Record `select version()`, commit SHAs and outputs. Closes R1 as PASS.
- **Path B — Explicit risk-accepted release:** the owner separately and in writing accepts the absence of 17.4 isolated testing after reviewing R1–R3 and the controls in §7–§8 (maintenance window, fresh fingerprints, post-deploy denial test, containment plan). This is a **governance exception, not compatibility evidence**; R1 stays "not tested".
**Owner decision:** Path B has been accepted as a documented version-test exception. Path A is not being pursued for this release unless new conflicting evidence requires reassessment. Neither choice is permission to deploy.

## 6. External-caller attestation (for the owner)
Reconciliation: repo — Save: one browser client call (`costing-suite-cost-build.js` → `costingRpc` → signed-in Supabase client, JWT user); Close: none (generated types only); scripts/workflows/Edge Function sources in repo: none. Production read-only inventory (owner): 34 cron command strings, function bodies, trigger definitions and 3 deployed Edge Functions: 0 references (Close-specific wording in those scans should be confirmed). Both public wrappers retain `service_role` EXECUTE, but both guards need a real application user with CBM View+Edit, so any service-role/JWT-less caller **will fail**.
**Owner operational attestation (9 November 2026, recorded in PR discussion):** Staff Governance classification changes are ordinarily made through the SASV application; explicitly necessary **governed backend changes** remain possible. This is not an unconditional no-external-caller assertion and is not a blanket waiver for direct SQL or service-role RPCs. The bounded technical scan disclosed no regular background integration. An exceptional backend operation must be individually reviewed, authorised and audited, with its own execution path. Any new non-JWT caller must be classified with owner/purpose/frequency before a related integration is activated. Do not introduce a guard bypass.

## 7. Controlled rollout checklist (STOP = halt, record, do not continue)
**Before.** (1) Written owner approval of the release and of Path A or Path B. (2) Fresh read-only readback of the four full-definition md5s — STOP on any difference from `553d103a…/6ba70947…/1c9884c0…/a8254681…` (also helper `d4921dbc…`). (3) Compare owner, ACL, `proconfig`, signature, volatility for all four against the baseline — STOP on difference. (4) Confirm CBM grant counts unchanged (1 View+Edit) and the editor is reachable. (5) Confirm migration sequencing/history method; executor knows `db push` is not used; version recorded. (6) Maintenance window, short `lock_timeout`, executor and observer named. (7) Containment plan approved in principle (§8). (8) Attestation §6 signed. (9) PR heads still `ba8d3b1` / `522e602` (STOP if changed).
**During.** (1) Apply Save file exactly as reviewed. STOP if any error. (2) Read-only: Save internal = original + exact guard (definition minus guard = `553d103a…`), wrapper still `6ba70947…`, metadata equal — STOP on mismatch. (3) Apply Close file exactly as reviewed; STOP on error and follow §3. (4) Read-only: Close internal minus guard = `1c9884c0…`, wrapper `a8254681…`. (5) Record exact outputs and timestamps; never continue after a mismatch.
**After — safe catalogue checks (read-only):** guard text present exactly once as first statement in both internals; all four md5/ACL/owner/config as expected; no other function changed; `authenticated` cannot EXECUTE either internal. **Functional tests (could mutate real records) — only under separately approved procedures:** denial tests with a non-editor and a view-only identity (denied calls cannot write because the guard precedes writes, but still require approval); **no positive test writes** against real classification records; if the editor path must be confirmed, use only an owner-approved, reversible, audited action or a staging copy. Confirm afterwards that `costing.staff_costing_classification` row counts/`updated_at` max are unchanged (read-only). Then monitor logs for permission errors from unexpected callers and capture final evidence.

## 8. Emergency and recovery (containment first; any containment needs separate owner approval and impact evaluation)
| Situation | Response |
|---|---|
| Save succeeds, Close fails | §3: stop, forward-correct Close; no Save rollback; optional approved temporary containment of the Close wrapper |
| Both installed but the legitimate editor is rejected | First verify the editor still holds CBM View **and** Edit and that the helper behaves (read-only). Fix by restoring the *grant* through governed access administration, not by removing the guard. A rollback is last resort, per function, with its own interlock and an alternative control in place |
| Unexpected service-caller failures | Identify the caller; provide a user-JWT path or an owner-approved dedicated control; no service-role bypass; rollback not routine |
| Unexpected behaviour in authenticated testing | Stop testing; read-only catalogue check; do not repeat on real records; escalate to the owner |
| Post-deploy fingerprint mismatch | Treat as drift/tampering: read-only investigation, compare to expected guarded forms, forward-correct with a reviewed migration; do not auto-roll back |
Rollbacks (`WP05_W506_SEC_FIX_01_ROLLBACK.sql`, `…_02_ROLLBACK.sql`) are security regressions, fail closed on drift, and are separately interlocked; executed independence is in §2.

## 9. Owner decisions still required
1. **DECIDED:** Path B accepted; PostgreSQL 17.4 remains NOT TESTED. Reconsider only if contradictory evidence arises.
2. **DECIDED:** Owner confirms ordinary SASV application use with deliberately required governed backend exceptions; unknown external/dynamic callers remain a residual risk (§6).
3. Authorise the release (production execution is a separate decision), the maintenance window and executor.
4. Approve the containment options in principle (e.g. whether a temporary Close-wrapper restriction is acceptable if Close fails).
5. Approve the post-deploy denial-test procedure and identities.
6. Decide Save-then-Close non-atomic installation (recommended) versus a reviewed atomic combined file (§2).
7. Confirm the migration-apply tool and how versions will be recorded.
8. Separate workstreams: client Edit-control gating and salary-data exposure; dedicated personnel-costing permission.

## 10. Final recommendation
**POLICY GATES RESOLVED; PRODUCTION EXECUTION BLOCKED BY RUNNER TRANSACTION/HISTORY COMPATIBILITY (R11).** R1 accepted under Path B and R6 operating model attested with residual unknown-caller risk. The mandatory migration-tool/transaction and version-history preflight, fresh hashes, approved execution/containment/denial-test plan, executor, maintenance window and separate owner release authorisation remain open. The code, fingerprints, sequencing and partial-failure behaviour are verified to the extent possible on PostgreSQL 16.15; production behaviour (real helper, PostgREST, 17.4) is NOT TESTED. Programme count 6/13; W5-06 and WP05 remain OPEN.
