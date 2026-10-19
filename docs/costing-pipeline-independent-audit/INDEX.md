# Costing pipeline independent audit: index and current state (branch costing/au4-normal-budget)
Updated 18 Oct 2026, 16:35 IST. The audit branch `docs/costing-pipeline-independent-audit` has its own README (the A0–A11 audit). This index covers the implementation work in PR #72.

## Current live state
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
- **Handover for the independent auditor:** `handover/CHATGPT_HANDOVER_2026-10-18.md` (short: `_SHORT.md`)
- **Handover part 2 (AU-9 capacity master, R2, G4 live switch OFF, runs/cron/Sheets-feed findings):** `handover/CHATGPT_HANDOVER_2026-10-18_PART2.md` (short: `_PART2_SHORT.md`)
- **Repository:** `Brahmadathanu/sasv-workspace-dev` (public), branch `costing/au4-normal-budget` (PR #72, open, not merged). Raw files: `https://raw.githubusercontent.com/Brahmadathanu/sasv-workspace-dev/costing/au4-normal-budget/docs/costing-pipeline-independent-audit/<path>` (verified 18 Oct 22:30 IST for both part-2 handover files at commit 8ec5bee)
- **Consolidation plan (current priority):** `proposals/consolidation/CLIENT_GOVERNED_WORKFLOW_PLAN.md`: client-governed period/run workflow gap table and work packages W1–W5 (plan only)
- **W1 + W5 LIVE (19 Oct 07:15–07:17):** `evidence/W1_W5/W1_W5_LIVE_INSTALL_2026-10-19.md` · parity `evidence/W1_W5/MIGRATION_PARITY_2026-10-19.md`
- **Approved feed contract v1:** `contracts/PRICE_REVISION_FEED_CONTRACT_v1.md`
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
| AU-6A exponent package | evidence/AU6A/, proposals/au6_combined/PREPARED_au6_combined_package.sql (**SUPERSEDED** 18 Oct 09:06) |
| AU-6L equipment loads, combined v2, runs 127–128, October close | evidence/AU6L/ (applied SQL in evidence/AU6L/live/) |
| Monthly carry-forward policy | POLICY_MONTHLY_CARRY_FORWARD_CF1.md |
| AU-9 seasonality (DVS-1) + machine capacity profiles (PREPARED, not applied) | proposals/au9_seasonality_capacity/ (start: AU9_ARCHITECTURE_AND_MIGRATION_PROPOSAL.md; G1–G3 package PREPARED_AU9_G1_G3_capacity_master.sql + G1_G3_LOCAL_TEST_REPORT.md; live evidence evidence/AU9/; R1 revisions + G4 simulation R1_CAPACITY_REVISIONS_AND_G4_SIMULATION.md; R2 corrections R2_CAPACITY_CORRECTIONS_AND_G4_RESIMULATION.md; R2 live evidence evidence/AU9/AU9_R2_LIVE_APPLY_2026-10-18.md; G4 build + local test G4_PLANT_AWARE_LOADS_BUILD_AND_LOCAL_TEST.md, package PREPARED_AU9_G4_plant_aware_loads.sql; G4 live install (switch OFF) evidence/AU9/AU9_G4_LIVE_INSTALL_SWITCH_OFF_2026-10-18.md) |
| Cron 60/61, run supersession, current-run pointer, Sheets feed gap (read-only findings) + proposed approved-only view (NOT built) | proposals/price_revision_feed/ (RUNS_CRON_AND_SHEETS_FEED_FINDINGS_2026-10-18.md, PROPOSED_v_price_revision_feed_approved.sql) |

## Standing rules for executors
No `supabase db push` / migration repair. Apply only through Supabase MCP `apply_migration` with user approval. Prepared packages stay outside `supabase/migrations`. No merges, tags or releases. No Sheet edits (ChatGPT owns Sheets). Never modify the APPROVED runs 122 and 128. Cron 60 stays paused; job 61 is opened only for an approved window.
