# Master costing workflow: remaining work (31 Oct 2026)

Read together with [CURRENT_STATE_2026-10-31.md](CURRENT_STATE_2026-10-31.md).

Column meanings:
- **Progress** is one of: not started, planned, in progress, blocked or done.
- **Where** says whether the work is client-only (screens), needs the server (database), or both.
- **Can it proceed?** is either "Proceed now" or names the owner decision it waits for.

Only items that truly depend on the 1 Nov October draft, or on the October finalise, wait for it.

## A. Owner decisions and governance
| # | Short name | What it is | Progress | Where | Can it proceed? |
|---|---|---|---|---|---|
| 1 | October finalise choice | After the 1 Nov 02:00 draft: finalise it as October's month-end run (run 143 becomes Superseded), keep run 143, or wait | blocked | server (one governed write) | Waits for the 1 Nov draft, then **owner decision** (checklist options 1/2/3) |
| 2 | Readiness rebuild | Rebuild the readiness snapshot, which has been stale since CI-050 changed a rule it uses | planned | server (live write) | Waits for the October finalise, then **owner approval** |
| 3 | CI-049 approval | Server guard so a month cannot be locked before it has ended | planned (drafted with rollback) | server | **Owner approval** to apply |
| 4 | CI-048 decisions | Daily health-check job, plus alerts (in-app banner first, email later) | planned (design only) | server (+ small client banner) | **Owner decisions** on schedule and alert channel |
| 5 | June–August reconciliation | July and August have no approved run. Decide how to treat them, then re-baseline the run 119 fingerprint | not started | server | **Owner decision** (approach) |
| 6 | WP10 block or warn | Whether creating an incomplete new SKU is blocked or only warned about | not started | server (if block) + client | **Owner decision** (block or warn) |
| 7 | Plant capacity for 74 machines | 74 machines are blocked for lack of capacity data (CI-011 / CW-12) | blocked | data entry (server data) | **Owner/production** must supply the capacities |
| 8 | PERF-P01 | Readiness screen speed (full portfolio is slow); needs an architecture choice | not started | server | **Owner decision** (approach) |
| 9 | WP05 acceptance | Accept the 25 Oct suite audit as the WP05 output and close WP05 | planned | docs only | **Owner acceptance** |
| 10 | First approval-screen walkthrough | Owner tries the approval screen in his own session, then decides which flags to switch on | not started | client (flag in browser) | **Owner**; can be done now (lock flag excepted) |
| 11 | Flag switch-on plan | Decide when each of the seven flags goes on for real users | not started | client | **Owner decision** per flag; lock flag waits for CI-049 |
| 12 | Migration-history hazard | 18 repo migration files have no production version and 81 production versions have no repo file. A record-only clean-up has been proposed | planned (proposal only) | repo + read-only check | **Owner approval** of the housekeeping proposal |
| 13 | Old periods (Mar, Jun, Jul, Aug) | Stay open, labelled historical drafts (decided 26 Oct) | done (decision) | — | — |
| 14 | CSE-P01 | Which sales snapshot row counts | done (CI-050 live 31 Oct) | server | — |

