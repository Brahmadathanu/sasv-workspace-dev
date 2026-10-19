# W2 governed period lifecycle: LOCAL build and test report (19 Oct 2026)

Approved 19 Oct 2026 07:59 IST: "build W2 LOCALLY on the proposed defaults. LOCAL BUILD AND TEST ONLY."
No live write, no apply_migration, no cron change, no merge or deploy. September unchanged (live: LOCKED/LOCKED). Live was only read.

## What was built
**Database (prepared, not installed):** `PREPARED_W2_governed_period_lifecycle.sql` (md5 d978bb219d266f6674c1b33c5a10087b), outside supabase/migrations.
- Prechecks stop the install if any of 13 live definitions differ (designate, close, authorise refresh, default valuation date, fingerprint verify, require_permission, pointer view, designation view, W1 status view, both run guards, audit event-type check), or if any month already has two APPROVED runs. Re-checked against live 19 Oct (read-only): all 13 match; W2 not present; runs 122/128 0 drift.
- 9 client RPCs (public, SECURITY DEFINER, one advisory lock per month, each writes an audit row with reason, approval reference and actor):

| RPC | Who | Rule |
|---|---|---|
| rpc_costing_period_governance_context | any logged-in | role (view / edit / owner), next month, default valuation date, 120 min |
| rpc_costing_preflight_run(run, APPROVE/SUPERSEDE) | view | the pre-approval checks (list below) |
| rpc_costing_open_next_period(reason, ref, valuation_date?) | editor | only the month after the latest period, never beyond next calendar month; date default = day opened (future month: the 1st); editable within the month |
| rpc_costing_approve_run | owner | all checks pass; BLOCKED refused; REVIEW_REQUIRED allowed and counted; no other APPROVED run in the month |
| rpc_costing_lock_period | editor | OPEN only; approved run present, its valuation date = month's, no active run, 0 fingerprint drift |
| rpc_costing_reopen_period | editor | LOCKED only; never CLOSED |
| rpc_costing_authorise_supersession | owner | month OPEN with an approved run, no active run, no unexpired authorisation; valid 120 min |
| rpc_costing_supersede_approved_run | owner | new run must be newer and created under the authorisation; old run REVOKED (kept), new APPROVED |
| rpc_costing_close_period | owner | LOCKED only; uses the existing rpc_close_cost_period |

- Checks: run SUCCESS with captured context; not already designated; month OPEN; valuation dates match; no queued/running run; fingerprint captured and clean; cost sheet present; no BLOCKED SKUs; REVIEW_REQUIRED count recorded; plus NO_OTHER_APPROVED_RUN (approve) or HAS_APPROVED_RUN / NEWER_THAN_APPROVED / AUTHORISATION_CONSUMED (supersede).
- Owner = table `costing.costing_governance_owner` (one row, append-only), seeded with uid dff17104-c02a-4bca-95b1-e8ddff46a9b6, 'Dr. Brahmadathan U' (the only costing-control-center editor; actor on the existing lock audits; live profile 'Brahmadathan U').
- Hardening: H1 truncate guard on the re-baseline log (the one-line guard); H2 audit log append-only + truncate guard; H3 audit event types + RUN_APPROVED, SUPERSESSION_AUTHORISED, RUN_SUPERSEDED; H4 run guards also protect REVOKED runs (a superseded run stays exactly as approved); H5 trigger refuses a second APPROVED run in a month on every path (incl. direct service_role designate); H6 trigger refuses any UPDATE/DELETE of a CLOSED month.

