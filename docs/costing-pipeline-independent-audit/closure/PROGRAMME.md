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

## 20 Oct 2026 — Binding architecture simplification direction and handover
- User expressly requires **only necessary future-proof costing architecture**; avoid unnecessary maintenance complexity/outages. Replacement must **hard-retire superseded executable objects/paths** after impact audit and separately approved controlled migration; no active legacy remnants. Preserve historical runs, migration evidence and unrelated clients/systems.
- Canonical new directive: `ARCHITECTURE_SIMPLIFICATION_AND_RETIREMENT_DIRECTIVE_2026-10-20.md` (commit 8ffb5aac). Work next: dependency inventory and KEEP/REPLACE/HARD-RETIRE/HISTORICAL-PRESERVE/PLANNING-ONLY classifications; smallest defensible physical charge driver and isolated tests.
- No system write or activation. G0 DONE; G1 VERIFIED; G2 **IN PROGRESS / SIMPLIFICATION REQUIRED**; G3/G4 OPEN; G5 NOT STARTED; G6 NOT READY.

## 20 October 2026 — G2 dependency inventory, phase 1 (read-only)
- **VERIFIED partial executable call graph** via live `pg_proc` function definitions and `pg_views` scan. Both direct-labour and production-OH writers reference the legacy route-load functions and the G4 load selector/wrapper/provenance functions. Therefore both writer contracts must be addressed before any hard retirement. No directly named view caller of the six selected functions was found; dynamic consumers remain to be audited.
- Catalog inventory identified machinery profiles, fallback and step capacity policies, route/load controls, historic provenance and workload snapshots. Preliminary KEEP / REPLACE / HARD-RETIRE / HISTORICAL-PRESERVE / PLANNING-ONLY mapping recorded in `evidence/G2/G2_DEPENDENCY_INVENTORY_PHASE1_2026-10-20.md` (commit 393399ca).
- **Still OPEN:** pg_depend, grants, RLS/trigger definition, cron/ETL/client references; independent alternative workload simulations and exact pool-conservation tests; final minimal architecture, retirement plan and gated approval packet.
- **Gate unchanged:** G2 IN PROGRESS; CI-032 HIGH OPEN. No live DB changes, runs, cron, switch, migration or merge.

## 20 October 2026 — G2 phase 2 workload sensitivity
- VERIFIED frozen run128: 453 manufacturing-workload product rows; eligible manufacturing labour ₹706,203; 5,789 step rows. Products 51/695/957 show scaled route intensity 511.6/2600/109.6 compared with unscaled step totals 174.8/5.2/7.6. These figures quantify sensitivity, not a replacement model or corrected allocation.
- Evidence: `evidence/G2/G2_FROZEN_RUN_SENSITIVITY_PHASE2_2026-10-20.md` (commit 4a1767c9). Full-population scenario shares, cap interaction and physical charge validation remain OPEN. CI-032 HIGH OPEN. No live changes.

## 20 October 2026 — G2 phase 3 cohort sensitivity (read-only)
- Simulated removal of recorded equipment multipliers across 453 frozen run128 product workload records, 445 positive candidates. Candidate workload sum 1178.64169091 versus historical 3861.78032033; manufacturing labour pool held at ₹706,203. Shares for products 51/695/957 move 13.236%→14.818%, 6.657%→0.044%, and 9.824%→2.232%. Results are **illustrative, not approved allocation**: existing caps are inherited, eight rows need review and POH/fully recomputed cap tests remain outstanding.
- Evidence commit `154fa837`, `evidence/G2/G2_FULL_COHORT_SENSITIVITY_PHASE3_2026-10-20.md`. G2 and CI-032 remain OPEN. No live changes.

## 20 October 2026 — G2 intentional-zero exception resolution
- Read-only run128 verified 8/453 DL products with `READY_ZERO_MANUFACTURING_LABOUR`, all ₹0, IDs 102,103,106,108,686,687,724,725. These are deliberate excluded-scope outcomes, not eight missing calculations; separate scope validity still requires independent examination. The other 445 DL records are 444 READY and one REVIEW_REQUIRED_FOUNDATION, amount ₹46.4496153; the pool remains ₹706,203.
- POH status also reports 444 READY, eight READY_ZERO_PRODUCTION_OVERHEAD, one REVIEW_REQUIRED_MONTHLY_DRIVER; exact ID parity and POH sensitivity remain open. Evidence `evidence/G2/G2_ZERO_WORKLOAD_EXCEPTION_VERIFICATION_2026-10-20.md` commit 54f94a8f. G2 OPEN, CI-032 HIGH OPEN; production unchanged.

## 20 Oct 2026 — G2 minimal operation-driver contract (proposal only)
- Compared committed step-factor, machine-assignment and G4 resolver forensics with full-population labour sensitivity. Proposed a bounded physical-activity contract: retain governed routes/overrides and standard batches, separate distinct occurrence/cycle work from verified charge-based repetition, never use kg/hour as kg/charge, preserve legitimate zero-scope, and conserve expense pools across approved workloads. No universal capacity requirement or new policy framework proposed.
- Physical validation for products 51/695/957, all-product DL+POH independent fixture, DB/client dependencies and retirement tests remain OPEN. Live detailed step-query attempts were blocked and no new step evidence is asserted. Evidence `evidence/G2/G2_OPERATION_DRIVER_MINIMUM_CONTRACT_2026-10-20.md` commit 573fa1eb; G2/CI-032 unchanged; zero production changes.

## 20 Oct — G2 latest read-only recurrence check
- Live run128 product51 step snapshots independently reconfirm 8 occurrences AND 8 cycles embedded in factors seq40/50/60/70; no evidence yet that these are two independent physical dimensions. Never multiply frozen step factor by these counts again. Product695 step-factor checks independently show ten single-occurrence/cycle steps, raw factor 5.2. Product957 detailed query blocked this checkpoint; use earlier certified evidence. Owner physical-process clarification required for Dhanyamlam. Evidence `evidence/G2/G2_DHANYAMLAM_RECURRENCE_CHECK_2026-10-20.md` commit 21b37cc8. G2 OPEN; live unchanged.

## 20 Oct — Dhanyamlam recurrence clarification (owner-confirmed)
- Product 51: occurrences 8 and cycles 8 are DUPLICATE representations of **8 total physical repetitions**, not 64. Prospective route correction is required; standard batch 1,155 L remains authoritative and frozen runs 122/128 untouched.
- Isolated arithmetic diagnostic: raw step-factor total 174.8 -> 23.6; holding historical equipment loads merely for sensitivity, scaled route intensity 511.6 -> 69.2. These are NOT new approved workload or SKU costs. Other products inheriting route144 and POH must be assessed before migration. Evidence `G2_DHANYAMLAM_OWNER_DECISION_2026-10-20.md`, commit e715cca9. G2 OPEN / CI-032 HIGH; no live changes.

## 20 Oct — G2 all-product repetition screen
- Read-only frozen run128: 293 repeated step rows among 62 products, but both occurrence and cycle >1 occurs only in six step rows of product51 (8×8, owner-confirmed duplicate). Other cases largely one count=1, including 101/41-cycle Ksheerabala Thailam and 40-cycle Abhraka preparations; no basis for blanket normalization. Affected source-route and POH comparisons are OPEN. Evidence `evidence/G2/G2_ALL_PRODUCT_RECURRENCE_SCREEN_2026-10-20.md` commit 54db377a. G2/CI-032 OPEN; no live changes.
