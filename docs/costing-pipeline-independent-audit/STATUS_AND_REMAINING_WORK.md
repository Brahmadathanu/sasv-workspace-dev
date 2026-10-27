# Costing suite — status and remaining work (27 Oct 2026, 23:30 IST)

Estimates are the assistant's estimates, not commitments.

| State | Item |
|---|---|
| **Done / live** | CI-038, CI-038a, CI-039 (26 Oct); CI-040 v2.1, CI-041 v2.1, CI-045, CI-042 v2.2, CI-043 v2.2 rev B (27 Oct). Run 143 October approved (22 Oct). September locked (run 122). |
| **Prepared (docs)** | Draft PR #98: current state, current runbook, October month-end runbook, decision log, migration reconciliation, grant audit, README. Cursor briefs: approval screen (revision pending), Refresh and date labels. |
| **Open, needs owner decision** | Merge PR #98. Health-check schedule and alerts. Back-dating cutoff warning. Grant tidy-up (11 trigger + 26 helper functions, 47 readable relations). June–August governance reconciliation (no approved runs). Migration-history housekeeping (18/73 gap). CI-044 (parked). |
| **Waiting** | Cursor approval-screen plan revision (owner pastes the six-point message, plan mode). Then the Refresh and date-labels plan. |

## Verification plan
**Sun 1 Nov, after 02:00 IST** (read-only)
- Job 67 ran at 02:00 IST (31 Oct 20:30 UTC) and created the October month-end draft **dated 31 Oct**, source `CRON_SCHEDULED`; job 68 finished it.
- Run 143 still APPROVED; October official date still 22 Oct; stored date 22 Oct.
- Combined fingerprint 119/122/143 = `3e5515ed97189b747ea3a8d18c3f4411`.
- SKUs 41 and 846 present with expected policies.
- Health check: no ERROR.

**Mon 2 Nov, after 02:00 IST** (read-only)
- Job 66 created the November period (if needed) and a November draft **dated 2 Nov**; no October catch-up (because 1 Nov produced it).
- The `JOB_RECENT_FAILURE` WARN for job 66 (26 Oct failure, audit source `CRON_SCHEDULED`, fixed by CI-039) has aged out of the 7-day window.
- Nothing else changed in approved history.

## Rough effort (estimates)
Approval screen: plan review 1 session, build 1–2 sessions after approval. Refresh/date labels: similar. Grant tidy-up: 1 session plus isolation test.
