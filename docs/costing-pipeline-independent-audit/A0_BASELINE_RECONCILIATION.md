# A0 — Live vs repository baseline reconciliation
Retrieved 2026-10-15 16:44–17:20 IST (Supabase `qhmoqtxpeasamtlxaoak`, SELECT-only; Git fetched 16:44 IST). Queries: `queries/A0_01_run_and_policy_state.sql`.
Labels: VERIFIED_LIVE · VERIFIED_REPO · UNVERIFIED · BLOCKED.

## A0.1 Provenance matrix
| # | Item | Live state | Repo state | Label |
|---|---|---|---|---|
| 1 | Git `main` | — | `71c30f1` (PR #64, 2026-10-15 10:40 IST); 53 migration files | VERIFIED_REPO |
| 2 | Audit branch | — | `docs/costing-pipeline-independent-audit` contains main | VERIFIED_REPO |
| 3 | PR #66 `feat/mc06-split-overhead-readiness-gate` | 7 functions `costing.fn_preview_mc06_*`/`fn_preview_mc08_*` **absent** live | head `778909e`, 42 commits ahead of main, 0 behind; 7 migrations (20261015124500…160000) + 13 manual SQL tests + 2 docs | VERIFIED_LIVE (not deployed) / VERIFIED_REPO (unmerged). Tests: COMMITTED_UNTESTED (no isolated DB found; no Supabase dev branches) |
| 4 | Live migrations 2026-10-13 → 10-15 | 37 applied | Only 1 has a repo file, under a **different version** (live `20261015045233` vs main file `20261015053000 ppm_inactive_sku_mrp_policy_governance`) | VERIFIED_LIVE. **GAP G-01**: 35 manufacturing-costing migrations (20261014104950 … 20261015021210, e.g. `costing_manufacturing_standard_rate_governance_foundation`, `costing_finance_behaviour_split_staging_and_conservation_gate`, `costing_preferred_batch_trial_rates_readonly_simulation`) exist live with **no file in any branch** |
| 5 | WP05 S1 | `20261013183522 wp05_s1_kpi_view_rebuild` applied 2026-10-14 00:05 IST | SQL + proof on `costing/wp05-g1-g2-docs` (PR #60, draft), not main | VERIFIED_LIVE / VERIFIED_REPO (unmerged) — outside costing-engine scope (dashboard KPI view only) |
| 6 | Run 119 | SUCCESS; period 2026-09-01; valuation 2026-09-10; requested 2026-10-14 17:19 IST, finished 17:45 IST; FULL_COSTING_REFRESH via UI_TOOLBAR; 489 READY / 146 REVIEW / 0 BLOCKED (635 SKUs) | — | VERIFIED_LIVE |
| 7 | Current successful runs | 2026-07 → run 80; 2026-08 → run 82; 2026-09 → run 119; **no run > 119** | — | VERIFIED_LIVE |
| 8 | "Frozen" status of run 119 | Period 2026-09 **OPEN**; valuation_date_status **DRAFT** (set 2026-09-10, ref GATE6C-SEP2026-PROSPECTIVE-VALUATION-2026-09-10); refresh-run context immutability trigger present; immutability triggers on POH workload + SKU POH allocation snapshots; **no** immutability trigger found on `sku_manufacturing_cop_snapshot`; `cost_pool_monthly_snapshot` has `trg_cost_pool_monthly_snapshot_mutable_run` (guard semantics not yet read); no INSERT/UPDATE/DELETE grants to `authenticated`/`anon` on COP/pool snapshots | — | VERIFIED_LIVE. **Finding A0-F2** |
| 9 | Behaviour split | 10 rows, all DRAFT, all for run 119: labour FIXED ₹706,203; POH staff FIXED ₹41,055; 8 OH heads (5 FIXED, 3 VARIABLE). Fixed POH = ₹361,578.68166667; Variable POH = ₹654,456.60 | — | VERIFIED_LIVE (matches baseline) |
| 10 | Manufacturing standard rate policies | 2 rows, both DRAFT: `MC06_LABOUR_NORMAL_RATE_V1` 911.61666667 WU / ₹706,203; `MC06_POH_NORMAL_RATE_V1` 991.41666667 WU / ₹1,016,035.28166667, behaviour NULL | — | VERIFIED_LIVE (zero approved) |
| 11 | Run 119 pools | Labour pool ₹706,203 fully allocated (Σ product allocations = ₹706,203); POH pool ₹1,016,035.28 (staff ₹41,055 + expense ₹974,980.28) | — | VERIFIED_LIVE |
| 12 | Preview/simulation functions | `fn_preview_manufacturing_*` (6) and `fn_simulate_preferred_batch_*` (2), all STABLE | none in repo | VERIFIED_LIVE, repo GAP (part of G-01) |
| 13 | Sheet 509 / filtered 440 / 69 | — | — | **BLOCKED**: no Google Sheets access from this agent. Not edited. Reconciliation handover: export both tabs (CSV) to the box, or grant read-only Sheets access; then join on sku_id to run 119 `sku_manufacturing_cop_snapshot` (635 rows) |
| 14 | `docs/manufacturing-costing-price-revision/` | — | exists only on PR #66 branch (2 docs) — not on main | VERIFIED_REPO |

## A0 findings
| ID | Sev | Finding | Evidence | Owner | Remediation / retest |
|---|---|---|---|---|---|
| A0-F1 | P2 | 35 live costing migrations have no repository file (traceability gap; DEC-014 permits server-first delivery but audit requires replayable source) | matrix row 4 | Manufacturing-costing workstream | Export `supabase_migrations.schema_migrations.statements` for those versions into an evidence folder (read-only), commit via isolated docs PR. Retest: version list equality |
| A0-F2 | P1 | Run 119 is not structurally frozen: period OPEN and valuation DRAFT; a new successful refresh for 2026-09 would replace run 119 as "current" for every consumer view; COP snapshot table lacks an immutability trigger | matrix row 8 | Finance + costing owner | Decision D-010 (lock period / freeze policy). Retest: trigger/period status query |
| A0-F3 | P2 | Run-119 POH conservation gap ₹1,181.76 (pool ₹1,016,035.28 vs Σ product allocations ₹1,014,853.52) | `queries/A3_02` | Costing engine | Identify products with POH workload but no SKU allocation row; retest Σ = pool or documented exclusion |
| A0-F4 | info | PR #66 is diagnostic/shadow only; nothing live; its tests have not been executed in an isolated DB | matrix row 3 | PR #66 owner | Needs isolated DB (Supabase branch) — user decision D-008 |


## Sweep 2 (2026-10-15 ~18:05 IST): migration reconciliation by identity and content (DIR-8)
**Method.**
- Live: `supabase_migrations.schema_migrations` for versions ≥ 20261013.
- The live content hash is the md5 of the statements with all whitespace removed.
- Repo: every `.sql` blob on all 35 `origin/*` branches (160 blobs), including Jarvis's `feat/wp07-*`, read-only. Each blob is hashed the same way.
- Matching is by name and by content.

**Correction to sweep 1.** The costing block 20261014104950…20261015021210 holds **33** migrations, not 35.

| Version | Name | Result | Where |
|---|---|---|---|
| 20261013095629 | wp07_b5_r2_qc_prep_run | PRESENT_EXACT | 20261013095629 origin/feat/wp07-s2c-c1-qc-preparation-ui |
| 20261013155440 | wp07_b5_1_qc_labname | PRESENT_EXACT | 20261013155440 origin/feat/wp07-s2c-c1-qc-preparation-ui |
| 20261013183522 | wp05_s1_kpi_view_rebuild | MISSING | - |
| 20261014104950 | fix_regional_default_nonpositive_sku_units | MISSING | - |
| 20261014114526 | fix_historical_preferred_batch_size_asof_resolution | MISSING | - |
| 20261014135001 | regional_marketing_evidence_review_public_wrappers | MISSING | - |
| 20261014180903 | costing_manufacturing_standard_rate_governance_foundation | MISSING | - |
| 20261014180947 | costing_standard_rate_immutable_supersession_guard | MISSING | - |
| 20261014181001 | costing_standard_rate_resolver_expiry_fail_closed | MISSING | - |
| 20261014233333 | costing_manufacturing_rate_readiness_preview | MISSING | - |
| 20261014233603 | costing_manufacturing_component_source_conservation_preview | MISSING | - |
| 20261014233841 | costing_manufacturing_absorption_fail_closed_gate | MISSING | - |
| 20261014234617 | costing_standard_batch_route_workload_preview | MISSING | - |
| 20261014234656 | costing_standard_batch_preview_historical_effective_reference_fix | MISSING | - |
| 20261015000602 | costing_kashaya_vasthi_kit_unit_mapping_exception | MISSING | - |
| 20261015001323 | costing_standard_sku_unit_governed_liquid_factor_coverage | MISSING | - |
| 20261015001912 | costing_portfolio_sku_conversion_fail_closed_audit | MISSING | - |
| 20261015002218 | costing_karkkidaka_kanji_500g_pack_count_conversion | MISSING | - |
| 20261015002706 | costing_count_pack_manufacturing_integrity_preview | MISSING | - |
| 20261015002846 | costing_standard_output_basis_evidence_gate | MISSING | - |
| 20261015003518 | costing_minimum_batch_scenario_nonfabrication_preview | MISSING | - |
| 20261015004056 | costing_canonical_rm_loss_input_not_yield_boundary | MISSING | - |
| 20261015004644 | costing_preferred_batch_canonical_net_output_formula | MISSING | - |
| 20261015004833 | costing_nos_standard_output_whole_unit_rounding | MISSING | - |
| 20261015005132 | costing_overhead_rate_source_fy_lineage_preview | MISSING | - |
| 20261015005349 | costing_overhead_higher_of_years_selection_rationale_audit | MISSING | - |
| 20261015005723 | costing_manufacturing_rate_approval_source_checklist | MISSING | - |
| 20261015010729 | costing_finance_behaviour_split_staging_and_conservation_gate | MISSING | - |
| 20261015010851 | costing_behaviour_split_strict_approval_and_immutability_guard | MISSING | - |
| 20261015010904 | costing_behaviour_split_staged_multicomponent_approval_fix | MISSING | - |
| 20261015011038 | costing_finance_rate_cutover_prerequisite_fail_closed_preview | MISSING | - |
| 20261015011703 | costing_transfer_batch_reference_workload_evidence_only | MISSING | - |
| 20261015011719 | costing_transfer_workload_failclosed_nullable_mapping_check | MISSING | - |
| 20261015012728 | costing_preferred_batch_trial_rates_readonly_simulation | MISSING | - |
| 20261015013006 | costing_preferred_batch_sku_manufacturing_trial_simulation | MISSING | - |
| 20261015021210 | fg_transfer_governed_base_quantity_exception_fix | MISSING | - |
| 20261015045233 | ppm_inactive_sku_mrp_policy_governance | PRESENT_EXACT | 20261015053000 origin,origin/docs/costing-pipeline-independent-audit,origin/feat/mc06-split-ove |

**Classification (VERIFIED_REPO + VERIFIED_LIVE).**
- **Genuinely missing: 33 costing migrations.**
  - No name or content match on any branch.
  - They are described only in narrative docs on `docs/costing-finance-oct15-continuation` (f4a8527, CHANGELOG_DECISIONS / SPRINT_EVIDENCE_HANDOVER).
  - They create:
    - 3 tables: `manufacturing_standard_rate_policy`, `sku_base_quantity_exception`, `manufacturing_cost_behaviour_split`.
    - 2 guard triggers.
    - The rate resolver.
    - About 20 STABLE preview/simulation functions.
    - A changed `public.v_tally_fg_transfer_normalized`.
  - 4 of them contain DML (seed/policy rows): 20261014180903, 20261015000602, 20261015002218, 20261015010851.
- **Renamed by the server, content identical: 1.** `ppm_inactive_sku_mrp_policy_governance` is live as 20261015045233. The repo file on main is 20261015053000. The version was assigned by the server, as recorded in the PPM-MRP-006 changelog.
- **Content present outside the migrations folder: 1.** `wp05_s1_kpi_view_rebuild` exists as `docs/master-data-costing/wp05-s1/01_forward.sql` on draft PR #60. That file is not byte-identical to the live statements after whitespace normalisation. Likely cause: the live apply wraps it (UNVERIFIED).
- **WP07 (Jarvis): 2 present exactly** on `feat/wp07-s2c-c1-qc-preparation-ui`.

**Evidence.** The live statement text of the 33 was exported read-only to `evidence/live_migrations_unversioned/*.sql.txt`. These files are evidence only and must not be applied.

**Remediation (PROPOSAL, owner: costing dev).**
- Open a PR that adds the 33 as `supabase/migrations/<live version>_<name>.sql`, byte-identical to the live statements.
- Add a CI check that diffs live `schema_migrations` against the repo.
- Retest: rerun this hash comparison. The expected result is 0 MISSING.

## Sweep 2: run-119 mutation vulnerabilities and proposed safeguards (D-010; no data altered, September not closed)
Retrieved 2026-10-15 ~18:15 IST, read-only catalog queries.

**Fingerprint (VERIFIED_LIVE)** for future tamper detection. Recompute these exact hashes and compare.
- `sku_manufacturing_cop_snapshot`, run 119: 635 rows. Hash md5(sku_id|cop|dl|poh|mat|status ordered by sku_id) = `71e18c2496d419257dbe1b362caec888`. Last `refreshed_at` 2026-10-14 17:31:16 IST.
- md5(row_to_json ordered by id):
  - `sku_internal_loaded_cost_snapshot`: `180d61576fe4d1abb00c6fa3e32c99fa`
  - `sku_prime_cost_snapshot`: `48ef70d72d334143bcbef5c0588d1067`
  - `sku_overhead_allocation_snapshot`: `d237569e33daf7bfd7e57afe7e542249`
  - All 635 rows each.

**Vulnerabilities (VERIFIED_LIVE).**
| # | Finding | Severity |
|---|---|---|
| V1 | 15 snapshot tables have **no trigger at all**. Includes `sku_manufacturing_cop_snapshot`, `sku_prime_cost_snapshot`, `sku_overhead_allocation_snapshot`, `sku_internal_loaded_cost_snapshot`, `direct_labour_component_pool_snapshot` and the RM/PM cost-line snapshots. Any role holding table privileges (postgres/service_role; 168 UPDATE/DELETE/TRUNCATE grants, all to `postgres`) can change run-119 rows silently. | P1 |
| V2 | `rpc_refresh_sku_manufacturing_cop_snapshot(date,date,bigint)` (SECURITY DEFINER) checks only context match and prime/overhead row counts. It then runs `delete from costing.sku_manufacturing_cop_snapshot where refresh_run_id=p_refresh_run_id` and re-inserts. It does **not** refuse a run already in SUCCESS, and does not check a period lock. Re-calling it with run 119 would rebuild 119 from whatever the upstream snapshots hold then. | P1 |
| V3 | Period 2026-09 is OPEN and the valuation date is DRAFT, so the period-level guards present in other RPCs cannot protect run 119. | P1 (A0-F2) |
| V4 | Mitigations already present: `authenticated` and `anon` lack EXECUTE on these refresh RPCs. `costing_refresh_run` has `trg_enforce_refresh_run_context_immutable`. 40 of 56 snapshot/period tables carry guard triggers (`*_mutable_run`, `trg_immutable_*`). | info |

**Safeguards (PROPOSAL; owner: costing dev + user approval; not applied).**
1. Add a `BEFORE UPDATE OR DELETE OR TRUNCATE` guard trigger to the 15 unprotected snapshot tables. It rejects rows whose run is `SUCCESS` or is listed in a new `costing.costing_run_reference_lock` table (run_id, locked_by, reason, locked_at), and is itself append-only.
2. Make every `rpc_refresh_*` fail closed when the target run is not in RUNNING state.
3. Add a lock row for run 119 that is independent of closing the period. This meets D-010 without closing September.
4. Add a nightly read-only fingerprint check that compares against the hashes above and alerts on drift.

Retest:
- In an isolated branch DB, an UPDATE/DELETE on run-119 rows must fail.
- A refresh RPC called with run 119 must raise an error.
- The fingerprints must be unchanged.

## Sweep 2: Google Sheet lineage, 509/440 (DIR-6). Still BLOCKED, read attempt made with no edits
- This session has no Google Drive or Sheets connector. The dynamic tool search for drive/sheet/google returned nothing, and `DownloadFile` needs a connected Google Drive account.
- Repo docs identify the workbook `SASV - TEMPORARY WORK SHEET`, ID `1HBte4Y4WFPGWark1jnQvNv_5spMuBA-6Om2KdNltXVM`. It contains the tab `price-revision-proposal` (sheetId 1337971988) and the tab `board-approved-mrp-register` (gid 1909141026).
- A public CSV export request returned **HTTP 401**, so the sheet is not publicly shared.
- **Access needed (any one of these):**
  - (a) Connect a Google Drive account with **Viewer** access to that workbook, and to the separate 440-SKU filtered submission file, in Grok Bot's connections.
  - (b) Share both files as "Anyone with the link: Viewer" temporarily.
  - (c) Download the `price-revision-proposal` (509) tab and the 440 submission as CSV and place them on the box or in chat.
  - Also needed: the file ID or name of the 440-SKU submission, which is not found in the repo.
