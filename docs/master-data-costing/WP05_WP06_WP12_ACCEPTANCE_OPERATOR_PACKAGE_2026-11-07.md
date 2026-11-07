# WP05 / WP06 / WP12 — acceptance operator package (issue #206) — 7 Nov 2026

**READY TO EXECUTE, NOT EXECUTED.** No authenticated acceptance has been run: no hosted build was reachable from the automation environment (its network policy returns 403 for `*.netlify.app`, not bypassed), no restricted identity exists, and no credentials were supplied. Everything below is tooling, procedure and a truthful status. Formal closure remains **5/13 (38%)**; every signed-in row is **NOT TESTED** until the owner runs this with a genuinely restricted identity on a digest-verified build. This package supersedes the procedure sections of `WP05_WP06_WP12_AUTHENTICATED_ACCEPTANCE_EXECUTION_PACKAGE_2026-11-06.md`, which stays valid for the checklist and sign-off criteria.

## 1. What the tooling does (all in `scripts/costing-acceptance/`)
| Tool | Purpose | Safety properties (each tested) |
|---|---|---|
| `verify-served-assets.mjs` | proves a hosted build serves the bytes of an **explicit 40-hex commit**: 72 Costing assets (derived from the six pages' own scripts and stylesheets, plus module code and `sw.js`), a bundle digest, and the served service-worker cache name | exit 0 only if everything matches; exit 3 `NOT_VERIFIED` if unreachable/403/off-origin login redirect; exit 1 `MISMATCH` for changed bytes, missing files, HTML fallback for a script, stale cache name; LF/CRLF ignored for text, binary exact; transient 5xx retried; a **loopback target is refused** unless `--allow-local-self-test`, and then the report says `LOCAL_SELF_TEST, hosted_proof=false` |
| `capture-storage-state.mjs` | the **operator** logs in by hand in a visible browser; saves Playwright storage state | never sees or stores a password; refuses a path inside the repo; file mode 600 |
| `acceptance-runner.mjs` | read-only run of the six modules: identity proof, build proof, 40 lenses/workspaces, 1280/390 px, flag matrix, period labels, console and request-name evidence | **never clicks/types**; only navigates by URL and selects the period; every request classified and any non-read is **aborted before leaving the browser** (run stops, exit 4); only `get_user_permissions`, `rpc_get_*`, the app-documented run-status reads, REST GET/HEAD and token refresh are allowed; fails closed (exit 3) without a verified build, a proven identity, a safe `--out`/session path; output scrubbed of tokens, emails, user ids |
| `lib/identity.mjs` | identity proof | accepts only when the session's own permission read **and** the owner's canonical extract agree and show zero edit grants |

Exit codes of the runner: `0` COMPLETED_CLEAN (hosted only) · `1` findings or render-only (empty tables are **not** a pass) · `2` usage · `3` NOT_TESTED · `4` FAILED_SECURITY. A `SELF_TEST_` verdict prefix means local fake backend: **not acceptance evidence**.

## 2. Identity prerequisites (the owner provides; I created no account and no grant)
Canonical targets (`public.user_permissions_canonical.target`): `module:costing-control-center`, `module:material-cost-manager`, `module:cost-build-manager`, `module:pricing-policy-manager`, `module:cost-sheet-review`, `module:production-route-manager`.
| Identity | Minimum grants | Fails the runner if |
|---|---|---|
| **ID-V** (view-only) | exactly those six with `can_view=true, can_edit=false`; **nothing else**: no other module, **zero** `can_edit=true` anywhere | any edit grant (session or canonical), any other viewable target, a missing or non-viewable target, session ≠ canonical |
| **ID-N** (denied) | no Costing permission (other modules allowed) | any Costing view or edit |
**The existing test login (Costing view-only plus 52 unrelated edit grants) can never be ID-V**; the runner rejects it by construction.

Safe way to supply an identity: (1) the owner creates the test user through the normal Supabase Auth process and grants permissions through the governed permission process (not by me, not by this tooling); (2) the owner runs this **SELECT-only** extract and saves it as `canonical.json` outside the repo:
```sql
select target, can_view, can_edit from public.user_permissions_canonical where user_id = '<test user uuid>' order by target;
```
wrapped as `{ "user_id_sha256_12": "<12 hex>", "rows": [ {"target": "...", "can_view": true, "can_edit": false}, ... ] }`, where the 12 hex are `printf %s '<uuid>' | sha256sum | cut -c1-12`; (3) the operator logs in by hand with `capture-storage-state.mjs`; (4) nothing credential-like goes into chat, the repo or a ticket; (5) afterwards delete the session file and rotate the test password. Runner output stores only a 12-hex hash of the user id.

## 3. Test matrix: what each claim means (all NOT TESTED until run)
| Claim | What the runner establishes (hosted run) | What it cannot establish |
|---|---|---|
| **Host** | served bytes = the named commit; cache name and bundle digest recorded | that the commit is the one the owner intends to accept |
| **Flag** | the temporary overrides were set exactly (read back) and all eleven restored OFF | production flag state (never touched) |
| **Module** | the page opened and its navigation was discovered (40 expected) | that the data is correct |
| **Render** | no page error, no horizontal overflow at 1280 and 390 px | visual quality (screenshots are for the owner to judge) |
| **Data** | rows present = `PASS`; none = `NOT TESTED`; server-restricted lens = `RESTRICTED` (**never a pass**) | correctness against the database |
| **Security** | no non-read request attempted; for ID-V no visible **enabled** mutating control (observed, never clicked) | server-side denial (needs a separately approved no-side-effect plan; SEC-A1/A2 denial stays NOT TESTED) |

## 4. The smallest practical assisted session (about 60-90 minutes of owner time, estimate)
1. *(owner, once)* Create ID-V (and ID-N if wanted), produce `canonical.json` (§2).
2. *(owner)* Decide the build: merge the PRs to be accepted, then take `main` at an exact SHA (or a Netlify deploy preview of it); note the SHA.
3. Verify the build (no login): `node scripts/costing-acceptance/verify-served-assets.mjs https://<host> <sha> --json provenance.json` must print `VERIFIED` (a `NOT_VERIFIED`/`MISMATCH` stops everything).
4. *(operator, 2 min)* `node scripts/costing-acceptance/capture-storage-state.mjs --base https://<host> --out <outside repo>/id-v.storage.json`, log in as ID-V, press Enter.
5. Run: `node scripts/costing-acceptance/acceptance-runner.mjs --base https://<host> --sha <sha> --identity ID-V --storage-state <that file> --canonical-proof <canonical.json> --out <outside repo>/acceptance-<date> --screenshots` (add `--matrix minimal` for a first pass). Standard matrix is about 120 page loads; locally with a fake backend it took 2.7 minutes, a hosted run needs real settle time, so allow roughly 20-30 minutes (**not measured on a hosted build**).
6. Optional: repeat with `--identity ID-N` for the denial side.
7. *(owner, 20-30 min)* Review `report.md` / `report.json`, the screenshots, the findings; complete `OWNER_ACCEPTANCE_RECORD_2026-11-04.md` Matrix A/B from it; judge visual items (CBM/PRM screens were never visually approved).
8. Delete the session file; rotate the password.

Gates one session can address **together** (evidence only; closure is the owner's act in each Gate Status): **WP05** CL1 §4(b) signed-in ON/OFF checklist plus the C6/C9/D3 dispositions; **MDC-07** (same checklist); **WP06** §4.5 signed-in acceptance of the ten workspaces (read-only) plus C9/D7/F-4 dispositions; **WP12** the signed-in rows. **Still needed after the session:** WP05 S2 printable ↔ SKU-detail parity and S9 KPI requery on real SKUs (manual, §5 of the 6 Nov package); WP12 Windows A14 installer proof and a final regression on the final head; SEC-A1/A2 server denial proofs; CDE-2 panel (not applied or wired).

## 5. Findings the runner already produced against the real client code (local self-test, reproducible)
- **LOCK-P01:** with `COSTING_LOCK_SCREEN_V1` on, the Control Center shows an **enabled "Close quarter (lock months)"** button to a view-only identity (the lock controller mounts with no edit-permission check; the approval screen got SEC-A2 client parity, the lock screen did not). Server-side enforcement for the lock RPCs is unverified. Flag is default OFF, so it matters before activating that flag. Logged in `PARKED_BACKLOG.md`.
- **`rpc_costing_health_check`** is classified as **forbidden** on the approval screen and as a **documented read** on the run-status screen; its server definition is not in the repo. The runner allows it only through the app's own documented list and reports every use for live read-back.
These are findings about local self-test behaviour against the fake view-only permissions; whether they reproduce on the real build is exactly what the acceptance session establishes.

## 6. Remaining release blockers (unchanged by this PR)
No restricted identity; no authorised, digest-verified build; WP05/06/12 signed-in acceptance NOT TESTED; owner decisions O-2, O-5, O-7, O-8; CDE-2 D3a/c and the server read-back, migration, gate flip and wiring; Windows A14; final regression on the final head; no CI workflow for `main` (CI-P01); no PWA/Electron release before WP00-WP12 complete.
