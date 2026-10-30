> **30 Oct 2026: start at [README_COSTING_SUITE.md](README_COSTING_SUITE.md) and [STATUS_AND_REMAINING_WORK.md](STATUS_AND_REMAINING_WORK.md).** CURRENT_STATE.md and everything below are dated history.

> **START HERE: [CURRENT_STATE.md](CURRENT_STATE.md)** (verified 24 Oct 2026). Live: run 143 is October's approved run (24 Oct 13:46 IST, superseded run 140 via owner authorisation #10; Mathalam (F) at ₹118/kg); October OPEN, 22 Oct valuation DRAFT; approved feed `costing.v_price_revision_current_approved_master` (old public feed view gone); cron 66/67/68 active, 60/61 gone. CI-033 applied (20261024111733). CI-037 profit chain applied (20261024171314): feed now 79 columns, profit columns empty until the first eligible run. CI-031 prepared, not applied. Everything below this line is dated history.

# Costing pipeline independent audit: index
Updated 19 Oct 2026, 20:20 IST (part-3 handover). The audit branch `docs/costing-pipeline-independent-audit` has its own README (the A0–A11 audit). This index covers the implementation work in PR #72.

## Live state as of 19 Oct (HISTORICAL; see CURRENT_STATE.md)
| Item | State |
|---|---|
| Sep 2026 | LOCKED / 10 Sep LOCKED; run 122 APPROVED; run 119 REFERENCE |
| Oct 2026 | LOCKED / 16 Oct LOCKED; run 128 APPROVED (18 Oct 14:18) |
| Runs 124–127 | SUCCESS, not designated |
| Cron 60 / 61 | paused; 61 is enabled only for an approved run window |
| Latest migration | 20261018110111 au9_r1_capacity_revisions (after 20261018103837 au9_g1_g3_capacity_master; no cost effect) |
| Run 122 fingerprint | ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows (unchanged) |
| Next period | November: needs CF-1 build, lock/reopen functions, capacity confirmation (see backlog) |