**Client (branch `costing/w2-period-runs-panel`, commit d5f92af, off `costing/w1-approved-run-labels` d132edf; not merged, no PR):**
- `public/shared/js/costing-period-governance.js` (new): "Period & runs" button next to the run label on Control Center; dialog lists the last 12 months (status, valuation date, run label) with only the actions the user may take; approve/supersede show the pre-checks first and stay disabled if any fail; every action asks for reason and approval reference; close warns it is final.
- `costing-suite-shell.js` (+12 lines: import, create panel, show on Control Center), `sasv-costing.css` (+26 lines). No WP07 files; `public/sw.js` not touched.
- Tests: `scripts/costing-period-governance/period-governance.test.mjs` 17/17 on rows captured from the local W2 database at each lifecycle step; W1 badge tests 8/8. Client contract end-to-end: the exact calls the module builds, run against the local DB with named arguments: 10/10 OK (`local_test/out/client_contract_e2e_log.txt`).

## Tests: 53/53 pass
Fixture: live-faithful W1/W5 fixture (runs 119-128) + live W1, W5, re-baseline SQL + live auth/permission functions (md5-identical to live) + real users: owner (dff17104), editor, view-only, no permission, anonymous. Test month November 2026; runs 140 (1 BLOCKED SKU), 141, 142, 143, 144 are clones of run 128 (144 with +10% selling prices).

| # | Test | Result |
|---|---|---|
| I1 | W2 SQL installs on live-faithful fixture; in-file prechecks + postchecks pass | PASS |
| I2 | Existing objects changed by W2 = only the 2 run guards (+REVOKED) and the audit event-type list; none removed | PASS |
| I3 | Objects added by W2 (count; listed in report) | PASS |
| I4 | Re-running the W2 SQL is safe (idempotent) | PASS |
| I5 | Guard stops if a live definition differs (fn_default changed in a rolled-back txn) | PASS |
| P1 | Context: roles resolved (view, edit, owner) | PASS |
| P2 | Context: next month = Nov, default valuation date = 1 Nov (opened in Oct, future month) | PASS |
| P3 | Open refused: view-only user, no-permission user, anonymous | PASS |
| P4 | Preflight refused for no-permission user | PASS |
| P5 | Reason (>=10 chars) and approval reference required | PASS |
| P6 | Valuation date outside the month refused | PASS |
| L1a | Open with default: Nov OPEN, valuation date 1 Nov, source SYSTEM_DEFAULT (rolled back) | PASS |
| L1b | Editor opens Nov with an edited valuation date (5 Nov): OPEN/DRAFT, GOVERNED_MANUAL | PASS |
| L1c | Only the next month: opening Dec on 19 Oct refused | PASS |
| L2 | Pre-approval checks while a run is still RUNNING: NO_ACTIVE_RUN fails (viewer can see checks) | PASS |
| L3 | Pre-approval checks on run 141 pass; REVIEW_REQUIRED allowed and counted | PASS |
| R1 | BLOCKED refusal: run 140 (1 BLOCKED SKU) cannot be approved | PASS |
| R2 | Approve refused for editor and viewer (owner-only) | PASS |
| L4 | Owner approves run 141: APPROVED by Dr. Brahmadathan U with designation fingerprint; feed shows Nov = run 141 (latest) | PASS |
| R3 | Double approval refused via RPC (run 142): use supersede | PASS |
| R4 | Double approval refused on the direct designate path (trigger backstop) | PASS |
| R5 | Close before lock refused | PASS |
| R6 | Lock refused for viewer | PASS |
| L5 | Editor locks Nov (approved run 141, valuation dates match, 0 drift) | PASS |
| R7 | Lock refused when already LOCKED | PASS |
| R8 | Authorise supersession refused while LOCKED (reopen first) | PASS |
| L6 | Editor reopens Nov: OPEN/DRAFT; approved run 141 kept in feed | PASS |
| R9 | New run in a month holding an APPROVED run refused without authorisation | PASS |
| R10 | Authorise supersession refused for editor (owner-only) | PASS |
| R11 | Expired authorisation does not allow a new run | PASS |
| L7 | Owner authorises supersession (expired one ignored); valid 120 minutes | PASS |
| R12 | Second open authorisation refused | PASS |
| L8 | New run 144 created under the authorisation (consumed); feed still run 141; label flags newer draft | PASS |
| R13 | Supersede with a run not created under the authorisation (142) refused | PASS |
| R14 | Supersede refused for editor (owner-only) | PASS |
| L9 | Owner supersedes 141 with 144: 141 REVOKED, 144 APPROVED; feed Nov = run 144 values | PASS |
| L10 | Feed hash changed only at supersession (approve->unchanged through reopen/authorise/new run->changed at supersede) | PASS |
| L11 | Superseded run 141 kept intact: rows unchanged, edits refused (REVOKED now protected), fingerprint clean | PASS |
| R15 | Close refused for editor (owner-only) | PASS |
| L12 | Lock again (run 144) then owner closes Nov: CLOSED/FINAL | PASS |
| R16 | Reopen after close refused: RPC (editor, owner) and direct UPDATE/DELETE (trigger) | PASS |
| R17 | Lock refused if the period valuation date no longer matches the approved run (Oct, rolled back) | PASS |
| A1 | Audit log: one row per action, in order | PASS |
| A2 | Every audit row records reason, approval reference and actor (owner/editor as expected) | PASS |
| A3 | Approval audit records the REVIEW_REQUIRED count and checks | PASS |
| A4 | Audit log is append-only (update and truncate refused) | PASS |
| A5 | Re-baseline log truncate guard; owner table append-only | PASS |
| N1 | Runs 122/127/128 rows unchanged; Sep/Oct feed rows unchanged (only the "latest approved month" flag moves to Nov) | PASS |
| N2 | Existing periods (Mar-Oct incl. September) untouched by the tests | PASS |
| N3 | Fingerprints clean: 122, 128 (approved), 141 (superseded), 144 (new approved) | PASS |
| N4 | Cost sheet for runs 122/127/128 identical (no cost-logic change) | PASS |
| N5 | One APPROVED run per month after everything | PASS |
| N6 | Run 127 (Oct draft) cannot be approved: Oct LOCKED, run 128 approved, and 127 has no fingerprint (pre-AU2 run) | PASS |

