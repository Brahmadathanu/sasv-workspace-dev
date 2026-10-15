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
