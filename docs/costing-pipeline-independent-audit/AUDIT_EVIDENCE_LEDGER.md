# Audit evidence ledger — append, never erase provenance
| ID | Gate | Assertion / artifact | Evidence type | State at initiation | Next verification |
|---|---|---|---|---|---|
| EV-001 | A0 | Run119 period 2026-09-01 valuation 2026-09-10 frozen | Prior Supabase read-only | HISTORICAL_VERIFIED; recheck live | Query refresh run and immutability guards |
| EV-002 | A0/A4 | 10 draft behaviour heads, none approved; rate cutover blocked | Prior Supabase read-only | HISTORICAL_VERIFIED; recheck live | Signed amount and policy counts |
| EV-003 | A0/A7 | Original 509, screened 440, 69 hold; filtered copy user-created/review-sent | Original sheet checked; filtered copy user report | MIXED_PROVENANCE | Confirm filtered tab unchanged, never modify |
| EV-004 | A3 | SKU193 and 988 batch workload, yield, UOM reference and sensitivity | Prior Supabase preview and derived arithmetic | ANALYTICAL_ONLY | Cross-check batch policy and actual manufacturing records |
| EV-005 | A6 | Stage03 active consumers still legacy; candidate on PR66 unmerged | Prior function source inspection | HISTORICAL_VERIFIED | Current live vs PR file/migration parity |
| EV-006 | A1/A4 | FYTD max-selected expense budgets may bias POH | Prior read-only inspection | UNRESOLVED_P1 | Full head/FY reconciliation and Finance review |
| EV-007 | A0/A10 | MC06-08 read-only shadow candidate/migrations/tests | Feature PR66 repository | COMMITTED_UNTESTED | Check PR branch, isolated DB availability and executable test logs |
| EV-008 | A7 | 440 proposed vs 69 held numerical spreadsheet context | Prior sheet reconciliation | WORKING_SUBMISSION | Compare management version by read-only file access |
| EV-009 | A3/A5 | Two product exceptions 190/1350 | Prior programme handover | UNRESOLVED | Inspect live batch reference and four SKU mappings |

## Sweep 1 — 2026-10-15 16:44–17:30 IST (Grok, SELECT-only; queries in `queries/`)
| ID | Gate | Observed claim | Source / query | Expected vs observed | Sev | State |
|---|---|---|---|---|---|---|
| EV-001 | A0 | Run 119 SUCCESS, period 2026-09-01, valuation 2026-09-10, 489/146/0, no later run | `costing_refresh_run`, A0_01 | as baseline; BUT period OPEN + valuation DRAFT → not structurally frozen | P1 (A0-F2) | VERIFIED_LIVE |
| EV-002 | A0 | 10 behaviour-split rows, all DRAFT; fixed POH ₹361,578.68166667, variable ₹654,456.60; 2 rate policies DRAFT | A0_01 | matches baseline | — | VERIFIED_LIVE |
| EV-005/007 | A0 | PR #66 (head 778909e) 7 functions not live; tests unexecuted | pg_proc + git | matches baseline | — | VERIFIED_LIVE / COMMITTED_UNTESTED |
| EV-010 | A0 | 35 live costing migrations (2026-10-14/15) have no repo file | schema_migrations vs all branches | expected parity; GAP | P2 | VERIFIED_LIVE |
| EV-011 | A0 | WP05 S1 `20261013183522` live; only on draft PR #60 | schema_migrations | — | — | VERIFIED_LIVE |
| EV-006 | A1 | Provision = abs() + max monthly-equivalent within and across FYs | view definition | expected normal budget; observed max-of-max | P1 | VERIFIED_LIVE |
| EV-012 | A1 | Tally feed switched FYTD → month-to-date on 2026-08-08 | daily totals A1_01 | expected consistent basis | P1 | VERIFIED_LIVE (cause UNVERIFIED) |
| EV-013 | A1 | POH selected ₹974,980.28 vs FY25-26 avg ₹629,880.04 (+54.8%); all pools +₹445,845.39/month | A1_02 | — | P1 | VERIFIED_LIVE |
| EV-014 | A1 | Fuel & Gas selected ₹479,589.60 from Q1 FYTD; July alone ₹12,711.85 | series | — | P1 | VERIFIED_LIVE; cause UNVERIFIED |
| EV-004 | A3 | SKU193/988 extremes caused by min-1 monthly whole-batch charging; 125 products ≥10× | A3_01/02 | — | P1 | VERIFIED_LIVE mechanism; sensitivities ANALYTICAL_ONLY |
| EV-009 | A3 | Products 190/1350 (SKUs 207/208/209/1798) REVIEW_REQUIRED in run 119 | A3_01 | — | P2 | VERIFIED_LIVE |
| EV-015 | A0/A3 | POH conservation gap ₹1,181.76 in run 119 | A3_02 | Σ = pool | P2 | VERIFIED_LIVE |
| EV-003/008 | A0/A7 | 509/440/69 lineage | — | — | — | BLOCKED (no Sheets access) |

