# CDE-2 corrected SQL candidate — review, isolated evidence and remaining decisions — 6 Nov 2026

**Status: UNAPPLIED CANDIDATE. Not a migration, not in `supabase/migrations/`, never executed against production or Supabase, no grant, no CDE-1b wiring, no change to costing-run governance. Formal closure remains 5/13.**
It replaces the proposal in `CDE2_RPC_PROPOSED_SQL_FOR_SERVER_REVIEW_2026-11-06.md` (merged #201, "not executable as written" per merged #203) and responds to #203 and draft #204. Files: `cde2-sql-candidate/rpc_get_costing_draft_component_evidence_v1.candidate.sql`, `cde2-sql-candidate/test/*.sql`, `scripts/cde2-sql-candidate/`.

**Revision 2 (6 Nov, after the owner-side read-back comment on #205):** R1 explicit null-timestamp denial, R2 writer-path investigation, R3 derived review-scope mechanism (D3 still disabled), R4 logging and EXECUTE review. Sections 1-5 below are updated; the original investigation text was superseded where it conflicts.

## 1. #203 blockers and how the candidate answers each
| #203 blocker / requirement | Candidate | Evidence |
|---|---|---|
| Permission helper signature `(p_target text, p_need_edit boolean)` | `require_permission('module:costing-control-center', false)` | static test + role-context tests |
| Run table key is `id` | `r.id = p_refresh_run_id and r.period_start = p_period_start` | static test; wrong-period pairs denied |
| Exact period/run/valuation/SKU isolation | all five sources joined on `(period_start, valuation_date, refresh_run_id, sku_id[, region_code])`, each must match **exactly one** row; the run's own `valuation_date` is used, never a caller value | duplicate / missing / period- or valuation-mismatched row in each source → denial |
| No money, no unrestricted notes | explicit column lists, no `select *` / row-to-json; `allocation_resolution_note`, `blocker_note`, `regional.*.note` are always `null`; every status/code must match `^[A-Z][A-Z0-9_]{0,79}$` else `null` (UNKNOWN) | seeded money columns and money-bearing notes never appear in output |
| Verified frozen-run timestamp (D4) | `refreshed_at` = the run's `finished_at` (UTC ISO), not a stage time | output `2026-11-04T21:05:00Z` where stage times are 20:45/21:00 |
| Missing = unauthorised = ineligible (indistinguishable) | one constant envelope `{"status":"empty"}` for: no permission, malformed input, missing / wrong-period / approved / reference / revoked / failed / non-selected / wrong-context run, closed period, missing SKU, any source inconsistency, and any internal error (`when others`, no `sqlerrm`) | 16 run/input cases + 4 identities compared byte-for-byte |
| R1 (owner review): a missing stage timestamp must be denied | all five stage timestamps must be **non-null** and `<=` the run's `finished_at`; before this revision a NULL made `ts > finished_at` NULL, so the row passed silently | null in each of the five columns → denial byte-identical to a missing row; mutation that drops the check is caught |
| Keep D3 fail-closed | `v_d3_decided boolean := false;` — as shipped **every** call, including a perfectly eligible one, returns the denial | test 3 |

The envelope status is `empty` (not `forbidden`) on purpose: a `forbidden` answer for an ineligible run but `empty` for a missing one is an existence oracle. Consequence for the UI: it cannot say *why* nothing is shown (see D8).

## 2. Investigations

### 2.1 R2: can a SUCCESS run's direct-labour or control rows be changed by any authorised server operation?
Method: parsed every function definition in `supabase/migrations` (latest definition per name), listed those that write either table, and read their run-status preconditions and EXECUTE history. **Repo evidence only: no production access.** The repo files are partly backfills of live state; live ACLs and definitions need the read-back pack (`readback/live_readback_selects.sql`, blocks A and B).

| Path | Finding (repo) |
|---|---|
| Direct-labour writers: `rpc_refresh_sku_direct_labour_component_split_snapshot`, `…_legacy_snapshot` (called by `…_allocation_snapshot`, in turn by the owner-only stage chain) | They accept a run that is `RUNNING` in stage 03 **or already `SUCCESS`**, but raise *"Direct Labour snapshots already exist for refresh run % and are immutable"* if **any** direct-labour row (or workload/step/packing-workload row) exists for the run, whatever its status. So an authorised call cannot overwrite or delete DL rows of a SUCCESS run. It *could* insert rows into a SUCCESS run that has none (a back-fill); those rows would carry a stamp later than `finished_at` and the candidate denies them (R1/§7 check). |
| EXECUTE on those writers and the chain | Revoked from `public, anon, authenticated, service_role`, granted to `postgres` only (S2A hardening `20260916121652`; a later AU-6 migration revokes again). |
| Control snapshot writer `rpc_refresh_exact_sku_control_snapshot` | The migration `20260915025638` rewrites it in place so that, **before** it sets the session context the trigger relies on, it requires `overall_status = 'RUNNING'`, `current_stage_code = '05_CONTROL_MAINTENANCE'` and a `RUNNING` stage-05 row. The migration aborts unless exactly one block matched. So the **writer** enforces run status; the **trigger** (`fn_guard_stage05_exact_snapshot_write`) only checks that the writer-set context matches the row (isolated probe: a session that sets the context can write regardless of status). **Correction to my first revision:** it said protection "rests on who may write, not on run status"; for the writer path that is incomplete, run status *is* enforced, in the writer. |
| EXECUTE on the control writer | **No grant or revoke for it exists in the repo** (and none for `rpc_refresh_costing_control_summary_snapshots`). Live ACL is unknown: read-back A2. Even if callable, the status check in the writer blocks a SUCCESS run. |
| Direct DML | Owner's live read-back: `authenticated` has no INSERT/UPDATE/DELETE on any of the five sources, and `service_role` has no UPDATE. |
| Anything that moves a run out of SUCCESS, or deletes runs | No repo function does (`update … set overall_status`, `delete from costing_refresh_run`: none). The run engine pre-dates the repo, so this is a read-back item (B), not a negative finding. |
| Cleanup / retention | No function deletes from either table (none in the repo; #137's retention work is analysis only). |

**Conclusion (conditional):** through the repo-visible authorised operations, no path changes existing direct-labour or control rows of a SUCCESS run; the only residual write is a DL back-fill into a SUCCESS run with no rows, which the candidate's timestamp check refuses. What remains is outside any "authorised operation": owner/superuser sessions (SQL editor, migrations), a session able to set the control context itself, an unknown live ACL on the control writer, and an unknown mechanism that could re-open a SUCCESS run. That is why D3b is narrowed (§5): hardening is **optional defence in depth** if the read-back confirms A, A2, B and B2.

### 2.2 R3: an explicit active-draft-review eligibility mechanism (no run ids, no calendar cutoff; D3 stays disabled)
No register of "runs under active review" exists in the repo. Options evaluated:

| Option | Rule | Verdict |
|---|---|---|
| **A (implemented in the candidate)** | run is its period's latest successful run **and** its period is not earlier than the latest period that has an APPROVED run (`v_costing_period_run_status.approved_run_id`) | Uses only governed state; no ids, no dates. Admits 148 (newer draft of the approved Oct period) and 149 (Nov); excludes 80/82 (Jul/Aug precede the approved Oct). The scope **advances itself**: approving Nov drops 148 and admits Dec drafts; approving a historical run does not widen it; revoking the Oct approval moves the floor back to Sep without admitting 80/82; with no approved run anywhere the scope is **empty**. Limits: a draft of a period older than the floor can never be reviewed (intended); every in-scope latest-success run qualifies even if nobody is actively reviewing it. Needs D3a/D3c approval. |
| B (alternative, not built) | explicit register, for example `(period_start, refresh_run_id, activated_at, activated_by, ended_at)` with one active row per period, written only by a governed RPC (CCC edit, reason, ideally maker-checker) and joined by the function | Gives manual control (e.g. review Oct after Nov is approved) and an audit trail. Costs a new table, a governed writer, its own tests, D7-style approval and operational discipline; the function would add one join. Recommended only if the owner wants manual curation. |
| C (rejected) | reuse AU-2 designations (APPROVED/REFERENCE/REVOKED) | They express approval state, not "under review"; adding a value changes run-governance semantics, which is out of scope. |
| D (rejected) | hard-coded run ids or an age cutoff | Explicitly forbidden. |

The candidate still ships `v_d3_decided := false`: the mechanism above is a proposal for the owner, not an enabled rule.

### 2.3 R4: audit/logging and EXECUTE
Existing infrastructure: only action-specific write audits (`joint_process_activation_audit`, the route-assignment correction audit, `proc_lifecycle_audit`). **None of the 79 `public.rpc_get_*` definitions in the repo writes anything**, and no migration uses `raise log`. Options for D5:

| Option | Assessment |
|---|---|
| Do nothing | Reads appear only in platform/API logs; whether they carry caller and run/SKU is a read-back item (block F). |
| `RAISE LOG` inside the function | **Probed in isolation:** allowed in a `STABLE` function inside a READ ONLY transaction; the line reaches the server log with caller and outcome; the client never receives it (default `client_min_messages`). No table, no write. Not in the candidate: it needs the ~25 return sites routed to one exit that logs an outcome class, and it carries a personal identifier into logs whose retention and access the repo does not define. |
| Audit-table insert | Turns a read into a write (breaks `STABLE`/read-only and GET semantics), needs a new table, contradicts "no business/audit writes"; no precedent among the 79 read RPCs. Needs explicit approval. |
| `pgaudit` / `pg_stat_statements` | Platform extensions; availability is a read-back item (F). |
| Throttling | Needs state, hence a write; none exists. |

EXECUTE: repo convention for read RPCs is `to authenticated` (of 5 `public.rpc_get_*` grants since Oct 2026, 4 include `authenticated`, one of those also `service_role`; one is `service_role` only). Under Supabase-style default privileges (simulated in the isolated database: all functions auto-granted to `anon`, `authenticated`, `service_role`), the candidate's two revokes leave **exactly `authenticated`, `postgres` and `service_role`**; `anon` and `public` cannot execute (a mutation that drops the `anon` revoke is now caught: the earlier anon test proved nothing because `anon` never had EXECUTE in the stub). `service_role` keeps EXECUTE but carries no end-user subject, so `require_permission` denies it (tested). Whether to revoke it too is D10.

## 3. Isolated validation
PostgreSQL 16.15 started per test run on a Unix socket only (`listen_addresses=''`), throw-away data directory, stub schema mirroring live names (`test/00_stub_schema.sql`; **not the live DDL**) with money columns and money-bearing notes seeded on purpose, `anon`/`authenticated` roles and a `require_permission` stub with the semantics described in #204. Scenario: runs 80, 82, 122, 143, 148, 149, 150, 155/156, 160 (REVOKED), 161 (REFERENCE), 170 (wrong context). `cde2-sql-candidate.test.mjs` (16 tests): 4 static (candidate contract, source-join identity, R2 repo facts, read-back pack is SELECT-only) and 12 PostgreSQL-backed (including the adapter cross-check and the logging probe) (the real CDE-1b adapter and CDE-1a loader accept the SQL's real output and treat the denial as empty). The gate-open variant exists only as a string-replaced copy inside the throw-away database. Mutation check: **eleven** deliberate breakages are each caught: drop the null-timestamp denial, check only one timestamp for null, drop the scope floor, floor off-by-one, null floor passing, drop the latest-success rule, drop the `anon` revoke, distinct missing-run envelope, dropped parity, leaked note, shipped-open gate.

Limits: the stub is my reading of the 5/6 Nov audits, not live DDL; `require_permission` is a stub; no real JWT/PostgREST path; no RLS test on the (unchanged) tables; no load/timing test (timing side channels not examined).

## 4. Server read-back still required before any migration (none done here)
`cde2-sql-candidate/readback/live_readback_selects.sql` holds SELECT/catalog-only queries (A writer ACL/ownership/definition hashes, A2 effective EXECUTE, B run-status mutators, B2 triggers, B3 table privileges, C default privileges, D current scope floor, E timestamp integrity over every eligible run, F logging settings). **Not run by the author.** The owner-side comment already confirmed: helper signature, null/late timestamps absent for runs 80/82/148/149, code pattern, no DML grants for `authenticated`, and the control guard's lack of a status check. Still open: A, A2, B, B2, C, E for every run the rule would admit, F, and a **real signed-in JWT/PostgREST negative-path test** after any authorised migration.

## 5. Remaining owner decisions (none decided here)
| ID | Decision | Candidate default / recommendation |
|---|---|---|
| D1 / D2 / D4 | principle; approved runs refused; frozen timestamp = `finished_at` | as drafted |
| **D3a** | accept the review-scope rule of §2.2 option A (latest successful run of a period not earlier than the latest approved period) | implemented, gate false |
| **D3b** | harden snapshot write protection | **narrowed:** optional defence in depth once read-back A/A2/B/B2 confirm no authorised path and no live ACL surprise on the control writer |
| **D3c** | historical drafts 80/82 | excluded by option A (no id, no date); alternative is option B |
| **D5** | read audit | candidate writes nothing; `RAISE LOG` is feasible but not built; table-based audit needs explicit approval |
| D6 | notes null vs approved code→message map | null |
| D7 | missing IK/OK region: deny or UNKNOWN | deny |
| D8 | single `empty` envelope | as drafted |
| D9 | keep the timestamp-integrity check (now including null denial) | keep; read-back E for every admitted run |
| **D10** | EXECUTE: keep `service_role` (current), or revoke it too | undecided; denied at runtime either way |

## 6. Not done / not claimed
No SQL against production, no migration, no grant, no wiring, no change to run governance, no WP closed. The candidate is **unreviewed by the server owner and unproven on live data**; the isolated schema is a stub, `require_permission` is a stub, and no real JWT/PostgREST/RLS path or timing analysis was run. CDE-1b stays unconnected.
