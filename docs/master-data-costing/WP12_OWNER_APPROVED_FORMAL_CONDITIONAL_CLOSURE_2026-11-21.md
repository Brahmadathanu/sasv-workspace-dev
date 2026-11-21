# WP12 — owner-authorised conditional formal closure (21 November 2026 IST)

**FINAL OWNER DECISION: WP12 CONDITIONALLY CLOSED. COSTING SUITE PROGRAMME 13/13 (100%) FORMALLY CLOSED.** This is formal governance acceptance in the proven development and operational scope, **not** an assertion that every previously untested test passed.

## Exact approval
After receiving the [WP12 final closure recommendation](WP12_FINAL_CONDITIONAL_CLOSURE_RECOMMENDATION_2026-11-21.md), which explicitly enumerated all residual evidence limits and downstream receiving owners, the programme owner replied **“Yes i approve.”** This expressly authorised **conditional WP12 closure** only. It did **not** separately authorise a draft-PR merge, production SQL, privilege/policy change, data purge, feature flag activation/deactivation, Electron installer publication or new release.

## Reconciled evidence accepted by owner
| Area | Final accepted status |
| --- | --- |
| Six Costing module populated functional reads | PASS — previous genuine single-session receiving |
| Six-module View-only account | PASS — 6/6 readable, writer controls absent, owner-observed |
| Six-module No-access account | PASS — 6/6 hidden in navigation, owner-observed |
| Protected sensitive-view V1–V7, actual authenticated No-access session | **7/7 NO DISCLOSURE OBSERVED**: each HTTP 200 and zero rows in a bounded one-row maximum GET. **Not** seven HTTP 401/403 denials |
| Protected view catalogue | Seven permission-filter predicates present, authenticated SELECT / anon denied, five definer and two invoker |
| PM BOM 390px, SKU Deactivate visibility | PASS; WP11 formally closed earlier |
| Hosted/PWA provenance | Previously accepted 74/74 hosted assets, v394 migration; owner observed signed-in `/sw.js` controlling page and activated; exactly one `hub-cache-v394` |
| Current browser-local Costing feature flags | 11 inspected; **10 OFF/default, one Review Worklist ON/stored (origin UNKNOWN)** |
| Eleven-flag mocked coverage | Previously accepted 21/21, NOT a real ON/ALL-ON signed-in sweep |
| November 2026 Cost Comparison ordinary governed-view load | PASS — user-observed HTTP **200**, **5,250 ms**, visible table loaded |
| Four-second p95 reliability | **NOT PROVEN**; owner separately selected **MONITORED FOLLOW-UP**, not a closure hold for one successful slow load. Issue #273 remains OPEN |
| Classification RPC Stage B | Owner-approved SQL applied/verified before this decision; direct authenticated DML revoked on four masters, SELECT / 12 RPCs preserved; WP10 conditionally closed earlier |
| Windows staff fleet | v6.2.0 deployed to all staff PCs per owner report; no per-installed ASAR hash attestation |

## Explicitly accepted residual limitations — NOT TESTED does not mean PASS
1. **Security — direct/deep-link:** Six-module No-access navigation was hidden but no direct URL denial was tested. Receive at next approved access-control review, especially before material route or permission changes. Any demonstrated protected-data disclosure is a **stop-the-line security incident**, not a waived gap. Receiver: owner and authorised security operator.
2. **Seven protected view GET semantics:** HTTP 200/empty results show no disclosure for these bounded requests, **not** explicit HTTP rejection and not a universal access proof. Maintain catalog permission predicates and future role-security review. Receiver: authorised security operator.
3. **Editor×6 and genuine JWT writer deny/positive:** Full independent Editor UI role matrix and real-JWT positive/negative governed master RPC calls are not proven end-to-end. Test only in authorised disposable nonproduction fixtures before the next sensitive writer/permission revision; **do not probe production writers**. Receiver: technical owner.
4. **Feature flags:** Current browser `COSTING_REVIEW_WORKLIST_V1` is **ON/stored with origin unknown**. No browser change or broad rollout authorised by closure. Live all-ON and individually ON authenticated matrix remains NOT TESTED, due at next formally approved feature activation with reset/rollback. Receiver: application owner / next activation process.
5. **Comparison reliability:** Existing issue [#273](https://github.com/Brahmadathanu/sasv-workspace-dev/issues/273) stays OPEN as monitored follow-up. One 5.25s/200 load exceeds 4s individually and does not certify 4s p95, nor erase historical 500s. Track naturally occurring redacted status/duration and investigate repeated errors; no automated load-test or SQL rewrite authorised. Receiver: Costing operator and issue owner.
6. **Desktop provenance/recovery:** Installed v6.2.0 verified by owner on staff systems, but per-installed ASAR digest and next installer update/rollback maintenance steps remain NOT TESTED. Receiver: next separately approved desktop maintenance release gate.
7. **Optional engineering proposals:** SQL PR #463, additional WP10 04/05/CL15, keyset proposal PR #473, and other unmerged proposals remain separately governed/unapplied absent explicit review and approval; this receipt does not silently approve them.


## Critical conflicting V1 security receipt — OPEN / NOT CLEARED
A distinct historical operator report on 21 Nov recorded **V1 HTTP 200 with one protected row visible** under a purported No-access session; execution stopped before V2–V7. The later different real-session batch recorded **all seven HTTP 200 with no rows**. These are **conflicting results**, not a demonstrated security fix. Underlying canonical permissions for the actual JWT in the first test were not independently proven, so the earlier row could have been a legitimately authorised MCM read or an unintended disclosure; the facts do **not** establish either outcome.

**This potential exposure remains a separately OPEN security triage / no-unconditional-security-signoff condition.** The owner's WP12 conditional *workpackage* closure approval cannot, and does not, certify that V1 was authorised or harmless. See [original stop receipt](WP12_V1_POTENTIAL_UNAUTHORISED_READ_STOP_2026-11-21.md) and [later empty-result receipt](WP12_SEVEN_VIEW_AUTHENTICATED_NO_DISCLOSURE_2026-11-21.md). Receiver: authorised application security operator plus programme owner. Next step is identity/permission classification through an approved privacy-preserving operator check, **without repeating data-bearing production GETs**; if V1 was confirmed under denied canonical permission, escalate as a real security incident before further releases/access changes. Do not change RLS/view ownership or grants speculatively.

## Programme status and next priority
**WP00–WP12 CLOSED (13/13, 100%) with separately recorded bounded residual acceptance.** WP10 and WP12 closures are **conditional**; status is *formally completed with receiving obligations*, not unconditional global assurance.

The previously published and staff-installed **SASV Workspace v6.2.0** remains valid. Do not retroactively impose earlier pre-release HOLD language; no additional Electron release has been approved.

**Next programme focus B: read-only Supabase storage warning/retention and all-scheme comparison retirement dependency assessment**, using the existing [controlled handover](https://github.com/Brahmadathanu/sasv-workspace-dev/pull/491) and requiring separate authorization before any purge, DDL, or UI retirement. C: repository cleanup follows B, with prior cleanup gates intact. Neither B nor C was approved for destructive execution by this WP12 closure.

## Documentation governance
Receipt initially authored on draft documentation branch `docs/wp12-continuation-20261117` (PR #472). The owner subsequently explicitly authorised merging, and PR #472 was squash-merged into `main` as `28e38ff193867c61a89d3458f2813b994a8aec30`. The top-level `main` programme tracker now carries the formal 13/13 status and the explicitly unresolved V1 conflicting evidence. Historical documents are retained as dated observations rather than rewritten as if all tests passed.
