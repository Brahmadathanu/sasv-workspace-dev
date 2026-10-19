# W2 governed period lifecycle: LIVE install (19 Oct 2026)

Approval (19 Oct 2026, relayed 09:16 IST): "Yes, install W2 live". Terms: single owner dff17104-c02a-4bca-95b1-e8ddff46a9b6 shown as 'Dr. Brahmadathan U'; H1-H6 accepted; future-month default valuation date the 1st; no previous-month-lock rule.
Applied: `apply_migration` name `w2_governed_period_lifecycle`, version **20261019053600** (11:06 IST, box/DB clock), file `APPLIED_W2_governed_period_lifecycle.sql` = prepared file unchanged (md5 d978bb219d266f6674c1b33c5a10087b). In-file prechecks and postchecks passed (no abort).

## Verification
| Check | Result |
|---|---|
| Baseline captured before install (3,958 definitions; fingerprints; periods; designations; cron; feed) | `live_before_W2.json` (11:05 IST) |
| Definitions changed = only the 3 intended | fn_guard_designated_run_rows, fn_guard_designated_run_header, audit event_type check; 0 removed |
| Changed definitions = local build | 3/3 identical md5 |
| Added objects = local build (parity) | 26/26 identical md5 (the 25 objects + the owner table's column signature) |
| Runs 122 / 128 fingerprint drift | 0 / 0 |
| Fingerprint captures | unchanged (12 rows, ids 1-13) |
| Periods | identical row md5 (Mar/Jun/Jul/Aug OPEN, Sep and Oct LOCKED/LOCKED) |
| Designations | unchanged: 119 REFERENCE, 122 APPROVED, 128 APPROVED |
| Feed | unchanged md5; Sep run 122 = 634 SKUs (74/70 negative), Oct run 128 = 627 (9/9) |
| Context function (as owner) | is_owner true, edit true; next month Nov, default valuation 1 Nov, 120 min |
| Pre-approval checks on run 128 (read-only) | ran; correctly not approvable again (already APPROVED, Oct LOCKED); fingerprint clean, 627 SKUs, 0 BLOCKED, 37 REVIEW_REQUIRED |
| Grants | 9 RPCs: authenticated/service_role only (no anon); 6 internal helpers: no client execute |
| No action executed | no period opened, no approval/lock/reopen/authorise/supersede/close; audit rows 11, authorisations 0, max run 128, 0 active |
| Cron | 60 and 61 still paused (active=false); all 33 jobs unchanged |

Not done (as instructed): November not opened, no refresh, no cron change, no merge or deploy.

## Files
live_before_W2.json, live_after_W2.json (same query: `live_state_query.sql`), w2_live_local_parity.json, live_functional_checks.json, APPLIED_W2_governed_period_lifecycle.sql. Local build and tests: proposals/consolidation/w2/W2_LOCAL_TEST_REPORT.md (53/53).

## Next steps
1. Review PR #73 (W1 labels), then open the panel PR from `costing/w2-period-runs-panel` (d5f92af); retarget both to main for review. Do not merge or deploy until reviewed.
2. At deploy: bump the service-worker cache version (public/sw.js) so clients load the new modules.
3. Decide job 61 restore (stage processor), needed for any governed refresh; job 60 stays paused.
4. First governed use: the owner opens November from the panel when wanted (not done).
