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

## 20 October — G2 route144 and POH parity independently verified
- Frozen run128 route144 has only product51 Dhanyamlam (no product-specific override). POH step snapshot independently shows six duplicated 8×8 steps, all product51. POH raw step sum 210 vs isolated eight-repetition arithmetic 28; full monetary pool share and valid equipment loads unverified. Evidence `evidence/G2/G2_ROUTE144_POH_PARITY_VERIFIED_2026-10-20.md` commit 4d40b20c. Future route membership still to be tested. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 active master route 144 independently inspected
- Live route144 family101 `SHUKTHAM_SERIAL_THERMAL_ACIDIC_EXTRACTION_ROUTE`, v1 APPROVED from 2026-08-30; six source step IDs 1593–1598 contain occurrence8/cycle8. Owner confirmed total eight repetitions. Proposed correction is a prospective governed successor route version, NOT an in-place edit of approved history. Route name Shuktham vs frozen recipient Dhanyamlam requires semantic review before implementation. Evidence `evidence/G2/G2_ROUTE144_SOURCE_CORRECTION_PREPARATION_2026-10-20.md` commit b8b7a75d; G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 live route-family mapping and immutable version guards
- Current family101 assignment table independently returns only approved product51, mapping ID424 effective 2026-08-30. Route144 parent carries approval-reference, immutable parent and WP04 readiness-epoch triggers. Prospective recurrence repair must use a successor version and verify readiness impact, not UPDATE approved v1. Evidence `evidence/G2/G2_ROUTE144_ASSIGNMENT_AND_VERSION_GUARDS_2026-10-20.md` commit 433a9f84. No live changes; G2 and CI-032 remain open.

## 20 Oct — G2 successor-version regression specification
- Defined 11 fail-closed isolated successor-route test obligations, including immutable route144/run128, prospective effective dates, both DL/POH writers, no double multiplication, 101/41/40-cycle peers, zero-scope, WP04 readiness and hard-retirement consumer graph. Actual route immutability function/step triggers/version API queries were blocked this checkpoint. **Tests specified, NOT run; no implementable migration approved.** Evidence `evidence/G2/G2_SUCCESSOR_ROUTE_FAIL_CLOSED_TEST_MATRIX_2026-10-20.md` commit 14251577. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 isolated recurrence regression executed
- Node isolated recurrence fixture PASS 6/6: Dhanyamlam DL 174.8→23.6, POH 210→28, only six duplicated steps normalized, 3/40/41/101 true cycles preserved, historical fixture intact. This is NOT database integration and not a successor finance run. Read-only parent immutable trigger function definition inspected: approved definition protected; lifecycle status/effective_to updates limited and route-step immutability trigger exists; exact step trigger function still to inspect. Evidence `evidence/G2/G2_RECURRENCE_LOCAL_TEST_RESULTS_2026-10-20.md` commit 1726bfc4. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 portable recurrence tests committed and step immutability verified
- Executable `evidence/G2/tests/recurrence-regression.test.mjs` committed (`76a705a0`) and independently rerun with `node --test`: 6 passed, 0 failed. Isolated arithmetic tests ONLY; no PostgreSQL writer integration or prospective price computation.
- Read-only live trigger `trg_route_family_route_step_immutable` resolves to `costing.fn_route_family_step_immutable()`: INSERT/UPDATE/DELETE of steps fail when parent route is APPROVED, SUPERSEDED or INACTIVE. Existing approved route144 must not have its steps edited; approved successor route has to be staged before approval and validated for effectivity and WP04 readiness. G2/CI-032 OPEN, no live changes.

## 20 Oct — G2 effective-route resolver and isolated test checkpoint
- Live resolver SQL inspected: approved, non-archived and effective-date valid route selected by descending effective_from, version and ID; it does not itself reject overlapping validity periods. Local Node suite 17/17 passed (12 existing plus 5 route resolver imitation scenarios). PostgreSQL integration not performed because no local Postgres server/client available. Evidence `evidence/G2/G2_ROUTE_RESOLVER_SELECTION_AUDIT_2026-10-20.md` commit 5f776380. Test source for five new cases remains local, not committed. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 overlap constraint and history-continuity hazard
- Verified GiST exclusion prohibits overlapping approved active route periods, one-writable draft index, unique route versions and approval evidence guards. Route resolver only sees APPROVED: blindly marking historic route144 SUPERSEDED would break historical as-of lookup. Candidate old-version APPROVED with end date day before prospective successor effective date requires isolated validation and separate approval. No prospective route exists. Evidence `evidence/G2/G2_ROUTE_EFFECTIVITY_EXCLUSION_AND_HISTORICAL_LOOKUP_2026-10-20.md` commit 1f951c4d. G2 OPEN / CI-032 HIGH; live unchanged.

