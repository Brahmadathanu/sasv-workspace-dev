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

## 20 Oct — G2 overlap provenance and snapshot attribution
- Inspected sample of overlapping family/product route lineages: predecessor/successor frequently approved same calendar day minutes apart; several predecessors remain open-ended. Sampled frozen DL/POH run122/128 each have 25 route recipients referencing selected successors, not the predecessor IDs. This does not prove historical non-use. Simple SUPERSEDED eligibility remains BLOCKED until all overlap provenance and temporal semantics resolved. Evidence `evidence/G2/G2_OVERLAP_PROVENANCE_AND_SNAPSHOT_ATTRIBUTION_2026-10-20.md` commit dac13e53. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 17-pair provenance completeness gate
- Attempts at fresh full lineage/one-family live read-only SQL were blocked this checkpoint. Prior verified 10 family + 7 product overlap inventory still stands; full lineage links, operational validity and comprehensive frozen-run attribution NOT certified. Preserve status as blocker; no unconditional SUPERSEDED broadening. Evidence `evidence/G2/G2_OVERLAP_COMPLETENESS_GATE_2026-10-20.md` commit f0cb04de. G2/CI-032 OPEN, no live changes.

## 20 Oct — G2 superseded route successor links verified
- Live read-only audit found 17/18 non-archived superseded family routes linked to successors (route48/family43 unlinked), and 9/9 superseded product routes linked; seven product predecessors 174-180 and family105 have NULL effective_to despite linked successors. Full frozen snapshot predecessor reference scan blocked, so non-use unproven. Evidence `evidence/G2/G2_SUCCESSOR_LINK_INVENTORY_2026-10-20.md` commit fd651d48. G2/CI-032 OPEN; no live change.

## 20 Oct — G2 family43 apparent overlap explained
- Read-only: family43 route49 is APPROVED but archived; route82 APPROVED unarchived, route48 SUPERSEDED unarchived. Therefore no active-approved exclusion constraint violation between 49/82. Historical lineage remains incomplete: route48 has no successor reference, route82 links to archived49. Evidence `evidence/G2/G2_FAMILY43_ARCHIVE_CHECK_2026-10-20.md` commit 12652862. No live changes; G2 open.

## 20 Oct — G2 full protected-run superseded-route attribution checked
- Read-only DL and POH snapshot scans over every identified non-archived superseded route (18 family IDs, 9 product IDs) return zero references for both protected run122 and run128. This closes the frozen-run predecessor-reference question, but does not establish non-use in other runs or physical manufacturing. Historical 17-pair overlaps and resolver policy remain open. Evidence `evidence/G2/G2_FROZEN_RUN_SUPERSEDED_REFERENCE_EXCLUSION_2026-10-20.md`, commit 65457b11. No live changes.

## 20 Oct — G2 guarded historical eligibility proposal
- Read-only family32 confirms a unique old-only window Aug17–23 and ambiguous Aug24 predecessor/successor coverage. 17/18 non-archived superseded family routes have closed intervals; one remains open-ended. Prepared conservative proposal to fail closed on all cross-status overlaps, require closed SUPSERSEDED window for historical read eligibility, preserve strict new-route approvals. Candidate **not approved or deployed**; full PostgreSQL, historic provenance and costing impact tests OPEN. Evidence `evidence/G2/G2_GUARDED_HISTORICAL_ELIGIBILITY_CANDIDATE_2026-10-20.md` commit 8bfddec0. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 bounded date-window check and realistic closure priorities
- Live read-only family32 17–31 Aug count of APPROVED/SUPERSEDED candidates: 14 days uniquely matched, 1 ambiguous (24 Aug), zero missing. This is candidate arithmetic, not operational provenance or PostgreSQL function test. Confirmed G2 **not complete**, G3–G6 open; prioritize manufacturing workload/charge evidence and full DL/POH conservation alongside bounded historical-route fix; do not extend open-ended research without decision impact. Evidence `evidence/G2/G2_PROGRESS_AND_FAMILY32_DATE_WINDOW_2026-10-20.md`, commit 31422672. No live changes.

