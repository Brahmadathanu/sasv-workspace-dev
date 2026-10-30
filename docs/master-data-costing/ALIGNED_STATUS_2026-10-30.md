# Costing suite — aligned status (30 Oct 2026, 20:00 IST)

Checked read-only: repo main `008fc26` (PR #100 merge) and production `qhmoqtxpeasamtlxaoak` (SELECT only, 30 Oct). Where an older document disagrees, this note wins until it is replaced.

## Live baseline
| Item | State |
|---|---|
| Server | Redesign v2 live (CI-038–CI-043, CI-045). CI-046 owner-only locking (20261029152138) and CI-047 grant tidy (20261029152614) applied 29 Oct; latest costing migration is CI-047. H09 baseline `ec82e4a5a8914eb240d0c038f3776564` (not re-hashed today) |
| Client | PR #99 approval screen (`COSTING_APPROVAL_SCREEN_V1`) and PR #100 Refresh with date (`COSTING_RECALC_WITH_DATE_V1`) merged, both **OFF** by default. `public/sw.js` = `hub-cache-v377` |
| Runs | 119 REFERENCE; 122 Sept APPROVED, Sept locked; 143 Oct APPROVED, official date 22 Oct; 147 Oct FAILED (data: packing BOM not in force on 22 Oct for SKUs 41, 846, 105) |
| Months | October OPEN; October readiness snapshot stale by design (rebuild after finalise) |
| Jobs | 66 weekly (Mon 02:00 IST), 67 month-end (cron `30 20 28-31 * *` UTC; acts on the 1st 02:00 IST), 68 stage processor every 5 min; all active. Jobs 60/61 do not exist |
| Not authorised | CI-049 month-ended lock guard (drafted); CI-048 health-check log/alerts (design); CI-044 parked |
| Who builds | Server: costing assistant with the owner's written approval per live write. Client: **Codex**, Phase A plan → Phase B after the owner's written authorisation. e-Aushadhi: Jarvis |

## (a) Server functions with no client screen, or a screen that is obsolete
All routes below exist live and the logged-in role may call them (checked 30 Oct). "Client use" = grep of `public/` excluding tests.

| Route / view | Client use | Verdict |
|---|---|---|
| `rpc_costing_lock_periods_for_close`, `rpc_costing_lock_period` | Only listed in `FORBIDDEN_RPCS` (`costing-approval-screen.js:37-38`) | **Not surfaced** → lock screen package (Phase A ready) |
| `rpc_costing_health_check` | Only in `FORBIDDEN_RPCS` (`costing-approval-screen.js:39`) | **Not surfaced** |
| `rpc_get_regional_marketing_evidence_review_queue`, `rpc_get_regional_marketing_action_queue`, `rpc_accept_regional_marketing_review` | none | **Not surfaced** (UX-P01 / CW-11) |
| `rpc_costing_reopen_period`, `rpc_costing_close_period`, `rpc_costing_open_next_period`, `rpc_costing_period_governance_context`, `rpc_costing_preflight_run` | none | **Not surfaced**; reopen/close are governance actions, not yet asked for |
| Readiness rebuild `costing.fn_wp04_build_readiness_portfolio` | none; no `public` route exists | **Not surfaced**; a button needs a new server route (owner role only today) |
| `rpc_costing_finalize_monthend_run_with_preview` | `costing-approval-screen.js:28,625` | **Surfaced** (PR #99, flag OFF; walkthrough pending) |
| `rpc_costing_request_recalculation` | `costing-recalculation.js:6` | **Surfaced** (PR #100, flag OFF) |
| `rpc_request_costing_refresh` (legacy toolbar Refresh) | `costing-suite-shell.js:2678` | **Surfaced, obsolete when PR #100 flag is on**; still the path with flag off (copies the stored date) |
| `rpc_set_cost_period_valuation_date` (old change-date tab) | `costing-suite-cost-period-valuation-helpers.js:12` | **Surfaced, obsolete**: moves only the legacy stored date; hidden only while `COSTING_RECALC_WITH_DATE_V1` is on |
| `v_costing_pricing_dashboard_summary` | `costing-suite-shell.js:2428` (source map entry) | **Dead reference** (CCC-P03 / CW-14); view drop is a later gated server change |
| Closed old routes (`rpc_costing_approve_run`, `..._supersede_approved_run`, `..._finalize_monthend_run`, `..._authorise_supersession`) | only `FORBIDDEN_RPCS` | Correct: refused by server (`W2_USE_NEW_APPROVAL_ROUTE`) |

## (b) Refresh / recalculation path — what is still not programmed
| # | Step | Status | Evidence |
|---|---|---|---|
| 1 | Request a draft with a chosen date | COVERED (flag OFF) | `costing-recalculation.js:6`; PR #100 |
| 2 | Live progress while the request runs | COVERED (legacy toolbar) | stage labels `costing-suite-shell.js:907`, status poll `rpc_get_costing_refresh_status` `:2695` |
| 3 | Last run state for the open month | COVERED (status word only) | `costing-suite-control-center.js:952` `latest_refresh_status` |
| 4 | Failure reason after the page is reloaded / for an old run like 147 | **CONFIRMED GAP** | reason shown only in the live poll text (`costing-suite-shell.js:2804`); `v_costing_pricing_run_display_status` has no error columns |
| 5 | Plain-language failure (e.g. "no packing BOM in force on 22 Oct for SKUs 41, 846, 105") | **CONFIRMED GAP** | client prints raw `error_stage_code` + `error_message` (`:2802-2805`); no mapper |
| 6 | Retry / cancel / hide a failed draft | **CONFIRMED GAP — server first** | no public cancel/hide route for costing runs; would need a CI-0xx |
| 7 | Readiness snapshot stale (`READINESS_BUILD_STALE`) explanation | **CONFIRMED GAP** (no client handling of the code; server text shown as-is, exact display UNKNOWN) | grep finds no `READINESS_BUILD` in `public/` |
| 8 | Readiness rebuild button | **CONFIRMED GAP — server first** | only `costing.fn_wp04_build_readiness_portfolio`, no public route |
| 9 | Preview → approve / month-end finalise | COVERED (flag OFF, not walked through) | `costing-approval-screen.js:26-28` |
| 10 | Lock after approval | **CONFIRMED GAP** → lock screen | no client caller |
| 11 | Health check view | **CONFIRMED GAP** | no client caller |
| 12 | "Month not ended" lock guard | **server gap** (CI-049 drafted) | — |

## (c) Next client packages, by value
| Rank | Package | Flag | Routes | Server change? | Risk / dependency |
|---|---|---|---|---|---|
| 1 | **Lock screen** (Phase 2) | `COSTING_LOCK_SCREEN_V1` | `rpc_costing_lock_periods_for_close`, `rpc_costing_lock_period`, `v_costing_pricing_period_run_status` | No; CI-049 strongly advised before use on an open month | Cache v378; e-Aushadhi pinned scripts via Jarvis. **Phase A ready** |
| 2 | **Run status & failed-run explanation** (read-only) | `COSTING_RUN_STATUS_V1` | `rpc_get_costing_refresh_status`, `v_costing_pricing_run_display_status`, `rpc_costing_health_check` | No for display; retry/cancel/hide later needs a CI | Plain mapping of known failure codes; no write. Closes gaps 4, 5, 7 (text), 11 |
| 3 | **Regional marketing review screen** | `COSTING_REGIONAL_REVIEW_V1` | the 3 regional RPCs | No | Acceptance is a live write by users; owner sign-off on who accepts |
| 4 | WP11 UX items (labels, sorting, dialogs, narrow screens) + CW-14 dead reference | per item | none new | No (view drop later, gated) | Low risk, many small PRs |

Not recommended yet: a separate month-end finalise screen (already inside PR #99), and readiness rebuild / retry buttons (need server routes first).

## Owner decisions open
CI-049; CI-048; October readiness rebuild timing; CSE-P01; WP10 block-or-warn; PERF-P01; plant capacity data for 74 machines; WP05 acceptance; push/merge of PR #98.
