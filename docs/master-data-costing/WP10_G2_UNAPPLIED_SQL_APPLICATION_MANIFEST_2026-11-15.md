# WP10 G2 — Reviewed SQL payload manifest (application status from receipts)

**GENERATED FILE — do not edit by hand** (`node scripts/wp10-g2-safeguards/gen-application-manifest.mjs`; `draft-sql-static.test.mjs` S24 requires it to match the SQL).
**THIS DOCUMENT IS NOT PERMISSION TO APPLY ANYTHING.** Phase 1 files 01/02/03/06 are APPLIED on qhmoqtxpeasamtlxaoak; 04/05 and rollback remain UNAPPLIED. See [actual receipts](WP10_SQL_PHASE1_EVIDENCE/application-receipt-2026-11-16.json). Payload headers saying UNAPPLIED are retained as the immutable pre-application source, not current installation status. No additional SQL, grant, permission, RLS, registry, flag, deployment or merge is authorised by this manifest. WP10 stays OPEN; programme 10/13.
Applying any step needs a separate, exact owner decision naming the target database, the file hashes below and the operator.

## 1. Files, order and hashes (sha256 of the committed text, LF-normalised)
| # | File (`docs/master-data-costing/WP10_G2_UNAPPLIED_SQL_PROPOSALS/`) | sha256 | Creates | Preflight dependency checks | Proposed grant implication |
|---|---|---|---|---|---|
| 1 | `01_clock_and_batch_size_contract.sql` | `0077b90fffbf9bd9c770ab55b85e81e8110d1c6c0a8a17135ba71bee4620dab3` | costing.fn_wp10_today_ist(); costing.fn_wp10_batch_size_state_as_of(bigint,date) | none (read-only helpers) | none (helpers revoked from public/anon/authenticated) |
| 2 | `02_essential_states_and_boundaries.sql` | `ef4cd91f693c220a614db3f7640afb301126b47626cde93e792b393b27c74b31` | costing.fn_wp10_essential_states_as_of(bigint,bigint,date); costing.fn_wp10_boundary_dates(bigint,bigint,date,date) | 01 receipt intact; 9 live functions md5-fingerprinted (resolvers + route chain) | none (helpers revoked) |
| 3 | `03_operational_expiry_horizon_rpc.sql` | `dea309c07d0ff6726b04d9ed4d56e190c6d2afda9628a06996df133e7dfb0ce5` | public.rpc_wp10_get_operational_expiry_horizon(integer,bigint,integer) | 01 and 02 receipts intact | GRANT EXECUTE to authenticated (read-only RPC; internal check: Manage Products view OR Costing Control Center view) |
| 4 | `04_active_sku_reparent_guard.sql` | `5aca56751901ee5c7c2ff17baec01cec728a1abdfd68fa70b3cc489eeae1c0e7` | public.fn_wp10_guard_active_sku_reparent(); trigger trg_wp10_active_sku_reparent_guard on public.product_skus | none beyond absence of the names | none (function revoked); the trigger fires for every writer incl. privileged ones |
| 5 | `05_product_route_impact_guard.sql` | `89aacb0f0a10f537e1de7b1b5b9633d4bf6975e6e82146039251b14e9da3239c` | public.fn_wp10_product_route_impact_before()/after(); triggers trg_wp10_product_route_impact_before/after on public.products | 01 receipt intact; 7 live route-chain functions md5-fingerprinted | none (functions revoked); the triggers fire for every writer incl. privileged ones |
| 6 | `06_subgroup_impact_preview.sql` | `abb291fe26bce9ac2618eca5325b4cb82392a262d895585e87b9746cc8f9217f` | 5 costing.fn_wp10_*_ctx helpers; public.rpc_wp10_preview_product_subgroup_impact(integer,integer) | 01 receipt intact; 7 captured live functions md5-fingerprinted (4 derived-from, 3 reused unchanged); required tables and public.app_has_permission present | GRANT EXECUTE on the preview RPC to authenticated only (read-only; internal check: Manage Products view); helpers revoked |
| 99 | `99_rollback_all.sql` | `a1bc2af2642f1c6e2e1ee9ca0047388648bc5940de5cc5ae1e50f159c6f00522` | — (removes 01–06 objects) | receipts intact for every existing object | none |