## 20 Oct — G2 manufacturing driver source priority
- Live read-only source confirms DL step-factor uses occurrence*cycle (product51 duplicate 8×8 issue); POH preview uses occurrence*cycle*resource-factor. POH preview explicitly derives monthly batch equivalents from quantity aggregated in `sku_sales_allocation_basis_snapshot`, a sales allocation basis rather than demonstrated actual production output. This is a verified **preview driver dependency**, not yet proven effective snapshot writer. Production-workload denominator and full two-pool money conservation remain priority G2 blockers. Evidence `evidence/G2/G2_MANUFACTURING_DRIVER_SOURCE_AUDIT_2026-10-20.md` commit b713a230. No live changes.

## 20 Oct — G2 all-run archived predecessor attribution
- Read-only scan of 17,364 DL snapshot records found 64 references to currently SUPERSEDED family route9, all in run82; route9 now archived, effective Jul1–Aug10, 2026. Zero references to currently SUPERSEDED product routes. Protected runs122/128 still have zero predecessor references. Preserve immutable snapshot attribution independent of present-day route archival; historical resolver eligibility still requires date/ambiguity governance. Evidence `evidence/G2/G2_ALL_RUN_ARCHIVED_SUPERSEDED_SNAPSHOT_REFERENCES_2026-10-20.md` commit 8e4c0dfb. G2/CI-032 OPEN; no live changes.

## 20 Oct — G2 run82 archived route temporal validity PASS
- Read-only: run82 August-period valuation 2026-08-07, 64 DL records referencing route9 effective 2026-07-01 through 2026-08-10; later archival on Aug13 does not invalidate snapshot temporal attribution. Immutable old-run references remain protected. Eligibility for fresh retrospective recomputation is separate, especially for archived routes. Evidence `evidence/G2/G2_RUN82_HISTORICAL_EFFECTIVE_DATE_2026-10-20.md` commit 934bd095. Financial correctness unverified, CI-032/G2 OPEN, no live writes.

### G2 SQL probe candidate — 20 Oct 2026
- Staged read-only parameterized family/product historical route candidate queries and explicit ambiguity regression matrix. Frozen snapshot ID read, retrospective route choice and prospective approval remain separate; no function replacement or migration. Evidence `evidence/G2/G2_HISTORICAL_RESOLUTION_SQL_PROBES_2026-10-20.md` (`bcd9ea9f`). Return-signature catalog query blocked; live migration prohibited, G2/CI-032 OPEN.

### G2 live PostgreSQL probe checkpoint — 20 Oct
- Confirmed both route resolvers `(integer,date) RETURNS bigint`, STABLE. Read-only queries reproduced family32 Aug24 (routes34/38) and product957 Aug25 (routes72/73) effective-date conflicts. Candidate checks only; PostgreSQL function regression and deployment NOT performed. Evidence `evidence/G2/G2_LIVE_SQL_RESOLVER_SIGNATURE_AND_AMBIGUITY_CHECKS_2026-10-20.md`, commit 51d64b4f. G2 open, no live changes.

### 20 Oct G2 — review-only family ambiguity guard staged
- Re-read governing IMPLEMENTATION_RULES and lean-retirement directive. Staged a proposed APPROVED-only family resolver ambiguity guard, preserving bigint/STABLE contract; no historical SUPERSEDED admission. Added isolated rollback-only SQL assertions for family32/product957 date overlaps and run82 route9 immutable attribution. Review-only files: `evidence/G2/G2_FAMILY_RESOLVER_AMBIGUITY_GUARD_REVIEW_ONLY_2026-10-20.sql` commit ebd16520 and `evidence/G2/tests/g2_route_guard_isolated_assertions.sql` commit 29dddb6f. Not executed in PostgreSQL or promoted to migration; DDL metadata/privileges and consumer parity must be verified prior to approval. G2/CI-032 OPEN. No live data or function changes.

### G2 patch security audit — 20 October 2026
- Live catalog found family resolver LANGUAGE sql, STABLE, SECURITY DEFINER, search_path=costing/public, owner postgres, EXECUTE ACL postgres/authenticated/service_role. Earlier draft omitted SECURITY DEFINER/search_path; corrected review-only SQL in commit aa18444f (no live change). PL/pgSQL language conversion and privilege parity must be tested in isolated PostgreSQL before approval. G2/CI-032 OPEN.

