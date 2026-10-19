# Costing end-to-end server closure: master programme

Mandate: `../COSTING_END_TO_END_SERVER_CLOSURE_MANDATE_2026-10-19.md` (28f1d4d). Price revision, Sheets, new pricing views and client pricing modules are SUSPENDED until G6 acceptance. Live work is read-only unless the user approves a batch.

| Gate | Scope | Status (19 Oct 18:25 IST) | Evidence |
|---|---|---|---|
| G0 | Repo/DB baseline, governing docs, issue register | **DONE** | `G0_BASELINE_2026-10-19.md`, `evidence/G0/`, `ISSUE_REGISTER.json` |
| G1 | Cost waterfall forensic reconciliation | **PARTIAL**: downstream identities, head-to-pool and pool-to-SKU conservation VERIFIED; 7/9 exceptions root-caused (IMC); upstream lineage pending | `G1_COST_WATERFALL_RECONCILIATION.md`, `evidence/G1/` |
| G2 | Machinery capacity and routing governance | NOT STARTED (baseline captured in G0) | - |
| G3 | Demand/seasonality (DVS-1) and all drivers | NOT STARTED | - |
| G4 | Period/run governance and safe refresh | W2 lifecycle LIVE (19 Oct); fingerprint versioning, revaluation design, cron restore pending | `../evidence/W2/` |
| G5 | Approved full cost waterfall export (no commercial scenarios) | NOT STARTED | - |
| G6 | Independent verification and acceptance | NOT STARTED | - |

Release status: **NOT READY**. Run 128 stays the October reference; it is not a finance-approved price basis.

## Discrepancies between the mandate's stated baseline and live/repo state (G0)
| Mandate statement | Actual | Disposition |
|---|---|---|
| 7/627 prime != material + DL (54,56,364,365,658,902,1285) | 9 SKUs differ exactly (adds 367, 901); 7 at >= Rs 0.01. Prime = material + DL + internal material conversion; 627/627 reconcile with IMC | Root cause found (CI-002); "7 vs 9" = tolerance |
| 7 internal-loaded component differences | Same 9 SKUs: ILC snapshot omits the IMC column | CI-002 |
| Head ledger 40 provisional, 5 unresolved | 38 PROVISIONAL, 5 APPROVED, 1 CURRENT_METHOD_RETAINED (Central Office), 8 EXCLUDED, 0 UNRESOLVED (52) | Docs updated (CI-004); Central Office still undecided (CI-003) |
| Machine 41 at 2 kg vs earlier 10 kg | Current 10 kg (R2 row 280); 2 kg is superseded R1 row 203 | Resolved (CI-013) |
| Handover files 404 | Present; the 404 path lacked the `docs/costing-pipeline-independent-audit/` prefix | Resolved |
| Open PRs #60/#61/#70/#72/#73 | Also open: #66 (MC06) and #59 (WP07, Jarvis) | Recorded |
| 94 null effective capacities | 94 = 74 BLOCKED_NEEDS_CAPACITY + 20 NOT_REQUIRED | Confirmed |
| 60% rule should be review flag only | It is authoritative in run 128 (SALES-01 switch ON); no DVS-1 tables live | CI-014 |
| Repo vs migrations | 582 live vs 96 repo files; costing W/AU migrations live-only by rule | CI-016 |
| Live unchanged since W2 | 3 non-costing lab migrations at 18:03-18:06 IST; 0 costing/public definition changes | CI-021 |
| Feed name `public.v_costing_pricing_price_revision_feed_approved`; Sep 634, Oct 627 | Confirmed; Sep 74/70, Oct 9/9 negatives | Confirmed |
| Sep administratively not CLOSED; Oct valuation 16 Oct; cron 60/61 inactive; G4 switch no row; 298 rows / 171 machines / all provisional / effective 1 Nov; 9 step rules | Confirmed | Confirmed |
