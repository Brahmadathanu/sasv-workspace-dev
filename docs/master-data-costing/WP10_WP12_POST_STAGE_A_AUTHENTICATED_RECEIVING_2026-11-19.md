# WP10/WP12 — post-Stage-A authenticated receiving readiness and closure gate (19 Nov 2026)

**STATUS: RECEIVING PREPARED, NO LIVE JWT/BROWSER SESSIONS TESTED, NO FORMAL WORKPACK CLOSURE.** Only safe read-only catalog aggregates inspected; no account provisioning or impersonation.

## Retain completed evidence without repeating it
- **WP00–WP09 and WP11 CLOSED**; 11/13 formal workpacks. WP11 responsive/mobile PWA v394 and v393→v394 SW lifecycle evidence accepted, prior six-module populated reads credited.
- **WP10 Stage A permission hardening APPLIED** on `qhmoqtxpeasamtlxaoak`; `119/119` preflight and `58/58` postflight. All 4 classification master tables now have exact four RLS policies requiring **View AND Edit for writes**; authenticated direct grants deliberately retained for authorised legacy Editors.
- **Stage A migration reconciliation COMPLETED** on 19 Nov: `20261118161406 wp10_four_master_stage_a_state_reconciliation` registered exactly once, live history 705→706. Independent R1 read-only check 28 results and 0 differences outside intended history metadata; no policy/ACL/RPC/helper/row-count drift. Authoritative receipt on PR #477 `docs/master-data-costing/WP10_STAGE_A_MIGRATION_HISTORY_REGISTERED_RECEIPT_2026-11-19.md`.
- This supersedes earlier 18 Nov matrix text claiming four-table identity-only RLS or missing migration registration. **Do not regress it to OPEN security risk**; instead label Stage A implemented, authorised legacy direct-DML bypass remaining until Stage B.

## New production canonical permission inventory — read-only aggregate, 19 Nov
Exact queries against `public.user_permissions_canonical`, no names/UUIDs or tokens returned. Each of four `module:manage-categories`, `module:manage-subcategories`, `module:manage-product-groups`, `module:manage-subgroups` reports:
- **1 Editor** assignment (`can_view=true,can_edit=true`).
- **2 View-only** assignments (`can_view=true,can_edit!=true`).
- **0** inconsistent Edit-but-no-View assignments.
- **0 explicit** denied assignments on those specific targets.
- Across **22** distinct canonical user identities: **1** has all four Edit, **2** have all four View-only, **19** have no `can_view=true` assignment on any of four. These 19 are **possible No-access candidates for these four modules only**; this does not prove an active session, no-access for all Costing or seven sensitive views, nor safe negative-HTTP access permission.
- Counts are *catalog evidence*, not authenticated HTTP or UI test evidence. A genuinely independent approved signed-in user must be identified by an authorised operator **privately**, with permissions verified for the exact tested target before the test. Never record identities/JWTs in PR.

## Next smallest real acceptance — WP10 four-root modules
1. Operator with actual browser access identifies **existing** authorised Editor, View-only and root-module-No-access sessions, on a pinned current build, each role independently confirmed by approved canonical assignments. Do not create or impersonate users.
2. For all four modules, in a View-only session: normal hierarchy contents visible, writer controls hidden. In Editor: controls visible but **no save/create/delete executed**. In No-access: route/menu denied or properly hidden according to product contract; no bypass URL probing beyond approved normal navigation.
3. Record one metadata-only receipt row per module/role with build, date, observed expected/actual, no business values. If session unavailable, mark NOT TESTED, not PASS.
4. Only in a disposable/nonproduction authenticated fixture test direct INSERT/UPDATE/DELETE denial for View-only, Edit-without-View and other-module Editor; production catalog checks, though correct, are not a substitute for actual PostgREST behaviour.
5. Stage B DML grant revocation **NOT YET APPROVED**. Requires managed staff Electron fleet inventory/upgrade and separate owner authorisation.

## WP12 Costing acceptance — genuine-session checklist
Read `WP12_AUTHENTICATED_BROWSER_RECEIVING_HANDOFF_2026-11-17.md` and `COSTING_WP12_CONTINUATION_CHECKPOINT_2026-11-17.md`. Preserve prior six populated surfaces and November comparison PWA visual-load proof.
- Independently proven View-only: six module reads, appropriate writer restrictions and personnel confidentiality.
- Independently proven Editor: visual allowed control presence, no writer.
- Independently proven No-access or specific denied role: seven approved minimal *metadata-only* HTTP negative reads (V1–V7 from handoff) **only where an established approved safe request method exists**; log actual HTTP status and no protected rows. A `200` empty result is not proof of denial.
- One normal **default-OFF** comparison navigation, if not already evidenced in this exact authenticated build: expected endpoint path category, HTTP status, elapsed time, outcome. One observation is **not** p95; if no authorised browser network metadata, NOT TESTED. Do not repeat the already accepted visible PWA load merely to manufacture a timing test.
- 11 feature-flag offline/mocked 21/21 already credited; live ON/ALL-ON + restore not authorised or demonstrated. Distinguish activation acceptance from default-OFF receiving.
- Windows installed-app/Bitdefender/release acceptance is a **separate owner-held milestone**, not a proven test. No unsigned OFFICE TEST retries or antivirus exceptions.

## Role/session availability versus accepted performance
The Supabase connection here supports read-only SQL and catalog metadata but **does not provide an authorised existing-user HTTP/JWT browser session**. Never substitute `SET ROLE`, privileged service key, artificial JWT, SQL-editor function call, or newly created account as real-user receiving.

Remaining decisions must not be hidden:
- D1: real Editor/View-only/No-access / seven negative HTTP gates remain unmet; security-sensitive receiving cannot be silently waived or marked PASS.
- D2: default comparison p95 ≤4s still not proven; owner must retain it as a strict closure requirement or explicitly move it to a separate monitored reliability objective under issue #273 (not mark PASS).
- D3: signed-in flag-ON test deferment is an explicit owner activation-scope decision; default-OFF acceptance is not proof of future ON state.
- D4: Stage B fleet cutover cannot be done until staff-installed versions have been inventoried and moved; interim risk remains, albeit constrained to authorised View+Edit identities by Stage A.
- D5: Electron release HOLD until separate owner approval.

## Decision / receipt status
| Gate | Current truthful status |
| --- | --- |
| Stage A policies and migration history | **COMPLETE / INDEPENDENT LIVE VERIFIED** |
| Four-module real three-role UI | **NOT TESTED in this session** |
| Seven sensitive-view real denied HTTP GETs | **NOT TESTED** |
| Cost Comparison normal OFF-path request/latency/p95 | **Only prior visible PWA load PASS; HTTP metadata and p95 NOT TESTED** |
| Offline flag matrix | **PASS 21/21 mocked** |
| Genuine all-ON flag restore | **NOT TESTED** |
| Staff-installed Electron inventory and Stage B | **DEFERRED** |
| WP10, WP12 formal | **OPEN** |
| Programme | **11/13 CLOSED, release HOLD** |

**Only promote a receiving row from NOT TESTED after an actual authorised observation.** Keep no private identities, tokens, query parameters, response bodies, costing numbers or confidential exports in the repo.