## 20 Oct — G2 approval entrypoint audit
- Read-only checked `costing.fn_enforce_prm_approval_reference()`: route approval-reference trigger enforces PRM-prefixed **format** but not substantive authorisation. Parent route write grants belong to postgres/service_role; no named dedicated route approve/supersede function found in limited catalog filters. Generic client/service approval workflow and atomic old-version close/new-version approval need inspection before any production proposal. Evidence `evidence/G2/G2_ROUTE_APPROVAL_ENTRYPOINT_AND_PRIVILEGES_2026-10-20.md` commit 9c177440. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 CRITICAL cross-schema historical route resolver mismatch
- Discovered governed approval/supersession RPCs in `public`, not `costing`. `public.rpc_approve_route_family_route` atomically sets predecessor `SUPERSEDED` and closes its effective period; `costing.fn_resolve_effective_route_family_route` filters only APPROVED, thus old routes disappear from historical as-of lookup after governed succession. This is confirmed executable contract inconsistency. Candidate selective inclusion of closed SUPERSEDED routes needs consumer/callsite audit and isolated integration tests before any live repair. Evidence `evidence/G2/G2_CROSS_SCHEMA_ROUTE_SUCCESSION_HISTORICAL_DEFECT_2026-10-20.md` commit 3126e815. New G2 historical-route continuity blocker OPEN, no live changes.

## 20 October — G2 historical route resolver direct-caller audit
- Live pg_proc function-body search (prokind=f) identified **six** direct callers of `costing.fn_resolve_effective_route_family_route` (four costing and two public workload preview/detail RPCs), plus several candidate independent APPROVED-filtered consumers requiring manual review. This reinforces need for one narrowly scoped historical selection repair and regression across all callers; direct source-text references are NOT the entire dynamic/client dependency graph. Evidence `evidence/G2/G2_HISTORICAL_ROUTE_DIRECT_CALLERS_2026-10-20.md`, commit 3d5506e8. G2/CI-032 OPEN; live unchanged.

## 20 Oct — G2 independent historical family route selector
- `fn_product_process_route_readiness(date)` contains a separately implemented date-scoped family route selector filtering APPROVED-only; after legitimate supersession it will misclassify historical readiness even if central resolver fixed. `fn_route_family_onboarding_status` intentionally uses latest-version selection, should not be mechanically rewritten. Two other candidate selectors still await source classification. Evidence `evidence/G2/G2_INDEPENDENT_ROUTE_SELECTOR_CLASSIFICATION_2026-10-20.md` commit 0e4d399d. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 remaining selector inspection blocked
- Attempts to read `fn_validate_product_process_route` and `fn_preview_route_family_route_steps` definitions and fingerprints were blocked; no unsupported classification made. Historical resolver/readiness issue remains confirmed, onboarding latest-version behaviour preserved. Evidence `closure/G2_SELECTOR_BLOCKER_2026-10-20.md` commit 844b8cbb. These two selector definitions are mandatory pre-migration stop gate. G2 OPEN; no live changes.

## 20 Oct — G2 two previously blocked function sources now classified
- Inspected both definitions successfully. `fn_validate_product_process_route(bigint)` checks a base family route by ID and requires APPROVED; it may reject an otherwise valid historical product route after base succession, subject to caller/as-of verification. `fn_preview_route_family_route_steps(bigint,date,date)` is direct-ID candidate preview; APPROVED check is on product-group mapping and should NOT be modified as historical resolver. Evidence `evidence/G2/G2_REMAINING_SELECTOR_SOURCE_CLASSIFICATION_2026-10-20.md` commit 11a1b0b8. Continue limited consumer audit, isolated integration and pool simulations. G2/CI-032 OPEN; live unchanged.

