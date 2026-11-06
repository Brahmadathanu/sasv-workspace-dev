# CDE-2 — final review package (candidate, evidence, migration plan, decisions) — 6 Nov 2026

**Status: READY FOR OWNER AND SERVER-SESSION REVIEW. NOT APPROVED, NOT APPLIED.** Nothing here was run against production or Supabase. The SQL is unapplied, `v_d3_decided` is `false` (every call is denied), CDE-1b is unconnected, no grant or permission changed, no run-governance change. Formal closure remains 5/13. This is the single package responding to the owner's consolidated comments on PR #205; it supersedes `CDE2_RPC_PROPOSED_SQL_FOR_SERVER_REVIEW_2026-11-06.md` and complements `CDE2_SQL_CANDIDATE_REVIEW_2026-11-06.md` (investigations).

## 1. What exists, and what kind of evidence it is
| Item | Location | Kind of evidence |
|---|---|---|
| Corrected SQL candidate (sha256 `49243eb90f12…989d`) | `cde2-sql-candidate/rpc_get_costing_draft_component_evidence_v1.candidate.sql` | unapplied text |
| Isolated schema + fixtures | `cde2-sql-candidate/test/` | **stub** tables for pre-repo objects; the three governed views are the **real** migration DDL (see §3) |
| 18 tests (`scripts/cde2-sql-candidate/`) | isolated PostgreSQL 16.15 (Unix socket only) + real Chromium | isolated; **not** real authenticated production acceptance |
| SELECT-only live read-back pack | `cde2-sql-candidate/readback/live_readback_selects.sql` | not run by the author; the owner side has since run parts of it (§4) |
| Migration/rollback plan, permission matrix, wiring plan | this document | plan only |

Isolated PostgreSQL evidence proves the SQL compiles and behaves as specified on that schema. It does **not** prove behaviour with a real JWT through PostgREST, real RLS, the live `require_permission`, or live data volumes. Those remain open (§8).

## 2. Security contract (exactly what the function guarantees)
1. **Signature:** `public.rpc_get_costing_draft_component_evidence_v1(p_period_start date, p_refresh_run_id bigint, p_sku_id bigint) returns jsonb`; `SECURITY DEFINER`, `STABLE`, `search_path = pg_catalog, pg_temp`, every object schema-qualified.
2. **One answer for every refusal:** `{"status":"empty"}` for no permission (including edit-without-view, other module, no subject), malformed input, missing / wrong-period run, approved / reference / revoked / failed / non-captured / non-selected run, out-of-scope period, closed period, missing SKU, missing / duplicate / mismatched / non-parity / null- or late-timestamp source rows, and any internal error (`exception when others`; no `sqlerrm`, no error class). Byte-identical across these cases (tested).
3. **Authorisation first:** `require_permission('module:costing-control-center', false)` (live signature `(text, boolean)` = view). CCC view and CCC edit are served identically. Called by `anon`: no EXECUTE.
4. **Exact identity:** run found by `id = p_refresh_run_id AND period_start = p_period_start`, `SUCCESS`, `CAPTURED_AT_REQUEST`, non-null `finished_at` and `valuation_date`. Each of the five sources is joined on `(period_start, valuation_date = the run's own, refresh_run_id, sku_id[, region_code])` and must match **exactly one** row (IK and OK each). The caller never supplies a valuation date.
5. **Eligibility (D3, gate shipped false):** not APPROVED / REFERENCE / REVOKED by the effective designation; period OPEN; the period's latest successful run; period not earlier than the latest period with an approved run (the dynamic review floor); empty scope when nothing is approved. No run id, no calendar date. Even when all hold, `v_d3_decided := false` denies.
6. **Integrity:** all five stage timestamps non-null and `<=` `finished_at`; prime↔control `material_costing_status` and prime↔conversion status parity. Defence in depth, **not** a proof of immutability.
7. **Projection:** explicit columns; no `select *` / row-to-json; no amount, rate, price, sales or personal field; three free-text notes always `null`; every status/code must match `^[A-Z][A-Z0-9_]{0,79}$` else `null` (UNKNOWN, never READY). `refreshed_at` = the run's `finished_at` (UTC).
8. **Read-only:** `STABLE`, runs inside a READ ONLY transaction (tested), writes nothing, creates no audit row. No table grant, policy or trigger is created or changed.

## 3. Evidence summary (head: see §10)
**Isolated database realism.** Loaded verbatim from the migrations: `costing.v_costing_run_effective_designation` and `v_current_successful_costing_refresh_run` (AU-2), `costing.v_costing_period_run_status` (W1). **The isolated W1 view's `md5(pg_get_viewdef)` equals `d38be6e4c0c8bb9811f4872b78e72936`, the value migration W2 pins for the live view.** The AU-2 designation table has the real columns and constraints ("latest designation row wins", so a later REVOKED removes an approval). Still stubbed: `costing_refresh_run`, `cost_periods`, the five source tables (pre-repo; columns from the 5/6 Nov audits), `require_permission` (semantics from the owner's `pg_get_functiondef` read-back), Supabase default privileges (simulated).

