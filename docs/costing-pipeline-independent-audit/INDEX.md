# Costing pipeline independent audit: index and current state (branch costing/au4-normal-budget)
Updated 18 Oct 2026, 15:45 IST. The audit branch `docs/costing-pipeline-independent-audit` has its own README (the A0–A11 audit). This index covers the implementation work in PR #72.

## Current live state
| Item | State |
|---|---|
| Sep 2026 | LOCKED / 10 Sep LOCKED; run 122 APPROVED; run 119 REFERENCE |
| Oct 2026 | LOCKED / 16 Oct LOCKED; run 128 APPROVED (18 Oct 14:18) |
| Runs 124–127 | SUCCESS, not designated |
| Cron 60 / 61 | paused; 61 is enabled only for an approved run window |
| Latest migration | 20261018044644 au6_combined_v2 |
| Run 122 fingerprint | ccb9c7072fc386ed13fbbbe6e4d8ab6b, 353,819 rows (unchanged) |
| Next period | November: needs CF-1 build, lock/reopen functions, capacity confirmation (see backlog) |

## Start here
- **Handover for the independent auditor:** `handover/CHATGPT_HANDOVER_2026-10-18.md` (short: `_SHORT.md`)
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
| AU-9 seasonality (DVS-1) + machine capacity profiles (PREPARED, not applied) | proposals/au9_seasonality_capacity/ (start: AU9_ARCHITECTURE_AND_MIGRATION_PROPOSAL.md; G1–G3 package PREPARED_AU9_G1_G3_capacity_master.sql + G1_G3_LOCAL_TEST_REPORT.md) |

## Standing rules for executors
No `supabase db push` / migration repair. Apply only through Supabase MCP `apply_migration` with user approval. Prepared packages stay outside `supabase/migrations`. No merges, tags or releases. No Sheet edits (ChatGPT owns Sheets). Never modify the APPROVED runs 122 and 128. Cron 60 stays paused; job 61 is opened only for an approved window.
