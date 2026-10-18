# Cron pause/restore runbook (jobs 60, 61 only). Status: READY, NOT EXECUTED.
Captured 2026-10-16: 60 `30 20 * * *` (02:00 IST) active; 61 `*/5 * * * *` active. In-flight check: none at capture.
Order: capture → pre-check (no QUEUED/RUNNING/PENDING) → pause both in one guarded block → post-checks (both inactive; other jobs' active count unchanged). Restore: alter_job back to captured active values; schedule/command never altered. Pause is safe: 60 currently creates nothing (no Oct period); 61 idles. Pausing 61 mid-run is prevented by the in-flight guard.