### G2 family resolver six-caller compatibility audit — 20 Oct
- Read-only pg_proc source scan verified six direct callers: effective process steps, candidate preview, overhead preview, effective-route validation, and two Production Route Manager RPCs. Two bodies contain no EXCEPTION clause; four contain exception handling with semantics not yet inspected. Staged ambiguity guard may alter operator error responses; requires isolated caller/client parity regression. Evidence `evidence/G2/G2_FAMILY_RESOLVER_SIX_CALLER_COMPATIBILITY_2026-10-20.md` (`c7d9b023`). No live changes; G2/CI-032 OPEN.

### G2 resolver callers — exception handlers checked
- All six direct callers have no EXCEPTION WHEN handlers. Previous keyword counts included RAISE EXCEPTION and evidence labels. New resolver errors propagate and need caller/client compatibility tests. See `evidence/G2/G2_SIX_CALLER_EXCEPTION_HANDLING_VERIFIED_2026-10-20.md` (7ea2b2ac). G2 OPEN; no live changes.

### G2 isolated testing gate clarification
- Existing SQL assertions check source data only; they do not execute replacement resolver or six-caller parity tests. Live catalog reconfirmed SECURITY DEFINER, STABLE and search_path. Full tests require a dedicated disposable PostgreSQL clone, rollback-only synthetic duplicate fixtures, security parity and client error checks. No live change; G2 open.

### G2 runtime test availability — 20 Oct
- Local executable check: no psql/postgres/docker; Node policy model suite 12/12 PASS, not PostgreSQL regression. Function replacement and six-caller parity remain untested. Evidence `evidence/G2/G2_RUNNER_AVAILABILITY_AND_MODEL_TEST_RESULT_2026-10-20.md` commit e34d1b20. No live changes; G2 OPEN.

### G2 follow-up — route scope
- Frozen snapshots retain route IDs; current previews use valuation-date selectors. No duplicate historical engine. See evidence/G2/G2_ROUTE_SELECTOR_CONSUMER_PURPOSE_2026-10-20.md. G2 open; no live writes.

### G2 dual-multiplier inventory
- Live: six of 1,668 family steps affected, all route144; 0 of 1,155 overrides; 210 DL and 210 POH snapshot step rows. Protected runs122/128 each contain six DL affected rows; preserve as frozen. Evidence G2_ROUTE_WIDE_DUAL_MULTIPLIER_INVENTORY_2026-10-20.md (b3a7a294). Correct authoring semantics prospectively; G2 open.

### G2 existing route approval gates
- Family and product validators exist and are used by approval RPCs; neither inspects repetition counts directly. Lean proposed safeguard reuses validators and current UI, with prospective governance. Evidence G2_EXISTING_APPROVAL_VALIDATOR_REUSE_2026-10-20.md (96ae485f). No live edits.

### G2 note adequacy checkpoint
- All six dual-positive Dhanyamlam steps already have notes; requiring a nonempty note alone cannot prevent double counting. Show total executions and require physically meaningful confirmation of nested cycles in approval review. Existing step_note and override_reason suffice; no new column proposed. Evidence G2_DUAL_MULTIPLIER_NOTE_ADEQUACY_2026-10-20.md (e3cbb43b). No live changes.

### G2 approval reference contract — 20 Oct
- Both route approvals require meaningful approval references and existing validators. Approval reference is not proof of nested cycles; do not overload it. See evidence/G2/G2_APPROVAL_REFERENCE_CONTRACT_2026-10-20.md (3d207d02). No live changes.

### G2 repetition safeguard handover — 20 Oct
- Two existing client forms confirmed. Stage computed total executions and dual-positive warning first; server enforcement awaits reliable route-version-bound review evidence, not free-text note. See evidence/G2/G2_ROUTE_MANAGER_REPETITION_IMPLEMENTATION_HANDOVER_2026-10-20.md (1cac77aa). G2 open; no live changes.

### G2 client repetition preview — code checkpoint
- Branch-only source changes: family-step form c2714cb4 and product-delta form b8d816dd display computed total executions, clarify cycles within occurrence, warn for dual-positive counts and guard invalid numeric input. Post-write source assertions passed for both forms; browser/runtime tests NOT executed. No DB changes, no approval enforcement; G2 OPEN.

### G2 repetition client smoke — 20 Oct
- Added scripts/costing-g2-route-repetition-preview-smoke.mjs (bceea5fd): source-extracted preview binding tests for both forms, eight numeric/boundary cases and listener wiring. Test committed but not executed against branch files; no browser or server approval test. No production changes.

