# Scheme Master register: per-scheme LATERAL performance candidate (UNAPPLIED)

Issue #211 section B. **Candidate only: nothing in this folder is a migration, nothing was applied, no Supabase, flag, client or deployment change.** The files are generated from the TB2 definition already in the repository (`supabase/migrations/20261019134900_tb2_costing_view_permission_gate.sql`) by `scripts/scheme-master-perf-candidate/build.mjs`; the test re-generates and compares byte for byte, so they cannot drift.

## Problem and measured evidence (issue #211, live, SELECT-only, 8 Nov 2026)
`public.v_costing_scheme_master_register` computes three statistics per scheme with three separate correlated subqueries over `costing.sku_scheme_viability_snapshot` (231,539 rows). The first cold baseline hit a 4.5 s guard (matches the intermittent HTTP 500 / `57014` seen once at 1280 px); the warm baseline took 231.433 ms with 206,906 shared-buffer hits.

| Variant (not created, measured inline) | Warm time | Shared hits | Verdict |
|---|---|---|---|
| Current view (3 correlated subqueries) | 231.433 ms | 206,906 | baseline; one cold run timed out at 4.5 s |
| **Per-scheme `LEFT JOIN LATERAL` (this candidate)** | **124.916 ms** | **102,883** | about 46% less time, about 50% fewer buffers |
| Global `GROUP BY scheme_id` | 2,941.849 ms | 101,396 (+4.9 MB temp sort) | slower; **not used** |

Parity measured so far: all 7 scheme rows identical on the 3 changed columns (`EXCEPT ALL` both ways = 0); and, in the independent review of PR #213 (head 3b4c0dc2, privileged read-only role), the exact candidate SELECT matched the live view on **all 34 columns, 7 rows vs 7 rows, 0 differences in either direction**. Permission-role parity (ID-V / no-permission / anon), repeated cold and warm timings and the exact-definition fingerprint are still pending; this package supplies them.

## What the candidate changes (and what it does not)
Four exact substitutions on the TB2 text, each required to match exactly once (generation fails closed otherwise):
1. `viability_snapshot_count`: scalar subquery `count(*)` becomes `viab.vs_snapshot_count`.
2. `viability_snapshot_period_count`: `count(DISTINCT period_start)` becomes `viab.vs_period_count`.
3. `latest_viability_snapshot_period`: `max(period_start)` becomes `viab.vs_latest_period`.
4. `FROM costing.scheme_master sm` gains one `LEFT JOIN LATERAL (select count(*), count(DISTINCT s.period_start), max(s.period_start) from costing.sku_scheme_viability_snapshot s where s.scheme_id = sm.id) viab ON true`.

Unchanged: all 34 column names and positions (31 columns textually untouched), types, NULL behaviour (`LEFT JOIN ... ON true` keeps a scheme with no snapshots at 0 / 0 / NULL, as the scalar subqueries did), `security_invoker=true`, the outer `where (select public.fn_costing_view_allowed())` gate (exactly once), no `ORDER BY`/`LIMIT` (the client orders by `scheme_name`), grants/ACL/reloptions (`CREATE OR REPLACE VIEW` preserves them), indexes (the existing `idx_sku_scheme_snapshot_period_status` and scheme_id index are left alone; no new index), RLS, RPCs, client code, flags.

### Comparison with the earlier local candidate
The earlier file (`CANDIDATE_scheme_master_register_lateral_NOT_APPLIED.sql`, kept privately) used the same shape the issue measured. Differences here: lateral columns/alias are prefixed (`viab.vs_*`) so they cannot collide with any `scheme_master` column in the many unqualified references; a fail-closed precondition block was added; the output is generated and diff-tested against TB2 instead of hand-edited; the "BEGIN ... ROLLBACK" wrapper was removed (this file is the statement to apply, after approval).

## Files
| File | Purpose |
|---|---|
| `scheme_master_register_viability_lateral.candidate.sql` | the change, as **ONE atomic `DO` statement**: exact-definition precondition, then the `CREATE OR REPLACE VIEW` (via `EXECUTE`), then post-conditions (see "Exact-definition fingerprint and atomic apply") |
| `expected_pre_change_viewdef.md5` | **recorded: `a9f6a128427a704e9bea97fc01e7b5f3`** (captured live and independently by the reviewer, 8 Nov 2026; live catalog: 34 columns, `security_invoker=true`, the original 3 viability references). One lowercase 32-hex line: `md5(pg_get_viewdef('public.v_costing_scheme_master_register'::regclass, true))` read from the live catalog by the reviewer (parity package block 0a). Until it exists the candidate carries the `UNRECORDED` sentinel and refuses to run |
| `scheme_master_register_rollback_tb2.sql` | exact TB2 definition, byte-for-byte rollback |
| `readback/scheme_master_parity_readonly.sql` | read-only parity and measurement package (below). Every block is `begin read only ... rollback` |
| `readback/scheme_master_rehearsal_rollback_txn.sql` | OPTIONAL: replaces the view inside a transaction that always rolls back; **not read-only** (brief ACCESS EXCLUSIVE lock), needs explicit approval |

