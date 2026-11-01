> **SUPERSEDED (24 Oct 2026) — see [../CURRENT_STATE.md](../CURRENT_STATE.md).** Dated history only; live-state statements below (approved runs 122/128/131/136/140, cron 60/61, the public price feed view) are out of date.

# ChatGPT handover, part 4 — lean costing architecture
Date 2026-10-20 IST. Authoritative continuation of handover PART3 (19 Oct) and repo progress since 19 Oct.
Repo: `Brahmadathanu/sasv-workspace-dev`. Work branch: `costing/au4-normal-budget`, PR #72 draft/unmerged.
Scope strictly `docs/costing-pipeline-independent-audit/`, not the separate Costing Suite client programme, procurement, or Jarvis WP07.

## START HERE — binding user directive
User instructs: unwanted complexity increases maintenance/outages, implement only required and future-proof architecture. When replacing a design, **HARD REMOVE its outdated executable architecture after controlled dependency-safe migration; do not leave confusing active old remnants**. Historical approved snapshots, applied migrations, audit journals, valid manufacturing/planning data and required consumer compatibility are not debris and MUST survive. The full binding rule is `closure/ARCHITECTURE_SIMPLIFICATION_AND_RETIREMENT_DIRECTIVE_2026-10-20.md`; implementation guidance has been appended to `closure/IMPLEMENTATION_RULES.md`. These override earlier assumptions that all missing machine capacities should block costing. The three suggested fixed/physical/planning modes are a proposed simplification, **not yet live or accepted as final engine design**. Minimise even that if justified by evidence.

## User's latest question — technical conclusion
Machine working charge may convert step quantity into discrete process loads; a product's weighted workload determines its share of total eligible workload. It is **not** the direct monetary denominator: eligible total product workload is the allocation denominator for manufacturing labour and production overhead. Capacity is useful only for steps truly repeating by equipment charge; not for each manual/administrative/fixed activity. Machinery throughput kg/h or Nos/h is for planning, not current costing (P28). Legacy defaults include MANUAL=50 kg, GRINDER=50 kg, DRYER=50 kg, MIXING=200 kg, GENERAL_AREA/STORAGE fixed, vessels output-based. Permissive class fallback can bias workload allocation. Avoid all 74 capacities becoming an artificial prerequisite.

## Core protected decisions/state
- `public.production_batch_size_ref` is **already enforced as standard batch reference**. Never question its use or replace with sales volume. It does NOT alone prove process-step input charges. BMR history confirms: Dhanyamlam product51 standard1155 L (8 BMRs); Thippili product957 standard770 kg (39 BMRs 385–770); Karkkidaka Kanji product695 standard50,000 Nos (historical BMR SP718; others40k/20k) and approved 0.5 kg/kit mass override.
- G0 DONE; G1 arithmetic and source lineage VERIFIED, including IMC as additional prime component, not a discrepancy. G2 OPEN; G3 seasonal demand DVS-1 installed DRAFT/OFF; G4 W2 period lifecycle live, plant-aware G4 OFF, prepared CI-012 and CI-034 not applied; G5 approved full waterfall export NOT STARTED; G6 NOT READY.
- Sep approved run122 (634 SKU) and Oct approved run128 (627 SKU) are immutable reference; latest live fingerprint audit 0/50 and 0/51 drift. October not a finance-approved price basis. Periods LOCKED not necessarily CLOSED. `public.v_costing_pricing_price_revision_feed_approved` 1261 rows. Cron 60/61 paused. September close and November run not authorised.
- 171 distinct machine profiles, 298 version rows; readiness 74 BLOCKED_NEEDS_CAPACITY, 74 READY_PROVISIONAL, 20 NOT_REQUIRED, 3 NOT_OPERATIONAL; historical profiles Nov-effective. 15 priority machines in `closure/evidence/CAP/CAPACITY_P1_15_MACHINES.md` (126 oil press 137 products,130 juice press95,119 firewood dryer63, 125 mixer1). **Do not invent their missing capacities.** G4 route provenance snapshot empty while switch OFF.
- Policies P1–P38 and approved deployment history PART3 govern; approved ledger LB1 live; 60%-based sales allocation stays until approved DVS-1; 86-SKU exception CSV defaults unapproved; 12.8% stale/manual material value; ₹8.72L Central Office plus ₹5L HO retained pending evidence; 9 negative margins and 37 review required.
- TB1–TB7 technical security hardening live except TB4 user Supabase dashboard confirmation that `costing` schema not exposed. Next Tally sync role still unconfirmed; do NOT relax service/ETL-admin writes if sync fails. CI-016 582 live migrations vs96 repo issue remains.
- No live mutations, drop, migration, switch, cron, runs, approval/period action, merge, deployments, pricing Sheets or client changes without explicit user authorisation. Read-only Supabase and GitHub repository documentation/tests allowed. Never touch Jarvis WP07.