### G2 source-extracted execution evidence
- Executed actual fetched preview-binding block in isolated JS for both branch forms: 7 input cases each, 14/14 PASS including listeners, empty/zero/fractional/unsafe integers and 8x8 warning. Not whole-form browser smoke or approval regression. Repo smoke script remains committed, execution via node on branch pending. No live changes.

### G2 repetition integration check — 20 Oct
- Verified both branch client forms initialise the derived count and bind input listeners. Product-delta form is operation-conditional, so full modal/browser tests remain essential. Extended repository smoke for invalid cycle-side values (8adddf79). Branch smoke execution and approval attestation not yet verified. No live changes.

### G2 operation-panel integration fix — 20 Oct
- Found that product-route ALTER_CYCLE uses separate AlterOcc/AlterCycles controls and lacked a visible repetition preview. Added preview to its cycle panel with active-operation-specific input binding (54ca0188). Updated smoke script to cover ADD_STEP and ALTER_CYCLE (33cc6d7b); branch runtime execution remains pending. No live changes.

### G2 product-delta operation-switch correction — 20 Oct
- Corrected repetition preview binding for both ADD/REPLACE and ALTER_CYCLE panels, including changes of operation after form load (client commit 1b5d8658). Updated smoke harness fb62258d and context fix cdcb8077. Executed 10 isolated cases against fetched product-delta binding: 10 PASS; full node script/browser and server approval tests remain outstanding. No live changes.

### G2 client repetition smoke checkpoint — 20 Oct
- Fixed malformed ALTER_CYCLE markup assertion in repository smoke script (98206b9b). Tested source-extracted bindings from current branch with 33 scenarios PASS (family 11; product delta add and ALTER_CYCLE 11 each) including invalid inputs and operation-change handler. Full repository node-script execution and browser authentication remain NOT VERIFIED because repo checkout is unavailable in isolated runner. No live changes; G2 remains OPEN.

### G2 server repetition attestation gate — 20 Oct
- Existing validators expose valid/errors; existing product route evidence_status/route_note do not attest computed nested repetitions. A generic note must not pass 8x8. Version-bound reviewer evidence and stale-input rejection are needed before server enforcement. Review-only evidence G2_SERVER_REPETITION_ATTESTATION_DECISION_GATE_2026-10-20.md (52498ec1). No live changes; G2 open.

### G2 route audit evidence checkpoint
- Existing route approval metadata is versioned but lacks step-specific attestation. Generic references cannot verify nested repetition. See evidence/G2/G2_APPROVAL_HISTORY_REUSE_CHECK_2026-10-20.md. No live writes.

### G2 protected-run factor footprint
- Read-only runs 122 and 128 each contain six affected DL and POH step rows. Summed DL step factors 172.8 and POH step factors 208 in each run; neither is rupee impact. Evidence G2_PROTECTED_RUN_DUAL_FACTOR_FOOTPRINT_2026-10-20.md (0ed08292). No live changes.

### G2 Dhanyamlam step-factor scenario
- Affected six-step DL sum 172.8 and POH sum 208 in protected runs122/128. Eight-total-repetition linear counterfactual: DL 21.6, POH 26, reductions 151.2 and 182. Not monetary impact. Evidence G2_EIGHT_REPETITION_SCENARIO_2026-10-20.md (25aaa23b). No live changes.

### G2 fixed-pool DL sensitivity
- Protected runs122/128: under eight-execution counterfactual, Product51 DL allocation falls provisionally by 19271.48 and 24945.15 respectively. Fixed 706203 pool redistributed, not saved. See evidence/G2/G2_DHANYAMLAM_DL_FIXED_POOL_SENSITIVITY_2026-10-20.md (83105a2a). POH rupee effect pending pool. No live changes.

### G2 DL+POH fixed-pool counterfactual — 20 October
- Protected run 122: POH redistribution from product 51 22614.51; combined DL+POH 41885.99. Protected run 128: POH redistribution 26199.94; combined 51145.09. Distinct alternative scenarios, not additive. Pools conserved; no financial posting. Evidence G2_DHANYAMLAM_COMBINED_FIXED_POOL_COUNTERFACTUAL_2026-10-20.md (fdc07a7f). G2 OPEN, no live changes.

