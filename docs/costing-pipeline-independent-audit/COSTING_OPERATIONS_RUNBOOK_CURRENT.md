# Costing operations runbook — current (redesign v2.2)

Checked against production read-only on 27 Oct 2026 (function definitions and signatures). Replaces the [historical first-governed-run runbook](runbooks/HISTORICAL_FIRST_GOVERNED_CLIENT_RUN_RUNBOOK_2026-10.md). Background: [COSTING_REDESIGN_V2_CURRENT_STATE.md](COSTING_REDESIGN_V2_CURRENT_STATE.md).

> **Every step except the health check is a production action.** Refresh, preview, approve, finalise and lock each write to production and need the owner's explicit approval text first. Approval/month-end finalise (PR #99, flag `COSTING_APPROVAL_SCREEN_V1`) and recalculation with a date (PR #100, flag `COSTING_RECALC_WITH_DATE_V1`) now have screens, both OFF by default and not yet walked through in production; lock has no screen yet (next Codex package). Until a screen is switched on and walked through, these actions are done inside the owner's own logged-in session (the server records who acted). Nothing here is to be run by an assistant without that approval.

## Order
Refresh → Preview → Approve (or Month-end finalise) → Lock (only before a formal close) → Health check.

## 1. Refresh (request a draft)
- **Purpose:** cost a new draft run for an OPEN month. A draft is never used for pricing until approved.
- **Who:** a logged-in user with costing edit permission (`module:costing-control-center`).
- **Route:** `rpc_costing_request_recalculation(p_period_start date, p_reason text, p_valuation_date date default null)`.
- **Server enforces:** reason ≥ 10 characters; month OPEN with stored-date status DRAFT; date inside the month and not after today (India date); date not earlier than the approved run's date (`W2_RUN_DATE_BEFORE_APPROVED`); refuses if a run is already queued/running (`W2_ACTIVE_RUN`). Empty date = today (India date), or the month end for a past month.
- **Afterwards:** note the `refresh_run_id` and `valuation_date` returned; wait for job 68 to finish the run (status SUCCESS in `public.v_costing_pricing_run_display_status`).
- Scheduled drafts (weekly Monday, month-end on the 1st) need no action; see current-state §5.
- **Do not** use the legacy toolbar Refresh (`rpc_request_costing_refresh`) expecting today's date: it copies the month's stored date (October: 22 Oct).

## 2. Preview
- **Purpose:** show the impact (SKU changes, staleness, cutoff messages) and issue an acknowledgement.
- **Who:** the person who will approve, logged in.
- **Route:** `rpc_costing_preview_approval_impact(p_refresh_run_id bigint)`.
- **Server enforces:** login required; **writes a preview acknowledgement row valid 15 minutes** (`approval_preview_ack_ttl_minutes`).
- **Afterwards:** read the result; keep its `preview_ack_id`.
- **Do not** open a preview on production for testing or from dev/test tools; only in the owner's authorised session.

## 3. Approve
- **Purpose:** make the run the month's approved run (supersedes the current approved run in the same step; the old one stays stored as Superseded).
- **Who:** owner only (server checks).
- **Route:** `rpc_costing_approve_run_with_preview(p_refresh_run_id bigint, p_reason text, p_approval_reference text, p_preview_ack_id bigint, p_acknowledge_stale boolean default false)`.
- **Server enforces:** run checks pass; acknowledgement belongs to this run, was opened by the same user, unused, not expired; nothing changed since the preview (`W2_PREVIEW_OUTDATED`); stale draft needs `p_acknowledge_stale = true`.
- **Afterwards:** `official_valuation_date` in `public.v_costing_pricing_period_run_status` equals the run's date; `pricing_use_label` names the new run; run health check.

## 4. Month-end finalise
- **Purpose:** approve the month-end run of a finished month. It does **not** lock.
- **Who:** owner only.
- **Route:** `rpc_costing_finalize_monthend_run_with_preview(` same five parameters as approve `)`, after a preview of that run.
- **Server enforces:** month OPEN/DRAFT; today (India date) is after the month end (`MONTHEND_PERIOD_NOT_FINISHED`); the run's own date equals the month's last day (`MONTHEND_VALUATION_DATE_MISMATCH`); all approve checks. If the run is already approved it reports `already_approved`.
- **Afterwards:** as for approve. Result says "Not locked: lock only before formal Close".

## 5. Lock (separate decision, normally at quarter close)
- **Purpose:** freeze the month's state before a formal close. Changes the lock state only; no date or run changes.
- **Who:** owner only (server checks since CI-046, 29 Oct; `W2_OWNER_ONLY`), plus costing edit permission.
- **Routes:** `rpc_costing_lock_period(p_period_start date, p_reason text, p_approval_reference text)`; quarter batch `rpc_costing_lock_periods_for_close(p_period_starts date[], p_reason text, p_approval_reference text)` (all-or-nothing, one calendar quarter, first-of-month dates).
- **Server enforces:** month OPEN; an approved run exists; no queued/running run; approved run's fingerprint has no drift.
- **Afterwards:** `period_status` LOCKED; official date unchanged. Note: a locked month gets no more scheduled drafts.

## 6. Health check (read-only)
- **Route:** `rpc_costing_health_check()` — returns severity (ERROR/WARN/INFO), check code, month, run, detail. Writes nothing; not scheduled; sends no alerts.
- **Who:** logged-in user with costing view permission.
- **Afterwards:** any ERROR → stop and investigate; WARN → note in status.

## Do not
- Do not use job 61 (it no longer exists) or pause/alter cron jobs 66/67/68.
- Do not move the stored month date (`rpc_set_cost_period_valuation_date`); it does not change the official date.
- Do not call `rpc_costing_approve_run`, `rpc_costing_finalize_monthend_run` or `rpc_costing_supersede_approved_run`: they refuse with `W2_USE_NEW_APPROVAL_ROUTE`.
- Do not open previews against production except in the owner's authorised session (each creates a 15-minute acknowledgement row).
- Do not change approved history (runs 119/122/143) or bypass the June–August governance reconciliation.

## October 2026 specifics
See [MONTH_END_APPROVAL_RUNBOOK.md](MONTH_END_APPROVAL_RUNBOOK.md): run 143 approved (22 Oct); expected month-end draft created Sun 1 Nov 02:00 IST dated 31 Oct; approval of it only after review and the owner's approval.

## Legacy screen boundaries
See [current-state §9](COSTING_REDESIGN_V2_CURRENT_STATE.md): today's Refresh button copies the stored date; the valuation-date panel must not be used; there are no approve/finalise/lock buttons yet (planned behind `COSTING_APPROVAL_SCREEN_V1` and `costingRecalcWithDateV1`, both off by default).