## Start here
- **LATEST HANDOVER (part 3, 19 Oct 20:20 IST): everything since 8ec5bee (W1/W5, W2, closure G0/G1, TB1–TB7, P33–P38, LB1, DVS-1 OFF, CI-012/CI-034 prepared, open items):** `archive/CHATGPT_HANDOVER_2026-10-19_PART3.md` (SUPERSEDED; short twin removed 24 Oct). Live state in section B2 there supersedes the table below.
- **Closure live applies:** `closure/TB_LIVE_APPLY_2026-10-19.md` · `closure/LB1_DVS1_LIVE_APPLY_2026-10-19.md` · prepared-not-applied: `closure/CI012_CI034_GUARD_AND_FIX.md`
- **CURRENT PRIORITY: end-to-end server closure (mandate 19 Oct):** `archive/COSTING_END_TO_END_SERVER_CLOSURE_MANDATE_2026-10-19.md` · programme `closure/PROGRAMME.md` · issue register `closure/ISSUE_REGISTER.json` (`.md`) · G0 `closure/G0_BASELINE_2026-10-19.md` · G1 `closure/G1_COST_WATERFALL_RECONCILIATION.md`
- **Handover for the independent auditor:** `archive/CHATGPT_HANDOVER_2026-10-18.md` (SUPERSEDED; short twin removed 24 Oct)
- **Handover part 2 (AU-9 capacity master, R2, G4 live switch OFF, runs/cron/Sheets-feed findings):** `archive/CHATGPT_HANDOVER_2026-10-18_PART2.md` (short: `archive/CHATGPT_HANDOVER_2026-10-18_PART2_SHORT.md`)
- **Repository:** `Brahmadathanu/sasv-workspace-dev` (public), branch `costing/au4-normal-budget` (PR #72, open, not merged). Raw files: `https://raw.githubusercontent.com/Brahmadathanu/sasv-workspace-dev/costing/au4-normal-budget/docs/costing-pipeline-independent-audit/<path>` (verified 18 Oct 22:30 IST for both part-2 handover files at commit 8ec5bee)
- **Consolidation plan (current priority):** `proposals/consolidation/CLIENT_GOVERNED_WORKFLOW_PLAN.md`: client-governed period/run workflow gap table and work packages W1–W5 (plan only)
- **W1 + W5 LIVE (19 Oct 07:15–07:17):** `evidence/W1_W5/W1_W5_LIVE_INSTALL_2026-10-19.md` · parity `evidence/W1_W5/MIGRATION_PARITY_2026-10-19.md`
- **Approved feed contract v1:** `archive/PRICE_REVISION_FEED_CONTRACT_v1.md`
- **W2 LIVE (19 Oct 11:06):** `evidence/W2/W2_LIVE_INSTALL_2026-10-19.md`
- **W2 local build:** `proposals/consolidation/w2/W2_LOCAL_TEST_REPORT.md` + PREPARED_W2 SQL; client branch `costing/w2-period-runs-panel`
- **W2 design:** `proposals/consolidation/W2_GOVERNED_PERIOD_LIFECYCLE_DESIGN.md`
- **W1 + W5 local build:** `proposals/consolidation/w1_w5/W1_W5_LOCAL_TEST_REPORT.md` + PREPARED_W1/W5 SQL; client branch `costing/w1-approved-run-labels`
- **Policies and status:** `POLICY_REGISTER.md`
- **Decisions (dated) and open questions:** `DECISIONS_AND_OPEN_QUESTIONS.md`
- **Changelog:** `CHANGELOG.md`
- **Backlog:** `../master-data-costing/PARKED_BACKLOG.md`

## File map
| Area | Files |
|---|---|
| Directives / sprints (16 Oct) | DIRECTIVE_2026-10-16b.md, SPRINT_2026-10-16c.md |
| AU-4 budget, cost heads, carriage | AU4_NORMAL_BUDGET_PROPOSAL.md, AU4_DECISION_TABLE_v2.md, COST_HEAD_POLICY_LEDGER.md, CARRIAGE_INWARD_AND_DRIVERS.md |
| Run governance, lifecycle, acceptance | AU4_CRON_GUARD_VERIFICATION.md, PERIOD_LIFECYCLE_DESIGN.md, FIRST_APPROVED_RUN_ACCEPTANCE.md, acceptance/, runbooks/ |
| Live log 16 Oct (Sep runs, lock, approval) | AU4_HANDOVER_LOG.md |
| Prices | AU7_PRICE_PROPOSAL_RUN122.md, evidence/AU7/ |
| AU-5 batch-true, October rate quality, default volume, C1 | evidence/AU5/, proposals/au5/, proposals/rate_quality_oct/ |
| AU-6 bundle (default v2, Abhraka, HO admin), run 126 | evidence/AU6/ |
| QC per batch / small-batch + kit RCA | evidence/AU6Q/, evidence/AU6S/ |
| AU-6A exponent package | evidence/AU6A/, archive/PREPARED_au6_combined_package.sql (**SUPERSEDED** 18 Oct 09:06) |
| AU-6L equipment loads, combined v2, runs 127–128, October close | evidence/AU6L/ (applied SQL in evidence/AU6L/live/) |
| Monthly carry-forward policy | POLICY_MONTHLY_CARRY_FORWARD_CF1.md |
| AU-9 seasonality (DVS-1) + machine capacity profiles (PREPARED, not applied) | proposals/au9_seasonality_capacity/ (start: AU9_ARCHITECTURE_AND_MIGRATION_PROPOSAL.md; G1–G3 package PREPARED_AU9_G1_G3_capacity_master.sql + G1_G3_LOCAL_TEST_REPORT.md; live evidence evidence/AU9/; R1 revisions + G4 simulation R1_CAPACITY_REVISIONS_AND_G4_SIMULATION.md; R2 corrections R2_CAPACITY_CORRECTIONS_AND_G4_RESIMULATION.md; R2 live evidence evidence/AU9/AU9_R2_LIVE_APPLY_2026-10-18.md; G4 build + local test G4_PLANT_AWARE_LOADS_BUILD_AND_LOCAL_TEST.md, package PREPARED_AU9_G4_plant_aware_loads.sql; G4 live install (switch OFF) evidence/AU9/AU9_G4_LIVE_INSTALL_SWITCH_OFF_2026-10-18.md) |
| Cron 60/61, run supersession, current-run pointer, Sheets feed gap (read-only findings) + proposed approved-only view (NOT built) | proposals/price_revision_feed/ (RUNS_CRON_AND_SHEETS_FEED_FINDINGS_2026-10-18.md, PROPOSED_v_price_revision_feed_approved.sql) |

## Standing rules for executors
No `supabase db push` / migration repair. Apply only through Supabase MCP `apply_migration` with user approval. Prepared packages stay outside `supabase/migrations`. No merges, tags or releases. No Sheet edits (ChatGPT owns Sheets). Never modify the APPROVED runs 122 and 128. Cron 60 stays paused; job 61 is opened only for an approved window.

## Current authoritative continuation (20 Oct 2026)
- **Binding simplification/hard-retirement decision:** `closure/ARCHITECTURE_SIMPLIFICATION_AND_RETIREMENT_DIRECTIVE_2026-10-20.md`
- **Full next-chat handover:** `archive/CHATGPT_HANDOVER_2026-10-20_PART4_LEAN_ARCHITECTURE.md`
- **Master gate status:** `closure/PROGRAMME.md`; G0 DONE, G1 VERIFIED, G2 OPEN/LEAN RE-DESIGN, G3/G4 OPEN, G5 NOT STARTED, G6 NOT READY.
- Never activate or delete live costing objects merely by reading these docs; require explicit user approval after tests and dependency review.

### Current entrypoint (20 Oct evening)
- Follow `closure/PROGRAMME.md` mobile-first completion checkpoint and `closure/IMPLEMENTATION_RULES.md` §§12–14. Current G2 experimental migration location is a **release blocker**; read `closure/TECHNICAL_BATCH.md` for the existing isolated PostgreSQL fixture approach. A **new** authorised refresh provides integration proof only after independent approval-security tests. Costing Sheets remain frozen pending G6; separate non-costing DB-to-Sheets activity needs separate scope. No live writes authorised.

### Production deployment checkpoint — 20 October 2026
- CI-034 and CI-012 are now **LIVE**, migrations `20261020162105` and `20261020162117`; postchecks PASS. See `closure/PROGRAMME.md` for precise results, and `closure/evidence/CI012/` for byte-identical applied SQL copies. Earlier TB1–TB7, LB1, and DVS1 OFF already live. Held G2 still NOT DEPLOYED, the large audit branch still NOT MERGED, full costing refresh NOT EXECUTED, Sheets integration BLOCKED.


- [21 Oct 2026 — Bounded G2 current-release closure](closure/G2_BOUNDED_RELEASE_CLOSURE_2026-10-21.md): numerical/physical G2 PASS, prospective attestation future hardening; G6 and Sheets remain on hold.


- [G6 final owner approval — run136](closure/G6_FINAL_OWNER_ACCEPTANCE_RUN136_2026-10-21.md): governed supersession verified, audit17, server release closed; Sheets awaiting owner requirements.
