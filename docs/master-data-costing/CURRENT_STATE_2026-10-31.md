# Costing suite and master-data costing: current state (31 Oct 2026)

**This is the single "where are we now" page as of 31 Oct 2026, 23:30 IST.** Where an older document disagrees with this page, this page wins. The list of remaining work is in [REMAINING_WORK_2026-10-31.md](REMAINING_WORK_2026-10-31.md).

Sources checked for this page: GitHub `main` at `9ea163d` (code and `public/sw.js`), the production database migration list (project `qhmoqtxpeasamtlxaoak`, read-only), and the costing decision log entries A1 to A29.

## 1. Code on main
- `main` = `9ea163d61da2e4e8b7fa81d13ace1c6b32dba00e` (PR #106). App cache name: `hub-cache-v383`. The next free cache number is v384.
- Costing pull requests merged, oldest first:

| PR | What it added | Merge commit | Switch (flag) |
|---|---|---|---|
| #99 | Run approval screen, Phase 1 | `e2c5fde` | `COSTING_APPROVAL_SCREEN_V1` |
| #100 | "Refresh with date" (recalculate a month as of a chosen date) | `008fc26` | `COSTING_RECALC_WITH_DATE_V1` |
| #101 | Period lock screen (quarter "Close period") | `86e6caf` (cache v378) | `COSTING_LOCK_SCREEN_V1` |
| #102 | Run status screen (read-only) | `6d28f21` (cache v379) | `COSTING_RUN_STATUS_V1` |
| #103 | Polish for the lock and run-status screens | `cd5b33d` (cache v380) | same flags |
| #104 | Plain, consistent labels; removed the dead old-dashboard reference | `f23427d` (cache v381) | `COSTING_UX_CONSISTENCY_V1` |
| #105 | Proper confirm dialog when a Family submit has a duplicate sequence (CW-06 item 1) | `1c505ed` (cache v382) | `COSTING_DIALOGS_V1` |
| #106 | Sortable columns, safer CSV export and column hints on the SKU cost sheet and printable cost sheet (CW-05, first part) | `9ea163d` (cache v383) | `COSTING_TABLE_TOOLS_V1` |

None of these pull requests changed the database.

## 2. Merged but switched off (seven flags)
All seven new screens and behaviours are **off by default**. Each is switched on per browser only. The browser storage value must be exactly `1`. With a flag off, users see the old behaviour.

| Flag | When on |
|---|---|
| `COSTING_APPROVAL_SCREEN_V1` | Shows the run approval screen (preview, then approve) |
| `COSTING_RECALC_WITH_DATE_V1` | Shows "Refresh with date". The old "change date" tab is then hidden |
| `COSTING_LOCK_SCREEN_V1` | Shows the period lock screen. **Do not switch on for October or any open month** until CI-049 is live or the owner decides otherwise in writing |
| `COSTING_RUN_STATUS_V1` | Shows the read-only run status and health screen |
| `COSTING_UX_CONSISTENCY_V1` | Uses the consistent plain labels |
| `COSTING_DIALOGS_V1` | Uses the new duplicate-sequence confirm dialog in the route manager |
| `COSTING_TABLE_TOOLS_V1` | Sort, CSV and column hints on the SKU cost sheet and printable cost sheet. The CSV keeps every column it has today |

No flag has been switched on in the owner's own session yet. The first walkthrough of the approval screen is still to be done.

## 3. Live in production (database changes)
These were applied to production, each with the owner's written approval:

| Change | What it does |
|---|---|
| CI-038, CI-038a | A SKU can only be made active when its five costing items exist. The check uses today's date or the month's date, whichever is later |
| CI-039 | The weekly job skips months that already have an approved run, and the "1st is a Monday" case is fixed |
| CI-040 v2.1 | Approval needs a preview first. Approving a newer draft replaces the old approved run in one step |
| CI-041 v2.1 | Weekly and month-end drafts keep running in approved months, marked "not for pricing" |
| CI-042 v2.2 | Locking only changes the lock state; status views |
| CI-043 v2.2 rev B | Read-only health check |
| CI-045 | Guard on the designated (reference/approved) runs |
| CI-046 | Only the owner can lock a period |
| CI-047 | Removed open public access from 37 costing functions |
| CI-050 | **CSE-P01 option B** (owner decision of 26 Oct): when several sales snapshot rows exist, costing uses the approved run's snapshot, otherwise the latest run. Applied 31 Oct 2026, 18:05 IST, version `20261031123530` |

Not live:
- **CI-044**: parked.
- **CI-049**: the "month has ended" lock guard. Drafted only; not approved and not applied.
- **CI-048**: the daily health-check job and alerts. Separately governed; not live.

**Side effect of CI-050:** the readiness snapshot is now marked stale, because a rule it depends on changed. Rebuilding it is a live write. It is planned for after the October decision (see the remaining-work list).

## 4. Costing runs that matter
| Run | Meaning |
|---|---|
| 119 | REFERENCE run |
| 122 | September, APPROVED, and September is LOCKED |
| 143 | October, APPROVED (dated 22 Oct). Used for pricing today |
| 128, 136, 140 | REVOKED (replaced) |
| 147 | Manual October draft of 30 Oct. FAILED because 3 SKUs (41, 105, 846) had no packaging BOM in force on 22 Oct. Harmless; no retry |

July and August have **no approved run**. This is a separate reconciliation item.

## 5. Automatic jobs and what to expect next
| Job | Schedule (IST) | Next expected event |
|---|---|---|
| 66, weekly draft | Mondays 02:00 | **Mon 2 Nov 02:00:** creates a November draft |
| 67, month-end draft | 02:00, acts only on the 1st | **Sun 1 Nov 02:00:** creates an October month-end draft dated 31 Oct, marked "not for pricing" |
| 68, stage processor | every 5 minutes | continuous |

The 1 Nov October draft does not change pricing by itself. Run 143 stays in use unless the owner decides to finalise the new draft (see `OCTOBER_MONTH_END_CHECKLIST`, kept outside the repo in the handover folder).

## 6. Rules that always apply
- The server (database) is the authority for business rules. Screens do not re-compute them.
- Every production change needs the owner's own written approval, with a pre-check, a post-check and a rollback ready.
- Merges to `main` happen only on the owner's text. New screens ship switched off.
- Approved and historical runs are never edited.
- Lock flag: see section 2.
- e-Aushadhi (Jarvis's area) is not touched. He is told before any cache-number change.

## 7. How to read the documentation
1. Start here, then read [REMAINING_WORK_2026-10-31.md](REMAINING_WORK_2026-10-31.md).
2. [CHANGELOG_DECISIONS.md](CHANGELOG_DECISIONS.md) holds the dated decisions.
3. [PARKED_BACKLOG.md](PARKED_BACKLOG.md) holds the parked items, with their status updated on 31 Oct.
4. Documents with a "SUPERSEDED / HISTORICAL" banner are kept for history only. Their status lines are no longer current.
5. The work-pack files `WP-*.md` record how each work pack was run. WP-1 and WP00 to WP04 are closed. WP05 to WP12 were never formally opened. Their remaining content is now tracked as the CW items in the remaining-work list.
6. Open draft PR #98 (docs, 27–30 Oct) overlaps with this update and is out of date. See the remaining-work list.
