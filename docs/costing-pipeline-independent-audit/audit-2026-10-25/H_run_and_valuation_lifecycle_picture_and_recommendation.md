# H: How runs, valuation dates, scheduled jobs and guards work, and how to improve them
Prepared 26 Oct 2026 (IST). Read-only. Based on review G (live function bodies) and a live check today: job 66 is active, job 67 is paused, job 68 is active. Job 66's last run on 26 Oct at 02:00 IST failed. The run table already stores each run's own valuation date.

## 1. A correction first
I said earlier that the scheduler "skips an approved month quietly". **That was wrong.** Here is what the live system actually does:
- The weekly job tries to move the month's valuation date and start a run.
- A guard (AU2) sees that the month already has an approved run and **throws an error**.
- Everything rolls back, and the job is recorded as FAILED.
- The result is that no current-data draft gets produced for the rest of that month.

The design document said "skip". The live code errors instead. Neither of these does what you want, which is to keep producing weekly drafts.

## 2. The picture as it is today

### Run lifecycle
| Step | What happens | Who |
|---|---|---|
| Requested | A run is created, and it copies the month's valuation date at that moment | Scheduler or a person |
| Queued, then running | Job 68 processes it stage by stage (materials, then cost build, then cost sheet, then controls, then final snapshot) | Automatic |
| Draft (complete) | The figures are available to review | n/a |
| Approved | Becomes the month's official figures. It can never be edited, and it is fingerprinted | Finance approver |
| Revoked or superseded | Replaced by a newer approved run, only with a recorded, single-use authorisation that expires after 120 minutes | Owner plus approver |
| Reference | A fixed benchmark run (run 119) | n/a |

### Valuation date lifecycle
- **Meaning today:** this is the "cost as of" date. Rates, BOMs, policies and other master data are read as they stood on this date.
- **Where it lives:** the month (period) holds one date, and every run copies it when it is requested.
- **Created:** when the month is first opened. The default is the day the month is opened.
- **Changed:** by the scheduler (moved to the run date every week), or by a person with a reason. This only works while the month is OPEN and no run is in progress.
- **Frozen:** once a run is approved, nobody can enter master data dated on or before that run's date. This back-dating guard covers about 45 policy tables.
- **Period states:** OPEN, then LOCKED (can be reopened), then CLOSED (final, never reopened).

### Scheduled jobs
| Job | When (IST) | What it does | Today |
|---|---|---|---|
| 66 weekly draft | Mondays 02:00 | Moves this month's date to today, then requests a full run. Opens the month if it doesn't exist yet | Active. Failed 26 Oct (audit-label bug) |
| 67 month-end draft | Fires on 29, 30, 31 and the 1st, but acts only on the 1st | Moves last month's date to the month end, then requests a run | **Paused** (until the fix is in) |
| 68 processor | Frequently | Processes queued runs | Active, healthy |

### Guards already in place
| Guard | What it protects |
|---|---|
| Approved-run immutability (AU2 trigger) | An approved run's header can't change, and no new run can start in that month without an authorisation |
| Fingerprints | Proves that an approved run's stored rows haven't changed |
| Supersession authorisation | Replacing approved figures needs a recorded reason. It is single-use and expires after 120 minutes |
| Back-dating guard | Nobody can enter master data dated inside an approved or locked window |
| Period states | LOCKED adds a second key, and CLOSED is final |
| Scheduler checks | No double run, no run while another is in progress, stops after an unresolved failure, no backdating |
| SKU activation guard (CI-038, new today) | A SKU can't be made active unless its five costing essentials are in place |