## 20 Oct — G2 product-route approval vs historical validation split
- Inspected four public RPC source bodies. Product-route approve and submit both call shared `fn_validate_product_process_route`, while validate and detail are read paths. Broadly admitting SUPERSEDED base routes in shared validator could weaken future approval. Require date-sensitive historical validation with explicit strict approval path and full regression before repair. Evidence `evidence/G2/G2_PRODUCT_ROUTE_PUBLIC_RPC_POLICY_SPLIT_2026-10-20.md` commit 331c196e. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 product-route resolver historical defect confirmed
- Narrow read-only pg_proc.prosrc retrieval succeeded: `costing.fn_resolve_effective_product_process_route(integer,date)` filters only APPROVED routes and dates, preserves ambiguity exception. Governed product-route succession sets predecessor SUPERSEDED, making old as-of product route invisible. This is a confirmed separate historical lookup defect. Minimum coordinated repair must preserve exception and strict prospective approval. Evidence `evidence/G2/G2_PRODUCT_ROUTE_RESOLVER_VERIFIED_2026-10-20.md` commit accbfa20. No live change. G2/CI-032 OPEN.

## 20 Oct — G2 coordinated historical continuity regression contract
- Verified product-route approved-only GiST exclusion protects active versions but not overlaps involving SUPERSEDED; therefore proposed historical selectors require explicit ambiguity rejection. Committed coordinated regression specification covering family/product route succession, independent readiness, strict new approval, provenance, historical snapshots, recurrence and WP04 stop conditions. Evidence `evidence/G2/G2_HISTORICAL_CONTINUITY_FAIL_CLOSED_REGRESSION_CONTRACT_2026-10-20.md` commit cfbfca6e. **Specification only; no isolated PostgreSQL execution or live change yet**. G2/CI-032 OPEN.

## 20 Oct — G2 executable local historical continuity contract
- Local Node test harness executed `node --test /mnt/data/costing-g2/*.test.mjs`: 18/18 passed, covering workload/recurrence invariants and six new historical selection model cases. Committed corresponding six-case behavioural fixture at `evidence/G2/tests/historical-continuity-contract.test.mjs` (37e3e221). This is NOT PostgreSQL integration: fixture is a proposed decision policy model and has not been run against stored procedures, schema constraints or data. Directly executed local file differs in layout from committed version, although same six scenario intents. G2/CI-032 OPEN; no live change.

## 20 Oct — G2 isolated SQL policy fixture prepared
- Executed local Node suite directly: 18/18 PASS; no PostgreSQL executable available locally. Added `evidence/G2/tests/historical_route_policy_fixture.sql` commit 0e494000, a rollback-wrapped TEMP-table PostgreSQL fixture exercising predecessor/successor date boundaries, archive/draft exclusion and historical overlap detection. SQL has NOT been executed against PostgreSQL and is NOT a production migration; overlap test verifies candidate count=2 rather than running the real resolver. Actual function integration, strict new-route approvals, independent readiness and cost-pool reconciliation remain OPEN. No live changes.

## 20 Oct — G2 PostgreSQL runner availability checkpoint
- Local Node suite re-run, 18/18 PASS. Local PostgreSQL server/client and Docker unavailable; pg_config alone not a runner. No disposable PostgreSQL test executed, and no production SQL was invoked. Evidence `evidence/G2/G2_POSTGRES_RUNNER_AVAILABILITY_2026-10-20.md` commit 0ee06ea2. Isolated PostgreSQL integration remains explicit stop gate before proposed repair. G2/CI-032 OPEN; live unchanged.

## 20 Oct — G2 fail-closed PostgreSQL resolver fixture prepared
- Rechecked local runner: no psql, postgres, initdb, Docker or Podman; executed Node behavioural suite 18/18 PASS. Added isolated rollback-wrapped SQL fixture with temporary data and temporary function that **raises on duplicate eligible historical routes**, tests predecessor/successor boundaries and rejects prospective historical approval assumptions. `evidence/G2/tests/historical_route_ambiguity_executable_fixture.sql` commit c763cf10. This SQL has **not** run in PostgreSQL and does not integrate actual costing functions. Full isolated PostgreSQL execution, consumer compatibility and finance gates OPEN. No live change.

## 20 Oct — G2 HIGH historical status overlap discovery (live read-only)
- Current data contains 10 overlapping family route pairs and 7 overlapping product route pairs when combining APPROVED and SUPERSEDED statuses with inclusive periods; some superseded rows remain open-ended, others overlap successors exactly on effective start day. Thus naive inclusion of SUPERSEDED in existing selectors is NOT safe and needs proven historical provenance and explicit exception policy before any code repair. Evidence `evidence/G2/G2_LIVE_HISTORICAL_ROUTE_OVERLAP_EXCEPTION_INVENTORY_2026-10-20.md` commit 680f1c1a. Prior unexecuted policy fixtures do not prove compatibility with these records. CI-032 HIGH/G2 OPEN; no live changes.
