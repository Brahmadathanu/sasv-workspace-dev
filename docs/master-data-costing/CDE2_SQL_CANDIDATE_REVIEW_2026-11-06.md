# CDE-2 corrected SQL candidate — review, isolated evidence and remaining decisions — 6 Nov 2026

**Status: UNAPPLIED CANDIDATE. Not a migration, not in `supabase/migrations/`, never executed against production or Supabase, no grant, no CDE-1b wiring, no change to costing-run governance. Formal closure remains 5/13.**
It replaces the proposal in `CDE2_RPC_PROPOSED_SQL_FOR_SERVER_REVIEW_2026-11-06.md` (merged #201, "not executable as written" per merged #203) and responds to #203 and draft #204. Files: `cde2-sql-candidate/rpc_get_costing_draft_component_evidence_v1.candidate.sql`, `cde2-sql-candidate/test/*.sql`, `scripts/cde2-sql-candidate/`.

## 1. #203 blockers and how the candidate answers each
| #203 blocker / requirement | Candidate | Evidence |
|---|---|---|
| Permission helper signature `(p_target text, p_need_edit boolean)` | `require_permission('module:costing-control-center', false)` | static test + role-context tests |
| Run table key is `id` | `r.id = p_refresh_run_id and r.period_start = p_period_start` | static test; wrong-period pairs denied |
| Exact period/run/valuation/SKU isolation | all five sources joined on `(period_start, valuation_date, refresh_run_id, sku_id[, region_code])`, each must match **exactly one** row; the run's own `valuation_date` is used, never a caller value | duplicate / missing / period- or valuation-mismatched row in each source → denial |
| No money, no unrestricted notes | explicit column lists, no `select *` / row-to-json; `allocation_resolution_note`, `blocker_note`, `regional.*.note` are always `null`; every status/code must match `^[A-Z][A-Z0-9_]{0,79}$` else `null` (UNKNOWN) | seeded money columns and money-bearing notes never appear in output |
| Verified frozen-run timestamp (D4) | `refreshed_at` = the run's `finished_at` (UTC ISO), not a stage time | output `2026-11-04T21:05:00Z` where stage times are 20:45/21:00 |
| Missing = unauthorised = ineligible (indistinguishable) | one constant envelope `{"status":"empty"}` for: no permission, malformed input, missing / wrong-period / approved / reference / revoked / failed / non-selected / wrong-context run, closed period, missing SKU, any source inconsistency, and any internal error (`when others`, no `sqlerrm`) | 16 run/input cases + 4 identities compared byte-for-byte |
| Keep D3 fail-closed | `v_d3_decided boolean := false;` — as shipped **every** call, including a perfectly eligible one, returns the denial | test 3 |

The envelope status is `empty` (not `forbidden`) on purpose: a `forbidden` answer for an ineligible run but `empty` for a missing one is an existence oracle. Consequence for the UI: it cannot say *why* nothing is shown (see D8).

## 2. Investigations
**Successful-run immutability (direct-labour and control snapshots).**
- Control: the **current** repo definition of `costing.fn_guard_stage05_exact_snapshot_write` (migration `20260915025638`, "backfilled from live") checks only writer-set session settings (`costing.control_snapshot_*`, `…_stage05_validated = '1'`). An earlier version (`20260807135720`) additionally required the run to be `RUNNING` in stage 05; the newer one does **not** consult the run status. Isolated test: after loading that exact function into a stub, a plain `UPDATE` is rejected, but a session that sets those four settings can rewrite a SUCCESS run's control row (`TAMPERED`). So protection rests on *who may write*, not on run status. (Live definition must still be read back and hashed: the repo file is a backfill.)
- Direct labour: no generic mutable-run guard exists in any repo migration (only a lineage-stamp trigger, plus the designated-run and TRUNCATE guards named in #204). The repo cannot show it is write-protected after SUCCESS.
- Prime/conversion/regional use `fn_enforce_mutable_refresh_run_snapshot` per #204 (its definition is not in the repo; not verified here).
- **Candidate's response:** it does not assume immutability. It adds a defence-in-depth check: every stage timestamp must be `<=` the run's `finished_at` (a row rewritten after finish with a fresh timestamp is refused), and cross-source parity must hold. This does **not** detect a rewrite that preserves the timestamp. Real protection needs a server decision (D3b).

**Authoritative active-draft-review selection rule.** No register exists in the repo. The closest authoritative object is `costing.v_costing_period_run_status` (migration `20261019014458`): `latest_success_run_id` (latest SUCCESS + CAPTURED_AT_REQUEST run per period) together with `v_costing_run_effective_designation` and `cost_periods.status`. The candidate uses exactly that: the run must be the period's latest successful run, not APPROVED/REFERENCE/REVOKED, in an OPEN period. This admits 148 and 149 and excludes 143, 150, superseded runs, closed periods. **It also admits 80 and 82** while their periods are OPEN (test 7 pins this as a known gap). Excluding them requires an owner policy (a review window, or a new explicit register); nothing existing can express it.

**Existing audit infrastructure (D5).** Only action-specific write audits exist (`joint_process_activation_audit`, the route-assignment correction audit, `proc_lifecycle_audit`). No read-audit mechanism exists. The candidate is `STABLE`, performs no write and creates no audit row; reads are visible only in API logs. Adding a read audit means a new table or telemetry design, which I did not invent.

## 3. Isolated validation
PostgreSQL 16.15 started per test run on a Unix socket only (`listen_addresses=''`), throw-away data directory, stub schema mirroring live names (`test/00_stub_schema.sql`; **not the live DDL**) with money columns and money-bearing notes seeded on purpose, `anon`/`authenticated` roles and a `require_permission` stub with the semantics described in #204. Scenario: runs 80, 82, 122, 143, 148, 149, 150, 155/156, 160 (REVOKED), 161 (REFERENCE), 170 (wrong context). `cde2-sql-candidate.test.mjs` (13 tests): 2 static, 10 PostgreSQL, 1 adapter cross-check (the real CDE-1b adapter and CDE-1a loader accept the SQL's real output and treat the denial as empty). The gate-open variant exists only as a string-replaced copy inside the throw-away database. Mutation check: six deliberate breakages (distinct missing-run envelope, dropped parity, leaked note, shipped-open gate, dropped approved-run exclusion, dropped timestamp check) are each caught.

Limits: the stub is my reading of the 5/6 Nov audits, not live DDL; `require_permission` is a stub; no real JWT/PostgREST path; no RLS test on the (unchanged) tables; no load/timing test (timing side channels not examined).

## 4. Server read-back still required before any migration (none done here)
1. Exact `pg_get_functiondef` of `require_permission` (does it write? it is called from a `STABLE` function) and the repo's SECURITY DEFINER conventions; default privileges so the function is not auto-granted to `anon` or others (the candidate revokes from `public` and `anon`; whether `service_role` should keep EXECUTE is undecided).
2. Column names and the presence of `period_start` and `valuation_date` on **all five** snapshot tables; `costing_refresh_run.valuation_date`/`finished_at`; `cost_periods.status` vocabulary; `conversion_status`.
3. That stage timestamps precede `finished_at` on every row of every run that would be eligible (otherwise the integrity check would deny legitimate runs), and the actual value domain of each status/code column against the machine-code pattern.
4. Live definitions (hashes) of the control and direct-labour write guards and who holds write privilege on each source.
5. That runs 148/149 give `ok` for all 628 SKUs in a read-only dry run **after** an authorised migration (not before).

## 5. Remaining owner decisions (nothing below is decided by this PR)
| ID | Decision | Candidate default / recommendation |
|---|---|---|
| D1 | Approve the principle of one per-run/per-SKU, non-monetary, CCC-view RPC | as drafted |
| D2 | Approved runs refused by the draft RPC | refused (same outward envelope) |
| **D3a** | Accept "latest successful, undesignated run of an OPEN period" as the review-selection rule | structural predicate implemented; gate still false |
| **D3b** | Whether control/direct-labour snapshots must be **hardened** (add run-status guards, restrict write grants) before eligibility relies on SUCCESS immutability | recommend yes; server DDL, not drafted here |
| **D3c** | How to exclude retained old drafts 80/82 (review window, explicit register, or accept) | undecided; no existing mechanism |
| D4 | Frozen-run timestamp = run `finished_at` | as drafted |
| **D5** | Audit/throttling of reads | none exists; candidate writes nothing |
| D6 | Notes: keep null, or approve a code→message map (loses SKU-105-style cause text) | null |
| D7 | Missing IK/OK region: deny (drafted) or UNKNOWN | deny |
| D8 | One uniform `empty` envelope (UI cannot explain why) | as drafted |
| D9 | Keep the timestamp-integrity check (needs read-back item 3) or drop it | keep, pending read-back |
| D10 | EXECUTE for `service_role`; exposure via PostgREST | undecided |

## 6. Not done / not claimed
No SQL against production, no migration, no grant, no wiring, no change to run governance, no WP closed. The candidate is **unreviewed by the server owner and unproven on live data**. CDE-1b stays unconnected.