Order is **01 → 02 → 03 → 04 → 05 → 06** and is enforced by the preflights (a file refuses to run if a prerequisite receipt is missing or modified). 03, 04, 05 and 06 are independent of each other except that 03 needs 01+02 and 05/06 need 01. **Proposals 04 and 05 are blocking guards; 03 and 06 are read-only endpoints.** The owner may select a subset only if its prerequisites are included; the rollback handles any subset.

## 2. What every file does before it creates anything (mechanical, in one transaction)
1. `set local lock_timeout = '5s'; statement_timeout = '30s'`.
2. **Absence check:** every function/trigger the file creates must NOT exist (no overwrite, no adoption; `CREATE FUNCTION`, never `CREATE OR REPLACE`). A re-run fails here.
3. **Live dependency fingerprint:** each live function it relies on must exist and `md5(pg_get_functiondef(oid))` must equal the reviewed value embedded in the file (derived from the committed independent catalogs). 06 fingerprints the four functions it is derived from and the three it reuses.
4. **Prerequisite receipts:** the proposals it depends on must carry `COMMENT 'WP10-G2 <file> md5:<definition md5>'` and still match.
5. Creates objects, applies revokes/grants, then stamps its own receipts. Any error rolls the whole file back.

## 3. Stop conditions (do NOT proceed; return to ChatGPT/owner)
- Any preflight exception, in particular: "already exists", "differs from the reviewed definition", "prerequisite … missing, not applied by this procedure, or modified since".
- A file hash that differs from section 1, or a `06_subgroup_impact_preview.sql` that is not the generator output.
- A target database whose route chain was changed after the reviewed catalogs (re-review, do not edit the md5 values).
- Any observed write by a preview call, any unexpected grant, or any failure of the post-apply checks below.
- Elevated lock waits or statement timeouts on the target (the files fail fast by design; do not raise the limits).

## 4. Post-apply read-only checks (to be run by an authorised operator, never by this package)
- Every `%wp10%` function has a receipt matching its definition (`provenance.test.mjs` V1.2 shows the query).
- `has_function_privilege`: `authenticated` can execute only `rpc_wp10_get_operational_expiry_horizon` and `rpc_wp10_preview_product_subgroup_impact`; `anon` and `service_role` execute neither; no `*_ctx` helper is executable by `authenticated`.
- A preview call inside `BEGIN READ ONLY` succeeds and changes no business, audit or epoch fingerprint (`preview.test.mjs` W10 shows the check).
- Real-role behaviour, hosted/installed-client behaviour and production-scale performance are **NOT TESTED** by this package and remain separate gates.

## 5. Rollback
`99_rollback_all.sql`: phase 1 verifies the receipt of every existing proposal-named object and **drops nothing** if any is missing or modified (not created by this procedure); phase 2 drops triggers then functions without CASCADE; absent objects are skipped with NOTICEs; no table, policy, grant on a live object or data is touched. Client rollback is independent: remove the `WP10_SAFEGUARDS_V1` localStorage flag (the client features are inert while the endpoints are absent).

## 6. Grant implications in one place (all TEXT in the SQL files; none executed)
- New client-callable surface if 03 and 06 are applied: two read-only RPCs, `EXECUTE` to `authenticated`, each re-checking identity and the existing permission targets (no new target, no registry or launcher change).
- Triggers 04/05 add rejections for privileged writers as well (service role, owner, SQL editor); they grant nothing.
- No RLS policy, table privilege or live-function ACL is changed by any file.
