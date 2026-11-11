# Staging acceptance package — scoped Cost Comparison RPC (#273)

**Prepared 11 Nov 2026. NOT EXECUTED.** No staging target is authorised, no billable Supabase branch was created, and nothing here installs the function, enables the flag or touches production. D-7 #24 FAIL, WP05 OPEN, programme 6/13 are unchanged. Passing this package is **staging evidence only**: it is an input to, not a substitute for, the owner's production application decision.

## 0. Target (owner decision needed; Claude will not create one)
| Option | Cost | Real roles / PostgREST | Notes |
|---|---|---|---|
| A. Existing authorised staging project | none new | yes | needs data volume near production (~1.46 M snapshot rows) or the performance step proves nothing; run `00_preflight_readonly.sql` P7 |
| B. Local Supabase stack on the owner's machine (`supabase start`, Docker) | none | yes (GoTrue, PostgREST, real `authenticated`/`anon` roles and the `8s/3s` role settings are *not* default; set them explicitly to match P6) | seed from a sanitised restore; needs the real `require_permission` definition from P3 |
| C. Supabase branch | **billable** | yes | only with separate written cost approval |
Never production: every script refuses without a confirmation and the HTTP runner refuses the production project ref and any JWT that names it.

## 1. Entry criteria
1. #276 (generic error text) and #275 reviewed; heads recorded in the issue.
2. `00_preflight_readonly.sql` on the target matches production for: view hashes (internal `63adf794…`, public `3382dc88…`), 63 columns, `require_permission` definition and owner, snapshot RLS/ownership (production: RLS on, not forced, 0 policies), role timeouts (authenticated 8 s, anon 3 s), no existing scoped function. Any mismatch is a finding; **stop** if the hash differs.
3. Four staging identities with real JWTs (never committed or pasted): **ID-V** (view-only on `module:costing-control-center`), **ID-N** (signed in, no costing permission), **ID-X** (permission on another module only), optional **edit-without-view**; plus the anon key.

## 2. Steps (owner-operated)
| # | Step | Command | Pass criteria |
|---|---|---|---|
| 1 | Fingerprint | `psql -v confirm_not_production=1 -At -f fingerprint.sql` | record `state_md5` (F0) and `scoped_function_present=false` |
| 2 | Apply prepared SQL to **staging** | `psql -v ON_ERROR_STOP=1 -f ../PREPARED_20261111_csr_scoped_comparison_rpc.sql` | exits 0; its post-conditions pass; fingerprint equals F0 apart from `scoped_function_present=true` |
| 3 | SQL-level real-data parity | `psql -v confirm_not_production=1 -v idv_uuid=<ID-V uuid> -f 10_parity_realdata_readonly.sql` | `PASS` lines for column contract and bag parity (`EXCEPT ALL` both ways, null profiles, order) for Sep/Oct/Nov 2026 and absent 2025-11; read the `capped` flag (true means ≥ 2,000 rows) |
| 4 | Real-role authorization, HTTP parity, performance | `node scripts/csr-scoped-rpc-staging/staging-acceptance.mjs` (env: see file header) | `verdict` begins `PASS`; all four `checks` true |
| 5 | Cold sample | rerun step 4 after ≥ 10 idle minutes; the first sample per period is the cold sample (`first`) | `first` for RPC within budget, no 5xx |
| 6 | Client flag drill (staging build only) | set `localStorage.COSTING_CSR_SCOPED_COMPARISON_RPC_V1="1"` in an ID-V browser at 1280 and 390 px; open Nov-vs-Oct Cost Comparison; then remove the flag | table identical to flag-OFF; no error; no raw server text; flag removal restores the view read |
| 7 | Rollback drill | `psql -v ON_ERROR_STOP=1 -f ../PREPARED_20261111_csr_scoped_comparison_rpc_rollback.sql`, fingerprint | `state_md5` equals F0; `scoped_function_present=false`; with the flag still ON the client shows the "not available on this server" message (no view fallback) and OFF restores normal reads |
| 8 | Roll-forward | re-apply the prepared SQL, rerun step 3 | passes again |

Order matters on rollback: **client flag off first, then drop the function**.

## 3. What each step proves (and does not)
- **Authorization (step 4):** with real JWTs, anon and ID-N/ID-X/edit-without-view receive an error and no rows from the RPC; ID-V receives rows. This is the non-waivable check that replaces the modelled-role tests. It does **not** prove the permission data on production matches staging; compare `user_permissions_canonical` shape separately.
- **Parity (steps 3 and 4):** SQL-level and over HTTP the RPC result equals the existing view result as a multiset, with identical column set and order, for Sep/Oct/Nov and the absent period. The runner compares SHA-256 digests; reports contain **no tokens and no row contents**.
- **Performance (steps 4–5):** interleaved view and RPC calls per period, bounded (≤ 15 rounds, aborts on the **first** 5xx), reporting p50/p95/max/first for each path. **Proposed** thresholds, for the owner to confirm: RPC p95 ≤ 4,000 ms (half the 8 s role budget), zero failures, and October RPC p95 not worse than the view. Planner estimates (Oct −0.57 %) are not substitutes. Staging results transfer to production only to the extent data volume, statistics (P7) and role settings (P6) match.
- **Not proven by this package:** production latency, behaviour under concurrent production load, Electron packaging, service-worker cache release, or any other lens.

## 4. No-go conditions (any one stops the programme)
View hash drift; an existing scoped function; non-postgres owner; RLS/policy surprise; any non-ID-V identity receiving rows; any bag/column/order mismatch; any 5xx; RPC p95 over budget or October worse than the view; flag-OFF behaviour not byte-identical; staging data volume not comparable (step 4 result then informational only).

## 5. Evidence to attach to #273
Heads of #275/#276, fingerprints F0/F1/F2, `staging-report.json` (tokens never included), the preflight and parity transcripts with the `cost_sheet_note` review result (counts only), and a statement of target, data volume and role settings.

## 6. Local validation already done (synthetic, not staging)
`staging-acceptance.mjs` is unit-tested against an in-process mock PostgREST (guards, allowlist, bag/order/column/authorization fault detection, 5xx abort, no secrets in report): `node --test scripts/csr-scoped-rpc-staging/staging-acceptance.test.mjs`. The three SQL files were executed against the disposable local PostgreSQL fixture only.