| Area | Tests (isolated PostgreSQL 16.15 unless noted) |
|---|---|
| Compile + functional | candidate creates; shipped gate denies everything; gate-open copy returns the exact whitelisted record for 148/41 with `refreshed_at = 2026-11-04T21:05:00Z` |
| Roles / permissions | view, edit, none, edit-without-view, other-module, no JWT subject (all `empty`); `anon` and `service_role`: `permission denied for function`; ACL under simulated default privileges = `authenticated` + `postgres` only; table privileges unchanged by applying the candidate |
| Isolation / selection | 148 vs 149 distinct; swapped period/run pairs denied; 80, 82, 143, 150, 122, 155, 160 (revoked), 161 (reference), 170 (not captured) denied; scope moves on approve / revoke / none / historical approval; superseded run denied |
| Source integrity | duplicate / missing / valuation- or period-mismatched row in each of the five tables, missing/duplicate/unknown region, parity breaks, post-finish and **null** timestamps, internal error: all identical denial |
| Leakage | seeded money columns and money-bearing notes never appear; unsafe codes become `null` |
| Client | real CDE-1b adapter + CDE-1a loader accept the SQL's actual JSON; **real Chromium**: the real Control Centre drawer renders the SQL's `ok` record (labels, no money, no notes, explicit Load, exactly one RPC call, no writes) and renders the SQL's denial as an all-Unknown empty state |
| Mutation | 23 deliberate breakages: **22 caught**; 1 equivalent mutant (dropping the `CAPTURED_AT_REQUEST` test at run lookup is redundant with the period-status view, which already excludes non-captured runs; kept as defence in depth) |
| Timing probe (manual, `timing-probe.mjs`) | early denials 12–24 µs, scope/SKU denials ~155 µs, full record ~360 µs per call. A real but small channel, far below network jitter, for callers who can already read control snapshots; accepted residual under D8 |
| Full repository suite | see the PR #205 description (LF and CRLF clone) |

## 4. Reconciliation with the owner's live read-back (all SELECT-only, by the owner side)
| Live finding | Reflected in |
|---|---|
| `require_permission(text, boolean DEFAULT false)`, SECURITY DEFINER, null-uid reject, `can_view` / optional `can_edit`; md5 `d4921dbc…` | candidate call `…, false`; stub semantics; md5 kept as drift evidence |
| 5 stage timestamps non-null and `<=` `finished_at` for all joined SKUs of runs 80/82/148/149 | R1 explicit null denial + late denial; read-back E remains required for any other admitted run |
| Status-code regex passes 100% for 148/149 | machine-code guard; D9 notes allow-list risk stays with future values |
| No INSERT/UPDATE/DELETE for `authenticated` on the five sources; `service_role` no UPDATE | candidate changes no table privilege (tested) |
| Control guard checks session settings only | trigger-only probe; **writer** enforces RUNNING stage 05 (control writer md5 `baf95544…`, guard md5 `85fa749b…`) |
| Control writer, both `rpc_refresh_costing_control_summary_snapshots` overloads and exact-run DL writers: **no EXECUTE** for anon/authenticated/service_role (live) | closes the repo's "unknown ACL" gap; DL writer md5 `61594e9b…` recorded |
| Legacy **one-argument** DL overload has `authenticated` EXECUTE but its body only raises | not a write path; recorded as deferred cleanup **CDE-P01** (not a CDE-2 blocker) |
| `fn_process_next_costing_refresh_stage_internal(bigint)` returns `REFRESH_RUN_NOT_PROCESSABLE` before any update when the run is not QUEUED/RUNNING | removes the stage-processor "re-open" concern; broader terminal-state hardening deferred (**CDE-P02**), no new audit |
| Default function privileges grant anon/authenticated/service_role; explicit REVOKE essential | simulated in isolation; candidate revokes `public`, `anon`, `service_role` (D10 default); **must be re-verified against live default ACLs after any apply** |
| `pg_stat_statements` installed, `pgaudit` absent; `log_statement=ddl`, `track_functions=none`, `log_min_messages=warning` | no per-caller read audit exists; D5 default: no new audit table; residual risk recorded (**CDE-P03**) |
| 80 (Jul) and 82 (Aug) are latest-success OPEN drafts today | excluded by the dynamic floor (Oct is the latest approved period); verified on the real W1 view logic |

## 5. Migration and rollback plan (NOTHING below is authorised or executed)
**Preconditions (all must be recorded):** owner decisions §7; server session ran `readback/live_readback_selects.sql` blocks A, A2, B, B2, B3, C, D, E (E for **every** run the floor would admit at apply time) and F, with results attached; the four drift hashes above re-checked immediately before applying; no costing refresh QUEUED/RUNNING during apply.

