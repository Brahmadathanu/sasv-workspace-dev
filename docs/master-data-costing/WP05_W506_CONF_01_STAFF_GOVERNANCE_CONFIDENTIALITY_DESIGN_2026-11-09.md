# WP05 W5-06 — Staff Governance confidentiality: combined security design (9 November 2026)

**DRAFT / NOT APPLIED / NOT DEPLOYED.** Issue #234. Save/Close writer guards (#254/#255) are deployed and are not touched. No production SQL, grant, migration replay, merge, deployment or salary-row export was performed. W5-06 OPEN; WP05 OPEN; programme 6/13. Companion PRs: **server** (this PR: migration, rollback, tests, this document) and **client** (`claude/wp05-w506-conf-client-gate`).

## 1. Consumer inventory (repository level; bounded)

| Consumer | What it reads | Finding |
|---|---|---|
| `costing-suite-cost-build.js` `loadStaffGovernanceRows` | register, unclassified-staff and pool-summary views, `select('*')` | Fetches all columns incl. `basic_salary`, `allowance_amount`, `employer_contribution`, `other_salary_cost`, `staff_details`; none of these five is rendered. Fixed in the client PR (explicit projections, no request without access). |
| `costing-suite-shell.js` | `VIEW_BY_LENS["staff-governance"]`, `loadRowsForLens`, generic CSV `exportCsvForRows(VIEW)`, `renderTable`, edit wiring | Export writes every key of the loaded rows; edit buttons rendered for any viewer; no personnel permission concept. Fixed in the client PR. |
| CBM edit modal / `saveStaffClassificationEdit` → Save wrapper | row fields `staff_id, employee_code, designation, costing_class, effective_from, allocation_weight, remarks, classification_note` | Needs no salary component. Server writer is already guarded (#254). |
| Close writer `rpc_close_staff_costing_classification` | `return query select … from v_costing_staff_classification_register` inside a SECURITY DEFINER function (owner = postgres) | Unaffected: `current_user` is the owner, which the gate admits (matrix row "definer-owned function"). No client call site. |
| `v_costing_unclassified_staff_for_costing` | reads the register view | Inherits the register gate; gated again by the same personnel function. |
| Repository scripts / workflows / Edge Functions / types | none besides generated `supabase.ts` | No other repo consumer. |
| Production: DB functions, triggers, cron (34), 3 Edge Functions | owner readbacks for #254/#255 found no writer references; **no consumer scan for the three *views*** beyond the repo was performed | **UNKNOWN** — owner readback item R-A below. External BI/PostgREST users of these views cannot be excluded. |

## 2. Permission boundary — options

| Option | Effect | Assessment |
|---|---|---|
| **A. Temporary: Cost Build Manager VIEW AND EDIT** (recommended now) | Individual staff/salary rows only for the attested sole editor; same policy as the deployed Save/Close guards; one gate function, so a later dedicated permission is a one-function change | Smallest change that closes the exposure; CBM view-only users (2 accounts) lose the individual tabs (they keep aggregate pool totals). Couples pay visibility to broad CBM edit rights — acknowledged. |
| **B. Dedicated personnel-costing permission** (target) | e.g. `role:personnel-costing-view` / `-edit` (naming follows the `role:material-cost-rm-trace` precedent), granted explicitly | Preferred least-privilege design; needs permission provisioning, an access-admin decision and a client permission mapping; not built here. Migration path: replace the body of `fn_costing_personnel_view_allowed()` and the client `personnelAccessAllowed()`; nothing else changes. |
| C. CBM VIEW only | Keeps view-only colleagues | Rejected: preserves broad salary visibility. |
| D. Leave broad gate, hide in UI | — | Rejected: UI hiding is not authorisation (PostgREST reads the view directly). |

**Aggregate reporting is preserved:** the pool-summary view keeps the broad `fn_costing_view_allowed()` row gate (amounts, counts, status); only the nested identifying `staff_details` column is NULLed for non-personnel callers (same name/type/order, so no consumer breaks).
`total_salary_cost` stays visible to the authorised editor (the existing screens display it); decide in §7 whether it should be dropped for editors too.

## 3. Server remedy (draft migration `20261109130000_wp05_w506_conf_01_personnel_view_gate.sql`, rollback in `docs/master-data-costing/prepared/`)
- New `public.fn_costing_personnel_view_allowed()` (security invoker, stable): `postgres/service_role` OR CBM view AND edit (via `app_has_permission`, the helper the TB2 gate already uses; `'edit'` is already used by four repo migrations).
- Register and unclassified-staff views: row gate switched to the personnel function. Pool view: `staff_details` masked via `CASE`.
- No GRANT/REVOKE on the views, no change to `fn_costing_view_allowed()` (shared by 46 other views), no table/RLS change, wrappers/writers untouched.
- **Fail-closed and exact-definition:** four full-definition md5 fingerprints (3 views + gate function) are **placeholders that abort the migration until filled from an owner SELECT-only readback**; exact-once textual anchors on the live `pg_get_viewdef`; installed definition must equal the verified original plus the single change; columns/types/order, owner, ACL, reloptions unchanged; idempotent only if reversing the change restores the verified original; one DO statement, no top-level BEGIN/COMMIT (runner-compatible, see #256 §11).
- Rollback = security regression, own interlock `w506.personnel_gate_rollback_owner_emergency_approval`, containment-first, same drift proofs; helper function left in place.

**Owner readback needed before this can be applied (SELECT-only; nothing executed here):** (R-A) for each of the three views: `md5(pg_get_viewdef(oid))`, the `pg_get_viewdef` text (to confirm the anchors: `fn_costing_view_allowed()` once; pool: the line `            p.staff_details,`), `relowner`, `relacl`, `reloptions`, and `pg_depend` dependents; (R-B) `md5(pg_get_functiondef)` of `fn_costing_view_allowed()` and the definition of `app_has_permission(text,text)` (confirm `'edit'` semantics and its canonical source); (R-C) consumers of the three views in function bodies, other views, triggers, cron and Edge Functions; (R-D) PostgreSQL 17.4 rendering of the same definitions (anchors were derived from 16.15 deparsing of the repo-recorded TB2 text).

## 4. Client remedy (client PR)
Explicit column projections (no `*`; no salary components, no `staff_details`); **no network request** for register/review tabs without personnel access (CBM view AND edit, CBM route, no permission-load error — fail closed); restricted notice + in-memory purge when denied (also covers deep links such as `?lens=staff-governance`, since the loader decides at load time); Edit/Review buttons rendered and wired only for the authorised editor, modal and save re-check; CSV export blocked for restricted staff tabs (and the exported rows can contain only projected columns); `sw.js` cache generation advanced (v393) so clients receive the JS (the service worker never caches Supabase responses; 25 pinned tests updated for the bump; frozen-diff shell/controller tests extended with the exact insertions).

## 5. Test evidence (nothing run against production)
| Suite | Result |
|---|---|
| Server static `node --test scripts/costing-w506-conf-server/migration-static.test.mjs` | 12/12 |
| Server runner `supabase/tests/w506_conf/run_view_gate_test.sh` (PostgreSQL 16.15 disposable, repo-recorded TB2 view text, synthetic rows) | 20 checks pass / 0 fail; identity matrix 14/14 |
| Client `node --test scripts/costing-w506-conf-client/staff-governance-gate.test.mjs` | 20/20 |
| Table-tools / cache-coupling suites touched by the bump | see client PR description (pre-existing failures identified against `main`) |
Matrix identities: no grants, unauthenticated, CSR-only, MCM-only, CCC view+edit, CBM view-only, CBM edit-without-view, CBM view+edit, postgres, service_role, anon, definer-owned writer pattern. Baseline reproduced: a CSR-only user reads individual salary rows and `staff_details` on the TB2 definitions.
**Limits:** synthetic dependencies; `app_has_permission`/`auth.uid` are test doubles; the three views come from the repo's TB2 text, **not** the live definitions (fingerprints must come from the readback); PostgreSQL 17.4 and real PostgREST behaviour NOT TESTED.

## 6. Safe authenticated PostgREST acceptance procedure (read-only; separately authorised; no salary/classification record is modified or exported)
Preconditions: owner approves the run; test identities already hold their intended grants (no grant changes): ID-N, a CSR-only user, a CBM view-only user, the CBM view+edit editor. Use their own session JWTs (never the service key). Only `HEAD`/`GET` against the three views, never `POST/PATCH/DELETE` and never an RPC.
1. For each identity and each view send `HEAD /rest/v1/<view>?select=staff_id` (or `period_start` for the pool view) with `Prefer: count=exact`; record **only status and the `Content-Range` count** (no body).
   Expected: register/review → ID-N 0, CSR-only 0, CBM view-only 0, editor = the live row counts (owner-known aggregates); pool → ID-N 0, others ≥1.
2. Masking check: as a restricted identity `GET /rest/v1/v_costing_staff_cost_pool_summary?select=staff_details&limit=1` must return `null` values; as the editor use `HEAD …?staff_details=not.is.null` with `count=exact` (count only; never read the column).
3. `anon` (no JWT): `HEAD` each view → 401/permission denied.
4. Browser (read-only clicks): for each identity open Cost Build Manager → Staff Governance; in DevTools confirm the Staff Review/Register tabs issue **no** request when restricted and the editor's requests carry the explicit `select=` list without salary components/`staff_details`; Edit buttons absent when restricted; Export shows the permission toast. **Do not click Save/Close.**
5. Evidence: store status codes, counts, and screenshots with salary cells masked/cropped; no response bodies containing salary or staff names.
6. Post-run: read-only check that `costing.staff_costing_classification` `max(updated_at)` and row count are unchanged.
STOP on any unexpected non-zero count for a restricted identity, any 5xx, or any request that would write.

## 7. Release order and decisions
Recommended order (each step separately authorised): (1) owner readback R-A…R-D → fill the four fingerprints in a reviewed commit; (2) deploy the **client** PR (it is safe with the current server: authorised editor unchanged, restricted users stop requesting individual rows); (3) apply the **server** migration with the #256 §11.4 method (one `apply_migration` call, read-only history/definition check, STOP gates); (4) run §6; (5) monitor. Rollbacks are security regressions (containment first).
**Decisions needed from the owner:** (a) approve Option A (temporary CBM view+edit) as the personnel boundary now, and whether CBM view-only users may keep individual rows (not recommended); (b) approve the dedicated personnel-costing permission as the next workstream and its target names; (c) should `total_salary_cost` be hidden even for the editor, or is it required on screen; (d) approve masking `staff_details` for non-personnel (vs removing the column); (e) authorise the SELECT-only readbacks R-A…R-D, including consumer scans of the three views (BI/external); (f) authorise the §6 PostgREST acceptance run and name the test identities; (g) release order and window; (h) confirm that no non-editor workflow depends on the individual tabs (2 CBM view-only accounts).