## New evidence row standard
EV-ID / exact observed claim / data source object and Git SHA or SQL query / run, as-of and retrieval timestamp / expected & observed / severity & financial impact / confidence/state / screenshot or query output ref / remediation owner / repeat test status. Query output should exclude secrets and sensitive financial identities.

## Current gate
A0 SUBSTANTIALLY COMPLETE with GAPs (sheet lineage BLOCKED; PR #66 tests unexecuted). A1 and A3 sweep 1 done, OPEN. No independent audit PASS, no production deployment or model approval authorised.

## Sweep 2: 2026-10-15 17:30–19:00 IST (SELECT-only / STABLE function calls)
| ID | Gate | Claim | Source | State |
|---|---|---|---|---|
| EV-016 | A3 | 125 products: ₹8,20,347/month charged vs ₹1,36,376 preferred-batch simulation; other 335: ₹9,01,875 vs ₹16,47,777 | A3_03 + `fn_simulate_preferred_batch_manufacturing_cost(119,503.95,640.65)` | VERIFIED_LIVE data / ANALYTICAL rates |
| EV-017 | A3/A1 | Completed FG batches about 107–185/month (Apr-25 to Sep-26) | v_tally_fg_transfer_normalized | VERIFIED_LIVE |
| EV-018 | A0 | 33 live migrations genuinely missing from all 35 branches; ppm server-renamed; S1 docs-only | schema_migrations hash vs 160 repo .sql blobs | VERIFIED_LIVE/REPO |
| EV-019 | A0 | 15 snapshot tables without triggers; COP refresh RPC deletes and rebuilds any run id; run-119 fingerprints | catalog + prosrc | VERIFIED_LIVE |
| EV-020 | A1 | ETL job params still FYTD (FROM 20260401) after 08-Aug; returned data MTD; 08-Aug fetch 15:45 IST | etl_jobs, tally_expenses_snapshot | VERIFIED_LIVE; cause UNVERIFIED |
| EV-021 | A1 | Fuel stock issues ₹2.1–4.7 lakh/month; ₹12.68 lakh receipts in Jun-26; Fuel ledger starts 09-Jun at ₹14.39 lakh | tally_fuel_stock_snapshot | VERIFIED_LIVE / ANALYTICAL |
| EV-022 | A1 | Interest not in manufacturing COP (COP = prime+POH+QC+stores); Forex gain turned into cost by abs() | RPC source, provision view | VERIFIED_LIVE |
| EV-023 | A0 | Sheets workbook 1HBte4Y4… export returns HTTP 401 | curl | BLOCKED |

| EV-024 | A2 | Mehasamani SKU 879 factor 0.02/g (expected 0.001 g→Kg); SKUs 859/1277 RM ₹1.46 and ₹0.96 per Kg; 0.91 density on 246 SKUs / 140 products; 554 SKUs with stale rates, 420 with fallback | A2_01 | VERIFIED_LIVE |
| EV-025 | A6 | 99 runs (86/12/1); all successful runs requested OPEN/DRAFT; current run = latest finished; UI request RPC permission-guarded; daily cron targets the calendar month | catalog, costing_refresh_run, cron | VERIFIED_LIVE |