### G2 server approval gate design — 20 October
- Narrow, non-retroactive approval rule drafted: version-bound count-specific attestation for dual-positive effective route steps, stale-input rejection, both route families and product overrides; no new table unless existing receipt mechanisms inadequate. See evidence/G2/G2_SERVER_APPROVAL_MINIMUM_CHANGE_DESIGN_2026-10-20.md (f0acc472). Exact approval RPC signatures and receipt persistence still require verification. No live changes; G2 OPEN.

### G2 live approval RPC signature verification
- Public RPCs, not costing schema: rpc_approve_route_family_route(bigint,text) and rpc_approve_product_route(bigint,text). Both lock review-required route and call costing validation before status transition; transition guard is preferred to changing general validators, preserving historical approved route144. Confirmation receipt/fingerprint persistence not verified; no SQL staged/deployed. Evidence G2_APPROVAL_RPC_INSERTION_POINT_2026-10-20.md (9df1f1fe). G2 OPEN.

### G2 structured approval-evidence storage decision — 20 Oct
- Live schema lacks route-header JSONB evidence or reusable count-specific receipts. Minimal candidate: one nullable JSONB approval-evidence field on each existing route header; server constructs and validates exact effective-step digest on approval, preserves historic APPROVED routes. Step-row race/permissions need verification before staging SQL. See evidence/G2/G2_REPETITION_EVIDENCE_STORAGE_DECISION_2026-10-20.md (5d2e1030). NO live changes; G2 OPEN.

### G2 governed repetition architecture selected — 20 Oct
- User prioritised professional durability, traceability and maintainability. Supersedes provisional mutable route-header JSON evidence option: choose a dedicated append-only repetition attestation register with route-version and effective-step digest, cross-route input lock, actor/time and exact count proof. Live mutation RPC read confirms parent route header FOR UPDATE on family step and product override upsert. Deletion and base-family concurrency still require verification. Architecture decision evidence/G2/G2_GOVERNED_REPETITION_REGISTER_ARCHITECTURE_DECISION_2026-10-20.md (b23d3cd2). Server code not yet staged, no live change. G2 OPEN.

### G2 implementation attempt — 20 Oct evening
- Authorised programme progression: planned append-only attestation register with dual route identity, step digest and immutable reviewer evidence. Branch SQL file creation was blocked by tool safety checks; no migration committed or deployed. Keep G2 OPEN. Next verify deletion locks/base route edits, then stage gated migration and approval RPC tests. No live writes.

### G2 staged migration hardening
- Verified live delete-product-override RPC has no parent lock; returns jsonb and is SECURITY DEFINER. Staged matching parent FOR UPDATE correction (a23d4dce), tightened one-route foreign keys, digest and JSON checks, append-only mutation trigger (ac15f30f), in 20261020191500_g2_route_repetition_evidence.sql. Mandatory initial RAISE HOLD preserved. Approval-attestation capture/approval verification and full tests still missing. No deployment, no DB changes. G2 OPEN.

### G2 effective-step evidence resolver
- Verified live costing.fn_effective_product_process_route_steps(bigint) returns effective keys, occurrence/cycle counts, base_step_id and override_id; this is canonical source for product attestation, not raw override rows. Family route uses production_route_family_route_step. SQL append attempt blocked; no unverified server logic committed. Migration remains deliberately held; no live change.

### G2 migration recovery (20 Oct)
- Fetched staged SQL and detected malformed split check constraint plus duplicate column/table closure. Replaced file with coherent DDL and retained unconditional initial G2 deployment HOLD; commit 7a10fee4. Approval evidence builder, capture and enforcement still NOT IMPLEMENTED. No DB deployment or protected-run edits. G2 OPEN.

### G2 staged server approval integration — 20 October
- Same held migration now contains canonical family/product effective-route evidence builder (cd58ead7), SHA256 exact route/version matching guard (f62cacc6), governed server-generated confirmation capture (d4418f5e), and BOTH actual existing public approval RPC definitions with confirmation guard inserted before approval state mutation (2d3d46cf). Source assertions confirm both paths, hold, capture and immutability sections present. Still NOT VERIFIED: complete canonical fingerprint scope, concurrent base-family mutations, permissions/GRANT hardening, Postgres compile/regression, client confirmation UI. Deployment HOLD retained; no live changes. G2 OPEN.