## Work completed by ChatGPT after part3 (19–20 Oct)
1. Checkpoint `archive/CHATGPT_TAKEOVER_CHECKPOINT_2026-10-19.md`; commits 5c13fc1b.
2. G2 triage `G2_CHATGPT_INDEPENDENT_TRIAGE_2026-10-19.md`; 15 priority machines all blocked.
3. Detailed frozen route factors `G2_FROZEN_ROUTE_STEP_FORENSICS_2026-10-19.md`: product51 labour ₹93,475.19/month (13.24%),957 ₹69,374.49 (9.82%),695 ₹47,009.67 (6.66%). Top10 manufacturing labour share44%. All exact immutable run128 results.
4. BMR audit `G2_BATCH_MASTER_BMR_PROVENANCE_2026-10-19.md` confirms standard batch references.
5. Clarification `G2_STANDARD_BATCH_VS_PROCESS_CHARGE_2026-10-19.md`; standard batch is valid, physical stage charges a distinct driver.
6. Step factors `G2_STEP_FACTOR_RECONCILIATION_2026-10-19.md`: product51 steps40/50/60 occurrence8 AND cycles8 with factor38.4/64/64 and ×3 loads; product695 ×500 on 7 steps, only 6 with nonzero DL factor; product957 grinder/dryer ×16 and named mixing ×4.
7. Machine links `G2_MACHINE_ASSIGNMENT_FORENSICS_2026-10-19.md`: product51 inherited family route144, named machine2 Disintegrator 28.3333 kg/h *planning throughput*; product695 inherited family154, dryer machine119 named for steps30/70 and missing kg charge; product957 approved product route73 overrides family41, named mixer125 missing kg charge (route72 superseded). Route override ADD/BYPASS critical.
8. Live executable G4 function audit `G2_G4_RESOLVER_CODE_AUDIT_2026-10-20.md`: `costing.fn_au9_g4_resolve_step_load` and `fn_au9_g4_route_step_loads`, separate `fn_au9_g4_load_mode`. Both mode and resolver hard-gate Nov1, 2026. Actual G4 OFF returns legacy `fn_route_step_loads`. Named machine capacity CHARGE takes priority; throughput falls to class and flags, missing named machine can fall through to step/class, class candidate ambiguity fail-closed; stage input currently `p_solid_kg` or finished `p_output_qty` per product, not physically recorded per step. Null string concatenation loses one provenance flag.
9. Subsequent read-only query: **all 17 G4 fallback policies allow fallback**, incl manual/grinder/dryer/mixer, from 1 Nov; 9 step capacity rules. Attempt to commit fallback doc blocked, but facts confirmed; do not assume file exists.
10. `G2_CAPACITY_PURPOSE_SIMPLIFICATION_2026-10-20.md` and master `closure/PROGRAMME.md` updated with rationale and minimum viable model (commits 1adc85b9 and 31c89615).
11. Latest binding architecture retirement directive file in closure, implementation rules and programme updated, issues MD appended; see latest branch.