## 3. The problems in plain words
1. **The scheduler errors in every approved month** and produces no current-cost drafts after approval. That is the opposite of what you want.
2. **One date per month is doing two jobs.** It is both "the date of the official figures" and "the date the latest draft is costed at". That is why a weekly draft can't run without seeming to move the approved date.
3. **Failures are silent.** The 26 Oct failure was noticed by chance, and nothing alerts anyone.
4. **An audit-label bug** (CRON_SCHEDULED isn't on the allowed list) breaks every scheduled run, including the one on Mon 2 Nov.
5. **If the 1st falls on a Monday,** the new month waits a week to be opened.

## 4. Recommendation: two lanes
Keep the official figures exactly as they are (immutable, fingerprinted, approved by a person). Add a separate working lane that never competes with them.

| | Official lane | Working (monitoring) lane |
|---|---|---|
| Purpose | Prices and Finance use these figures | Shows what costs are *today* |
| Runs | One approved run per month | Weekly drafts, all through the month, including after approval |
| Valuation date | Fixed when approved | Each run's own date (its run date). It does not move the month's date |
| Can be approved? | Yes | Only if a person promotes it under the existing supersession rules |
| Label on screens | "APPROVED – official" | "WORKING DRAFT – not for pricing" |

**What the valuation date should mean:** it belongs to each **run**, as its cost-as-of date. The month keeps only "the approved date", which is simply the date of its approved run. The run table already stores its own date, so this is a modest change rather than a redesign.

**Drift report:** each weekly working run compares itself with the approved run. Per SKU it shows the cost change, the margin change and what caused it (rate, BOM, policy). The approver then sees "what would change if we re-ran today", and can decide whether superseding is worth it.

**How approval picks a run:** the approver picks one completed draft, normally the latest, and approves it. The system never approves anything on its own.

**Lock:** not needed monthly, because approval already freezes the figures. Use LOCK and CLOSE only at quarter or year end, or for audit sign-off, and do them in batches.

**Old open months (Mar, Jun, Jul, Aug):** leave them open and label them "historical draft, not used for pricing". Nothing reads them and nothing blocks on them.

**Automatic rollover:** on the 1st, open the new month and make the month-end draft for the old month. If the old month is already approved, make a working draft instead.

**Health check:** a daily check confirms that the jobs ran and that no failed scheduled run is waiting. On failure it raises a red banner on the costing home page, and later a message. It also flags a month that is still not approved by the Nth day.

## 5. A month in the life (target design)
| When | What happens | Who | Manual clicks |
|---|---|---|---|
| 1st, 02:00 | New month opened. Last month's month-end draft is made (a working draft if the month is already approved) | Automatic | 0 |
| Every Monday | Weekly working draft at the current date, plus a drift report | Automatic | 0 |
| Daily | Health check, with a banner if anything failed | Automatic | 0 |
| About days 3–7 | Reviewer reads the latest month-end draft and its controls | Costing reviewer | Review |
| Same | Approve the chosen run (a different person from the one who prepared it) | Finance approver | 1 |
| Rest of month | Weekly working drafts continue. The drift report shows any change that matters | Automatic | 0 |
| Only if needed | Supersede: give a reason and authorise, then the new run, then approve | Owner plus approver | 3 |
| Quarter or year end | Lock and close the approved months in a batch | Finance | 1 per batch |

## 6. Manual steps that must stay manual
| Step | Why it stays manual |
|---|---|
| Approving a month's figures | It is a financial sign-off. It needs a named person and separation of duties |
| Superseding approved figures | It changes official numbers, so it needs a reason, an audit trail and a second person |
| Closing a period | It is final and irreversible |
| Changing a valuation date by hand | It is rare and changes the basis of the figures, so it needs a reason |
| Fixing data the guards reject | Needs human judgement (BOM, rates, SKU essentials) |

Everything else can be automatic: opening months, drafts, rollover, drift reports and health checks.

## 7. Phased path (approved-run immutability is unchanged in every phase)
| Phase | What | Risk | Rollback |
|---|---|---|---|
| **1. CI-039, before Mon 2 Nov** | Add the CRON_SCHEDULED label. In an approved month, return a clear "approved, skipped" status instead of erroring. Handle a Monday-the-1st. Then resume job 67 | Low. It changes only the scheduler function and one allowed value | Restore the previous function body and constraint |
| **2. Health check, November** | Daily job status check plus a banner on the costing home page | Very low. Read-only | Drop the job and view |
| **3. Working lane, November–December** | Add a run purpose (OFFICIAL or WORKING). Working runs use their own date and never move the month's date. AU2 lets working runs through but never lets them be designated without supersession. The scheduler makes working runs in approved months | Medium. Touches the AU2 trigger and the designation rules. Needs a full regression and a local test first | Disable working-run creation. Existing runs stay as inert drafts |
| **4. Drift report and screen, after Phase 3** | Approved run vs latest working run, per SKU, built into the approval and period screens (Cursor) | Low | Hide the screen |
| **5. Lock policy, any time** | Document: approval = frozen; lock and close at quarter end | None. No code | n/a |

Phase 1 alone stops the failures, but it still produces **no drafts after approval**. Your requirement is met only by Phase 3. Phase 1 is the safe stopgap so that the 2 Nov run works.

## 8. Trade-offs and unknowns
- **Storage and load:** working runs add about 4–5 full runs a month. Storage and job 68 load still need sizing (not measured).
- **Back-dating guard:** it stays tied to approved runs only. Working runs must not advance the frozen-through date (this needs design care).
- **Unverified:** the scheduler's behaviour after the fix is reasoned from the code, not executed. Job 68's handling of a scheduled November run is untested. The drift report's cost is not estimated. The run-119 sales-allocation fingerprint drift existed before today's changes and remains open.