### G2 server source hardening checkpoint — 20 October
- Expanded canonical fingerprints to full family and effective-product step records (001006f8, cf15544c); normalized repetition keys retained. Restricted execution of SECURITY DEFINER evidence/guard helpers to owner, exposed confirm RPC only to authenticated with existing permission check (cc138a5e). Eight structural source assertions passed. Explicit initial deployment HOLD remains. Full PostgreSQL compilation, end-to-end approval regression, stale evidence/concurrency tests and UI capture still OPEN. No live changes.

### G2 server evidence ordering and static gate — 20 Oct
- Fixed deterministic `jsonb_agg` ordering in both confirmation capture and approval guard (672466bc). Added Node static-smoke script scripts/costing-g2-attestation-migration-static-smoke.mjs (6e76140f). Re-fetched branch migration: 15/15 independent structural assertions passed; exact paired ordering count 2. Full PostgreSQL compilation, RLS/grants, stale-version and concurrency regressions NOT RUN. Deployment HOLD remains; no live change. G2 OPEN.

### G2 inherited-family fingerprint hardening — 20 Oct
- Product-route evidence now includes base family route ID and version, not just effective step rows (ba5c6961). Updated static test requirements (f17d674d). This guards lineage drift in proposed approvals. Live DB compiler and transactional race tests still not completed; initial migration deployment HOLD remains. No production writes. G2 OPEN.

### G2 review-only attestation gate — 20 Oct 2026
- Staged capture now requires REVIEW_REQUIRED status, preventing evidence creation while route is in DRAFT (05871676). Read-only verified both submission RPCs transition DRAFT to REVIEW_REQUIRED and validate routes. Added static regression assertion (771d827e). No PostgreSQL compiler/transaction test runner available; migration HOLD remains; live unchanged. G2 OPEN.

### G2 runnable workload regression and schema read checks — 20 October
- Ran locally available Node fixture tests under `/mnt/data/costing-g2`: `node --test *.test.mjs` => **12/12 PASS, 0 failures**. These verify allocation and eight-total-repetition mathematical fixtures, **NOT** PostgreSQL migration compilation or approval RPC execution. Read-only live schema confirms `route_version` columns on both route tables and `base_route_family_route_id` on product route. `information_schema.role_table_grants` shows no direct `anon`/`authenticated` grants for family steps or product overrides. No local psql/postgres/docker installed. Staged confirmation remains review-only (05871676), migration HOLD active, no DB writes. Next: isolated PostgreSQL migration tests with negative cases and permissions before deployment. G2 OPEN.

### G2 inherited-family concurrency correction — 20 Oct 2026
- Identified remaining transaction race: product attestation and approval locked product header but not the inherited family header read by effective-step resolver. Added `FOR SHARE OF fr` family-parent lock before resolving effective product steps in BOTH confirm and approve guard, after the existing product parent `FOR UPDATE` boundary (dc937fdb). Added dual lock-source assertion (cd1d4806). These are staged source changes, not database execution proof; PostgreSQL concurrency tests and lock-order review remain mandatory. Unconditional deployment HOLD active; no live changes. G2 OPEN.

### G2 review-submission locking — 20 October 2026
- Read-only live function inspection showed both `rpc_submit_product_route_for_review` and `rpc_submit_route_family_route_for_review` validated child route state before obtaining any explicit parent row lock, permitting concurrent edit/validation race. Staged exact original RPC bodies with parent `FOR UPDATE` acquired before validation (4c466a0e); added static regression assertions (fd06b631). Local environment lacks psql/postgres/docker, so no execution or concurrency pass is claimed. Migration first-statement HOLD remains, no live writes. Next check candidate deadlock graph and run isolated DB tests. G2/CI-032 OPEN.

### G2 product review inherited-family lock — 20 October 2026
- Transaction boundary extended: product Submit for Review now locks product route header FOR UPDATE, then inherited family route header FOR SHARE before validating the product effective route (46916803). Product approval and confirmation already use product-header then family-header acquisition order. Source lock-order consistency improved; live PostgreSQL deadlock/concurrency verification still NOT RUN. Initial migration HOLD stays active. No database mutation. G2 OPEN.


## 20 October — Mobile-first completion and end-to-end acceptance decision

