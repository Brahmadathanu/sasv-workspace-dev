# Costing suite — status and remaining work (updated 30 Oct 2026, 20:00 IST)

> **30 Oct 2026:** PR #100 Refresh with date merged (main `008fc26`, flag `COSTING_RECALC_WITH_DATE_V1` OFF, cache `hub-cache-v377`). Client builder is now **Codex** (was Cursor). Lock screen (`COSTING_LOCK_SCREEN_V1`, cache v378) Phase A request ready. CI-049 month-ended lock guard drafted, not authorised. Run 147 (October, 22 Oct) FAILED: packing BOM not in force on 22 Oct for SKUs 41, 846, 105; harmless draft. October readiness snapshot is stale by design (rebuild after finalise). Full gap list: [../master-data-costing/ALIGNED_STATUS_2026-10-30.md](../master-data-costing/ALIGNED_STATUS_2026-10-30.md).

Estimates are the assistant's estimates, not commitments.

| State | Item |
|---|---|
| **Done / live** | CI-038, CI-038a, CI-039 (26 Oct); CI-040 v2.1, CI-041 v2.1, CI-045, CI-042 v2.2, CI-043 v2.2 rev B (27 Oct); **CI-046 owner-only locking (29 Oct 20:51 IST, v20261029152138) and CI-047 PUBLIC-execute tidy-up of 37 costing functions (29 Oct 20:56 IST, v20261029152614)**. PR #99 approval screen Phase 1 merged (main e2c5fde, flag OFF). Run 143 October approved (22 Oct). September locked (run 122). |
| **Prepared (docs)** | Draft PR #98: current state, current runbook, October month-end runbook, decision log, migration reconciliation, grant audit, README. Approval screen shipped (PR #99); Refresh with date shipped (PR #100); lock-screen brief updated 30 Oct. |
| **Open, needs owner decision** | Merge PR #98. Health-check schedule and alerts. Back-dating cutoff warning. Grant tidy-up of the 47 readable relations and default privileges (the 37 functions are done by CI-047). CI-048 health-check log + alert channel (design ready). June–August governance reconciliation (no approved runs). Migration-history housekeeping (18/73 gap). CI-044 (parked). |
| **Waiting** | Codex Phase A plan for the Phase 2 lock screen (brief updated 30 Oct). CI-049 owner decision. First production walkthrough of the approval screen (owner session). |

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