## Important design implications
Current G4 implements complexity that may not make costs materially more accurate. A readiness list of 74 missing machine capacities is not equivalent to 74 true costing blockers. There are 17 permissive fallback rules, risk of silent unvalidated values, and an overriding user's mandate to simplify. Evaluate **actual allocation effect** of route complexity; choose smallest auditable workload driver necessary, not maximum physical equipment coverage. Do not prematurely build a large step-charge system unless proving value. Maintain pool conservation and independent auditability. Do not keep legacy and replacement engines both executable post governed cutover; drop obsolete functions, tables, policies, switches, views or code only when safe and separately approved. Preserve historical run snapshots and append-only migration history.

## NEXT ACTION — proceed autonomously, no repeated orientation questions
**G2 minimal architecture and retirement inventory.**
A. Read original mandate `COSTING_END_TO_END_SERVER_CLOSURE_MANDATE_2026-10-19.md`, closure PROGRAMME, IMPLEMENTATION_RULES, ISSUE_REGISTER, DECISIONS and Part3/Part4 handovers. Independently verify latest repo refs.
B. Read-only enumerate all active G4, legacy and route-load database functions/views/tables, grants/RLS, ETL/cron/client references. Trace actual consumer dependency graph including snapshot writers. Classify each KEEP / REPLACE / HARD-RETIRE / HISTORICAL-PRESERVE / PLANNING-ONLY. Document an irreversible-state-safe retirement strategy (snapshot readers retained); do not execute drops.
C. Quantify from frozen run128 the allocation proportions affected by manual 50kg, class charge defaults, step repetitions and named machines; calculate non-intrusive alternative workload scenarios in local/test SQL only, not modifying approved runs.
D. Settle the smallest defensible model and evidence requirements. Base on standard `production_batch_size_ref`; separate fixed operation/charge-based operation/planning throughput if actually necessary. No stage-level data bureaucracy without benefits. CI-032 HIGH remains until production validation.
E. Prepare candidate migration and deterministic tests on isolated PostgreSQL fixtures; exercise user-approved historical comparisons, source traceability, dimensional/unit guard, no stale active path post-retirement, no orphaned consumer; ensure no separate costly client work.
F. Update root docs and `closure/PROGRAMME.md`, `closure/ISSUE_REGISTER.md/.json`, `DECISIONS_AND_OPEN_QUESTIONS.md`, `CHANGELOG.md`, `INDEX.md` after **real** gate progress; never falsely close G2.
G. Submit grouped approval packet before any live migration, object deletion, G4 activation, monthly costing rerun or other production changes. User prefers autonomous handling but explicit governance gate.

## G3–G6 continuation
- G3: 86-SKU DVS-1 review (no wholesale accept), 60% rule transition and sales basis; CI-029 stale rates, CI-003 central/HO overlap, CI-006 landed cost; approved 22 normals, 16 marketing heads require review.
- G4: CI-012 tiered no-backdating prepared (8 forward-only tables, other masters audit only) and CI-034 valuation-date anchoring fix prepared, safe period open/approve/lock/supersede/close, cron job61 then60 controlled restore, effective-date policy.
- G5: efficient approved-only full cost waterfall feed including RM, PM, material conversion, manufacturing and packing labour, prime, production OH, QC, stores and landed cost, COP, admin, finance, internal loaded, regional/national marketing with traceable source and drivers; indexed snapshot performance; no discounts/schemes or price proposals until G6.
- G6: independent audit and access tests including TB4 dashboard, 582-vs-96 migration parity strategy, all approved runs unchanged, cost-pool conservation, 9 negative-margin +37 review outcomes and documented residual blockers. Release only after independent sign-off.

## Workflow communication contract
After each chat turn: (1) do the real available engineering/read-only work, (2) update relevant repository evidence and PROGRAMME in parallel with SHA, (3) give user **brief recap**: Completed, Verified, Open/blocked, Next, Live changes. Prefer repository source to memory or handover assertions. No endless turn-by-turn 'proceed' without implementation; tackle work in useful batches. Do not claim "server complete" until G6 acceptance.

## Branch reading links
- `https://github.com/Brahmadathanu/sasv-workspace-dev/tree/costing/au4-normal-budget/docs/costing-pipeline-independent-audit/`
- PART3 `docs/costing-pipeline-independent-audit/handover/CHATGPT_HANDOVER_2026-10-19_PART3.md`
- PART4 this file.
