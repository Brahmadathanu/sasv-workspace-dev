# WP04-G7 — Frozen authenticated/live verification package

2026-10-05. **FROZEN / NOT EXECUTED.**

## Entry state
- G4 CLOSED.
- G5 ACCEPTED.
- G6 PASS.
- Frozen client branch: feat/wp04-g5-portfolio-readiness
- Frozen head: db7544f2ebdf30f515f249ade9e12a660a364476
- Main: e421fe8df9b98b4956acdcd4cadeb36a3f9b923c
- DEC-015 unchanged.

## Execution surface
Launch the frozen feature worktree through the repository's existing Electron development path:

`npm run dev`

Use the application's normal sign-in flow only. Authentication material stays inside the application session and is not copied into chat, scripts or headers.

## Live preflight
Existing session-bearing permission classes exist for:
- Control Center view allowed;
- Manage Products view without Control Center;
- neither permission.

No user, role, permission or session changes are part of G7.

The three new public readers remain authenticated-only with Control Center permission checks. Private C helpers remain postgres-only.

## A. Allowed Control Center case
Using an existing Control Center-view account:

1. Open Costing Control Center → Readiness.
2. Governed periods load.
3. Initial period is the newest server-returned governed period.
4. Generic costing-period state is not used as Readiness authority.
5. Context/valuation displays from server response.
6. OPERATIONAL loads and shows separate population/matched/returned counts.
7. UNKNOWN remains UNKNOWN.
8. ALL_EXISTING loads and population is >= OPERATIONAL.
9. Exercise one available server severity filter and, where available, one dependency/owner/route filter.
10. Use the sole shell search; clear it and verify restoration.
11. If Next exists, advance one keyset page; then change filter/search and verify keyset resets.
12. Verify Product-gap panels when returned; no gap row gets fabricated SKU readiness.
13. Open one row detail and verify server-derived read-only identity/context/summary/dependencies/owner/route/evidence/downstream/shared issues.
14. Owner/route remain descriptive text only; no writer/action control appears.

Record visible counts/context and PASS/FAIL only.

## B. Manage Products-only denial
Using an existing account with Manage Products view but no Control Center view:

- Readiness/new bulk readers must not produce successful portfolio data.
- Control Center surface must be hidden/denied/unavailable according to existing module access.
- Existing single-SKU Manage Products readiness, where available, should remain governed by its prior canonical boundary.

No permission changes.

## C. Neither-permission denial
Using an existing account with neither permission:

- Costing Control Center/Readiness unavailable;
- no portfolio readiness data exposed;
- Manage Products canonical readiness unavailable under existing access rules.

## D. Anonymous denial
At the end of testing, sign out normally and reload.

Verify:
- sign-in is required;
- Costing Control Center/Readiness cannot be used;
- previously displayed readiness data is not interactively exposed after sign-out/reload.

## E. Private-helper denial
Verify:
- client source contains no private-helper call path;
- deployed private-helper ACL remains postgres-only;
- no frontend-accessible private-helper surface appears.

Do not change Data API exposure to manufacture a test.

## F. Native application permission matrix
Through normal application sessions, verify the three public readers:

Control Center account:
- governed periods succeeds;
- Product gaps succeeds;
- portfolio succeeds.

Manage Products-only:
- all three denied.

Neither:
- all three denied.

Anonymous:
- all three denied/not authenticated.

Evidence contains only account-class labels and sanitized success/denial results.

## G. Live performance under DEC-015
Preserve historical evidence exactly:
- 6938.008 ms
- 5084.304 ms
- full-611 OPERATIONAL/full-statistics
- provisional 3s/5s targets UNMET/NON-BLOCKING.

Capture only two normal UI-triggered live portfolio request durations:
1. initial OPERATIONAL load;
2. one subsequent normal load such as ALL_EXISTING/filter/search.

No benchmarking loop, no timeout change, no averaging campaign.

G7 performance passes if normal signed-in requests complete successfully without timeout/error and timings are honestly recorded. Any severe regression/timeout blocks G7 for review.

## H. User-visible verification
Verify:
- one Readiness lens;
- one search control;
- governed-period controls are understandable;
- desktop/table view usable;
- narrow window card/list view usable;
- no permanent Action column;
- no monetary/snapshot/diagnosis content mixed into Readiness;
- Unavailable/error is visibly distinct from UNKNOWN;
- detail remains read-only.

Screenshots are optional and must exclude authentication/session material.

## Evidence report
Return:
- A: allowed Control Center PASS/FAIL + visible counts/context;
- B: Manage Products-only denial PASS/FAIL;
- C: neither denial PASS/FAIL;
- D: anonymous denial PASS/FAIL;
- E: private-helper denial PASS/FAIL;
- F: per-reader permission matrix;
- G: two live request durations;
- H: visual/responsive PASS/FAIL;
- sanitized errors only.

## Stop conditions
Stop if:
- a denied class receives readiness data;
- private helper becomes frontend-callable;
- allowed Control Center user is denied unexpectedly;
- governed period comes from local/calendar state;
- UNKNOWN is transformed;
- statistics/filter semantics look client-derived;
- keyset/search/filter behavior contradicts G5;
- live request times out or regresses severely;
- any account/permission/server/Data API change appears necessary;
- authentication material would need to leave the normal application flow.

No automatic correction in G7.

## Manual interaction
This chat cannot operate the user's local Electron session. User interaction is therefore required:

1. keep the worktree at db7544f2ebdf30f515f249ade9e12a660a364476;
2. run `npm run dev`;
3. sign in normally in the app;
4. perform the above checks for each existing account class available to the user;
5. sign out normally between account classes;
6. record only PASS/FAIL, visible counts/context and two request durations;
7. return the sanitized observations to ChatGPT.

If the user does not have legitimate sign-in access to one required existing account class, mark that case BLOCKED. Do not create, reset or alter an account just for G7.

## Gate boundary
Package frozen. Execution not started. No merge/release/publish/G8.