## B. Screens and client packages
| # | Short name | What it is | Progress | Where | Can it proceed? |
|---|---|---|---|---|---|
| 15 | CW-05 remainder | Sort, CSV and hints for the other table groups (control centre, policy, scheme, material, cost build, driver governance) | planned | client-only | Proceed now |
| 16 | CW-05 column hint wording | Hints only repeat the column name plus "Click to sort." Real one-line meanings are needed | not started | client-only | **Owner** to supply or approve the wording |
| 17 | CW-05 sort keys | Product / SKU, Product, Category, Group and the cost-sheet Status column cannot be sorted yet | not started | client-only | Proceed now (sort by the displayed text) |
| 18 | CW-05 button styling | Sort buttons use the plain browser style | not started | client-only (CSS) | Proceed now |
| 19 | CW-06 item 2 | Name-only "create family" prompt: replace it with a full form or remove the button | blocked | client (+ server if full form) | **Owner product decision** |
| 20 | CW-06 item 4 | Supersede prompt: a proper picker of eligible drafts | not started | client, write-critical | Proceed as a separate, carefully gated package |
| 21 | CW-06 items 3 and 5 | Item 3 cannot be reached from the screen; item 5 (approval-screen dialogs) was deliberately excluded | done (no action) | — | — |
| 22 | CW-03 profit after scheme | Show profit after scheme per SKU (IK/OK) | not started | needs server (permission-checked view) + client | **Owner approval** of the server view; data arrives with a CI-037-eligible run |
| 23 | CW-04 glossary | Shared status glossary (labels are done in #104) | not started (deferred) | client-only | Proceed now if wanted; was deferred |
| 24 | CW-10 pending-approvals badge | Badge for items waiting for the user's approval | not started | needs server (count source) + client | Proceed now (design); server part needs approval |
| 25 | CW-13 narrow screens and inline styles | Make costing screens usable on small screens; move inline styles to CSS | not started | client-only | Proceed now |
| 26 | CCC-P01 | SKU Control Status vs Portfolio Readiness: decide whether to merge the two | not started | client (+ evidence) | **Owner decision** after a usage review |
| 27 | CCC-P02 | Pricing Policy Manager duplication audit | not started | docs/review | Proceed now |
| 28 | CCC-P03 / CW-14 | Client part done (#104). Retiring the two old dashboard views is still to do | in progress | server (drop, gated) | **Owner approval** of the drop |
| 29 | UX-P02 / WP11 | Manage Products look-and-feel hardening | not started | client-only | Proceed now (design pass) |
| 30 | NAV-P01 / NAV-P02 | Master-data navigation; links for readiness route codes | not started | client-only | Proceed now (needs proven destinations) |
| 31 | MDC-07, WP06, WP09 | Costing navigation, Pricing Policy Manager simplification, whole-app launcher audit | not started | client / docs | Proceed now (low priority) |
| 32 | Regional marketing review (UX-P01 / CW-11) | Screen to review and accept regional marketing evidence. Needs a new read function, `rpc_list_regional_marketing_review_candidates` (sketch only) | blocked (held) | server + client (screen writes) | **Owner approval** of the new function; held until June–August reconciliation (#5) is decided |

## C. Small leftovers
| # | Short name | What it is | Progress | Where | Can it proceed? |
|---|---|---|---|---|---|
| 33 | Lock-screen reload message | If the reload after a successful lock fails, it is shown as a lock error (`costing-lock-screen.js` ~line 317) | not started | client-only | Proceed now |
| 34 | Batch-mode lockout test | Missing test for the batch-lock lockout path | not started | client-only (tests) | Proceed now |
| 35 | Smoke tests need Node 21+ | The e-Aushadhi qc-preparation-workspace smoke needs Node 21 or later | not started | tooling | Proceed now (note in test instructions) |
| 36 | Netlify deploy check | GitHub does not show the deploys of the last merges | not started | owner check | **Owner** glances at the Netlify dashboard |
| 37 | WP12 closing note | Regression proof and programme closing note | in progress (this update) | docs | Proceed now |
| 38 | PPM migration file line endings | `20261015045233_ppm_inactive_sku_mrp_policy_governance.sql` is live in production; the repo copy has Windows line endings, so it shows as modified locally | not started | repo only | **Owner approval** for one separate normalisation commit, or leave as is |

## D. Outside costing (listed only, owned elsewhere)
| # | Short name | What it is | Progress | Where | Can it proceed? |
|---|---|---|---|---|---|
| 39 | PR #98 (docs) | Draft docs PR of 27–30 Oct, now overlapping and out of date | blocked | docs + record copies of migrations | **Owner**: close as superseded, or keep only its migration record copies in a fresh PR |
| 40 | Tally master-data PRs #92, #93, #94, #97 | Tally master-data work | not reviewed here | — | Outside costing |
| 41 | Jarvis draft #59 and branch `feat/wp07-ux1-worklist` | e-Aushadhi work; will move to cache v384 or later | in progress (his) | — | Jarvis's area; he pings before merging |
