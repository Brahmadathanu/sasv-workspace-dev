# Costing end-to-end server closure: master programme

Mandate: `../COSTING_END_TO_END_SERVER_CLOSURE_MANDATE_2026-10-19.md` (28f1d4d). Price revision, Sheets, new pricing views and client pricing modules are SUSPENDED until G6 acceptance. Live work is read-only unless the user approves a batch.

| Gate | Scope | Status (19 Oct 19:35 IST) | Evidence |
|---|---|---|---|
| G0 | Repo/DB baseline, governing docs, issue register | **DONE** | `G0_BASELINE_2026-10-19.md`, `evidence/G0/`, `ISSUE_REGISTER.json` |
| G1 | Cost waterfall forensic reconciliation | **VERIFIED (arithmetic + lineage)** 19 Oct 19:05 IST: identities, head-to-pool, pool-to-SKU, Tally rate -> line -> SKU, BOM/UOM/yield, route -> labour all reconcile; 7/9 exceptions = IMC. Open data/driver items CI-028..032 carried to G2-G4 | `G1_COST_WATERFALL_RECONCILIATION.md`, `G1_UPSTREAM_LINEAGE.md`, `evidence/G1/`, `evidence/G1U/` |
| G2 | Machinery capacity and routing governance | **IN PROGRESS — READ-ONLY FORENSICS** (20 Oct): standard batch/BMR sources verified; named machine links 2/119/125 established; active G4 resolver audited; physical step-charge and traceability gaps identified; 74 machines still blocked, CI-032 unresolved; no activation | `G2_CHATGPT_INDEPENDENT_TRIAGE_2026-10-19.md`, `G2_FROZEN_ROUTE_STEP_FORENSICS_2026-10-19.md`, `G2_BATCH_MASTER_BMR_PROVENANCE_2026-10-19.md`, `G2_STEP_FACTOR_RECONCILIATION_2026-10-19.md`, `G2_MACHINE_ASSIGNMENT_FORENSICS_2026-10-19.md`, `G2_G4_RESOLVER_CODE_AUDIT_2026-10-20.md` |
| G3 | Demand/seasonality (DVS-1) and all drivers | Policy decisions ACCEPTED 19 Oct 19:02 IST (LB1 ledger write prepared); 60% rule operative until G5; DVS-1 build in progress | `G3_POLICY_DECISION_SHEET.md`, `evidence/G3/` |
| G4 | Period/run governance and safe refresh | W2 lifecycle LIVE (19 Oct); fingerprint versioning, revaluation design, cron restore pending | `../evidence/W2/` |
| G5 | Approved full cost waterfall export (no commercial scenarios) | NOT STARTED | - |
| G6 | Independent verification and acceptance | Technical batch TB1-TB7 **LIVE + VERIFIED** 19 Oct 19:26 IST (TB4 = user dashboard check); watch next Tally sync | `TECHNICAL_BATCH.md`, `TB_LIVE_APPLY_2026-10-19.md`, `evidence/TB/`, `evidence/TBL/` |

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

## ChatGPT workflow recap — 20 Oct 2026
- G0 DONE; G1 accounting/lineage VERIFIED; G2 IN PROGRESS, **not accepted**; G3 DVS-1 OFF; G4 W2 live, plant-aware OFF, CI-012/CI-034 prepared; G5 NOT STARTED; G6 NOT READY.
- Read-only live resolver audit confirms effective date hardcoded >= 1 Nov, throughput planning-only correctly segregated, but product-level charge applied to diverse stage types, missing named capacity can fall through to fallback, and null provenance concatenation; all require tests and governed policy decisions.
- Existing approved run128 is preserved. No Sheets, pricing, cron activation, new run, migration deployment, or merge authorised.
- Next: validate route-step volume/unit provenance and prepare isolated resolver test matrix before an explicit production-change approval packet.

## 20 Oct 2026 — G2 purpose review (current)
- Read-only verified 50 kg MANUAL, GRINDER and DRYER class load defaults, 200 kg MIXING, and fixed storage/general area. Machine capacity acts as an intermediate workload driver, not the cost pool denominator. User highlighted disproportionate complexity; G2 simplification recommended, subject to approval.
- Three proposed step modes: fixed per legitimate operation, physical equipment charge, planning throughput only. Do not require capacity for irrelevant activities. Evidence: `G2_CAPACITY_PURPOSE_SIMPLIFICATION_2026-10-20.md`.
- **G2 OPEN** pending specific activity driver applicability and simulated pool-share impacts. G3–G6 unchanged; approved runs and live state unchanged.