## Exact-definition fingerprint and atomic apply (review requirements, independent review of 3b4c0dc2)
Counting columns and references cannot detect a changed unrelated expression or an altered permission predicate, so the candidate now verifies the **exact** pre-change definition:
- **Fingerprint.** `md5(pg_get_viewdef(view, true))` of the live view must equal the value recorded in `expected_pre_change_viewdef.md5`. It can only be produced by the live catalog (PostgreSQL's canonical deparse differs from the TB2 source text), so the reviewer records it from block 0a, keeps `viewdef_text` with the review record, and re-runs `node scripts/scheme-master-perf-candidate/build.mjs --write`, which embeds it. Deliberate normalisation: **none**, the md5 is over the exact `pg_get_viewdef(oid, true)` text, so any change at all to an expression, the gate or the column list invalidates it and the apply stops.
- **UNRECORDED sentinel.** If the fingerprint file is missing, the generator embeds `UNRECORDED` and the candidate's first check raises, so it cannot be applied by accident. The fingerprint `a9f6a128427a704e9bea97fc01e7b5f3` is now recorded and embedded; the sentinel no longer appears in the committed candidate. Re-record and regenerate if the live view ever changes before apply.
- **Also checked before the replace:** the 34 column names in order (not just the count), `reloptions` **exactly** `{security_invoker=true}` (not merely containing it), the gate text, and exactly 3 viability references (independent sanity check in case the wrong fingerprint is recorded).
- **ONE atomic statement.** The check, the `CREATE OR REPLACE VIEW` (passed to `EXECUTE`) and the post-conditions are a single `DO` block, so they run in one transaction under any runner (psql, migration CLI, SQL API) and can never be separated; any `RAISE` rolls everything back. There is deliberately no `BEGIN/COMMIT` (not needed, and some runners wrap their own) and **no LOCK TABLE** (LOCK on a view recurses into every base table and would block unrelated reads; the replace itself takes the view's own lock).
- **Post-conditions in the same statement:** same column names **and types**, same `reloptions`, same ACL (grants), gate still present, exactly one viability reference and a `LATERAL` join; otherwise it rolls back.
- **Preserved:** `security_invoker=true`, the `fn_costing_view_allowed()` gate, all 34 columns, grants (not touched), and the rollback file (unchanged TB2 text).
- The optional rehearsal now inlines the exact same `DO` block (no psql `\i`), so it works through the SQL API; it also ends in ROLLBACK.

## Read-only parity package (owner-run; nothing here writes)
0. Catalog snapshot before/after: **0a fingerprint capture** (`viewdef_md5`, `viewdef_text`, `columns_match`, `options_exact`), view ACL, `reloptions`, owner, definition md5, the 34 columns with `format_type`, `has_table_privilege` for anon/authenticated/service_role, dependants (`pg_depend`).
1. Cardinality plus **all 34 columns** two-way `EXCEPT ALL` (NULLs compare equal) between the live view and the inlined candidate body. Expect `7 / 7 / 0 / 0`.
2. Per-column `pg_typeof` parity; ordered-fetch parity (`array_agg(scheme_id order by scheme_name, scheme_id)`); per-scheme comparison of the three changed columns; independent recomputation from the base table; schemes without snapshots.
3. Permission semantics under `SET LOCAL ROLE authenticated` with ID-V's claims (expect 7 / 7 / 0 / 0), a user with no Costing permission (expect 0 / 0), and anon (`has_table_privilege` unchanged). Replace the two `<..._UUID>` placeholders.
4. `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` for baseline and candidate under a 6 s guard; repeat 3 times alternately (and once as ID-V). Reference numbers above.
5. Gate function, RLS flags/policies and indexes on the touched tables (metadata only).
The candidate body inlined in the package is test-checked to be byte-identical to the candidate view, and it runs with the caller's privileges and RLS exactly as the `security_invoker` view would.

## Approval gates before any apply (all required; gate 0 done, the rest pending)
0. ~~Record the fingerprint~~ **done:** `a9f6a128427a704e9bea97fc01e7b5f3` recorded and embedded. Immediately before any apply the reviewer re-runs block 0a and confirms `viewdef_md5` still equals it and `columns_match` / `options_exact` are true (the candidate re-checks this itself and rolls back otherwise).
1. Owner runs the parity package: block 1/2 results show **0 differences, same column types, same order**, block 3 shows identical permission semantics, block 0 saved as the "before" snapshot.
2. Block 4 measurements repeated (3x, cold if possible) confirm the candidate is not slower and drops the buffer count; record the numbers in #211.
3. Optional rehearsal (`readback/...rehearsal...`) in a quiet moment, if the owner wants proof on the real replaced view.
4. Owner approves applying; the apply is performed by the owner/ChatGPT release process, **not** by this repository change. At that time copy the candidate file into `supabase/migrations/<timestamp>_costing_scheme_master_register_viability_lateral.sql` in a separate reviewed PR (the single DO statement, unchanged) (it is deliberately not a migration now: an added Costing migration would also trip the historical Costing scope-guard tests).
5. After apply: re-run block 0 (ACL/options/columns must equal "before") and block 1; hit the Scheme Master tab as ID-V.

## Rollback
Run `scheme_master_register_rollback_tb2.sql` (idempotent, same columns, keeps grants and dependants). The fingerprint precondition makes the candidate refuse to run twice or against a drifted view, so a failed precondition means "do not apply; re-review", not "force".

## Not proven by this change
That the cold-start timeout is eliminated (only the warm cost is roughly halved; cold behaviour depends on cache and IO; the first live call after a long idle may still be slow, so the 8 s limit should be re-measured after apply). That no other view depends on these three columns (block 0 lists dependants). PostgreSQL-backed behavioural tests were not run here (no PostgreSQL binaries on the author's machine, and no database access); the static tests prove construction and the SQL package proves behaviour when the owner runs it. Formal status stays 5/13.