## What a live install would change (exactly)
Changed (3): `costing.fn_guard_designated_run_rows()` and `costing.fn_guard_designated_run_header()` (only `'REVOKED'` added to the protected list); constraint `cost_period_governance_audit_event_type_chk` (3 event types added).
Added (25): table `costing.costing_governance_owner` (+1 row) with 3 constraints; 6 internal functions (fn_w2_owner_name, fn_w2_require_text, fn_w2_audit, fn_w2_run_checks, fn_w2_guard_single_approved, fn_w2_guard_closed_period); 9 public RPCs above; 7 triggers (audit append-only + truncate, closed-month final, owner table append-only + truncate, single-approved on designation, truncate guard on re-baseline log).
Not changed: cost logic, snapshots, views, W1 feed, fingerprints, existing period/designation functions, cron, data of any month (Sep/Oct stay LOCKED). Behaviour that changes: (a) audit rows can no longer be edited or deleted; (b) a REVOKED run's rows/header become immutable; (c) a second APPROVED run in a month is refused (today allowed; the pointer picks the later one); (d) a CLOSED month row can never be updated.

## Decisions needed before a live install
1. Confirm owner = uid dff17104-c02a-4bca-95b1-e8ddff46a9b6, display name 'Dr. Brahmadathan U' (single approver).
2. Accept H2 (audit append-only) and H4 (REVOKED runs immutable): both change existing behaviour.
3. Future-month default valuation date = the 1st (opening Nov on 19 Oct gives 1 Nov; editable).
4. Should opening a month require the previous month to be LOCKED? (Built: not required; Mar/Jun/Jul/Aug are OPEN today.)
5. Earlier open items: C1 grants on public W1 views; C2 feed v2; C3 fingerprint id column.
6. Deploy order: W2 SQL live first, then client (PR #73 then the W2 panel branch; retarget to main; service-worker cache bump at deploy).