**User direction:** Complete server work as efficiently as is professionally defensible; user is on phone and also needs separate database-to-Google-Sheets work tonight. Do not jump directly to merge or refresh. This checkpoint aligns the proposed end-to-end proof with governing rules rather than treating a successful refresh as proof of every control.

### Critical reconciliation of existing rules
- `IMPLEMENTATION_RULES.md` §2 explicitly requires **prepared SQL under closure/prepared/**, **not** `supabase/migrations/`, and byte-identical applied evidence with md5. The experimental G2 file at `supabase/migrations/20261020191500_g2_route_repetition_evidence.sql` conflicts with that rule. It begins with an unconditional G2 HOLD, so it must **not** be merged, deployed or allowed into an automatic migration runner. Reconcile the placement and remove the conflicting executable migration artifact from the candidate release only after preserving a traceable draft in the governed evidence/prepared area and reviewing every consumer. This documentation does not waive the rule.
- `TECHNICAL_BATCH.md` records an existing PostgreSQL 17 catalogue-backed test fixture and runner (`evidence/TB/run_tests.py`), providing a viable prior testing pattern. Verify its current availability and G2 coverage; do not claim it currently runs in the ChatGPT execution environment.
- The 19 October mandate suspends Google Sheets regeneration and pricing work until server acceptance. User's separate database-to-Sheets need should be triaged as its own workflow; only non-costing, non-conflicting, expressly authorised Sheets work can proceed independently. Do not silently remove the costing embargo.
- The user's suggestion to merge and refresh is a **proposed acceptance strategy**, not blanket consent for merge, production migration, refresh, period switch, cron, protected-run overwrite or Sheets editing. Each live change still requires an explicit approved batch.

### Tonight-oriented single critical path — no unnecessary detours
1. **G2 code freeze & defect review:** reconcile the currently staged route-repetition SQL against implementation rules, eliminate blocking DDL/permission/function-security issues, trace the exact approval and refresh consumers, and package one minimal prepared migration. Do not keep two runnable migration copies.
2. **Reuse established isolated test pattern:** locate/reconstruct the existing TB PostgreSQL 17 fixture, compare live function definitions and checksum, execute migration compilation and G2 positive/negative/security/concurrency tests; record real outputs. If unavailable, state the precise blocker and stop, rather than substitute fabricated PASS marks.
3. **Server acceptance:** review G1–G4 open issues, dependencies, driver correctness, invariants and release impact; distinguish G2 route attestation readiness from end-to-end costing-suite completion. A single green refresh cannot certify unresolved policy/governance concerns.
4. **Controlled production sequence after separate authorisation:** merge reviewed branch -> deploy only explicitly approved byte-identical migration -> post-deploy access/RPC checks -> run one **new**, traceable costing refresh using documented period/valuation inputs (no changes to runs 122/128 or approvals) -> reconcile all waterfall amounts, allocations, workload factors, route/version provenance and run governance against evidence. Observe existing cron switches; do not reactivate implicitly.
5. **G6 independent acceptance:** capture read-only comparison and exceptions, mark PASS only where evidenced; otherwise HOLD with exact failed check and next repair. Only then release costing-dependent Google Sheet/price revision work under separately authorised scope.

### Phone-first communication
Send short updates with **Completed / Verified / Remaining / Next / Live Changes** and request only actionable approvals at the real deployment boundary. Avoid repeated “proceed” loops and changes outside the critical path. No cost-bearing Supabase branch was created.

**Current status:** G2/CI-032 OPEN; G4/G5/G6 overall programme acceptance NOT inferred. Staged G2 SQL has an intentional deployment HOLD. No merge, live migration, refresh, snapshot mutation or Google Sheets edit performed in this turn.

### Binding dependency — server acceptance before ANY database-to-Google-Sheets integration (20 Oct evening)
- User explicitly directed: no database-to-Google-Sheets data integration of any category until server works are completed and proven correct through a **new, authorised costing refresh**, complete downstream reconciliation, and verified data correctness. This supersedes the earlier exception for separate non-costing Sheets activities. Gate sequence: G2/other server blocks PASS -> isolated integration and permissions tests PASS -> separate merge/deploy approvals -> new non-destructive refresh -> numerical and lineage reconciliation PASS -> G6 acceptance -> only then separate Sheets integration work. No shortcuts based on merge alone or a run completing without balancing evidence. No live changes authorised by this instruction.