1. **Create the migration file** `supabase/migrations/<timestamp>_cde2_draft_component_evidence_rpc_v1.sql` containing the candidate **verbatim** (gate false). *Not created in this PR.*
2. **Apply** by the normal owner-authorised migration process. Expected advisory function-definition md5 on PostgreSQL 16.15: `32ee11258c12d2e3701b17cbc47404d3` (live may differ if the server version formats differently: investigate, do not ignore).
3. **Post-apply verification, SELECT-only:** function exists, `prosecdef`, `provolatile='s'`, `proconfig`; ACL is exactly `authenticated` + owner, with `has_function_privilege` false for anon, public, service_role (re-run against live default ACLs); table privileges and row counts of the five sources identical to the pre-apply snapshot; through PostgREST with a **restricted** CCC-view identity: `{"status":"empty"}` for 148/41 and 149/41 (gate false); the same envelope for a no-permission identity; anon rejected.
4. **Gate flip is a separate, later migration** (`create or replace` with the single line `v_d3_decided boolean := true;`) only after: D3a/D3c approved; read-back E clean for every admitted run; real-auth negative tests passed; the denial UX accepted (D8). Verification then expects `ok` for sample SKUs of 148 and 149 and `empty` for 80, 82, 143, 150 and a foreign period.
5. **Rollback (complete, both steps):** `drop function public.rpc_get_costing_draft_component_evidence_v1(date, bigint, bigint);` Nothing depends on it (CDE-1b is unwired); no data, grant on tables, policy or trigger was created. If only the gate flip must be undone, re-apply the shipped text (gate false).

## 6. Final permission matrix (expected after step 2; gate false)
| Principal | EXECUTE | Call result | After gate flip, eligible run |
|---|---|---|---|
| `anon` | no | error: permission denied for function | n/a |
| `authenticated`, CCC view | yes | `{"status":"empty"}` | `ok` record (non-monetary) |
| `authenticated`, CCC edit (with view) | yes | `{"status":"empty"}` | identical to view, no write |
| `authenticated`, edit without view / other module / no CCC / no subject | yes | `{"status":"empty"}` | `{"status":"empty"}` |
| `service_role` | **no** (D10) | error: permission denied for function | n/a |
| owner (`postgres`) | yes (definer) | n/a | n/a |
| Source tables | unchanged: `authenticated` SELECT on direct-labour and control only (RLS), none on prime/conversion/regional; no DML for any non-owner | | |

## 7. Owner decisions, with recommended selections (none decided here)
| ID | Decision | Recommended | If left undecided |
|---|---|---|---|
| D1 | single CCC-view, non-monetary read RPC | approve (principle) | no migration |
| D2 | refuse approved/reference/revoked | approve | as drafted |
| **D3a / D3c** | review scope = latest successful, undesignated run of an OPEN period not earlier than the latest approved period (excludes 80/82 without ids or dates) | **approve** | gate stays false |
| D3b | extra snapshot hardening | **defer** (CDE-P02): no authorised path found; live ACLs confirm | none |
| D4 | `refreshed_at` = run `finished_at` | approve | as drafted |
| D5 | read audit | **no new audit table**; accept platform visibility; record residual risk (CDE-P03) | as drafted |
| D6 | notes | keep null | as drafted |
| D7 | missing IK/OK region | deny | as drafted |
| D8 | one `empty` envelope; accepted timing residual | approve | as drafted |
| D9 | keep timestamp integrity check | approve | as drafted |
| D10 | `service_role` EXECUTE | **revoke** (already in the candidate) | as drafted |
| New | migration authorisation, then gate flip, then wiring | separate, sequential | nothing proceeds |

## 8. Client wiring plan (separate PR, NOT now; CDE-1b stays unconnected)
- **Preconditions:** migration applied with gate false and verified (§5.3); owner approves wiring.
- **Change (small):** in `public/shared/js/costing-suite-shell.js`, `mountDraftRunEvidenceInDrawer()` (≈ line 6091, already behind `COSTING_REVIEW_WORKLIST_V1` and the `sku-control-status` lens), connect once: `if (!getDraftRunEvidenceProvider()) connectDraftRunEvidenceProvider((name, params) => costingRpc(name, params));`. `costingRpc` (≈ line 2479) already returns `{ data, error }`. Loading stays an explicit user click; nothing automatic.
- **Tests to change deliberately:** the "NOT CONNECTED" guard in `draft-run-evidence-provider.test.mjs` becomes "exactly one call site, flag-gated"; the CDE-1a shell-strip/guard tests must be reviewed for the one added line; the six-module sweep's RPC allow-list must accept the one new read RPC; flag OFF output must remain byte-identical.
- **Behaviour while the gate is false:** every SKU shows the all-Unknown empty state ("No component evidence was returned…"). That wording is accurate but cannot say why; accepted under D8.
- **Not in the wiring PR:** any change to run selection, Cost Sheet or approved-run pinning; CDE-3.

## 9. Acceptance prerequisites (after migration and wiring)
Restricted identities and the integrated-build identification are in `WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md`. For CDE-2 specifically: a CCC view-only identity with **no** other edit grants sees the empty state for 148/149 while the gate is false; after the gate flip, 148 and 149 SKUs show component statuses and 80/82/143/150 show the empty state; a no-permission identity sees the empty state; the network log shows exactly one `rpc_get_costing_draft_component_evidence_v1` call per explicit Load and no mutating RPC.

## 10. Exact commit and PR information
Filled in at the end of this package: see the PR #205 description and the handback (head SHA, base `main` `968e835`, full-suite figures).
